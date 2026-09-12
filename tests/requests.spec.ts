import {test,expect,chromium} from '@playwright/test';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {attachPanel} from './helpers/native-panel';

test('records real submissions and responses in the native Requests panel',async()=>{
  test.setTimeout(60000);
  const server=createServer(async(req,res)=>{
    if(req.url==='/') {res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html><head><title>Customer test form</title></head><body><form id="customer"><label>Full name<input name="name" value="Maya Chen"></label><label>Email<input name="email" value="maya@example.com"></label><button>Submit customer</button></form><p id="result"></p><script>document.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.target));values.password='private-password';const response=await fetch('/api/customers',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer private-token'},body:JSON.stringify(values)});document.querySelector('#result').textContent=await response.text();});</script></body></html>`);return;}
    if(req.url==='/api/customers'){for await(const _ of req){}res.writeHead(201,{'Content-Type':'application/json','Set-Cookie':'private-cookie=yes'});res.end(JSON.stringify({id:42,message:'Customer created',accessToken:'private-response-token'}));return;}
    if(req.url==='/api/invalid'){res.writeHead(422,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Email already exists'}));return;}
    if(req.url==='/api/large'){res.writeHead(200,{'Content-Type':'text/plain'});res.end('A'.repeat(80*1024));return;}
    if(req.url==='/api/broken'){req.socket.destroy();return;}
    if(req.url==='/redirect'){res.writeHead(302,{Location:'/thanks'});res.end();return;}
    if(req.url==='/thanks'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<h1>Thank you</h1>');return;}
    res.writeHead(404);res.end();
  });
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const profile=await mkdtemp(resolve(tmpdir(),'formly-requests-')),extension=resolve('dist');
  const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:['--enable-unsafe-extension-debugging',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  try{
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker'),id=worker.url().split('/')[2];
    const options=await context.newPage();await options.goto(`chrome-extension://${id}/index.html`);
    const website=await context.newPage();await website.goto(base);
    const tab=await worker.evaluate(async()=> (await chrome.tabs.query({active:true,lastFocusedWindow:true}))[0]);
    await options.evaluate(windowId=>chrome.sidePanel.open({windowId}),tab.windowId);
    const cdp=await context.browser()!.newBrowserCDPSession();let target:string|undefined;
    await expect.poll(async()=>{target=(await cdp.send('Target.getTargets')).targetInfos.find(t=>t.url.endsWith('/sidepanel.html'))?.targetId;return !!target;}).toBe(true);
    const panel=await attachPanel(cdp,target!);
    async function click(text:string){const selector=`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)})`;await expect.poll(()=>panel.evaluate(`!!(${selector}) && !(${selector}).disabled`)).toBe(true);await panel.evaluate(`(${selector}).click()`);await panel.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
    const body=()=>panel.evaluate('document.querySelector(".requests-panel").textContent');
    await click('Requests');
    await website.getByRole('button',{name:'Submit customer'}).click();
    expect(await panel.evaluate('document.querySelectorAll(".request-row").length')).toBe(0);
    await click('Start recording');
    await expect.poll(body).toContain('Stop recording');
    await website.getByRole('button',{name:'Submit customer'}).click();
    await expect.poll(()=>panel.evaluate('document.querySelectorAll(".request-row").length')).toBe(1);
    await panel.evaluate('document.querySelector(".request-row").click()');
    await expect.poll(body).toContain('Maya Chen');
    expect(await body()).not.toMatch(/private-password|private-token/);
    await click('Response');
    await expect.poll(body).toContain('Customer created');
    expect(await body()).toContain('201');expect(await body()).not.toContain('private-response-token');
    for(const width of [360,420,768]){
      await panel.send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});
      expect(await panel.evaluate('document.documentElement.scrollWidth<=innerWidth')).toBe(true);
      const shot=await panel.send('Page.captureScreenshot',{format:'png'});await writeFile(`test-results/requests-${width}.png`,Buffer.from(shot.data,'base64'));
    }
    await website.evaluate(async()=>{await fetch('/api/invalid');await fetch('/api/large');await fetch('/api/broken').catch(()=>{});});
    await expect.poll(()=>panel.evaluate('document.querySelectorAll(".request-row").length')).toBe(4);
    await panel.evaluate(`Array.from(document.querySelectorAll('.request-row')).find(b=>b.textContent.includes('/api/invalid')).click()`);
    await expect.poll(body).toContain('Email already exists');expect(await body()).toContain('422');
    await panel.evaluate(`Array.from(document.querySelectorAll('.request-row')).find(b=>b.textContent.includes('/api/large')).click()`);
    await expect.poll(body).toContain('64 KB');
    await panel.evaluate(`Array.from(document.querySelectorAll('.request-row')).find(b=>b.textContent.includes('/api/broken')).click()`);
    await expect.poll(body).toContain('Network error');
    await website.goto(`${base}/redirect`);
    await expect.poll(()=>panel.evaluate('document.querySelectorAll(".request-row").length')).toBe(6);
    await panel.evaluate(`Array.from(document.querySelectorAll('.request-row')).find(b=>b.textContent.includes('/redirect')).click()`);
    await expect.poll(body).toContain('302');
    await click('Stop recording');
    await website.evaluate(async()=>{await fetch('/api/invalid');});
    expect(await panel.evaluate('document.querySelectorAll(".request-row").length')).toBe(6);
    await panel.evaluate(`document.querySelector('[aria-label="Clear request history"]').click()`);
    await expect.poll(()=>panel.evaluate('document.querySelectorAll(".request-row").length')).toBe(0);
    await click('Start recording');
    await expect.poll(body).toContain('Stop recording');
    const other=await context.newPage();await other.goto(base);
    await expect.poll(body).toContain('switched tabs');
    await other.close();await website.bringToFront();
    await click('Start recording');await expect.poll(body).toContain('Stop recording');
    await website.close();
    await expect.poll(body).not.toContain('Stop recording');
    await expect.poll(()=>panel.evaluate('document.querySelectorAll(".request-row").length')).toBe(0);
    expect(panel.errors).toEqual([]);
  }finally{await context.close();await rm(profile,{recursive:true,force:true});server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));}
});
