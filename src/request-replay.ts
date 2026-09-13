import {bodyPreview,cleanHeaders,cleanURL,MAX_BODY_BYTES,type RequestEntry} from './network';
export const METHODS=['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'] as const;
export interface Pair {name:string;value:string}
export interface RequestDraft {url:string;method:string;headers:Pair[];body:string;cookies:boolean;transport?:'website'|'extension';reuseAuth?:boolean}
export interface ReplayResult extends RequestEntry {cookies:boolean;transport?:'website'|'extension';reusedHeaders?:string[]}
// These headers are controlled by Fetch; showing them as editable would silently misrepresent the send.
export function browserHeader(name:string) {
  return /^(?:sec-|proxy-|:)/i.test(name) || /^(?:accept-charset|accept-encoding|access-control-request-headers|access-control-request-method|connection|content-length|cookie2?|date|dnt|expect|host|keep-alive|origin|permissions-policy|referer|te|trailer|transfer-encoding|upgrade|via|user-agent)$/i.test(name);
}
function hidden(value:string){return /\[hidden\]|%5bhidden%5d/i.test(value);}
export function createDraft(entry:RequestEntry):RequestDraft {
  return {url:entry.url,method:entry.method,headers:Object.entries(entry.requestHeaders).filter(([name,value])=>!browserHeader(name)&&!hidden(value)).map(([name,value])=>({name,value})),body:entry.editableBody ?? '',cookies:!!entry.sourceOrigin,transport:entry.sourceOrigin?'website':'extension',reuseAuth:!!entry.authenticationHeaders?.length};
}
export function prepareRequest(draft:RequestDraft) {
  let url:URL;
  try{url=new URL(draft.url);}catch{throw new Error('Enter a complete HTTP or HTTPS URL.');}
  if(!['http:','https:'].includes(url.protocol))throw new Error('Only HTTP and HTTPS requests are supported.');
  if(url.username || url.password)throw new Error('Remove credentials from the URL. Use an Authorization header instead.');
  if(!METHODS.includes(draft.method as typeof METHODS[number]))throw new Error('Choose a supported HTTP method.');
  if(hidden(url.href))throw new Error('Replace or remove hidden values in the URL before sending.');
  if(url.href.length>8192)throw new Error('The URL is too long (maximum 8,192 characters).');
  url.hash='';
  const headers=new Headers();
  for(const pair of draft.headers) {
    const name=pair.name.trim();
    if(!name && !pair.value)continue;
    if(!name)throw new Error('Each header needs a name.');
    if(browserHeader(name) || /^x-http-method(?:-override)?$|^x-method-override$/i.test(name))throw new Error(`${name} is controlled by the browser and cannot be set here.`);
    if(hidden(pair.value))throw new Error(`Replace or remove the hidden value in ${name}.`);
    try{headers.append(name,pair.value);}catch{throw new Error(`Invalid header: ${name}. Check its name and value.`);}
  }
  const body=['GET','HEAD'].includes(draft.method)?undefined:draft.body;
  if(body && hidden(body))throw new Error('Replace or remove hidden values in the body before sending.');
  if(body && new TextEncoder().encode(body).length>MAX_BODY_BYTES)throw new Error('Request bodies are limited to 64 KB.');
  if(body && /json/i.test(headers.get('content-type') || '')) {
    try{JSON.parse(body);}catch{throw new Error('The body is not valid JSON. Fix it or change Content-Type.');}
  }
  if(/multipart\/form-data/i.test(headers.get('content-type') || ''))throw new Error('Multipart uploads are not supported. Choose a text or JSON body and update Content-Type.');
  return {url:url.href,origin:`${url.protocol}//${url.hostname}/*`,headers,body};
}
export async function replayRequest(draft:RequestDraft,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<ReplayResult> {
  const prepared=prepareRequest(draft),started=performance.now();
  const preview=bodyPreview(prepared.body ?? '',prepared.headers.get('content-type') || '');
  const result:ReplayResult={id:crypto.randomUUID(),kind:'Resend',url:cleanURL(prepared.url),method:draft.method,startedAt:Date.now(),state:'pending',requestHeaders:cleanHeaders(Object.fromEntries(prepared.headers)),responseHeaders:{},requestBody:preview.text,cookies:draft.cookies};
  try {
    const response=await fetcher(prepared.url,{method:draft.method,headers:prepared.headers,body:prepared.body,credentials:draft.cookies?'include':'omit',redirect:'manual',cache:'no-store',signal});
    if(response.type==='opaqueredirect') {
      result.state='redirected';result.bodyNote='Redirect stopped. Chrome hides this response’s status and headers. Enter the destination URL to send there explicitly.';
    } else {
      result.state='complete';result.status=response.status;result.statusText=response.statusText;
      result.responseHeaders=cleanHeaders(Object.fromEntries(response.headers));result.mimeType=response.headers.get('content-type') || '';
      if(response.body) {
        const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
        try {
          while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>MAX_BODY_BYTES){result.bodyNote='Body exceeds the 64 KB preview limit.';await reader.cancel();break;}chunks.push(next.value);}
        }finally{reader.releaseLock();}
        if(!result.bodyNote){const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}const body=bodyPreview(new TextDecoder().decode(bytes),result.mimeType);result.responseBody=body.text;result.bodyNote=body.note;}
      }else result.responseBody='';
    }
  }catch{result.state='failed';result.error=signal.aborted?'Request canceled or timed out. It may already have reached the server.':'Could not read a response. Check the endpoint, connection, and website access. The request may have reached the server.';}
  result.duration=Math.round(performance.now()-started);return result;
}
