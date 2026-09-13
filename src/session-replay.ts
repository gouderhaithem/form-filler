import {bodyPreview,cleanHeaders,cleanURL} from './network';
import {prepareRequest,replayRequest,type RequestDraft,type ReplayResult} from './request-replay';
import type {NetworkRecorder} from './network-recorder';
import {websiteRequest,type WebsiteRequest} from './website-replay';
export function registerSessionReplay(recorder:NetworkRecorder) {
  const pending=new Map<string,{owner?:string;abort:AbortController;tabId?:number;documentId?:string;wire?:WebsiteRequest}>();
  chrome.runtime.onMessage.addListener((message:unknown,sender,sendResponse)=>{
    if(sender.id!==chrome.runtime.id || sender.url?.split('?')[0]!==chrome.runtime.getURL('sidepanel.html') || !message || typeof message!=='object')return;
    const msg=message as {type?:string;id?:string;originalId?:string;draft?:RequestDraft};
    if(!msg.type?.startsWith('replay:'))return;
    void(async()=>{
      if(!msg.id || msg.id.length>100)throw new Error('Invalid resend identifier.');
      if(msg.type==='replay:cancel'){
        const task=pending.get(msg.id);if(!task || task.owner!==sender.documentId)return;
        task.abort.abort();
        return;
      }
      if(msg.type!=='replay:send' || !msg.draft || !msg.originalId)throw new Error('Invalid resend action.');
      if(pending.size)throw new Error('Another resend is still running. Wait for it to finish.');
      const draft=msg.draft,prepared=prepareRequest(draft);
      const context=recorder.replayContext(msg.originalId,prepared.url,!!draft.reuseAuth);
      const headers=new Headers(context.headers);for(const [name,value] of prepared.headers)headers.set(name,value);
      const resolved={...draft,headers:[...headers].map(([name,value])=>({name,value}))};
      const task:{owner?:string;abort:AbortController;tabId?:number;documentId?:string;wire?:WebsiteRequest}={owner:sender.documentId,abort:new AbortController()};
      task.abort.signal.addEventListener('abort',()=>{if(task.tabId!==undefined && task.documentId && task.wire)void chrome.scripting.executeScript({target:{tabId:task.tabId,documentIds:[task.documentId]},func:websiteRequest,args:[task.wire,'cancel']}).catch(()=>{});},{once:true});
      pending.set(msg.id,task);const timer=setTimeout(()=>task.abort.abort(),20000);
      try {
        let result:ReplayResult;
        if(draft.transport!=='website')result=await replayRequest(resolved,task.abort.signal);
        else {
          if(!context.pageURL)throw new Error('The source page was not captured. Record again or choose extension mode.');
          const tab=await chrome.tabs.get(context.tabId);if(!tab.active)throw new Error('Select the original website tab before resending.');
          const frame=(await chrome.scripting.executeScript({target:{tabId:context.tabId},func:()=>({url:location.href.split('#')[0]})}))[0];
          if(!frame?.documentId || frame.result?.url!==context.pageURL)throw new Error('The source page changed. Record again, or choose extension mode.');
          if(task.abort.signal.aborted)throw new Error('Resend was canceled before sending.');
          task.tabId=context.tabId;task.documentId=frame.documentId;
          task.wire={id:msg.id,url:prepared.url,method:draft.method,headers:Object.fromEntries(headers),body:prepared.body,cookies:draft.cookies,sourceOrigin:new URL(context.pageURL).origin};
          const raw=(await chrome.scripting.executeScript({target:{tabId:context.tabId,documentIds:[frame.documentId]},func:websiteRequest,args:[task.wire]}))[0]?.result;
          if(!raw)throw new Error('The source page closed or changed while sending. The server may have received the request.');
          const preview=bodyPreview(raw.body ?? '',raw.headers?.['content-type'] || '');
          const requestBody=bodyPreview(prepared.body ?? '',headers.get('content-type') || '');
          result={id:crypto.randomUUID(),kind:'Resend',url:cleanURL(prepared.url),method:draft.method,startedAt:Date.now()-(raw.duration || 0),duration:raw.duration,state:raw.error?'failed':raw.redirected?'redirected':'complete',status:raw.status,statusText:raw.statusText,requestHeaders:cleanHeaders(Object.fromEntries(headers)),responseHeaders:cleanHeaders(raw.headers),requestBody:requestBody.text,responseBody:raw.body===undefined?undefined:preview.text,bodyNote:raw.note || preview.note,error:raw.error,cookies:draft.cookies};
        }
        result.transport=draft.transport;result.reusedHeaders=Object.keys(context.headers);return result;
      }finally{clearTimeout(timer);pending.delete(msg.id);}
    })().then(result=>sendResponse({ok:true,result})).catch(error=>sendResponse({ok:false,error:error instanceof Error?error.message:'Resend failed.'}));
    return true;
  });
}
