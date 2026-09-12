import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowDownLeft,ArrowUpRight,Check,Copy,Radio,Square,Trash2,Waypoints} from 'lucide-react';
import {isExtension} from './storage';
import {requestSummary,type CaptureReply,type CaptureState} from './network';
import './requests.css';
const empty:CaptureState={recording:false,message:'Start recording before submitting your form.',entries:[]};
export function RequestsPanel(){
  const [capture,setCapture]=useState<CaptureState>(empty),[selected,setSelected]=useState<string>(),[section,setSection]=useState('request');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState(''),[copied,setCopied]=useState(false);
  const generation=useRef(0),working=useRef(false),selectedRef=useRef<string|undefined>(undefined);
  const installed=isExtension();
  const refresh=useCallback(async()=>{
    if(!installed || working.current)return;
    const token=++generation.current;
    try{const reply:CaptureReply=await chrome.runtime.sendMessage({type:'network:get',selectedId:selectedRef.current});if(token!==generation.current)return;if(!reply.ok)throw new Error(reply.error);if(reply.capture)setCapture(reply.capture);}
    catch(e){if(token===generation.current)setError(e instanceof Error?e.message:'Could not read requests.');}
  },[installed]);
  useEffect(()=>{void refresh();const timer=window.setInterval(()=>void refresh(),1000);return()=>{++generation.current;window.clearInterval(timer);};},[refresh]);
  useEffect(()=>{selectedRef.current=selected;setCopied(false);void refresh();},[selected,refresh]);
  async function action(type:'start'|'stop'|'clear'){
    if(working.current)return;
    working.current=true;++generation.current;setBusy(true);setError('');
    try{
      let tabId:number|undefined;
      if(type==='start'){const window=await chrome.windows.getCurrent();tabId=(await chrome.tabs.query({active:true,windowId:window.id}))[0]?.id;}
      const reply:CaptureReply=await chrome.runtime.sendMessage({type:`network:${type}`,tabId,selectedId:selectedRef.current});
      if(!reply.ok)throw new Error(reply.error || 'The recorder could not complete this action.');
      if(reply.capture)setCapture(reply.capture);
      if(type==='start' || type==='clear'){setSelected(undefined);selectedRef.current=undefined;}
    }catch(e){setError(e instanceof Error?e.message:'Recording failed.');}
    finally{working.current=false;setBusy(false);}
  }
  const entry=capture.entries.find(entry=>entry.id===selected);
  const entries=capture.entries.filter(entry=>`${entry.method} ${entry.url} ${entry.status || ''}`.toLowerCase().includes(query.toLowerCase())).slice().reverse();
  const body=entry?(section==='request'?entry.requestBody:entry.responseBody):undefined;
  const headers=entry?(section==='request'?entry.requestHeaders:entry.responseHeaders):{};
  async function copy(){if(body===undefined)return;try{await navigator.clipboard.writeText(body);setCopied(true);}catch{setError('Copy failed. Select the response text to copy it manually.');}}
  return <section className="requests-panel" aria-label="Request inspector" aria-busy={busy}>
    <div className="requests-title"><p className="eyebrow">FOLLOW THE SUBMISSION</p><h1>What did the<br/><span>server say?</span></h1><p>Submit your form on the website. See the request and response here.</p></div>
    <div className="record-actions"><button className={capture.recording?'record-stop':'primary'} disabled={busy || !installed} onClick={()=>void action(capture.recording?'stop':'start')}>{capture.recording?<Square size={15}/>:<Radio size={17}/>} {busy?'Please wait…':capture.recording?'Stop recording':'Start recording'}</button><button className="icon-button" aria-label="Clear request history" title="Clear request history" disabled={busy || !capture.entries.length} onClick={()=>void action('clear')}><Trash2 size={17}/></button></div>
    <p className={`record-status ${capture.recording?'live':''}`} role="status"><span/>{capture.recording?`Recording ${capture.site}`:capture.message}</p>
    {error&&<p className="message error" role="alert">{error}</p>}
    {!capture.recording&&!capture.entries.length&&<p className="capture-note">Chrome shows a debugging notice while recording. Captures stay in memory, never go to Gemini, and stop when you switch tabs.</p>}
    <label className="request-search"><span className="sr-only">Filter requests</span><input placeholder="Filter by endpoint, method, or status" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="requests-count"><h2>Requests <span>{capture.entries.length}</span></h2><span>Last 50 · Fetch / XHR / Pages</span></div>
    <div className="request-list">{entries.map(item=>{const url=new URL(item.url);return <button className={`request-row ${selected===item.id?'selected':''}`} key={item.id} onClick={()=>setSelected(item.id)} aria-pressed={selected===item.id}><span className={`method ${item.method.toLowerCase()}`}>{item.method}</span><span className="endpoint"><strong>{url.pathname}{url.search}</strong><small>{url.host}</small></span><span className={`http-status ${item.state==='failed'||(item.status || 0)>=400?'bad':''}`}>{item.status || (item.state==='pending'?'…':item.state==='failed'?'ERR':'—')}<small>{item.duration!==undefined?`${item.duration} ms`:item.state}</small></span></button>;})}</div>
    {!entries.length&&<div className="empty"><Waypoints size={28}/><h2>{capture.entries.length?'No matching requests':capture.recording?'Waiting for your form':'Your next request starts here'}</h2><p>{capture.recording?'Submit a form or trigger an action on this tab. API calls and page submissions will appear here.':'Start recording, then submit a form on the website.'}</p></div>}
    {entry&&<section className="request-detail" aria-label="Selected request"><div className="detail-summary"><strong>{entry.method}</strong><span>{requestSummary(entry)}</span>{entry.duration!==undefined&&<small>{entry.duration} ms</small>}</div><p className="full-endpoint">{entry.url}</p><div className="detail-tabs" aria-label="Request detail view"><button aria-pressed={section==='request'} onClick={()=>{setSection('request');setCopied(false);}}><ArrowUpRight size={14}/> Request</button><button aria-pressed={section==='response'} onClick={()=>{setSection('response');setCopied(false);}}><ArrowDownLeft size={14}/> Response</button></div>
      <div className="body-heading"><h3>{section==='request'?'Submitted data':'Response body'}</h3><button className="icon-button" aria-label="Copy displayed body" title="Copy displayed body" disabled={body===undefined} onClick={()=>void copy()}>{copied?<Check size={15}/>:<Copy size={15}/>}</button></div>
      {body!==undefined?<pre className="payload" tabIndex={0}>{body || '(empty body)'}</pre>:<p className="hint">{entry.state==='pending'?'Waiting for the request to finish…':'No body available for this request.'}</p>}
      {entry.error&&<p className="message error">{entry.error}</p>}{entry.bodyNote&&<p className="hint">{entry.bodyNote}</p>}
      <details className="request-headers"><summary>{section==='request'?'Request':'Response'} headers <span>{Object.keys(headers).length}</span></summary><dl>{Object.entries(headers).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></details>
      <p className="capture-note">HTTP status describes the request. Check the response for application errors. Known credential fields are hidden; other body content may contain form data.</p>
    </section>}
  </section>;
}
