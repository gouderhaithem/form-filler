import {bodyPreview,cleanHeaders,cleanURL,MAX_BODY_BYTES,MAX_REQUESTS,type CaptureState,type RequestEntry} from './network';
interface DebuggerAPI {
  attach:(tabId:number)=>Promise<void>;
  detach:(tabId:number)=>Promise<void>;
  command:(tabId:number,method:string,params?:Record<string,unknown>)=>Promise<unknown>;
}
interface NetworkEvent {
  requestId?:string;type?:string;timestamp?:number;wallTime?:number;errorText?:string;
  request?:{url:string;method:string;headers?:Record<string,unknown>;postData?:string;hasPostData?:boolean};
  response?:{status:number;statusText:string;headers?:Record<string,unknown>;mimeType?:string};
  redirectResponse?:{status:number;statusText:string;headers?:Record<string,unknown>};
}
// One explicitly started tab. Payloads stay in service-worker memory and never enter Gemini or disk storage.
export class NetworkRecorder {
  private capture:CaptureState={recording:false,message:'Start recording before submitting your form.',entries:[]};
  private generation=0;
  private rows=new Map<string,{entry:RequestEntry;timestamp:number}>();
  private transitioning=false;
  constructor(private api:DebuggerAPI){}
  get state(){return structuredClone(this.capture);}
  view(selectedId?:string):CaptureState{return {...this.capture,entries:this.capture.entries.map(entry=>entry.id===selectedId?{...entry}:{...entry,requestBody:undefined,responseBody:undefined,requestHeaders:{},responseHeaders:{}})};}
  async start(tabId:number,site:string) {
    if(this.transitioning)throw new Error('Recording is changing. Try again in a moment.');
    if(this.capture.recording){if(this.capture.tabId===tabId)return;throw new Error('Stop the current recording first.');}
    this.transitioning=true;
    let attached=false;
    try {
      await this.api.attach(tabId);attached=true;
      ++this.generation;this.rows.clear();
      this.capture={recording:true,tabId,site,message:'Recording fetch, XHR, and document requests from this tab.',entries:[]};
      await this.api.command(tabId,'Network.enable',{maxTotalBufferSize:4*1024*1024,maxResourceBufferSize:128*1024,maxPostDataSize:MAX_BODY_BYTES});
    } catch(error) {
      this.capture.recording=false;this.capture.message='Could not start recording. Another debugger or a restricted page may be using this tab.';
      if(attached)await this.api.detach(tabId).catch(()=>{});
      throw error;
    } finally{this.transitioning=false;}
  }
  async stop(message='Recording stopped. Captured requests remain available until you clear them.') {
    const tabId=this.capture.tabId;
    if(!this.capture.recording || tabId===undefined)return;
    this.finish(message);
    await this.api.detach(tabId).catch(()=>{});
  }
  detached(tabId:number,reason:string) {
    if(this.capture.tabId===tabId && this.capture.recording)this.finish(`Recording ended (${reason}). Start again to capture more requests.`);
  }
  private finish(message:string) {
    ++this.generation;this.capture.recording=false;this.capture.message=message;
    for(const entry of this.capture.entries)if(entry.state==='pending'){entry.state='stopped';entry.bodyNote='Recording ended before the response completed.';}
    this.rows.clear();
  }
  clear(){++this.generation;this.rows.clear();this.capture.entries=[];}
  async event(tabId:number,method:string,params:unknown) {
    if(!this.capture.recording || this.capture.tabId!==tabId || !params || typeof params!=='object')return;
    const event=params as NetworkEvent;
    if(!event.requestId)return;
    const key=event.requestId;
    const generation=this.generation;
    const current=()=>this.capture.recording && this.capture.tabId===tabId && generation===this.generation;
    if(method==='Network.requestWillBeSent' && event.request) {
      const prior=this.rows.get(key);
      if(prior && event.redirectResponse){prior.entry.state='redirected';prior.entry.status=event.redirectResponse.status;prior.entry.statusText=event.redirectResponse.statusText;prior.entry.responseHeaders=cleanHeaders(event.redirectResponse.headers);prior.entry.duration=Math.max(0,Math.round(((event.timestamp || 0)-prior.timestamp)*1000));prior.entry.bodyNote='Redirect response. The following request appears separately.';}
      if(!['Fetch','XHR','Document'].includes(event.type || '') || !/^https?:/i.test(event.request.url)){this.rows.delete(key);return;}
      const entry:RequestEntry={id:crypto.randomUUID(),url:cleanURL(event.request.url),method:event.request.method,kind:event.type!,startedAt:(event.wallTime || Date.now()/1000)*1000,state:'pending',requestHeaders:cleanHeaders(event.request.headers),responseHeaders:{}};
      this.capture.entries.push(entry);this.rows.set(key,{entry,timestamp:event.timestamp || 0});
      if(this.capture.entries.length>MAX_REQUESTS){const removed=this.capture.entries.shift();for(const [id,row] of this.rows)if(row.entry===removed)this.rows.delete(id);}
      const mime=Object.entries(event.request.headers || {}).find(([name])=>name.toLowerCase()==='content-type')?.[1];
      const applyBody=(body:string)=>{const preview=bodyPreview(body,String(mime || ''));entry.requestBody=preview.text;if(preview.note)entry.bodyNote=preview.note;};
      if(event.request.postData!==undefined)applyBody(event.request.postData);
      else if(event.request.hasPostData) {
        try {const data=await this.api.command(tabId,'Network.getRequestPostData',{requestId:key}) as {postData?:string};if(current() && data.postData!==undefined)applyBody(data.postData);}
        catch {if(current())entry.bodyNote='Request body unavailable or above the capture limit.';}
      }
      return;
    }
    const row=this.rows.get(key);if(!row)return;
    const entry=row.entry;
    if(method==='Network.responseReceived' && event.response) {
      entry.status=event.response.status;entry.statusText=event.response.statusText;entry.responseHeaders=cleanHeaders(event.response.headers);entry.mimeType=event.response.mimeType;
    } else if(method==='Network.loadingFailed') {
      entry.state='failed';entry.error=event.errorText || 'The request failed.';entry.duration=Math.max(0,Math.round(((event.timestamp || row.timestamp)-row.timestamp)*1000));this.rows.delete(key);
    } else if(method==='Network.loadingFinished') {
      entry.state='complete';entry.duration=Math.max(0,Math.round(((event.timestamp || row.timestamp)-row.timestamp)*1000));
      this.rows.delete(key);
      if(entry.status===204 || entry.status===304 || entry.method==='HEAD'){entry.responseBody='';return;}
      if(entry.mimeType && !/json|text|xml|javascript|x-www-form-urlencoded|graphql/i.test(entry.mimeType)){entry.bodyNote='Binary response omitted.';return;}
      try {
        const data=await this.api.command(tabId,'Network.getResponseBody',{requestId:key}) as {body:string;base64Encoded?:boolean};
        if(!current())return;
        let body=data.body;
        if(data.base64Encoded){if(body.length>MAX_BODY_BYTES*1.4){entry.bodyNote='Body exceeds the 64 KB preview limit.';return;}body=new TextDecoder().decode(Uint8Array.from(atob(body),c=>c.charCodeAt(0)));}
        const preview=bodyPreview(body,entry.mimeType);entry.responseBody=preview.text;if(preview.note)entry.bodyNote=preview.note;
      }catch{if(current())entry.bodyNote='Response body unavailable. It may have been evicted, streamed, or interrupted.';}
    }
  }
}
