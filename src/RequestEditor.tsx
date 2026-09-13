import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,Plus,Send,Trash2} from 'lucide-react';
import {requestSummary,type RequestEntry} from './network';
import {createDraft,METHODS,prepareRequest,type Pair,type ReplayResult} from './request-replay';
function Pairs({label,items,onChange}:{label:string;items:Pair[];onChange:(items:Pair[])=>void}) {
  return <div className="editor-pairs"><div className="body-heading"><h3>{label}</h3><button type="button" className="editor-text-button" onClick={()=>onChange([...items,{name:'',value:''}])}><Plus size={13}/> Add {label==='Headers'?'header':'parameter'}</button></div>
    {items.map((item,index)=><div className="editor-pair" key={index}><input aria-label={`${label} name ${index+1}`} placeholder="Name" value={item.name} onChange={e=>onChange(items.map((p,i)=>i===index?{...p,name:e.target.value}:p))}/><input aria-label={`${label} value ${index+1}`} placeholder="Value" value={item.value} onChange={e=>onChange(items.map((p,i)=>i===index?{...p,value:e.target.value}:p))}/><button type="button" className="icon-button" aria-label={`Remove ${label.toLowerCase()} ${index+1}`} onClick={()=>onChange(items.filter((_,i)=>i!==index))}><Trash2 size={14}/></button></div>)}
    {!items.length&&<p className="hint">No {label.toLowerCase()} added.</p>}
  </div>;
}
export function RequestEditor({original,onClose}:{original:RequestEntry;onClose:()=>void}) {
  const [draft,setDraft]=useState(()=>createDraft(original)),[tab,setTab]=useState('body');
  const [results,setResults]=useState<ReplayResult[]>([]),[resultId,setResultId]=useState('');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[phase,setPhase]=useState(''),[copied,setCopied]=useState(false);
  const controller=useRef<AbortController|null>(null),mounted=useRef(true),locked=useRef(false);
  useEffect(()=>{mounted.current=true;document.querySelector('.request-editor')?.scrollIntoView({block:'start'});document.querySelector<HTMLInputElement>('.editor-address input')?.focus({preventScroll:true});return()=>{mounted.current=false;controller.current?.abort();};},[]);
  let params:Pair[]=[];
  try{params=[...new URL(draft.url).searchParams].map(([name,value])=>({name,value}));}catch{/* The URL field provides its own validation on Send. */}
  function updateParams(items:Pair[]){try{const url=new URL(draft.url);url.search='';for(const {name,value} of items)url.searchParams.append(name,value);setDraft({...draft,url:url.href});}catch{setError('Enter a valid URL before editing its parameters.');}}
  async function send(){
    if(locked.current)return;
    setError('');setCopied(false);
    let prepared:ReturnType<typeof prepareRequest>;
    try{if(original.requestBodyNote && !['GET','HEAD'].includes(draft.method) && !draft.body)throw new Error('The original body was unavailable. Enter a replacement body before sending.');prepared=prepareRequest(draft);}catch(e){setError(e instanceof Error?e.message:'Check the request.');return;}
    locked.current=true;setBusy(true);setPhase('Waiting for website access…');
    const abort=new AbortController();controller.current=abort;
    const requestId=crypto.randomUUID();
    abort.signal.addEventListener('abort',()=>{void chrome.runtime.sendMessage({type:'replay:cancel',id:requestId}).catch(()=>{});},{once:true});let timer:ReturnType<typeof setTimeout>|undefined;
    try {
      // Keep the permission request directly in the Send gesture. Only the edited destination is requested.
      const origins=[prepared.origin];if(draft.transport==='website' && original.sourceOrigin){const source=new URL(original.sourceOrigin);origins.push(`${source.protocol}//${source.hostname}/*`);}
      const allowed=await chrome.permissions.request({origins:[...new Set(origins)]});
      if(!mounted.current || abort.signal.aborted)return;
      if(!allowed)throw new Error('Website access was declined. Nothing was sent. Click Send to try again.');
      setPhase('Sending request…');timer=setTimeout(()=>abort.abort(),20000);
      const reply:{ok:boolean;error?:string;result?:ReplayResult}=await chrome.runtime.sendMessage({type:'replay:send',id:requestId,originalId:original.id,draft});
      if(!reply.ok || !reply.result)throw new Error(reply.error || 'No resend result returned.');
      const result=reply.result;
      if(!mounted.current)return;
      setResults(previous=>[result,...previous].slice(0,10));setResultId(result.id);
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Could not send this request.');}
    finally{clearTimeout(timer);controller.current=null;locked.current=false;if(mounted.current){setBusy(false);setPhase('');}}
  }
  const result=results.find(item=>item.id===resultId),hasBody=!['GET','HEAD'].includes(draft.method);
  return <section className="request-editor" aria-label="Edit request">
    <div className="editor-heading"><div><p className="eyebrow">TRY ANOTHER REQUEST</p><h2>Edit & resend</h2></div><button className="editor-text-button" disabled={busy} onClick={onClose}><ArrowLeft size={14}/> Close editor</button></div>
    <p className="capture-note">Send makes a real request to the URL below. Website mode uses the source tab’s session. Captured authentication stays hidden and is reused only for the original API origin. Drafts and results stay here until you close the editor.</p>
    <form onSubmit={e=>{e.preventDefault();void send();}}>
      <fieldset disabled={busy} className="editor-fields"><legend className="sr-only">Request to send</legend>
        <div className="editor-address"><label>Method<select value={draft.method} onChange={e=>setDraft({...draft,method:e.target.value})}>{!METHODS.includes(draft.method as typeof METHODS[number])&&<option>{draft.method}</option>}{METHODS.map(method=><option key={method}>{method}</option>)}</select></label><label>Request URL<input type="text" value={draft.url} onChange={e=>setDraft({...draft,url:e.target.value})} spellCheck={false}/></label></div>
        <div className="detail-tabs" aria-label="Edit request section">{['params','headers','body'].map(section=><button type="button" key={section} aria-pressed={tab===section} onClick={()=>setTab(section)}>{section==='params'?'Params':section==='headers'?'Headers':'Body'}</button>)}</div>
        {tab==='params'&&<Pairs label="Parameters" items={params} onChange={updateParams}/>}
        {tab==='headers'&&<Pairs label="Headers" items={draft.headers} onChange={headers=>setDraft({...draft,headers})}/>}
        {tab==='body'&&<label className="editor-body">Request body<textarea value={draft.body} disabled={!hasBody} onChange={e=>setDraft({...draft,body:e.target.value})} spellCheck={false} placeholder="JSON, URL-encoded form data, or text"/>{!hasBody&&<span className="hint">{draft.method} sends no body. Your draft is kept if you switch methods.</span>}{original.requestBodyNote&&<span className="hint">Original body: {original.requestBodyNote} Enter a replacement before sending.</span>}</label>}
        <label className="replay-history">Send from<select aria-label="Send from" value={draft.transport || 'extension'} onChange={e=>setDraft({...draft,transport:e.target.value as 'website'|'extension',cookies:e.target.value==='website'})}><option value="website" disabled={!original.sourceOrigin}>Website session (recommended)</option><option value="extension">Extension</option></select></label>
        {!!original.authenticationHeaders?.length&&<label className="editor-cookies"><input type="checkbox" checked={!!draft.reuseAuth} onChange={e=>setDraft({...draft,reuseAuth:e.target.checked})}/> Reuse captured authentication ({original.authenticationHeaders.join(', ')})</label>}
        <label className="editor-cookies"><input type="checkbox" checked={draft.cookies} onChange={e=>setDraft({...draft,cookies:e.target.checked})}/> Include browser cookies for this destination</label>
        <p className="hint">{draft.transport==='website'?'Uses the original website tab’s cookies, Origin, and Referer. Keep that page open.':'Sent from the extension. Cookies, Origin, and Referer can differ from the website.'} Redirects stop for review. Timeout: 20 seconds.</p>
      </fieldset>
      {error&&<p className="message error" role="alert">{error}</p>}
      <div className="editor-send"><button className="primary" type="submit" disabled={busy}><Send size={15}/>{busy?'Sending…':'Send'}</button>{busy&&<button type="button" className="editor-text-button" onClick={()=>controller.current?.abort()}>Cancel</button>}</div>
      <p role="status" className="hint">{phase}</p>
    </form>
    <div className="replay-comparison"><div><span>Original</span><strong>{requestSummary(original)}</strong><small>{original.duration===undefined?'':`${original.duration} ms`}</small></div><div className={result && (result.state==='failed' || (result.status || 0)>=400)?'bad':''}><span>Resent</span><strong>{result?(result.state==='redirected'?'Redirect stopped':requestSummary(result)):'Not sent yet'}</strong><small>{result?.duration===undefined?'':`${result.duration} ms`}</small></div></div>
    {result&&<section className="replay-response" aria-label="Resent response"><label className="replay-history">Resend history · last 10<select aria-label="Choose resend result" value={resultId} onChange={e=>{setResultId(e.target.value);setCopied(false);}}>{results.map((item,index)=><option value={item.id} key={item.id}>{results.length-index}. {item.method} · {item.state==='redirected'?'Redirect stopped':requestSummary(item)}</option>)}</select></label><p className="full-endpoint">{result.method} {result.url}</p>
      <div className="body-heading"><h3>New response</h3><button className="editor-text-button" disabled={result.responseBody===undefined} onClick={()=>{void navigator.clipboard.writeText(result.responseBody || '').then(()=>setCopied(true)).catch(()=>setError('Could not copy the response.'));}}>{copied?'Copied':'Copy response'}</button></div>
      {result.error&&<p className="message error" role="alert">{result.error}</p>}{result.bodyNote&&<p className="hint">{result.bodyNote}</p>}{result.responseBody!==undefined&&<pre className="payload" tabIndex={0}>{result.responseBody || '(empty body)'}</pre>}
      <details className="request-headers"><summary>Response headers</summary><dl>{Object.entries(result.responseHeaders).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></details>
      <details className="request-headers"><summary>Sent request</summary><p className="hint">Sent from: {result.transport==='website'?'website session':'extension'}. {result.reusedHeaders?.length?`Reused authentication: ${result.reusedHeaders.join(', ')}. `:''}Browser cookies: {result.cookies?'included when permitted':'omitted'}. Known credential fields are hidden below.</p><dl>{Object.entries(result.requestHeaders).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl><pre className="payload">{result.requestBody || '(no body)'}</pre></details>
      <details className="request-headers"><summary>Original response</summary><p className="full-endpoint">{original.method} {original.url}</p><pre className="payload">{original.responseBody ?? original.bodyNote ?? 'No response body captured.'}</pre></details>
    </section>}
  </section>;
}
