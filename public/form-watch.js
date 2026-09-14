// Runs only on permitted websites while Gemini is enabled. No entered values leave this script.
(() => {
  if (globalThis.__formlyWatcher) { globalThis.__formlyWatcher.refresh(); return; }
  let timer, stopped=false, previous='', lastScan=0;
  const fields='input:not([type=hidden]):not([type=submit]):not([type=button]),textarea,select';
  function check() {
    timer=undefined;if(stopped || document.visibilityState==='hidden')return;
    lastScan=Date.now();
    const controls=[...document.querySelectorAll(fields)].filter(el=>!el.disabled && el.getClientRects().length).slice(0,150);
    // Include descriptions/constraints/visibility, never .value, textarea text, or selected values.
    const fingerprint=JSON.stringify(controls.map(el=>[
      el.tagName,...['type','id','name','placeholder','autocomplete','aria-label','aria-labelledby','min','max','step','minlength','maxlength','pattern','required','readonly'].map(name=>el.getAttribute(name)),
      [...(el.labels || [])].map(label=>label.textContent?.slice(0,300)),
      (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id=>document.getElementById(id)?.textContent?.slice(0,300)),
    ]));
    if(fingerprint===previous)return;previous=fingerprint;
    if(!controls.length)return;
    void chrome.runtime.sendMessage({type:'formly:prepare'}).catch(()=>stop());
  }
  function schedule(){if(stopped || timer)return;timer=setTimeout(check,Math.max(250,1000-(Date.now()-lastScan)));}
  function refresh(){previous='';schedule();}
  const observer=new MutationObserver(schedule);
  observer.observe(document,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['type','id','name','placeholder','autocomplete','aria-label','aria-labelledby','min','max','step','minlength','maxlength','pattern','required','readonly','disabled','hidden','style','class','open']});
  function message(msg,sender){if(sender.id!==chrome.runtime.id)return;if(msg?.type==='formly:watch-stop')stop();if(msg?.type==='formly:watch-refresh')refresh();}
  function visible(){if(document.visibilityState==='visible')refresh();}
  function stop(){stopped=true;clearTimeout(timer);observer.disconnect();document.removeEventListener('visibilitychange',visible);chrome.runtime.onMessage.removeListener(message);delete globalThis.__formlyWatcher;}
  chrome.runtime.onMessage.addListener(message);document.addEventListener('visibilitychange',visible);
  globalThis.__formlyWatcher={refresh,stop};schedule();
})();
