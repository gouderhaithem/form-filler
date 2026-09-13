export const MAX_REQUESTS = 50;
export const MAX_BODY_BYTES = 64 * 1024;
export interface RequestEntry {
  id: string;
  url: string;
  method: string;
  kind: string;
  startedAt: number;
  duration?: number;
  state: 'pending' | 'complete' | 'failed' | 'redirected' | 'stopped';
  status?: number;
  statusText?: string;
  requestHeaders: Record<string,string>;
  responseHeaders: Record<string,string>;
  requestBody?: string;
  editableBody?: string;
  requestBodyNote?: string;
  responseBody?: string;
  bodyNote?: string;
  error?: string;
  mimeType?: string;
  sourceOrigin?: string;
  authenticationHeaders?: string[];
}
export interface CaptureState {
  recording: boolean;
  tabId?: number;
  site?: string;
  message: string;
  entries: RequestEntry[];
}
export interface CaptureReply {ok:boolean;error?:string;capture?:CaptureState}
const secret = /authorization|cookie|password|passwd|secret|(?:^|[-_])(?:token|api[-_]?key|csrf|xsrf)(?:$|[-_])|accessToken|refreshToken|apiKey/i;
export function cleanHeaders(headers:Record<string,unknown>={}) {
  return Object.fromEntries(Object.entries(headers).slice(0,100).map(([key,value])=>[key,secret.test(key)?'[hidden]':String(value).slice(0,4096)]));
}
export function cleanURL(raw:string) {
  try {
    const url=new URL(raw);
    if(url.username)url.username='hidden';if(url.password)url.password='hidden';
    for(const key of [...url.searchParams.keys()])if(secret.test(key))url.searchParams.set(key,'[hidden]');
    url.hash='';return url.href.slice(0,8192);
  }catch{return raw.slice(0,8192);}
}
function redact(value:unknown):unknown {
  if(Array.isArray(value))return value.map(redact);
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,secret.test(key)?'[hidden]':redact(item)]));
  return value;
}
export function bodyPreview(body:string,mime=''):{text?:string;note?:string} {
  if(/multipart\//i.test(mime))return {note:'Multipart payload omitted. File contents are not captured.'};
  if(mime && !/json|text|xml|javascript|x-www-form-urlencoded|graphql/i.test(mime))return {note:'Binary response omitted.'};
  // Do not partially display a secret-bearing structured payload that cannot be parsed completely.
  if(new TextEncoder().encode(body).length>MAX_BODY_BYTES)return {note:'Body exceeds the 64 KB preview limit.'};
  let text=body;
  try {text=JSON.stringify(redact(JSON.parse(body)),null,2);}
  catch {
    if(/json/i.test(mime))return {note:'JSON body could not be parsed.'};
    if(/x-www-form-urlencoded/i.test(mime)) {
      const params=new URLSearchParams(body);
      text=[...params].map(([key,value])=>`${key}: ${secret.test(key)?'[hidden]':value}`).join('\n');
    }
  }
  if(new TextEncoder().encode(text).length>MAX_BODY_BYTES)return {note:'Formatted body exceeds the 64 KB preview limit.'};
  return {text};
}
// Keep form encoding and duplicate keys intact for editing, while applying the same redaction.
export function editableBody(body:string,mime=''):string|undefined {
  const preview=bodyPreview(body,mime);
  if(preview.text===undefined)return;
  if(/x-www-form-urlencoded/i.test(mime)) {
    const params=new URLSearchParams();
    for(const [key,value] of new URLSearchParams(body))params.append(key,secret.test(key)?'[hidden]':value);
    return params.toString();
  }
  return preview.text;
}
export function requestSummary(entry:RequestEntry):string {
  if(entry.state==='failed')return 'Network error';
  if(entry.state==='stopped')return 'Stopped';
  if(entry.status!==undefined)return `${entry.status}${entry.statusText?` ${entry.statusText}`:''}`;
  return 'Pending';
}
