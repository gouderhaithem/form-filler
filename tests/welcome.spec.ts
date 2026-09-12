import { test, expect, chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

test('welcome preview, settings links and responsive layouts',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('requestfailed',request=>errors.push(`${request.method()} ${request.url()}`));
  await page.setViewportSize({width:1280,height:960});
  await page.goto('/welcome.html');
  await expect(page.getByRole('heading',{name:'Less typing. More testing.'})).toBeVisible();
  await page.getByRole('button',{name:'Try a fill',exact:true}).click();
  await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('Maya Chen');
  await page.screenshot({path:'test-results/welcome-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Fill again',exact:true}).click();
  await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('Adam Parker');
  for(const [name,width] of [['tablet',768],['mobile',360]] as const) {
    await page.setViewportSize({width,height:900});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/welcome-${name}.png`,fullPage:true});
  }
  await page.getByRole('link',{name:'Choose exclusions'}).click();
  await expect(page.getByRole('button',{name:'Excluded fields',exact:true})).toHaveClass('selected');
  await page.goto('/welcome.html');
  await page.getByRole('link',{name:'Manage your cache'}).click();
  await expect(page.getByRole('heading',{name:'Suggestion cache',exact:true})).toBeInViewport();
  expect(errors).toEqual([]);
});

test('fresh installation opens the guide and extension reload does not reopen it',async()=>{
  const extensionPath=resolve('dist');
  const profile=await mkdtemp(resolve(tmpdir(),'formly-welcome-'));
  const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:['--enable-unsafe-extension-debugging',`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});
  try {
    const id=createHash('sha256').update(extensionPath).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await expect.poll(()=>context.pages().filter(page=>page.url()===`chrome-extension://${id}/welcome.html`).length).toBe(1);
    const welcome=context.pages().find(page=>page.url().endsWith('/welcome.html'))!;
    await expect(welcome.getByRole('heading',{name:'Less typing. More testing.'})).toBeVisible();
    const iconSizes=await welcome.evaluate(async()=>{
      const manifest=chrome.runtime.getManifest();
      return Promise.all(Object.entries(manifest.icons!).map(async([size,path])=>{
        const icon=new Image();icon.src=chrome.runtime.getURL(path);await icon.decode();
        return [Number(size),icon.naturalWidth,icon.naturalHeight];
      }));
    });
    expect(iconSizes).toEqual([[16,16,16],[32,32,32],[48,48,48],[128,128,128]]);
    await welcome.getByRole('link',{name:'Open settings',exact:true}).click();
    await expect(welcome.getByRole('button',{name:'Gemini',exact:true})).toHaveClass('selected');
    // CLI loading bypasses Chrome's Developer mode switch. Enable it in this disposable
    // profile so reloading behaves like the documented Load unpacked installation flow.
    const manager=await context.newPage();await manager.goto('chrome://extensions');
    const developerMode=manager.locator('extensions-toolbar').locator('#devMode');
    if(await developerMode.getAttribute('checked')===null) await developerMode.click();
    await expect(developerMode).toHaveAttribute('checked','');
    const closed=worker.waitForEvent('close');
    await worker.evaluate(()=>{setTimeout(()=>chrome.runtime.reload(),0);});
    await closed;
    // MV3 workers can stay idle after a reload; visiting Options wakes one with a message.
    const options=await context.newPage();
    // Navigation is briefly blocked while Chrome replaces the unloaded extension.
    await expect(async()=>{
      await options.goto(`chrome-extension://${id}/index.html`);
      await expect(options.getByLabel('API key',{exact:true})).toBeEnabled();
    }).toPass({timeout:10000,intervals:[100,250,500]});
    await expect(options.getByLabel('API key',{exact:true})).toBeEnabled();
    expect(context.pages().filter(page=>page.url().endsWith('/welcome.html'))).toHaveLength(0);
    const guidePromise=context.waitForEvent('page');
    await options.getByRole('link',{name:'Welcome guide'}).click();
    const guide=await guidePromise;
    await expect(guide.getByRole('heading',{name:'Less typing. More testing.'})).toBeVisible();
  } finally {await context.close();await rm(profile,{recursive:true,force:true});}
});
