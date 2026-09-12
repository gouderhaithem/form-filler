// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { fillPage, type FillRequest } from '../src/engine';
import { panelPageAction } from '../src/panel-page';
import { generateValues } from '../src/data';
const request:FillRequest={values:generateValues('en'),custom:[],overwrite:true,fillUnknown:true,passwords:false};
const input=(id:string)=>document.getElementById(id) as HTMLInputElement;
beforeEach(()=>{
  document.body.replaceChildren();
  vi.spyOn(Element.prototype,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
it('reports fill and skip reasons without exposing preserved, password, or hidden values',()=>{
  document.body.innerHTML='<input id="email" type="email"><input id="firstName" value="Personal name"><input id="pwd" type="password" value="private"><input id="hidden" type="hidden" value="secret"><input id="q" type="search"><input id="fixed" disabled><label for="terms">I agree to terms</label><input id="terms" type="checkbox">';
  const result=fillPage({...request,overwrite:false});
  expect(result.fields?.find(f=>f.label==='email')).toMatchObject({status:'filled',value:request.values.email});
  expect(result.fields?.find(f=>f.label==='firstName')).toMatchObject({status:'skipped',reason:'Existing value preserved'});
  expect(result.fields?.find(f=>f.label==='pwd')).toMatchObject({reason:'Password filling disabled'});
  expect(result.fields?.find(f=>f.label==='q')).toMatchObject({reason:'Excluded by your settings'});
  expect(result.fields?.find(f=>f.label==='fixed')).toMatchObject({reason:'Disabled field'});
  expect(result.fields?.find(f=>f.label==='I agree to terms')).toMatchObject({reason:'Consent field stays untouched'});
  expect(JSON.stringify(result.fields)).not.toMatch(/Personal name|private|secret|hidden/);
});
it('inspect and Gemini scans do not fill the form or replace its undo snapshot',()=>{
  document.body.innerHTML='<input id="firstName" value="Before"><input id="project">';
  const filled=fillPage(request);
  const after=input('firstName').value;
  const scanned=fillPage({...request,mode:'scan'});
  expect(scanned.fields).toBeUndefined();
  expect(fillPage({...request,mode:'inspect'}).canUndo).toBe(true);
  expect(input('firstName').value).toBe(after);
  expect(panelPageAction('undo',filled.documentId!)).toMatchObject({restored:2,kept:0});
  expect(input('firstName').value).toBe('Before');
  expect(input('project').value).toBe('');
});
it('undo preserves manual edits, restores native choices, and expires after one use',()=>{
  document.body.innerHTML='<input id="firstName" value="Before"><input id="email" type="email"><select id="country"><option value="">Choose</option><option value="FR">France</option></select><input id="choice" type="checkbox">';
  const result=fillPage(request);
  input('firstName').value='My correction';
  const undo=panelPageAction('undo',result.documentId!);
  expect(undo).toMatchObject({restored:3,kept:1});
  expect(input('firstName').value).toBe('My correction');
  expect(input('email').value).toBe('');
  expect(input('country').value).toBe('');
  expect(input('choice').checked).toBe(false);
  expect(fillPage({...request,mode:'inspect'}).canUndo).toBe(false);
});
it('rejects stale documents and removed fields instead of using their old positions',()=>{
  document.body.innerHTML='<input id="firstName">';
  const result=fillPage(request),id=result.fields![0].id;
  expect(()=>panelPageAction('undo','older-document')).toThrow(/page changed/);
  input('firstName').remove();
  expect(()=>panelPageAction('field',result.documentId!,id)).toThrow(/removed/);
  expect(fillPage({...request,expectedDocument:'older-document'}).stale).toBe(true);
});
it('limits targeted custom values to the chosen field and website even with autocomplete',()=>{
  document.body.innerHTML='<input id="one" autocomplete="given-name"><input id="two" autocomplete="given-name">';
  const custom=[{id:'rule',label:'First name',value:'Fixture',selector:'#one',site:location.hostname}];
  fillPage({...request,custom});
  expect(input('one').value).toBe('Fixture');expect(input('two').value).toBe(request.values.firstName);
  fillPage({...request,custom:[{...custom[0],site:'different.example'}]});
  expect(input('one').value).toBe(request.values.firstName);
});
it('keeps a manually changed radio group intact during undo',()=>{
  document.body.innerHTML='<input type="radio" id="a" name="contact" checked><input type="radio" id="b" name="contact"><input type="radio" id="c" name="contact">';
  const result=fillPage(request);
  input('a').checked=true;
  panelPageAction('undo',result.documentId!);
  expect(input('a').checked).toBe(true);
  expect([input('b'),input('c')].some(el=>el.checked)).toBe(false);
});
