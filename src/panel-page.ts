import type { PanelPageState, ControlSnapshot, Control } from './panel-types';
// Runs in the same isolated world as fillPage. DOM references and undo values never leave it.
export function panelPageAction(action:'highlight'|'undo'|'field',documentId:string,id?:string) {
  const state=globalThis as typeof globalThis & {__formlyDocumentId?:string;__formlyPanel?:PanelPageState};
  if(state.__formlyDocumentId!==documentId || !state.__formlyPanel) throw new Error('This page changed. Refresh the field list.');
  const panel=state.__formlyPanel;
  if(action==='undo') {
    const snapshot=(el:Control):ControlSnapshot=>({value:el.value,...(el instanceof HTMLInputElement && ['checkbox','radio'].includes(el.type)?{checked:el.checked}:{}),...(el instanceof HTMLSelectElement?{selected:Array.from(el.options,o=>o.selected)}:{})});
    const eligible=panel.undo.filter(entry=>entry.element.isConnected && JSON.stringify(snapshot(entry.element))===JSON.stringify(entry.after));
    // Restore radio groups atomically so a manual choice in one member stays untouched.
    const safe=eligible.filter(entry=>!(entry.element instanceof HTMLInputElement && entry.element.type==='radio') || panel.undo.filter(other=>other.element instanceof HTMLInputElement && other.element.type==='radio' && other.element.form===entry.element.form && other.element.name===entry.element.name).every(other=>eligible.includes(other)));
    const kept=panel.undo.length-safe.length;
    for(const entry of safe) {
      const el=entry.element;
      if(entry.before.checked!==undefined) Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'checked')?.set?.call(el,entry.before.checked);
      else if(el instanceof HTMLSelectElement && entry.before.selected) Array.from(el.options).forEach((option,i)=>option.selected=entry.before.selected![i] ?? false);
      else Object.getOwnPropertyDescriptor(el instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLTextAreaElement.prototype,'value')?.set?.call(el,entry.before.value);
    }
    for(const entry of safe){entry.element.dispatchEvent(new Event('input',{bubbles:true}));entry.element.dispatchEvent(new Event('change',{bubbles:true}));}
    panel.undo=[];panel.reports.clear();
    return {restored:safe.length,kept};
  }
  const el=id?panel.elements.get(id):undefined;
  if(!el?.isConnected) throw new Error('This field was removed. Refresh the field list.');
  if(action==='highlight') {
    el.scrollIntoView({behavior:'smooth',block:'center'});
    el.focus({preventScroll:true});
    el.animate([{outline:'3px solid #5370ce',outlineOffset:'4px'},{outline:'3px solid #5370ce',outlineOffset:'4px'},{outline:'3px solid transparent',outlineOffset:'7px'}],{duration:1800});
    return {};
  }
  const parts:string[]=[];
  let node:Element|null=el;
  while(node && node!==document.documentElement){
    if(node.id && document.querySelectorAll(`#${CSS.escape(node.id)}`).length===1){parts.unshift(`#${CSS.escape(node.id)}`);break;}
    const parent:Element|null=node.parentElement;
    parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${parent?Array.from(parent.children).indexOf(node)+1:1})`);
    node=parent;
  }
  return {selector:parts.join(' > '),site:location.hostname,label:panel.reports.get(el)?.label || el.getAttribute('aria-label') || el.name || el.id || 'Custom field'};
}
