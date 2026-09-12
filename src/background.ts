import './network-background';
import { panelPageAction } from './panel-page';
import { generateIdentities, generateValues, validateSettings, type Settings } from './data';
import { generateSamples } from './samples';
import { fillPage, type FillRequest, type FillResult, type SuggestedField } from './engine';
import { digest, generateSuggestions, listModels, liveBatch, validateGemini, validCacheMinutes, type CachedBatch, type GeminiConfig } from './gemini';

const filling = new Set<number>();
const CACHE_PREFIX='gemini-cache:';
const ALARM='gemini-cache-expiry';
// A tab keeps one batch per origin, so cap how many field signatures it may accumulate as the user
// moves between forms. The fields of the form in front of the user always win a slot.
const MAX_BATCH_FIELDS=120;
let cacheEpoch=0;
const pendingBatches=new Map<string,Promise<CachedBatch>>();
const prewarming=new Set<number>();
const queuedReloads=new Map<number,chrome.tabs.Tab>();
const protectStorage=chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});

async function pruneCache() {
  const stored=await chrome.storage.session.get(null);
  const expired=Object.keys(stored).filter(key=>key.startsWith(CACHE_PREFIX)&&!liveBatch(stored[key]));
  if(expired.length) await chrome.storage.session.remove(expired);
  const active=Object.entries(stored).filter(([key,value])=>key.startsWith(CACHE_PREFIX)&&liveBatch(value));
  if(active.length>24) {
    const excess=active.sort((a,b)=>(a[1] as CachedBatch).expiresAt-(b[1] as CachedBatch).expiresAt).splice(0,active.length-24);
    await chrome.storage.session.remove(excess.map(([key])=>key));
  }
  if(active.length) await chrome.alarms.create(ALARM,{when:Math.min(...active.map(([,value])=>(value as CachedBatch).expiresAt))});
  else await chrome.alarms.clear(ALARM);
  return active;
}
async function clearCache() {
  cacheEpoch++;
  pendingBatches.clear();
  const stored=await chrome.storage.session.get(null);
  await chrome.storage.session.remove(Object.keys(stored).filter(key=>key.startsWith(CACHE_PREFIX)));
  await chrome.alarms.clear(ALARM);
}
async function status() {
  const active=await pruneCache();
  const {geminiStatus}=await chrome.storage.session.get('geminiStatus');
  return {batches:active.length,suggestions:active.reduce((total,[,value])=>total+Object.values((value as CachedBatch).values).reduce((sum,values)=>sum+values.length,0),0),expiresAt:active.length?Math.min(...active.map(([,value])=>(value as CachedBatch).expiresAt)):null,lastMessage:typeof geminiStatus==='string'?geminiStatus:''};
}

async function prepareBatch(tabId:number,request:FillRequest,settings:Settings,config:GeminiConfig,epoch:number) {
  const scans=await chrome.scripting.executeScript({target:{tabId},func:fillPage,args:[{...request,mode:'scan'}]});
  const scan=scans[0]?.result;
  if(!scan) throw new Error('The form could not be inspected. Local filling is still available.');
  if(request.expectedDocument && request.expectedDocument!==scan.documentId) throw new Error('The page changed. Refresh the field list.');
  request.expectedDocument=scan.documentId;
  const fields=scan.unknown || [];
  if(!fields.length) return {scan,note:'All fields handled by the local generator.'};
  await pruneCache();
  // Key on the page and Gemini settings only. Field metadata shifts whenever a page reveals a field or
  // rewrites a label, and folding it into the key orphaned the whole batch on every such change.
  const cacheKey=`${CACHE_PREFIX}${tabId}:${await digest([scan.origin,settings.locale,config.model,await digest(config.apiKey)])}`;
  const cached=liveBatch((await chrome.storage.session.get(cacheKey))[cacheKey]);
  // Suggestions are stored per field signature so a field keeps its remaining values even when the
  // surrounding form changes, and only genuinely new or exhausted fields cost a request.
  const missing=fields.filter(field=>!cached?.values[field.signature!]?.length);
  if(!missing.length) return {scan,cacheKey,batch:cached,note:'Used cached Gemini suggestions.'};
  const pendingKey=`${cacheKey}:${await digest(missing.map(field=>field.signature))}`;
  let work=pendingBatches.get(pendingKey);
  if(!work) {
    work=(async()=>{
      const generated=await generateSuggestions(config,missing,settings.locale);
      if(epoch!==cacheEpoch) throw new Error('Gemini settings or cache changed. Local values were used.');
      const latest=liveBatch((await chrome.storage.session.get(cacheKey))[cacheKey]);
      const values:Record<string,string[]>={};
      for(const field of fields) {
        const suggested=generated[field.id] ?? latest?.values[field.signature!];
        if(suggested?.length) values[field.signature!]=suggested;
      }
      for(const [signature,suggested] of Object.entries(latest?.values || {})) {
        if(Object.keys(values).length>=MAX_BATCH_FIELDS) break;
        if(!(signature in values) && suggested.length) values[signature]=suggested;
      }
      // Adding fields must not keep older suggestions alive beyond their original deadline.
      const fresh={expiresAt:latest?.expiresAt ?? Date.now()+config.cacheMinutes*60*1000,values};
      if(epoch!==cacheEpoch) throw new Error('Gemini settings or cache changed. Local values were used.');
      await chrome.storage.session.set({[cacheKey]:fresh});
      await pruneCache();
      return fresh;
    })();
    pendingBatches.set(pendingKey,work);
  }
  let batch:CachedBatch;
  try{batch=await work;}finally{if(pendingBatches.get(pendingKey)===work) pendingBatches.delete(pendingKey);}
  return {scan,cacheKey,batch,note:cached?'Gemini added suggestions for the new fields.':'Gemini generated a fresh batch.'};
}

async function prepareOnReload(tabId:number,tab:chrome.tabs.Tab) {
  if(!tab.url || !/^https?:/.test(tab.url)) return;
  if(prewarming.has(tabId)){queuedReloads.set(tabId,tab);return;}
  prewarming.add(tabId);
  try {
    await protectStorage;
    const stored=await chrome.storage.local.get(['settings','gemini']);
    const settings=validateSettings(stored.settings),config=validateGemini(stored.gemini);
    if(!config.enabled || !config.apiKey || !settings.fillUnknown) return;
    const epoch=cacheEpoch;
    const prepared=await prepareBatch(tabId,{...settings,values:generateValues(settings.locale)},settings,config,epoch);
    if(epoch===cacheEpoch) await chrome.storage.session.set({geminiStatus:prepared.batch?'Gemini suggestions are ready. Click Formly to fill.':prepared.note});
  } catch(error) {
    await chrome.storage.session.set({geminiStatus:error instanceof Error?`${error.message} Local fallback is available.`:'Gemini preparation failed. Local fallback is available.'});
  } finally {
    prewarming.delete(tabId);
    const queued=queuedReloads.get(tabId);queuedReloads.delete(tabId);
    if(queued) void prepareOnReload(tabId,queued).catch(()=>{});
  }
}

async function fillClickedTab(tab: chrome.tabs.Tab, expectedDocument?:string) {
  const tabId=tab.id;
  if(tabId===undefined || filling.has(tabId)) throw new Error('A fill is already running. Try again in a moment.');
  filling.add(tabId);
  try {
    await protectStorage;
    await chrome.action.setBadgeText({tabId,text:'…'});
    const stored=await chrome.storage.local.get(['settings','gemini']);
    const settings=validateSettings(stored.settings);
    const config=validateGemini(stored.gemini);
    const request:FillRequest={...settings,expectedDocument,values:generateValues(settings.locale),identities:generateIdentities(settings.locale),samples:generateSamples(settings.locale)};
    let note='';
    let cacheKey:string | undefined;
    let batch:CachedBatch | undefined;
    let signatures:Map<string,string> | undefined;
    const epoch=cacheEpoch;
    if(config.enabled && config.apiKey && settings.fillUnknown) {
      try {
        await chrome.action.setBadgeText({tabId,text:'AI'});
        const prepared=await prepareBatch(tabId,request,settings,config,epoch);
        request.expectedDocument=prepared.scan.documentId;
        note=prepared.note;cacheKey=prepared.cacheKey;batch=prepared.batch;
        signatures=new Map((prepared.scan.unknown || []).map(field=>[field.id,field.signature!]));
        if(batch && batch.expiresAt>Date.now() && epoch===cacheEpoch) {
          const suggestions:Record<string,SuggestedField>={};
          for(const field of prepared.scan.unknown || []) suggestions[field.id]={signature:field.signature!,values:batch.values[field.signature!] || []};
          request.suggestions=suggestions;request.suggestionsExpireAt=batch.expiresAt;
        }
      } catch(error) {
        note=error instanceof Error?error.message:'Gemini failed. Local values were used.';
        note+=' Local fallback is active.';
        batch=undefined;
      }
      await chrome.storage.session.set({geminiStatus:note});
    }
    request.exclusions=validateSettings((await chrome.storage.local.get('settings')).settings).exclusions;
    if(epoch!==cacheEpoch || (batch && batch.expiresAt<=Date.now())) delete request.suggestions;
    const responses=await chrome.scripting.executeScript({target:{tabId},func:fillPage,args:[request]});
    const result:FillResult | undefined=responses[0]?.result;
    if(!result) throw new Error('The page did not respond. Click to try again.');
    if(result.stale) throw new Error('The page changed while generating data. Click Formly again.');
    if(batch && cacheKey && signatures && epoch===cacheEpoch && batch.expiresAt>Date.now()) {
      for(const [id,value] of Object.entries(result.used || {})) {
        const signature=signatures.get(id);
        if(!signature) continue;
        const values=batch.values[signature];
        const index=values?.indexOf(value) ?? -1;
        if(index>=0) batch.values[signature]=values.slice(index+1);
      }
      await chrome.storage.session.set({[cacheKey]:batch});
    }
    await chrome.action.setBadgeBackgroundColor({tabId,color:result.filled?'#5370ce':'#80704d'});
    await chrome.action.setBadgeText({tabId,text:String(result.filled)});
    await chrome.action.setTitle({tabId,title:`Formly: ${result.filled} filled, ${result.preserved} kept, ${result.unmatched} unrecognized, ${result.invalid} incompatible. ${note} Click to fill again. Right-click → Open Formly panel for details.`});
  } catch(error) {
    const message=error instanceof Error?error.message:'Could not fill this page.';
    const reason=/cannot access|extensions gallery|chrome:\/\/|edge:\/\//i.test(message)?'This page restricts extensions. Open a regular website with a form.':message;
    await chrome.action.setBadgeBackgroundColor({tabId,color:'#b34c3c'});
    await chrome.action.setBadgeText({tabId,text:'!'});
    await chrome.action.setTitle({tabId,title:`Formly: ${reason}`});
    throw new Error(reason);
  } finally {filling.delete(tabId);}
}

chrome.runtime.onInstalled.addListener(details=>{
  chrome.contextMenus.create({id:'formly-panel',title:'Open Formly panel',contexts:['action']},()=>void chrome.runtime.lastError);
  void chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:false});
  if(details.reason==='install') void chrome.tabs.create({url:chrome.runtime.getURL('welcome.html')}).catch(()=>{});
});

chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local' && changes.settings && JSON.stringify(validateSettings(changes.settings.oldValue).exclusions)!==JSON.stringify(validateSettings(changes.settings.newValue).exclusions)) void clearCache().catch(()=>{});
});
chrome.tabs.onUpdated.addListener((tabId,change,tab)=>{if(change.status==='complete') void prepareOnReload(tabId,tab).catch(()=>{});});
chrome.action.onClicked.addListener(tab=>fillClickedTab(tab).catch(()=>{}));
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name===ALARM) void pruneCache().catch(()=>{});});
chrome.tabs.onRemoved.addListener(tabId=>{
  queuedReloads.delete(tabId);
  void chrome.storage.session.get(null).then(stored=>chrome.storage.session.remove(Object.keys(stored).filter(key=>key.startsWith(`${CACHE_PREFIX}${tabId}:`)))).catch(()=>{});
});
chrome.runtime.onMessage.addListener((message:unknown,sender,sendResponse)=>{
  if(sender.id!==chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('')) || !message || typeof message!=='object') return;
  const msg=message as {type?:string;config?:unknown;apiKey?:unknown;cacheMinutes?:unknown};
  if(!msg.type?.startsWith('gemini:')) return;
  void (async()=>{
    await protectStorage;
    switch(msg.type) {
      case 'gemini:get': return {config:validateGemini((await chrome.storage.local.get('gemini')).gemini),status:await status()};
      case 'gemini:save': {
        const config=validateGemini(msg.config);
        if(config.enabled && !config.apiKey) throw new Error('Enter your API key before enabling Gemini.');
        await chrome.storage.local.set({gemini:config});await clearCache();
        await chrome.storage.session.remove('geminiStatus');
        return {config,status:await status()};
      }
      case 'gemini:test': return {models:await listModels(typeof msg.apiKey==='string'?msg.apiKey:'')};
      case 'gemini:cache': {
        if(!validCacheMinutes(msg.cacheMinutes)) throw new Error('Choose a whole number from 1 to 60 minutes.');
        const config={...validateGemini((await chrome.storage.local.get('gemini')).gemini),cacheMinutes:msg.cacheMinutes};
        await chrome.storage.local.set({gemini:config});await clearCache();
        await chrome.storage.session.remove('geminiStatus');
        return {config,status:await status()};
      }
      case 'gemini:clear': await clearCache();await chrome.storage.session.remove('geminiStatus');return {status:await status()};
      case 'gemini:status': return {status:await status()};
      default: throw new Error('Unknown Gemini action.');
    }
  })().then(data=>sendResponse({ok:true,...data})).catch(error=>sendResponse({ok:false,error:error instanceof Error?error.message:'The Gemini action failed.'}));
  return true;
});

// Call open synchronously from the browser gesture, before any asynchronous work.
chrome.contextMenus.onClicked.addListener((info,tab)=>{
  if(info.menuItemId==='formly-panel' && tab?.windowId!==undefined) void chrome.sidePanel.open({windowId:tab.windowId}).catch(()=>{});
});
chrome.commands.onCommand.addListener((command,tab)=>{
  if(command==='open-panel' && tab?.windowId!==undefined) void chrome.sidePanel.open({windowId:tab.windowId}).catch(()=>{});
});
async function inspectTab(tabId:number) {
  const settings=validateSettings((await chrome.storage.local.get('settings')).settings);
  const reply=(await chrome.scripting.executeScript({target:{tabId},func:fillPage,args:[{...settings,values:generateValues(settings.locale),mode:'inspect'}]}))[0]?.result;
  if(!reply) throw new Error('The page did not respond. Refresh to try again.');
  return {tabId,...reply};
}
chrome.runtime.onMessage.addListener((message:unknown,sender,sendResponse)=>{
  if(sender.id!==chrome.runtime.id || sender.url?.split('?')[0]!==chrome.runtime.getURL('sidepanel.html') || !message || typeof message!=='object') return;
  const msg=message as {type?:string;tabId?:number;documentId?:string;fieldId?:string;value?:string};
  if(!msg.type?.startsWith('panel:')) return;
  void (async()=>{
    if(!Number.isInteger(msg.tabId)) throw new Error('Choose a website tab first.');
    const tabId=msg.tabId!;
    const tab=await chrome.tabs.get(tabId);
    if(!tab.active) throw new Error('The active tab changed. Refresh the panel.');
    if(tab.url && !/^https?:/.test(tab.url)) throw new Error('Open a regular website with a form. This page does not support filling.');
    if(msg.type==='panel:inspect') return inspectTab(tabId);
    if(!msg.documentId) throw new Error('Refresh the field list first.');
    if(msg.type==='panel:fill') {await fillClickedTab(tab,msg.documentId);return inspectTab(tabId);}
    if(filling.has(tabId)) throw new Error('Wait for the current fill to finish.');
    if(msg.type==='panel:highlight' || msg.type==='panel:undo') {
      const action=msg.type==='panel:undo'?'undo':'highlight';
      const result=(await chrome.scripting.executeScript({target:{tabId},func:panelPageAction,args:[action,msg.documentId,msg.fieldId ?? '']}))[0]?.result;
      if(action==='undo') {await chrome.action.setBadgeText({tabId,text:''});await chrome.action.setTitle({tabId,title:'Formly: last fill undone. Click to fill again.'});}
      return {...await inspectTab(tabId),...result};
    }
    if(msg.type==='panel:exclude' || msg.type==='panel:rule') {
      if(!msg.fieldId) throw new Error('Choose a field first.');
      if(msg.type==='panel:rule' && (typeof msg.value!=='string' || !msg.value.trim() || msg.value.length>5000)) throw new Error('Enter a test value between 1 and 5,000 characters.');
      const field=(await chrome.scripting.executeScript({target:{tabId},func:panelPageAction,args:['field',msg.documentId,msg.fieldId]}))[0]?.result;
      if(!field || !('selector' in field) || !field.selector || !field.site) throw new Error('This field could not be located. Refresh the panel.');
      const settings=validateSettings((await chrome.storage.local.get('settings')).settings);
      if(msg.type==='panel:exclude') {
        if(!settings.exclusions.rules.some(rule=>rule.match==='selector' && rule.value===field.selector && rule.site===field.site)) settings.exclusions.rules.push({id:crypto.randomUUID(),match:'selector',value:field.selector,site:field.site});
      } else {
        settings.custom=settings.custom.filter(rule=>rule.selector!==field.selector || rule.site!==field.site);
        settings.custom.push({id:crypto.randomUUID(),label:field.label || 'Custom field',value:msg.value!,selector:field.selector,site:field.site});
      }
      await chrome.storage.local.set({settings});await clearCache();
      return inspectTab(tabId);
    }
    throw new Error('Unknown panel action.');
  })().then(data=>sendResponse({ok:true,...data})).catch(error=>{
    const raw=error instanceof Error?error.message:'The panel action failed.';
    const reason=/chrome:\/\/|edge:\/\/|extensions gallery|chrome web store/i.test(raw)?'This page does not support filling. Open a regular website with a form.':/cannot access|permission/i.test(raw)?'Click the Formly toolbar icon or reopen this panel from its right-click menu to allow access to this website.':raw;
    sendResponse({ok:false,error:reason});
  });
  return true;
});
