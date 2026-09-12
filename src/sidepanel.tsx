import {RequestsPanel} from './RequestsPanel';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, ChevronRight, CircleMinus, ExternalLink, Eye, ListFilter, PanelRight, RefreshCw, Settings2, ShieldCheck, Sparkles, Undo2, X } from 'lucide-react';
import { isExtension } from './storage';
import type { FieldReport, PanelReply } from './panel-types';
import './sidepanel.css';

function SidePanel() {
  const [view,setView]=useState<'fields'|'requests'>('fields');
  const [page,setPage]=useState<PanelReply|null>(null);
  const [error,setError]=useState('');
  const [actionError,setActionError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState('');
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState('all');
  const [selected,setSelected]=useState<string|null>(null);
  const [value,setValue]=useState('');
  const version=useRef(0), working=useRef(false), current=useRef<PanelReply|null>(null);
  const installed=isExtension();
  const refresh=useCallback(async(explicit=false)=>{
    if(!installed){setLoading(false);return;}
    if(working.current)return;
    const seq=++version.current;
    try {
      const window=await chrome.windows.getCurrent();
      const [tab]=await chrome.tabs.query({active:true,windowId:window.id});
      if(seq!==version.current)return;
      if(tab?.id===undefined)throw new Error('Choose a website tab to inspect its form.');
      if(current.current?.tabId!==tab.id){current.current=null;setPage(null);setSelected(null);setNotice('');setActionError('');setLoading(true);}
      const reply:PanelReply=await chrome.runtime.sendMessage({type:'panel:inspect',tabId:tab.id});
      if(seq!==version.current)return;
      if(!reply.ok)throw new Error(reply.error || 'Could not inspect this page.');
      if(current.current?.documentId!==reply.documentId){setSelected(null);setNotice('');}
      current.current=reply;setPage(reply);setError('');
      if(explicit){setNotice('Field list refreshed.');setActionError('');}
    } catch(e) {if(seq===version.current){current.current=null;setPage(null);setSelected(null);setError(e instanceof Error?e.message:'Could not inspect this page.');}}
    finally {if(seq===version.current)setLoading(false);}
  },[installed]);
  useEffect(()=>{
    void refresh();
    if(!installed)return;
    const interval=window.setInterval(()=>void refresh(),2500);
    const invalidate=()=>{++version.current;current.current=null;setPage(null);setSelected(null);setNotice('');setActionError('');setLoading(true);};
    const activated=()=>{invalidate();void refresh();};
    const updated=(tabId:number,change:chrome.tabs.TabChangeInfo)=>{
      if(current.current && current.current.tabId!==tabId)return;
      if(change.status==='loading' || change.url){invalidate();}
      if(change.status==='complete' || change.url)void refresh();
    };
    chrome.tabs.onActivated.addListener(activated);chrome.tabs.onUpdated.addListener(updated);
    return()=>{++version.current;window.clearInterval(interval);chrome.tabs.onActivated.removeListener(activated);chrome.tabs.onUpdated.removeListener(updated);};
  },[installed,refresh]);
  async function action(type:string,fieldId?:string) {
    const target=current.current;
    if(!target?.documentId || working.current)return;
    working.current=true;const seq=++version.current;setBusy(type);setActionError('');setNotice('');
    try {
      const reply:PanelReply=await chrome.runtime.sendMessage({type:`panel:${type}`,tabId:target.tabId,documentId:target.documentId,fieldId,value});
      if(!reply.ok)throw new Error(reply.error || 'Could not complete this action.');
      if(seq!==version.current)return;
      current.current=reply;setPage(reply);
      if(type==='rule'){setNotice('Custom value saved for this field on this website. Use Fill again to apply it.');setSelected(null);setValue('');}
      if(type==='exclude'){setNotice('This field will be skipped on this website. Manage exclusions in Options.');setSelected(null);}
      if(type==='undo')setNotice(`${reply.restored || 0} fields restored.${reply.kept?` ${reply.kept} changed or removed fields kept.`:''}`);
      if(type==='fill')setNotice('Fill complete. Review the form before submitting.');
    } catch(e){setActionError(e instanceof Error?e.message:'The action failed.');}
    finally{working.current=false;setBusy('');void refresh();}
  }
  const fields=page?.fields || [];
  const filled=fields.filter(field=>field.status==='filled').length;
  const skipped=fields.filter(field=>field.status==='skipped' || field.status==='incompatible').length;
  const visible=fields.filter(field=>filter==='all' || (filter==='filled'?field.status==='filled':field.status==='skipped' || field.status==='incompatible'));
  const active=fields.find(field=>field.id===selected);
  function choose(field:FieldReport){setSelected(field.id);setValue('');void action('highlight',field.id);}
  const editor=active&&<section className="field-editor" aria-label="Field controls"><div className="editor-heading"><h2>{active.label}</h2><button className="icon-button" aria-label="Close field controls" onClick={()=>setSelected(null)}><X size={17}/></button></div><button className="text-button" disabled={!!busy} onClick={()=>void action('highlight',active.id)}><Eye size={15}/> Show on page</button>{active.editable&&active.reason!=='Excluded by your settings'?<form onSubmit={e=>{e.preventDefault();void action('rule',active.id);}}><label htmlFor="field-value">Custom test value</label><input id="field-value" value={value} onChange={e=>setValue(e.target.value)} placeholder="e.g. PRJ-001" maxLength={5000} required/><p className="hint">Saved for this field on this website.</p><button className="secondary" disabled={!!busy || !value.trim()}>Save field rule</button><button className="text-button exclude" type="button" disabled={!!busy} onClick={()=>void action('exclude',active.id)}>Exclude this field</button></form>:<p className="hint">{active.reason}. You can manage generator settings and exclusions in Options.</p>}</section>;
  return <div className="panel-shell">
    <header className="panel-header"><a className="brand" href="./welcome.html" target="_blank" rel="noreferrer"><img src="./icons/icon-32.png" alt=""/><strong>formly</strong></a><span className="companion">PAGE COMPANION</span><button className="icon-button" aria-label="Open settings" title="Open settings" onClick={()=>installed?void chrome.runtime.openOptionsPage():window.open('./index.html','_blank')}><Settings2 size={18}/></button></header>
    <nav className="companion-tabs" aria-label="Panel views"><button aria-pressed={view==='fields'} onClick={()=>setView('fields')}>Fields</button><button aria-pressed={view==='requests'} onClick={()=>setView('requests')}>Requests</button></nav>
    <main hidden={view!=='fields'} aria-busy={!!busy || loading} data-document-id={page?.documentId}>
      <section className="page-heading"><p className="eyebrow">YOUR FORM, AT A GLANCE</p><h1>A little help.<br/><span>Right beside you.</span></h1><p className="site-name"><ShieldCheck size={14}/>{page?.origin?new URL(page.origin).host:'Your current website'}</p></section>
      <div className="primary-actions"><button className="primary" disabled={!page || !!busy || loading} onClick={()=>void action('fill')}><Sparkles size={17}/>{busy==='fill'?'Filling your form…':filled?'Fill again':'Fill this page'}</button><button className="icon-button refresh" title="Refresh field list" aria-label="Refresh field list" disabled={!!busy} onClick={()=>void refresh(true)}><RefreshCw size={17}/></button></div>
      <button className="undo" disabled={!page?.canUndo || !!busy} onClick={()=>void action('undo')}><Undo2 size={15}/>{busy==='undo'?'Restoring…':'Undo last fill'}</button>
      {notice&&<p className="message success" role="status">{notice}</p>}
      {(error||actionError)&&<div className="message error" role="alert"><strong>{page?"Could not complete this action":"Page access needed"}</strong><p>{error||actionError}</p></div>}
      {!installed&&<div className="empty"><PanelRight size={28}/><h2>Your form, in view</h2><p>Install the extension, then right-click its toolbar icon and choose <strong>Open Formly panel</strong>.</p><p>You can also press <strong>Alt + Shift + F</strong>.</p></div>}
      {installed&&loading&&<p className="empty" role="status">Looking for fields…</p>}
      {page&&<>
        <div className="results-heading"><h2>Form fields <span>{fields.length}</span></h2><span>{filled} filled · {skipped} skipped</span></div>
        <div className="filters" aria-label="Filter fields"><ListFilter size={15}/>{[['all','All fields'],['filled','Filled'],['skipped','Skipped']].map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div>
        <div className="field-list">{visible.map(field=><React.Fragment key={field.id}><button className={`field-row ${selected===field.id?'selected':''}`} key={field.id} onClick={()=>choose(field)} disabled={!!busy} aria-label={`${field.label}: ${field.status}. ${field.reason}`}><span className={`field-status ${field.status}`}>{field.status==='filled'?<Check size={15}/>:field.status==='ready'?<span className="ready-dot"/>:<CircleMinus size={15}/>}</span><span className="field-copy"><strong>{field.label}</strong><span>{field.status==='filled'?field.value:field.reason}</span></span><ChevronRight size={15}/></button>{selected===field.id&&editor}</React.Fragment>)}</div>
        {!visible.length&&<div className="empty"><Eye size={25}/><h2>{fields.length?'No fields in this view':'No native form fields found'}</h2><p>{fields.length?'Try another filter or fill this page.':'Open a form, or reveal its next step and refresh. Embedded frames and custom widgets may not be supported.'}</p></div>}
      </>}

    </main>
    {view==='requests'&&<main><RequestsPanel/></main>}
    <footer className="panel-footer"><span><span className="status-dot"/>You control submission</span><a href="./index.html" target="_blank" rel="noreferrer">All settings <ExternalLink size={12}/></a></footer>
  </div>;
}
createRoot(document.getElementById('root')!).render(<SidePanel/>);
