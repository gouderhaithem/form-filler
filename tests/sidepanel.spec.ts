import {test,expect,chromium,type CDPSession} from '@playwright/test';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';

// Native side panels are separate CDP targets, not ordinary Playwright tabs.
async function attachPanel(cdp:CDPSession,targetId:string) {
  const {sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:false});
  let next=0;
  const errors:string[]=[];
  const waiting=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void}>();
  cdp.on('Target.receivedMessageFromTarget',event=>{
    if(event.sessionId!==sessionId)return;
    const reply=JSON.parse(event.message);
    if(reply.method==='Runtime.exceptionThrown')errors.push(reply.params.exceptionDetails.text);
    const pending=waiting.get(reply.id);
    if(!pending)return;
    waiting.delete(reply.id);
    if(reply.error)pending.reject(new Error(reply.error.message));else pending.resolve(reply.result);
  });
  async function send(method:string,params:Record<string,unknown>={}) {
    const id=++next;
    const promise=new Promise<any>((resolve,reject)=>waiting.set(id,{resolve,reject}));
    await cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method,params})});
    return promise;
  }
  async function evaluate(expression:string){
    const reply=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
    if(reply.exceptionDetails)throw new Error(reply.exceptionDetails.exception?.description || reply.exceptionDetails.text);
    return reply.result.value;
  }
  await send('Runtime.enable');
  return {send,evaluate,errors};
}

test('native panel inspects, fills, edits rules, excludes, undoes, and follows navigation',async()=>{
  test.setTimeout(60000);
  const profile=await mkdtemp(resolve(tmpdir(),'formly-panel-test-'));
  const extension=resolve('dist');
  const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:['--enable-unsafe-extension-debugging',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  try{
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id=worker.url().split('/')[2];
    const options=await context.newPage();await options.goto(`chrome-extension://${id}/index.html`);
    const website=await context.newPage();await website.goto('http://127.0.0.1:5188/demo.html');
    const cdp=await context.browser()!.newBrowserCDPSession();
    const {targetInfos}=await cdp.send('Target.getTargets',{filter:[{type:'tab',exclude:false},{exclude:true}]});
    const target=targetInfos.find(t=>t.url===website.url())!;
    await cdp.send('Extensions.triggerAction',{id,targetId:target.targetId});
    await expect(website.locator('#first')).not.toHaveValue('');
    const tab=await worker.evaluate(async()=> (await chrome.tabs.query({active:true,lastFocusedWindow:true}))[0]);
    expect(await worker.evaluate(async()=> (await chrome.commands.getAll()).find(command=>command.name==='open-panel')?.shortcut)).toBe('Alt+Shift+F');
    // Headless input does not route browser accelerators. Open the real native panel with a user gesture.
    await options.evaluate(windowId=>chrome.sidePanel.open({windowId}),tab.windowId);
    await website.bringToFront();
    let panelTarget:string|undefined;
    await expect.poll(async()=>{panelTarget=(await cdp.send('Target.getTargets')).targetInfos.find(t=>t.url.endsWith('/sidepanel.html'))?.targetId;return !!panelTarget;}).toBe(true);
    const panel=await attachPanel(cdp,panelTarget!);
    await expect.poll(()=>panel.evaluate('document.querySelectorAll(".field-row").length')).toBeGreaterThan(5);
    await expect.poll(()=>panel.evaluate('document.querySelector(".results-heading").textContent')).toContain('filled');
    expect(await panel.evaluate('document.body.textContent')).toContain('Password filling disabled');
    async function clickButton(text:string){const selector=`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)})`;await expect.poll(()=>panel.evaluate(`!!(${selector}) && !(${selector}).disabled`)).toBe(true);await panel.evaluate(`(${selector}).click()`);await panel.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await expect.poll(()=>panel.evaluate('document.querySelector(".primary").disabled')).toBe(false);}
    async function clickField(label:string){const selector=`Array.from(document.querySelectorAll('.field-row')).find(b=>b.querySelector('strong').textContent===${JSON.stringify(label)})`;await expect.poll(()=>panel.evaluate(`!!(${selector}) && !(${selector}).disabled`)).toBe(true);await panel.evaluate(`(${selector}).click()`);await panel.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await expect.poll(()=>panel.evaluate('document.querySelector(".primary").disabled')).toBe(false);}
    await clickField('Project code');
    await expect.poll(()=>panel.evaluate('!!document.querySelector("#field-value")')).toBe(true);
    await panel.evaluate(`(()=>{const el=document.querySelector('#field-value');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'PRJ-PANEL');el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await clickButton('Save field rule');
    await expect.poll(()=>panel.evaluate('document.body.textContent')).toContain('Custom value saved');
    await clickButton('Fill again');
    await expect(website.locator('#project-code')).toHaveValue('PRJ-PANEL');
    await clickField('Project code');
    await clickButton('Exclude this field');
    await expect.poll(()=>panel.evaluate('document.body.textContent')).toContain('This field will be skipped');
    await website.locator('#project-code').fill('Keep this');
    await clickButton('Fill again');
    await expect.poll(()=>panel.evaluate('document.querySelector(".primary").disabled')).toBe(false);
    await expect(website.locator('#project-code')).toHaveValue('Keep this');
    for(const width of [360,420,768]) {
      await panel.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      expect(await panel.evaluate('document.documentElement.scrollWidth<=innerWidth')).toBe(true);
      const shot=await panel.send('Page.captureScreenshot',{format:'png'});
      await writeFile(`test-results/sidepanel-${width}.png`,Buffer.from(shot.data,'base64'));
    }
    const name=await website.locator('#first').inputValue();
    await clickButton('Fill again');
    await expect(website.locator('#first')).not.toHaveValue(name);
    await website.locator('#email').fill('manual@example.com');
    await clickButton('Undo last fill');
    await expect(website.locator('#first')).toHaveValue(name);
    await expect(website.locator('#email')).toHaveValue('manual@example.com');
    await expect.poll(()=>panel.evaluate('document.querySelector(".undo").disabled')).toBe(true);
    const oldDocument=await panel.evaluate('document.querySelector("main").dataset.documentId');
    await website.reload();
    await expect.poll(()=>panel.evaluate('document.querySelector("main").dataset.documentId || null')).not.toBe(oldDocument);
    await expect.poll(()=>panel.evaluate('!!document.querySelector("main").dataset.documentId')).toBe(true);
    await expect.poll(()=>panel.evaluate('document.querySelector(".undo").disabled')).toBe(true);
    await expect.poll(()=>panel.evaluate('document.querySelector(".results-heading").textContent')).toContain('0 filled');
    await clickButton('Fill this page');
    await expect(website.locator('#first')).not.toHaveValue('');
    const fresh=await context.newPage();await fresh.goto('http://127.0.0.1:5188/dynamic-form.html');
    await expect.poll(()=>panel.evaluate('document.body.textContent')).toContain('Page access needed');
    await fresh.close();await website.bringToFront();
    await expect.poll(()=>panel.evaluate('document.querySelectorAll(".field-row").length')).toBeGreaterThan(5);
    await website.goto('chrome://extensions');
    await expect.poll(()=>panel.evaluate('document.body.textContent')).toContain('This page does not support filling');
    expect(panel.errors).toEqual([]);
  }finally{await context.close();await rm(profile,{recursive:true,force:true});}
});
