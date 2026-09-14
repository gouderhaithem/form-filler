import {test,expect,chromium} from '@playwright/test';
import {mkdtemp,rm,cp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';

test('prepares late forms before clicks and fills immediately while AI is pending',async()=>{
  test.setTimeout(60000);
  const root=await mkdtemp(resolve(tmpdir(),'formly-preload-')),extension=resolve(root,'extension');await cp(resolve('dist'),extension,{recursive:true});
  const manifest=JSON.parse(await readFile(resolve(extension,'manifest.json'),'utf8'));manifest.host_permissions.push('http://*/*','https://*/*');await writeFile(resolve(extension,'manifest.json'),JSON.stringify(manifest));
  const context=await chromium.launchPersistentContext(resolve(root,'profile'),{channel:'chromium',headless:true,args:['--enable-unsafe-extension-debugging',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  try{
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker'),id=worker.url().split('/')[2];
    await worker.evaluate(()=>{
      const state=globalThis as typeof globalThis & {requests:{fields:{id:string;label:string}[]}[];release?:()=>void};state.requests=[];
      globalThis.fetch=async(_input,init)=>{
        if(!init?.body)return new Response(JSON.stringify({models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']}]}));
        const metadata=JSON.parse(JSON.parse(String(init.body)).contents[0].parts[0].text);state.requests.push(metadata);
        return new Promise<Response>(done=>{state.release=()=>done(new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({fields:metadata.fields.map((field:{id:string})=>({id:field.id,values:['Cedar','Maple','Willow','Birch']}))})}]}}]})));});
      };
    });
    const website=await context.newPage();await website.route('**/preload-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Lazy form</title><main id="app"></main><p id="clock"></p>'}));await website.goto('http://127.0.0.1:5188/preload-fixture');
    const options=await context.newPage();await options.goto(`chrome-extension://${id}/index.html`);
    await options.getByLabel('API key',{exact:true}).fill('fake-key-for-local-tests');await options.getByLabel('Use Gemini for unknown fields').check();await options.getByRole('button',{name:'Save settings',exact:true}).click();await expect(options.getByRole('status')).toContainText('Suggestions prepare automatically');
    await website.bringToFront();
    const requests=()=>worker.evaluate(()=>(globalThis as typeof globalThis & {requests:unknown[]}).requests);
    expect(await requests()).toHaveLength(0);
    await website.evaluate(()=>{document.querySelector('#app')!.innerHTML='<form><label>Project codename<input id="project" name="projectCode"></label></form>';});
    await expect.poll(async()=>(await requests()).length).toBe(1);
    await expect(website.locator('#project')).toHaveValue('');
    // A second form appears while the first batch is still waiting on Gemini.
    await website.evaluate(()=>{document.querySelector('form')!.insertAdjacentHTML('beforeend','<label>Campaign concept<input id="campaign" name="campaignConcept"></label>');});
    const cdp=await context.browser()!.newBrowserCDPSession();
    const targets=(await cdp.send('Target.getTargets',{filter:[{type:'tab',exclude:false},{exclude:true}]})).targetInfos;
    const target=targets.find(t=>t.url===website.url())!;
    await cdp.send('Extensions.triggerAction',{id,targetId:target.targetId});
    await expect(website.locator('#project')).not.toHaveValue('',{timeout:1500});await expect(website.locator('#campaign')).not.toHaveValue('');
    expect(await requests()).toHaveLength(1);
    await worker.evaluate(()=>(globalThis as typeof globalThis & {release?:()=>void}).release?.());
    await expect.poll(async()=>(await requests()).length).toBe(2);
    expect((await requests())[1]).toMatchObject({fields:[{label:'Campaign concept'}]});
    // Consume the first field's cached data while the second field is still generating.
    await cdp.send('Extensions.triggerAction',{id,targetId:target.targetId});await expect(website.locator('#project')).toHaveValue('Cedar');
    await expect.poll(()=>worker.evaluate(async()=>Object.values(await chrome.storage.session.get(null)).filter((entry:any)=>entry?.values).flatMap((entry:any)=>Object.values(entry.values)).some((values:any)=>values[0]==='Maple'))).toBe(true);
    await worker.evaluate(()=>(globalThis as typeof globalThis & {release?:()=>void}).release?.());
    await expect.poll(()=>worker.evaluate(async()=>Object.values(await chrome.storage.session.get(null)).filter((entry:any)=>entry?.values).flatMap((entry:any)=>Object.keys(entry.values)).length)).toBe(2);
    await cdp.send('Extensions.triggerAction',{id,targetId:target.targetId});await expect(website.locator('#project')).toHaveValue('Maple');expect(await requests()).toHaveLength(2);
    // Typing or unrelated page activity must not ask Gemini for another batch.
    await website.locator('#project').fill('PRIVATE ENTERED VALUE');
    await website.evaluate(()=>{for(let i=0;i<10;i++)document.querySelector('#clock')!.textContent=String(i);});
    await website.waitForTimeout(1200);expect(await requests()).toHaveLength(2);expect(JSON.stringify(await requests())).not.toContain('PRIVATE ENTERED VALUE');
    // Turning Gemini off removes future injections and stops preparation on an already open page.
    await options.getByLabel('Use Gemini for unknown fields').uncheck();await options.getByRole('button',{name:'Save settings',exact:true}).click();await expect(options.getByRole('status')).toContainText('Local generation is active');
    expect(await worker.evaluate(()=>chrome.scripting.getRegisteredContentScripts())).toEqual([]);
    await website.evaluate(()=>{document.querySelector('form')!.insertAdjacentHTML('beforeend','<label>Research direction<input name="researchDirection"></label>');});
    await website.waitForTimeout(1200);expect(await requests()).toHaveLength(2);
  }finally{await context.close();await rm(root,{recursive:true,force:true});}
});
