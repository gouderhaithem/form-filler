import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, Check, ChevronDown, ChevronRight, Copy, FlaskConical, Plus, Settings2, Shuffle, Sparkles, Trash2, X } from 'lucide-react';
import { defaults, fields, generateIdentities, generateValues, type Settings, type Values } from './data';
import { generateSamples } from './samples';
import { fillPage, type FillResult } from './engine';
import { isExtension, readSettings, saveSettings } from './storage';
import './style.css';
import { GeminiPanel } from './GeminiPanel';
import { ExclusionsPanel } from './ExclusionsPanel';

type Section = 'gemini'|'generate'|'custom'|'excluded';
function App() {
  const [settings,setSettings] = useState<Settings>(defaults);
  const [values,setValues] = useState<Values>(()=>generateValues('en'));
  const [ready,setReady] = useState(false);
  const [busy,setBusy] = useState(false);
  const [tab,setTab] = useState<Section>(()=>{
    const section=window.location.hash.slice(1);
    return section==='generate'||section==='custom'||section==='excluded'?section:'gemini';
  });
  const [expanded,setExpanded] = useState(false);
  const [options,setOptions] = useState(false);
  const [error,setError] = useState('');
  const [result,setResult] = useState<FillResult|null>(null);
  const [copied,setCopied] = useState('');
  const saveQueue = useRef(Promise.resolve());
  useEffect(()=> { let active=true; readSettings().then(s=>{ if(active){setSettings(s);setValues(generateValues(s.locale));} }).catch(()=>{if(active)setError('Could not load your settings. You can still generate data.');}).finally(()=>{if(active)setReady(true);}); return()=>{active=false;}; },[]);
  function update(next:Settings) {
    setSettings(next);
    saveQueue.current = saveQueue.current.then(()=>saveSettings(next)).catch(()=>setError('Could not save your settings. Please try again.'));
  }
  function regenerate() { setValues(generateValues(settings.locale));setResult(null);setError(''); }
  async function fill() {
    setBusy(true);setError('');setResult(null);
    const fresh = generateValues(settings.locale);setValues(fresh);
    try {
      const request = { exclusions:settings.exclusions,values:fresh,identities:generateIdentities(settings.locale),samples:generateSamples(settings.locale),custom:settings.custom,overwrite:settings.overwrite,fillUnknown:settings.fillUnknown,passwords:settings.passwords };
      if (isExtension()) {
        const [active] = await chrome.tabs.query({active:true,currentWindow:true});
        if (!active?.id) throw new Error('Open a webpage with a form, then try again.');
        const responses = await chrome.scripting.executeScript({target:{tabId:active.id},func:fillPage,args:[request]});
        if (!responses[0]?.result) throw new Error('The page did not respond. Reopen the extension and try again.');
        setResult(responses[0].result);
      } else {
        const demo = document.querySelector<HTMLIFrameElement>('#demo-form');
        if (!demo?.contentWindow) throw new Error('Demo form is still loading. Try again.');
        demo.contentWindow.postMessage({type:'formly-fill',request},window.location.origin);
      }
    } catch(e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      setError(/cannot access|extensions gallery|chrome:\/\/|edge:\/\//i.test(message) ? 'This browser page cannot be filled. Open a regular website with a form and try again.' : message);
    } finally { setBusy(false); }
  }
  useEffect(()=>{
    const listener=(event:MessageEvent)=>{ if(event.origin===window.location.origin && event.source===document.querySelector<HTMLIFrameElement>('#demo-form')?.contentWindow && event.data?.type==='formly-result') setResult(event.data.result); };
    window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener);
  },[]);
  async function copy(key:string,value:string) {
    try {await navigator.clipboard.writeText(value);setCopied(key);setTimeout(()=>setCopied(''),1600);}catch{setError('Copy failed. You can select and copy the value manually.');}
  }
  const shown = expanded ? fields.filter(([key])=>key!=='password'||settings.passwords) : fields.filter(([key])=>['fullName','username','email','phone'].includes(key));
  return <div className={isExtension()?'extension':'workspace'}>
    <main className="panel">
      <header><div className="brand"><img className="brand-icon" src="./icons/icon-128.png" width="34" height="34" alt=""/>formly<span className="badge">TEST DATA</span></div><button className={`icon ${options?'active':''}`} aria-label="Toggle settings" onClick={()=>setOptions(!options)}><Settings2 size={19}/></button></header>
      <nav aria-label="Sections"><button className={tab==='gemini'?'selected':''} onClick={()=>setTab('gemini')}><Sparkles size={15}/> Gemini</button><button className={tab==='generate'?'selected':''} onClick={()=>setTab('generate')}><Shuffle size={15}/> Generator</button><button className={tab==='custom'?'selected':''} onClick={()=>setTab('custom')}>Custom fields {settings.custom.length>0&&<span className="count">{settings.custom.length}</span>}</button><button className={tab==='excluded'?'selected':''} onClick={()=>setTab('excluded')}>Excluded fields</button></nav>
      <div className="content">
        <div className="eyebrow"><span/> YOUR FORM, FILLED.</div>
        <h1>{tab==='gemini'?'A little context.':tab==='excluded'?'Choose what':'Less typing.'}<br/><span>{tab==='gemini'?'Better test data.':tab==='excluded'?'stays untouched.':'More testing.'}</span></h1>
        <p className="intro">{tab==='gemini'?'Relevant suggestions for fields the local generator doesn’t recognize.':tab==='excluded'?'Keep search bars, navigation controls, and selected fields unchanged.':'Fresh, consistent test data for your forms. Names, addresses, and everything in between.'}</p>
        {options&&<section className="options"><h2>Fill settings</h2>{([
          ['overwrite','Replace existing values','Overwrite fields that already have a value.'],
          ['fillUnknown','Fill unknown fields','Fill every editable field, even if its value is invalid.'],
          ['passwords','Generate test passwords','Fill password and confirmation fields.'],
        ] as const).map(([key,label,description])=><label className="toggle-row" key={key}><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={settings[key]} disabled={!ready||busy} onChange={e=>update({...settings,[key]:e.target.checked})}/></label>)}<p className="fine">Consent stays manual. Forms are never submitted.</p></section>}
        {tab==='gemini'?<GeminiPanel/>:tab==='excluded'?<ExclusionsPanel value={settings.exclusions} disabled={!ready||busy} onChange={exclusions=>update({...settings,exclusions})}/>:tab==='generate'?<>
          <div className="section-heading"><h2>Generated identity</h2><label className="locale"><span className="sr-only">Data language</span><select disabled={!ready||busy} value={settings.locale} onChange={e=>{const locale=e.target.value as Settings['locale'];update({...settings,locale});setValues(generateValues(locale));setResult(null);}}><option value="en">English</option><option value="fr">Français</option><option value="ar">العربية</option></select><ChevronDown size={13}/></label></div>
          <div className="identity"><span className="avatar">{values.firstName.slice(0,1)}{values.lastName.slice(0,1)}</span><div><strong dir="auto">{values.fullName}</strong><small>{values.jobTitle} · {values.company}</small></div><button className="icon" title="Generate another identity" aria-label="Generate another identity" onClick={regenerate} disabled={busy}><Shuffle size={17}/></button></div>
          <div className="values">{shown.map(([key,label])=><div className="value-row" key={key}><span>{label}</span><div><b dir="auto">{values[key]}</b><button className="copy" aria-label={`Copy ${label}`} onClick={()=>copy(key,values[key])}>{copied===key?<Check size={13}/>:<Copy size={13}/>}</button></div></div>)}</div>
          <button className="expand" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?<ChevronDown size={14}/>:<ChevronRight size={14}/>} {expanded?'Show fewer fields':`Explore all ${fields.length} field types`}</button>
          <div className="language-note"><span>EN</span><span>FR</span><span>AR</span><p>Recognizes labels in all three languages.<br/>Synthetic samples; field validity may vary.</p></div>
        </>:<section className="custom"><div className="section-heading"><h2>Your field rules</h2><span className="subtle">{settings.custom.length} rules</span></div><p className="helper">Match a label, name, or ID with a test value. Your value is inserted exactly as entered. Autocomplete takes priority.</p>{settings.custom.length===0&&<div className="empty"><Plus size={24}/><strong>Make any field familiar</strong><p>Add labels such as “Project code” or “Matricule”<br/>and choose the value to fill.</p></div>}{settings.custom.map((field,index)=><div className="custom-row" key={field.id}><div><label htmlFor={`label-${field.id}`}>Field label</label><input id={`label-${field.id}`} placeholder="e.g. Project code" value={field.label} onChange={e=>update({...settings,custom:settings.custom.map((c,i)=>i===index?{...c,label:e.target.value}:c)})}/></div><div><label htmlFor={`value-${field.id}`}>Test value</label><input id={`value-${field.id}`} placeholder="e.g. PRJ-001" value={field.value} onChange={e=>update({...settings,custom:settings.custom.map((c,i)=>i===index?{...c,value:e.target.value}:c)})}/></div><button className="icon delete" aria-label={`Delete rule ${index+1}`} onClick={()=>update({...settings,custom:settings.custom.filter((_,i)=>i!==index)})}><Trash2 size={16}/></button></div>)}<button className="add" disabled={!ready} onClick={()=>update({...settings,custom:[...settings.custom,{id:crypto.randomUUID(),label:'',value:''}]})}><Plus size={15}/> Add custom field</button></section>}
      </div>
      <div className="actionbar">
        {error&&<div className="notice error" role="alert"><span>{error}</span><button className="icon" aria-label="Dismiss error" onClick={()=>setError('')}><X size={15}/></button></div>}
        {result&&<div className="notice success" role="status"><Check size={17}/><div><strong>{result.filled} {result.filled===1?'field':'fields'} filled</strong><small>{result.preserved} kept · {result.unmatched} unrecognized · {result.invalid} incompatible</small>{result.filled===0&&<small>Try enabling “Fill unknown fields” in settings.</small>}</div></div>}
{!isExtension()&&<button className="fill" onClick={fill} disabled={!ready||busy}><Sparkles size={18}/>{busy?'Filling your form…':'Generate & fill'}<ArrowUpRight size={18}/></button>}
        {isExtension()&&<p className="helper">To fill a website, switch to its tab and click the Formly toolbar icon. These settings apply automatically.</p>}
        <p className="footnote">New data with every click. {settings.overwrite?'Existing values will be replaced.':'Existing values are kept.'}</p>
      </div>
      <footer><span><span className="status-dot"/> Your browser, your test data</span><a className="welcome-link" href="./welcome.html" target="_blank" rel="noreferrer">Welcome guide ↗</a><span>v0.7</span></footer>
    </main>
    {!isExtension()&&<section className="demo"><div className="demo-header"><FlaskConical size={20}/><div><h2>Try it on a real form</h2><p>This local demo uses the same filling engine as the extension.</p></div><a href="/demo.html" target="_blank" rel="noreferrer">Open form <ArrowUpRight size={14}/></a></div><iframe id="demo-form" title="Mixed-language test form" src="/demo.html"/><p className="demo-tip">Use the generator on the left, then watch the fields fill here.</p></section>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
