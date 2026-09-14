import {validateSettings} from './data';
import {validateGemini} from './gemini';
const ID='formly-form-watch';
// Dynamic registration preserves the existing optional site-access model.
export function installFormPreload(prepare:(tabId:number,tab:chrome.tabs.Tab,documentId?:string)=>Promise<void>) {
  let updating:Promise<void>=Promise.resolve();
  function sync(){
    updating=updating.catch(()=>{}).then(async()=>{
      const stored=await chrome.storage.local.get(['settings','gemini']);
      const config=validateGemini(stored.gemini);
      const enabled=config.enabled && !!config.apiKey && validateSettings(stored.settings).fillUnknown;
      const matches=enabled?(await chrome.permissions.getAll()).origins?.filter(origin=>/^https?:\/\//.test(origin)) || []:[];
      const registered=(await chrome.scripting.getRegisteredContentScripts({ids:[ID]}))[0];
      if(matches.length){
        const script={id:ID,matches,js:['form-watch.js'],runAt:'document_end' as const,allFrames:false,persistAcrossSessions:true};
        if(registered)await chrome.scripting.updateContentScripts([script]);else await chrome.scripting.registerContentScripts([script]);
      }else if(registered)await chrome.scripting.unregisterContentScripts({ids:[ID]});
      const tabs=await chrome.tabs.query({url:['http://*/*','https://*/*']});
      await Promise.allSettled(tabs.map(async tab=>{
        if(tab.id===undefined)return;
        const url=tab.url?new URL(tab.url):undefined;
        const allowed=matches.length && url && await chrome.permissions.contains({origins:[`${url.protocol}//${url.hostname}/*`]});
        if(allowed)await chrome.scripting.executeScript({target:{tabId:tab.id},files:['form-watch.js']});
        else await chrome.tabs.sendMessage(tab.id,{type:'formly:watch-stop'});
      }));
    });return updating;
  }
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local' && (changes.gemini || changes.settings))void sync().catch(()=>{});});
  chrome.permissions.onAdded.addListener(()=>{void sync().catch(()=>{});});
  chrome.permissions.onRemoved.addListener(()=>{void sync().catch(()=>{});});
  chrome.runtime.onMessage.addListener((message:unknown,sender,sendResponse)=>{
    if(!message || typeof message!=='object' || (message as {type?:string}).type!=='formly:prepare')return;
    if(sender.id!==chrome.runtime.id || sender.frameId!==0 || sender.tab?.id===undefined || !sender.documentId || !/^https?:/.test(sender.url || ''))return;
    const tabId=sender.tab.id;
    void(async()=>{
      const url=new URL(sender.url!);
      if(!await chrome.permissions.contains({origins:[`${url.protocol}//${url.hostname}/*`]}))return;
      await prepare(tabId,{...sender.tab,url:sender.url} as chrome.tabs.Tab,sender.documentId);
    })().then(()=>sendResponse({ok:true})).catch(()=>sendResponse({ok:false}));
    return true;
  });
  void sync().catch(()=>{});
  return sync;
}
