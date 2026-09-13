import {test,expect,chromium} from '@playwright/test';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {mkdtemp,rm,cp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {attachPanel} from './helpers/native-panel';

test('edits and resends captured requests with real payloads, responses, and permission handling',async()=>{
  test.setTimeout(60000);
  const received:{url:string;method:string;body:string;header:string|undefined;cookie:string|undefined}[]=[];
  const server=createServer(async(req,res)=>{
    if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<h1>Customer form</h1>');return;}
    if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
    let body='';for await(const chunk of req)body+=chunk;
    received.push({url:req.url!,method:req.method!,body,header:req.headers['x-test'] as string|undefined,cookie:req.headers.cookie});
    if(req.url==='/slow')return;
    if(req.url==='/redirect'){res.writeHead(302,{Location:'/redirect-destination'});res.end();return;}
    res.writeHead(req.url?.startsWith('/invalid')?422:201,{'Content-Type':'application/json','X-Result':'local-fixture'});
    res.end(JSON.stringify({message:req.url?.startsWith('/invalid')?'Email rejected':'Customer saved',body:body?JSON.parse(body):null,token:'private-response-token'}));
  });
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const root=await mkdtemp(resolve(tmpdir(),'formly-editor-')),extension=resolve(root,'extension');await cp(resolve('dist'),extension,{recursive:true});
  // Headless Chrome cannot operate the native site permission bubble: grant this local fixture only.
  const manifest=JSON.parse(await readFile(resolve(extension,'manifest.json'),'utf8'));manifest.host_permissions.push('http://127.0.0.1/*');await writeFile(resolve(extension,'manifest.json'),JSON.stringify(manifest));
  const context=await chromium.launchPersistentContext(resolve(root,'profile'),{channel:'chromium',headless:true,args:['--enable-unsafe-extension-debugging',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  try{
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker'),id=worker.url().split('/')[2];
    const options=await context.newPage();await options.goto(`chrome-extension://${id}/index.html`);
    const website=await context.newPage();await website.goto(base);
    const tab=await worker.evaluate(async()=> (await chrome.tabs.query({active:true,lastFocusedWindow:true}))[0]);await options.evaluate(windowId=>chrome.sidePanel.open({windowId}),tab.windowId);
    const cdp=await context.browser()!.newBrowserCDPSession();let target:string|undefined;
    await expect.poll(async()=>{target=(await cdp.send('Target.getTargets')).targetInfos.find(t=>t.url.endsWith('/sidepanel.html'))?.targetId;return !!target;}).toBe(true);
    const panel=await attachPanel(cdp,target!);
    async function click(text:string){const selector=`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)})`;await expect.poll(()=>panel.evaluate(`!!(${selector}) && !(${selector}).disabled`)).toBe(true);await panel.evaluate(`(${selector}).click()`);await settle();}
    const settle=()=>panel.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    async function fill(selector:string,value:string){await panel.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await settle();}
    const editor=()=>panel.evaluate('document.querySelector(".request-editor")?.textContent || ""');
    await click('Requests');await click('Start recording');
    await expect.poll(()=>panel.evaluate('document.querySelector(".record-status").textContent')).toContain('Recording');
    await website.evaluate(async()=>{await fetch('/api/customers?source=website',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'original@example.com',password:'private-password'})});});
    await expect.poll(()=>panel.evaluate('document.querySelectorAll(".request-row").length')).toBe(1);
    await panel.evaluate('document.querySelector(".request-row").click()');
    await expect.poll(()=>panel.evaluate('document.querySelector(".request-detail").textContent')).toContain('original@example.com');
    await click('Stop recording');await click('Edit & resend');
    await fill('[aria-label="Send from"]','extension');
    await click('Send');await expect.poll(editor).toContain('Replace or remove hidden values');expect(received).toHaveLength(1);
    await fill('.editor-address input',`${base}/api/edited?source=panel`);
    await fill('.editor-address select','PATCH');
    await fill('.editor-body textarea','{"email":"edited@example.com"}');
    await click('Params');await fill('[aria-label="Parameters value 1"]','resend');
    await click('Headers');await click('Add header');
    await fill('[aria-label="Headers name 2"]','X-Test');await fill('[aria-label="Headers value 2"]','edited-header');
    // A denied permission must never issue a network request.
    await panel.evaluate('window.savedPermissionRequest=chrome.permissions.request;chrome.permissions.request=async()=>false');
    await click('Send');await expect.poll(editor).toContain('Website access was declined');expect(received).toHaveLength(1);
    await panel.evaluate('chrome.permissions.request=window.savedPermissionRequest');
    await context.addCookies([{name:'test_session',value:'fixture',url:base}]);
    await click('Body');await click('Send');
    await expect.poll(()=>panel.evaluate('document.querySelector(".replay-response")?.textContent || ""')).toContain('Customer saved');
    expect(received[1]).toMatchObject({url:'/api/edited?source=resend',method:'PATCH',body:'{"email":"edited@example.com"}',header:'edited-header',cookie:undefined});
    expect(await editor()).not.toContain('private-response-token');
    expect(await panel.evaluate('document.querySelector(".request-detail").textContent')).toContain('original@example.com');
    await panel.evaluate('Array.from(document.querySelectorAll("summary")).find(e=>e.textContent==="Original response").click()');
    expect(await editor()).toContain('original@example.com');
    for(const width of [360,420,768]){
      await panel.send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});
      await panel.evaluate('document.querySelector(".request-editor").scrollIntoView()');await settle();
      expect(await panel.evaluate('document.documentElement.scrollWidth<=innerWidth')).toBe(true);
      const shot=await panel.send('Page.captureScreenshot',{format:'png'});await writeFile(`test-results/request-editor-${width}.png`,Buffer.from(shot.data,'base64'));
    }
    await panel.evaluate('document.querySelector(".editor-cookies input").click()');await settle();
    await fill('.editor-address input',`${base}/invalid`);await click('Send');
    await expect.poll(editor).toContain('Email rejected');expect(await editor()).toContain('422');expect(received[2].cookie).toBe('test_session=fixture');
    await fill('.editor-address input',`${base}/redirect`);await click('Send');await expect.poll(editor).toContain('Redirect stopped');expect(received.some(item=>item.url==='/redirect-destination')).toBe(false);
    await fill('.editor-address input',`${base}/slow`);await click('Send');await expect.poll(()=>received.some(item=>item.url==='/slow')).toBe(true);await click('Cancel');await expect.poll(editor).toContain('may already have reached the server');
    expect(await panel.evaluate('document.querySelectorAll(".replay-response .replay-history option").length')).toBe(4);
    await click('Close editor');expect(await editor()).toBe('');expect(panel.errors).toEqual([]);
  }finally{await context.close();await rm(root,{recursive:true,force:true});server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));}
});
