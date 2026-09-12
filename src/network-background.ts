import {NetworkRecorder} from './network-recorder';
const recorder=new NetworkRecorder({
  attach:tabId=>chrome.debugger.attach({tabId},'1.3'),
  detach:tabId=>chrome.debugger.detach({tabId}),
  command:(tabId,method,params)=>chrome.debugger.sendCommand({tabId},method,params),
});
let recordingWindow:number|undefined;
chrome.debugger.onEvent.addListener((source,method,params)=>{
  if(source.tabId!==undefined && !('sessionId' in source && source.sessionId))void recorder.event(source.tabId,method,params).catch(()=>{});
});
chrome.debugger.onDetach.addListener((source,reason)=>{if(source.tabId!==undefined)recorder.detached(source.tabId,reason);});
chrome.tabs.onActivated.addListener(info=>{
  const capture=recorder.view();
  if(capture.recording && info.windowId===recordingWindow && info.tabId!==capture.tabId)void recorder.stop('Recording stopped because you switched tabs. Captured requests remain available.');
});
chrome.tabs.onRemoved.addListener(tabId=>{
  if(recorder.view().tabId===tabId)void recorder.stop('The recorded tab was closed.').then(()=>{if(recorder.view().tabId===tabId)recorder.clear();});
});
chrome.runtime.onMessage.addListener((message:unknown,sender,sendResponse)=>{
  if(sender.id!==chrome.runtime.id || sender.url?.split('?')[0]!==chrome.runtime.getURL('sidepanel.html') || !message || typeof message!=='object')return;
  const msg=message as {type?:string;tabId?:number;selectedId?:string};
  if(!msg.type?.startsWith('network:'))return;
  void(async()=>{
    if(msg.type==='network:start') {
      if(!Number.isInteger(msg.tabId))throw new Error('Open a website tab first.');
      const tab=await chrome.tabs.get(msg.tabId!);
      if(!tab.active)throw new Error('The active tab changed. Start recording from the website you want to inspect.');
      const target=(await chrome.debugger.getTargets()).find(target=>target.tabId===tab.id);
      if(!target?.url || !/^https?:/i.test(target.url))throw new Error('Recording is available on regular HTTP and HTTPS websites.');
      recordingWindow=tab.windowId;
      try{await recorder.start(tab.id!,new URL(target.url).host);}
      catch{throw new Error('Could not attach the recorder. Close another debugger on this tab, then try again.');}
      if(!(await chrome.tabs.get(tab.id!)).active)await recorder.stop('Recording stopped because you switched tabs.');
    } else if(msg.type==='network:stop')await recorder.stop();
    else if(msg.type==='network:clear')recorder.clear();
    else if(msg.type!=='network:get')throw new Error('Unknown recording action.');
    return recorder.view(typeof msg.selectedId==='string'?msg.selectedId:undefined);
  })().then(capture=>sendResponse({ok:true,capture})).catch(error=>sendResponse({ok:false,error:error instanceof Error?error.message:'Recording failed.'}));
  return true;
});
