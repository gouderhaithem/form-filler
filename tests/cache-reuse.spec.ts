import { test, expect, chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { mkdtemp, rm, cp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

// A form that reveals a field once it is filled used to change every scanned field's identity, which
// orphaned the cached batch and sent a fresh Gemini request on every single toolbar click.
test('a form that grows after filling keeps reusing its cached suggestions',async()=>{
  test.setTimeout(90000);
  const root=await mkdtemp(resolve(tmpdir(),'formly-cache-'));
  const path=resolve(root,'extension'),profile=resolve(root,'profile');
  await cp(resolve('dist'),path,{recursive:true});
  // Headless Chrome cannot operate its native permission bubble. Pregrant site access in this copy only.
  const manifest=JSON.parse(await readFile(resolve(path,'manifest.json'),'utf8'));
  manifest.host_permissions.push('http://*/*','https://*/*');
  await writeFile(resolve(path,'manifest.json'),JSON.stringify(manifest));
  const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:['--enable-unsafe-extension-debugging',`--disable-extensions-except=${path}`,`--load-extension=${path}`]});
  try {
    const id=createHash('sha256').update(path).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    // Mock only Google's responses, recording which fields each batch actually asked for.
    await worker.evaluate(()=>{
      const state=globalThis as typeof globalThis & {testRequests:string[][]};state.testRequests=[];
      globalThis.fetch=async(input,init)=>{
        if(!String(input).startsWith('https://generativelanguage.googleapis.com/')) throw new Error('Unexpected request');
        if(!init?.body) return new Response(JSON.stringify({models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']}]}));
        const metadata=JSON.parse(JSON.parse(String(init.body)).contents[0].parts[0].text) as {fields:{id:string;label:string;type:string}[]};
        state.testRequests.push(metadata.fields.map(field=>field.label));
        const words=['Cedar','Maple','Willow','Birch','Oak','Pine','Elm','Ash','Palm','Olive'];
        return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({fields:metadata.fields.map(field=>({id:field.id,values:words}))})}]}}]}));
      };
    });
    const options=await context.newPage();
    await options.goto(`chrome-extension://${id}/index.html`);
    await options.getByLabel('API key',{exact:true}).fill('fake-key-for-local-tests');
    await options.getByRole('button',{name:'Test key',exact:true}).click();
    await expect(options.getByRole('status')).toContainText('Key accepted');
    await options.getByLabel('Use Gemini for unknown fields').check();
    await options.getByRole('button',{name:'Save settings',exact:true}).click();
    await expect(options.getByRole('status')).toContainText('Reload a website');

    const website=await context.newPage();
    await website.goto('http://127.0.0.1:5188/dynamic-form.html');
    const requests=()=>worker.evaluate(()=>(globalThis as typeof globalThis & {testRequests:string[][]}).testRequests);
    await expect.poll(async()=>(await requests()).length).toBe(1);
    const expiresAt=await worker.evaluate(async()=>Object.entries(await chrome.storage.session.get(null)).find(([key])=>key.startsWith('gemini-cache:'))![1].expiresAt);

    const cdp=await context.browser()!.newBrowserCDPSession();
    const {targetInfos}=await cdp.send('Target.getTargets',{filter:[{type:'tab',exclude:false},{exclude:true}]});
    const target=targetInfos.find(t=>t.url===website.url())!;

    const tabId=await worker.evaluate(async()=> (await chrome.tabs.query({active:true,lastFocusedWindow:true}))[0].id!);
    async function fillAndWait(expected:string) {
      // The DOM changes before the worker finishes saving its cache and releasing the fill lock.
      await worker.evaluate(tabId=>chrome.action.setTitle({tabId,title:'Waiting for fill completion'}),tabId);
      await cdp.send('Extensions.triggerAction',{id,targetId:target.targetId});
      await expect(website.locator('#project-code')).toHaveValue(expected);
      await expect.poll(()=>worker.evaluate(tabId=>chrome.action.getTitle({tabId}),tabId)).toMatch(/^Formly: \d+ filled,/);
    }

    // Filling reveals "Confirm project code", so the scanned form is no longer the one Gemini saw.
    await fillAndWait('Cedar');
    await expect(website.locator('#confirm-code')).toHaveValue('');

    // The revealed field is the only thing worth asking about; the originals keep their cached values.
    await fillAndWait('Maple');
    await expect(website.locator('#confirm-code')).toHaveValue('Cedar');
    expect(await requests()).toEqual([['Project code name','Why are you interested?'],['Confirm project code']]);
    expect(await worker.evaluate(async()=>Object.entries(await chrome.storage.session.get(null)).find(([key])=>key.startsWith('gemini-cache:'))![1].expiresAt)).toBe(expiresAt);

    // The settled form must now fill entirely from cache, however often it is clicked.
    for(const expected of ['Willow','Birch','Oak']) {
      await fillAndWait(expected);
    }
    expect((await requests()).length).toBe(2);
    await expect.poll(()=>worker.evaluate(async()=>Object.keys(await chrome.storage.session.get(null)).filter(key=>key.startsWith('gemini-cache:')).length)).toBe(1);
  } finally {
    await context.close();
    await rm(root,{recursive:true,force:true});
  }
});
