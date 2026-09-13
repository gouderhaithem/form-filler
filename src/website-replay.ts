// This function is injected into the source document's isolated world: no module references.
// Cookies/Origin/Referer are supplied by Chrome in the website's context, not by the extension page.
export interface WebsiteRequest {id:string;url:string;method:string;headers:Record<string,string>;body?:string;cookies:boolean;sourceOrigin:string}
export interface WebsiteResponse {status?:number;statusText?:string;headers?:Record<string,string>;body?:string;note?:string;error?:string;redirected?:boolean;duration?:number}
export async function websiteRequest(input:WebsiteRequest,action:'send'|'cancel'='send'):Promise<WebsiteResponse> {
  const state=globalThis as typeof globalThis & {__formlyRequests?:Map<string,AbortController>};
  if(action==='cancel'){const abort=state.__formlyRequests?.get(input.id) || new AbortController();abort.abort();(state.__formlyRequests ??=new Map()).set(input.id,abort);setTimeout(()=>{if(state.__formlyRequests?.get(input.id)===abort)state.__formlyRequests.delete(input.id);},20000);return {};}
  if(location.origin!==input.sourceOrigin)throw new Error('The source page changed. Record the request again.');
  const controller=state.__formlyRequests?.get(input.id) || new AbortController();(state.__formlyRequests ??= new Map()).set(input.id,controller);
  const timer=setTimeout(()=>controller.abort(),20000),started=performance.now();
  const result:WebsiteResponse={};
  try {
    const response=await fetch(input.url,{method:input.method,headers:input.headers,body:input.body,credentials:input.cookies?'include':'omit',redirect:'manual',cache:'no-store',signal:controller.signal});
    if(response.type==='opaqueredirect'){result.redirected=true;result.note='Redirect stopped. Chrome hides this response’s status and headers. Enter the destination URL to send there explicitly.';}
    else {
      result.status=response.status;result.statusText=response.statusText;result.headers=Object.fromEntries(response.headers);
      if(response.body){
        const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
        try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>64*1024){result.note='Body exceeds the 64 KB preview limit.';await reader.cancel();break;}chunks.push(next.value);}}finally{reader.releaseLock();}
        if(!result.note){const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}result.body=new TextDecoder().decode(bytes);}
      }else result.body='';
    }
  }catch{result.error=controller.signal.aborted?'Request canceled or timed out. It may already have reached the server.':'Could not read a website response. Check CORS, the connection, and whether the page is still open. The request may have reached the server.';}
  finally{clearTimeout(timer);state.__formlyRequests?.delete(input.id);}
  result.duration=Math.round(performance.now()-started);return result;
}
