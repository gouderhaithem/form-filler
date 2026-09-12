import { useState } from 'react';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import type { Exclusions, ExclusionRule } from './data';

interface Props { value:Exclusions; onChange:(value:Exclusions)=>void; disabled:boolean }
export function ExclusionsPanel({value,onChange,disabled}:Props) {
  const [match,setMatch]=useState<ExclusionRule['match']>('label');
  const [text,setText]=useState('');
  const [site,setSite]=useState('');
  const [error,setError]=useState('');
  function addRule() {
    setError('');
    const ruleValue=text.trim();
    if(!ruleValue){setError('Enter the field label, name, ID, or selector.');return;}
    let hostname='';
    if(site.trim()) {
      try {
        const url=new URL(site.includes('://')?site.trim():`https://${site.trim()}`);
        if(!['http:','https:'].includes(url.protocol) || !url.hostname || url.hostname.includes('*')) throw new Error();
        hostname=url.hostname.toLowerCase().replace(/\.$/,'');
      } catch{setError('Enter a website such as example.com, or leave it empty for all websites.');return;}
    }
    if(match==='selector') {
      try{document.querySelector(ruleValue);}catch{setError('That CSS selector is invalid. Try #site-search or header select.');return;}
    }
    if(value.rules.some(rule=>rule.match===match && rule.value===ruleValue && rule.site===hostname)) {setError('That exclusion already exists.');return;}
    onChange({...value,rules:[...value.rules,{id:crypto.randomUUID(),match,value:ruleValue,site:hostname}]});
    setText('');setSite('');
  }
  return <section className="exclusions-panel" aria-label="Excluded fields">
    <div className="section-heading"><h2>Leave these fields alone</h2><ShieldCheck size={17}/></div>
    <p className="helper">Excluded fields keep their current values. The local filler and Gemini both skip them.</p>
    <label className="toggle-row"><span><strong>Skip search fields</strong><small>Search inputs and search labels in English, French, or Arabic.</small></span><input type="checkbox" disabled={disabled} checked={value.skipSearch} onChange={e=>onChange({...value,skipSearch:e.target.checked})}/></label>
    <label className="toggle-row"><span><strong>Skip headers and navigation</strong><small>Inputs and dropdowns inside page headers and navigation areas.</small></span><input type="checkbox" disabled={disabled} checked={value.skipHeader} onChange={e=>onChange({...value,skipHeader:e.target.checked})}/></label>
    <div className="exclusion-rules"><div className="section-heading"><h2>Your exclusions</h2><span className="subtle">{value.rules.length} rules</span></div>
      {!value.rules.length&&<p className="helper">Add a field such as “Language” or “Store location” to keep it unchanged.</p>}
      {value.rules.map(rule=><div className="exclusion-rule" key={rule.id}><div><strong>{rule.value}</strong><small>{rule.match==='selector'?'CSS selector':'Label / name / ID'} · {rule.site || 'All websites'}</small></div><button className="icon" disabled={disabled} aria-label={`Remove exclusion ${rule.value}`} onClick={()=>onChange({...value,rules:value.rules.filter(item=>item.id!==rule.id)})}><Trash2 size={15}/></button></div>)}
    </div>
    <form onSubmit={e=>{e.preventDefault();addRule();}}>
      <div className="gemini-field"><label htmlFor="exclude-match">Match by</label><select id="exclude-match" disabled={disabled} value={match} onChange={e=>{setMatch(e.target.value as ExclusionRule['match']);setError('');}}><option value="label">Label, name, ID, or placeholder</option><option value="selector">CSS selector (advanced)</option></select></div>
      <div className="gemini-field"><label htmlFor="exclude-value">{match==='selector'?'CSS selector':'Field to exclude'}</label><input id="exclude-value" disabled={disabled} value={text} onChange={e=>setText(e.target.value)} placeholder={match==='selector'?'e.g. #site-search or header select':'e.g. Language or siteSearch'}/></div>
      <div className="gemini-field"><label htmlFor="exclude-site">Website (optional)</label><input id="exclude-site" disabled={disabled} value={site} onChange={e=>setSite(e.target.value)} placeholder="All websites, or example.com"/><small>A domain applies to that site and its subdomains.</small></div>
      {error&&<p className="notice error" role="alert">{error}</p>}
      <button className="add" type="submit" disabled={disabled||!text.trim()}><Plus size={15}/> Add exclusion</button>
    </form>
    <p className="fine">Changes save automatically. Label rules use an exact match. A CSS selector can target a field or a whole container.</p>
  </section>;
}
