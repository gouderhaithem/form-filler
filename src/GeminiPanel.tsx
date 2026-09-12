import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, RefreshCw, Trash2 } from 'lucide-react';
import { MODELS, MIN_CACHE_MINUTES, MAX_CACHE_MINUTES, defaultGemini, validCacheMinutes, type GeminiConfig } from './gemini';
import { isExtension } from './storage';

interface CacheStatus { batches:number; suggestions:number; expiresAt:number|null; lastMessage:string }
const emptyStatus:CacheStatus={batches:0,suggestions:0,expiresAt:null,lastMessage:''};
interface Reply { ok:boolean; error?:string; config?:GeminiConfig; status?:CacheStatus; models?:string[] }
async function send(message:object):Promise<Reply> {
  const reply:Reply=await chrome.runtime.sendMessage(message);
  if(!reply?.ok) throw new Error(reply?.error || 'The extension did not respond. Reload Formly and try again.');
  return reply;
}

export function GeminiPanel() {
  const [config,setConfig]=useState<GeminiConfig>(defaultGemini);
  const [cache,setCache]=useState<CacheStatus>(emptyStatus);
  const [models,setModels]=useState<string[]>([...MODELS]);
  const [visible,setVisible]=useState(false);
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [now,setNow]=useState(Date.now());
  const [cacheMinutes,setCacheMinutes]=useState(String(defaultGemini.cacheMinutes));
  const installed=isExtension();
  useEffect(()=>{
    let active=true;
    if(!installed){setReady(true);return;}
    send({type:'gemini:get'}).then(reply=>{if(active){setConfig(reply.config!);setCacheMinutes(String(reply.config!.cacheMinutes));setCache(reply.status!);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setReady(true);});
    const timer=setInterval(()=>{setNow(Date.now());},1000);
    const refresh=setInterval(()=>{void send({type:'gemini:status'}).then(reply=>{if(active)setCache(reply.status!);}).catch(()=>{});},15000);
    return()=>{active=false;clearInterval(timer);clearInterval(refresh);};
  },[installed]);
  useEffect(()=>{
    if(ready && window.location.hash==='#cache') document.getElementById('cache')?.scrollIntoView();
  },[ready]);
  async function action(name:string,work:()=>Promise<void>) {
    setBusy(name);setError('');setMessage('');
    try{await work();}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy('');}
  }
  function save() {
    void action('save',async()=>{
      if(config.enabled) {
        if(!config.apiKey.trim()) throw new Error('Enter your API key first.');
        const granted=await chrome.permissions.request({origins:['http://*/*','https://*/*']});
        if(!granted) throw new Error('Website access is needed to prepare data on reload. Allow access and save again.');
      }
      const reply=await send({type:'gemini:save',config});setConfig(reply.config!);setCache(reply.status!);
      setMessage(config.enabled?'Saved. Reload a website to prepare its suggestions.':'Saved. Local generation is active.');
    });
  }
  const disabled=!installed||!ready||!!busy;
  const seconds=Math.max(0,Math.ceil(((cache.expiresAt || now)-now)/1000));
  const durationValid=validCacheMinutes(Number(cacheMinutes));
  return <section className="gemini-panel" aria-label="Gemini settings">
    <div className="section-heading"><h2>Context for unfamiliar fields</h2><span className="gemini-tag">GEMINI</span></div>
    <p className="helper">Gemini reads field labels and prepares relevant words and phrases when a website loads. The toolbar icon fills them when you click.</p>
    {!installed&&<div className="gemini-info">Open Formly’s extension <strong>Options</strong> to connect your key. This webpage is a local UI preview.</div>}
    <label className="toggle-row"><span><strong>Use Gemini for unknown fields</strong><small>Prepare suggestions automatically on website reload.</small></span><input type="checkbox" checked={config.enabled} disabled={disabled} onChange={e=>setConfig({...config,enabled:e.target.checked})}/></label>
    <div className="gemini-field"><label htmlFor="gemini-key"><KeyRound size={13}/> API key</label><div className="key-input"><input id="gemini-key" type={visible?'text':'password'} value={config.apiKey} autoComplete="off" spellCheck={false} disabled={disabled} placeholder="Paste your Gemini API key" onChange={e=>setConfig({...config,apiKey:e.target.value})}/><button className="icon" aria-label={visible?'Hide API key':'Show API key'} disabled={disabled} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={16}/>:<Eye size={16}/>}</button></div><a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Get a key in Google AI Studio ↗</a></div>
    <div className="gemini-field"><label htmlFor="gemini-model">Model</label><select id="gemini-model" value={config.model} disabled={disabled} onChange={e=>setConfig({...config,model:e.target.value})}>{[...new Set([config.model,...models])].map(model=><option key={model}>{model}</option>)}</select><small>Test your key to confirm which of these it can reach. Requests use your Gemini quota.</small></div>
    <div className="gemini-buttons"><button className="secondary" disabled={disabled||!config.apiKey.trim()} onClick={()=>void action('test',async()=>{const reply=await send({type:'gemini:test',apiKey:config.apiKey});setModels(reply.models!);if(!reply.models!.includes(config.model))setConfig({...config,model:reply.models![0]});setMessage('Key accepted. Choose a model, then save.');})}><RefreshCw size={14}/>{busy==='test'?'Testing…':'Test key'}</button><button className="primary" disabled={disabled} onClick={save}><Check size={14}/>{busy==='save'?'Saving…':'Save settings'}</button></div>
    {error&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice success" role="status">{message}</p>}
    <section id="cache" className="cache-controls" aria-labelledby="cache-heading">
      <div className="section-heading"><h2 id="cache-heading">Suggestion cache</h2><span className="cache-duration">{config.cacheMinutes} min</span></div>
      <p className="helper">Keep a batch ready for your next click. Choose how long suggestions stay available.</p>
      <form onSubmit={event=>{event.preventDefault();if(!durationValid)return;void action('cache',async()=>{
        const reply=await send({type:'gemini:cache',cacheMinutes:Number(cacheMinutes)});
        setConfig(current=>({...current,cacheMinutes:reply.config!.cacheMinutes}));setCache(reply.status!);
        setMessage(`Cache expiry saved: ${reply.config!.cacheMinutes} ${reply.config!.cacheMinutes===1?'minute':'minutes'}. Previous suggestions cleared.`);
      });}}>
        <label htmlFor="cache-minutes">Cache expiry (minutes)</label>
        <div className="cache-input-row"><input id="cache-minutes" type="number" min={MIN_CACHE_MINUTES} max={MAX_CACHE_MINUTES} step="1" required value={cacheMinutes} disabled={disabled} aria-describedby="cache-hint" aria-invalid={!durationValid} onChange={event=>setCacheMinutes(event.target.value)}/><button type="submit" className="secondary" disabled={disabled||!durationValid||Number(cacheMinutes)===config.cacheMinutes}>{busy==='cache'?'Saving…':'Save expiry'}</button></div>
        <p id="cache-hint" className={`cache-hint${durationValid?'':' invalid'}`}>1–60 minutes. Saving clears existing suggestions and applies the new duration to fresh batches.</p>
      </form>
      <div className="cache-summary"><div><strong>{cache.batches&&seconds?`${cache.suggestions} suggestions ready`:'Cache is empty'}</strong><small>{cache.batches&&seconds?`${cache.batches} ${cache.batches===1?'batch':'batches'} · next expiry ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'New suggestions are prepared when needed.'}</small></div><button className="cache-clear" aria-label="Clear Gemini cache" disabled={disabled} onClick={()=>void action('clear',async()=>{const reply=await send({type:'gemini:clear'});setCache(reply.status!);setMessage('Cached suggestions cleared.');})}><Trash2 size={14}/> Clear cache</button></div>
    </section>
    {cache.lastMessage&&<p className="helper" role="status">{cache.lastMessage}</p>}
    <p className="gemini-privacy">Only field labels, names, placeholders, and constraints go to Google. Entered values are excluded. Your key stays in local extension storage, which is not encrypted. Suggestions expire after your chosen duration; local words remain the fallback.</p>
    <button className="text-button" disabled={disabled||!config.apiKey} onClick={()=>void action('forget',async()=>{const reply=await send({type:'gemini:save',config:{...config,apiKey:'',enabled:false}});setConfig(reply.config!);setCache(reply.status!);setMessage('Key removed and cache cleared.');})}>Remove saved key</button>
  </section>;
}
