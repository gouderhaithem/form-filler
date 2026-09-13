import {test,expect,chromium} from '@playwright/test';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {mkdtemp,rm,cp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {attachPanel} from './helpers/native-panel';

test('resends with the website session, protected headers and original browser context',async()=>{
  test.setTimeout(60000);
  const requests:{origin?:string;referer?:string;cookie?:string;authorization?:string;csrf?:string;site?:string;body:string}[]=[];
  let base='';
  const server=createServer(async(req,res)=>{
    if(req.url==='/app' || req.url==='/other'){res.writeHead(200,{'Content-Type':'text/html','Set-Cookie':'session=fixture-session; HttpOnly; SameSite=Strict; Path=/'});res.end('<h1>Authenticated form</h1>');return;}
    if(req.url!=='/api/secure' && req.url!=='/api/slow'){res.writeHead(204);res.end();return;}
    let body='';for await(const chunk of req)body+=chunk;
    const received={origin:req.headers.origin,referer:req.headers.referer,cookie:req.headers.cookie,authorization:req.headers.authorization,csrf:req.headers['x-csrf-token'] as string,site:req.headers['sec-fetch-site'] as string,body};requests.push(received);
    if(req.url==='/api/slow')return;
    const accepted=received.origin===base && received.referer===`${base}/app` && received.cookie?.includes('session=fixture-session') && received.authorization==='Bearer fixture-auth' && received.csrf==='fixture-csrf';
    res.writeHead(accepted?201:403,{'Content-Type':'application/json'});res.end(JSON.stringify({message:accepted?'Authenticated customer saved':'Session or CSRF context mismatch'}));
  });
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const root=await mkdtemp(resolve(tmpdir(),'formly-session-')),extension=resolve(root,'extension');await cp(resolve('dist'),extension,{recursive:true});
  const manifest=JSON.parse(await readFile(resolve(extension,'manifest.json'),'utf8'));manifest.host_permissions.push('http://127.0.0.1/*');await writeFile(resolve(extension,'manifest.json'),JSON.stringify(manifest));
  const context=await chromium.launchPersistentContext(resolve(root,'profile'),{channel:'chromium',headless:true,args:['--enable-unsafe-extension-debugging',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  try{
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker'),id=worker.url().split('/')[2];
    const options=await context.newPage();await options.goto(`chrome-extension://${id}/index.html`);
    const website=await context.newPage();await website.goto(`${base}/app`);
    const tab=await worker.evaluate(async()=> (await chrome.tabs.query({active:true,lastFocusedWindow:true}))[0]);await options.evaluate(windowId=>chrome.sidePanel.open({windowId}),tab.windowId);
    const cdp=await context.browser()!.newBrowserCDPSession();let target:string|undefined;
    await expect.poll(async()=>{target=(await cdp.send('Target.getTargets')).targetInfos.find(t=>t.url.endsWith('/sidepanel.html'))?.targetId;return !!target;}).toBe(true);
    const panel=await attachPanel(cdp,target!);
    const settle=()=>panel.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    async function click(text:string){const selector=`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)})`;await expect.poll(()=>panel.evaluate(`!!(${selector}) && !(${selector}).disabled`)).toBe(true);await panel.evaluate(`(${selector}).click()`);await settle();}
    async function fill(selector:string,value:string){await panel.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await settle();}
    const editor=()=>panel.evaluate('document.querySelector(".request-editor")?.textContent || ""');
    await click('Requests');await click('Start recording');await expect.poll(()=>panel.evaluate('document.querySelector(".record-status").textContent')).toContain('Recording');
    await website.evaluate(async()=>{await fetch('/api/secure',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer fixture-auth','X-CSRF-Token':'fixture-csrf'},body:JSON.stringify({email:'original@example.com'})});});
    await expect.poll(()=>panel.evaluate('document.querySelectorAll(".request-row").length')).toBe(1);
    await panel.evaluate('document.querySelector(".request-row").click()');await expect.poll(()=>panel.evaluate('document.querySelector(".request-detail").textContent')).toContain('201');
    await click('Stop recording');await click('Edit & resend');
    expect(await panel.evaluate("document.querySelector('select[aria-label]').value")).toBe('website');
    expect(await editor()).toContain('Reuse captured authentication');
    const captured=await panel.evaluate('chrome.runtime.sendMessage({type:"network:get"}).then(r=>chrome.runtime.sendMessage({type:"network:get",selectedId:r.capture.entries[0].id})).then(r=>JSON.stringify(r))');expect(captured).not.toMatch(/fixture-auth|fixture-csrf|fixture-session/);
    await fill('.editor-body textarea','{"email":"edited@example.com"}');
    // Extension fetch can include cookies and auth yet still fail the site's Origin/Referer checks.
    await fill('[aria-label="Send from"]','extension');await panel.evaluate('document.querySelector(".editor-cookies:last-of-type input").click()');await settle();await click('Send');await expect.poll(editor).toContain('Session or CSRF context mismatch');
    await fill('[aria-label="Send from"]','website');await click('Send');await expect.poll(()=>panel.evaluate('document.querySelector(".replay-response>.payload")?.textContent || ""')).toContain('Authenticated customer saved');
    expect(requests[1]).toMatchObject({authorization:'Bearer fixture-auth',csrf:'fixture-csrf',cookie:'session=fixture-session'});
    expect(requests).toHaveLength(3);expect(requests[2]).toMatchObject({...requests[0],body:'{"email":"edited@example.com"}',site:'same-origin'});
    expect(await editor()).not.toMatch(/fixture-auth|fixture-csrf|fixture-session/);
    for(const width of [360,420,768]){await panel.send('Emulation.setDeviceMetricsOverride',{width,height:1200,deviceScaleFactor:1,mobile:false});await panel.evaluate('document.querySelector(".request-editor").scrollIntoView()');await settle();expect(await panel.evaluate('document.documentElement.scrollWidth<=innerWidth')).toBe(true);const shot=await panel.send('Page.captureScreenshot',{format:'png'});await writeFile(`test-results/session-replay-${width}.png`,Buffer.from(shot.data,'base64'));}
    await fill('.editor-address input',`${base}/api/slow`);await click('Send');await expect.poll(()=>requests.length).toBe(4);await click('Cancel');await expect.poll(editor).toContain('may already have reached the server');
    // Original authentication must not follow an edited URL to another origin, including another port.
    await fill('.editor-address input','http://127.0.0.1:1/api/secure');await click('Send');await expect.poll(editor).toContain('Turn off captured authentication');expect(requests).toHaveLength(4);
    await fill('.editor-address input',`${base}/api/secure`);await website.goto(`${base}/other`);await click('Send');await expect.poll(editor).toContain('source page changed');expect(requests).toHaveLength(4);
    expect(panel.errors).toEqual([]);
  }finally{await context.close();await rm(root,{recursive:true,force:true});server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));}
});
