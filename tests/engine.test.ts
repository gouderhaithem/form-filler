// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fillPage, type FillRequest } from '../src/engine';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';
const values={...generateValues('en'),quantity:'3',price:'49.99',country:'United States'};
const request:FillRequest={values,identities:generateIdentities('en'),samples:generateSamples('en'),custom:[],overwrite:false,fillUnknown:false,passwords:false};
beforeEach(()=>{
  document.body.replaceChildren();
  vi.spyOn(Element.prototype,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
function field(id:string){return document.getElementById(id) as HTMLInputElement;}
describe('form filling',()=>{
  it('matches multilingual labels and autocomplete with a consistent identity',()=>{
    document.body.innerHTML='<label for="a">Prénom</label><input id="a"><label for="b">اللقب</label><input id="b"><input id="c" autocomplete="name"><input id="d" type="email"><label for="e">اسم المستخدم</label><input id="e">';
    expect(fillPage(request).filled).toBe(5);
    expect(field('a').value).toBe(values.firstName);expect(field('b').value).toBe(values.lastName);
    expect(field('c').value).toBe(`${values.firstName} ${values.lastName}`);expect(field('d').value).toBe(values.email);expect(field('e').value).toBe(values.username);
  });
  it('preserves existing values and excludes passwords, hidden, payment, readonly and consent',()=>{
    document.body.innerHTML='<input id="firstName" value="My name"><input id="password" type="password"><input id="secret" type="hidden"><input id="card" autocomplete="cc-number"><input id="email" readonly><label for="terms">I agree to terms</label><input id="terms" type="checkbox">';
    const result=fillPage({...request,fillUnknown:true});expect(result.filled).toBe(0);expect(result.preserved).toBe(1);expect(field('firstName').value).toBe('My name');expect(field('terms').checked).toBe(false);expect(field('card').value).toBe('');
  });
  it('overwrites only when requested and dispatches form events',()=>{
    document.body.innerHTML='<input id="firstName" value="Before">';const input=vi.fn(),change=vi.fn();field('firstName').addEventListener('input',input);field('firstName').addEventListener('change',change);
    fillPage({...request,overwrite:true});expect(field('firstName').value).toBe(values.firstName);expect(input).toHaveBeenCalledOnce();expect(change).toHaveBeenCalledOnce();
  });
  it('fills native selects and respects numeric bounds and steps',()=>{
    document.body.innerHTML='<select id="country" autocomplete="country"><option value="">Choose</option><option value="US">United States</option></select><input id="quantity" type="number" min="10" max="20" step="2"><input id="price" type="number" min="0" step="0.01">';
    expect(fillPage(request).filled).toBe(3);expect(field('country').value).toBe('US');expect(field('quantity').value).toBe('10');expect(field('price').value).toBe('49.99');
  });
  it('supports custom labels and leaves unsupported patterns unchanged',()=>{
    document.body.innerHTML='<label for="a">Matricule</label><input id="a"><input id="username" pattern="[A-Z]{3}">';
    const result=fillPage({...request,custom:[{id:'1',label:'Matricule',value:'ABC-123'}]});expect(field('a').value).toBe('ABC-123');expect(field('username').value).toBe('');expect(result.invalid).toBe(1);
  });
  it('fills dates, optional passwords and generic radio groups',()=>{
    document.body.innerHTML='<label for="dob">تاريخ الميلاد</label><input id="dob" type="date"><input id="pwd" type="password"><input id="confirm" type="password"><input id="r1" type="radio" name="choice"><input id="r2" type="radio" name="choice">';
    expect(fillPage({...request,passwords:true,fillUnknown:true}).filled).toBe(4);expect(field('dob').value).toBe(values.birthDate);expect(field('pwd').value).toBe(field('confirm').value);expect([field('r1'),field('r2')].filter(el=>el.checked)).toHaveLength(1);
  });
  it('uses accessible names and handles camel case names',()=>{
    document.body.innerHTML='<input id="a" name="firstName"><span id="label">البريد الإلكتروني</span><input id="b" aria-labelledby="label"><input id="c" aria-label="Nom de famille">';
    expect(fillPage(request).filled).toBe(3);expect(field('a').value).toBe(values.firstName);expect(field('b').value).toBe(values.email);expect(field('c').value).toBe(values.lastName);
  });
});


describe('fresh values on repeated fills',()=>{
  const fresh={...request,overwrite:true,fillUnknown:true};
  it('keeps French name labels and usernames readable and coherent across repeated payloads',()=>{
    document.body.innerHTML='<label for="last">Nom*</label><input id="last"><label for="first">Prénom*</label><input id="first"><label for="user">Nom d’utilisateur*</label><input id="user"><input id="full" autocomplete="name"><input id="middle" autocomplete="additional-name"><input id="email" type="email">';
    const identity={firstName:'Jamie',lastName:'Parker',middleName:'Robin',fullName:'Jamie Parker',username:'jamie.parker',email:'jamie.parker@example.com'};
    const run={...fresh,values:{...values,...identity}};
    expect(fillPage(run).filled).toBe(6);
    expect(field('first').value).toBe('Jamie');expect(field('last').value).toBe('Parker');expect(field('user').value).toBe('jamie.parker');
    let previous=identity;
    for(let i=0;i<12;i++) {
      expect(fillPage(run).filled).toBe(6);
      const next={firstName:field('first').value,lastName:field('last').value,middleName:field('middle').value,fullName:field('full').value,username:field('user').value,email:field('email').value};
      for(const key of ['firstName','lastName','middleName','fullName'] as const) {expect(next[key]).toMatch(/^[A-Za-z ]+$/);expect(next[key]).not.toBe(previous[key]);}
      expect(next.fullName).toBe(`${next.firstName} ${next.lastName}`);
      expect(next.username).toBe(`${next.firstName}.${next.lastName}`.toLowerCase());
      expect(next.email).toBe(`${next.username}@example.com`);
      previous=next;
    }
  });
  it('never pads or prefixes identity fields with random characters when length constraints apply',()=>{
    document.body.innerHTML='<input id="first" autocomplete="given-name" minlength="40"><input id="middle" autocomplete="additional-name" maxlength="2"><input id="user" autocomplete="username" minlength="40">';
    for(let i=0;i<5;i++) {
      expect(fillPage(fresh).filled).toBe(3);
      expect(field('first').value).toMatch(/^[A-Za-z]+$/);
      expect(field('middle').value).toMatch(/^[A-Za-z]{2}$/);
      expect(field('user').value).toMatch(/^[a-z]+\.[a-z]+$/);
    }
  });
  it('changes every editable native control when alternatives exist, even if the generated payload repeats',()=>{
    document.body.innerHTML=`<input id="firstName"><input id="username"><input id="mystery"><textarea id="another"></textarea>
      <input id="small" maxlength="1"><input id="quantity" type="number" min="1" max="3"><input id="range" type="range" min="1" max="3">
      <input id="date" type="date"><input id="month" type="month"><input id="week" type="week"><input id="time" type="time"><input id="appointment" type="datetime-local"><input id="color" type="color">
      <select id="country"><option value="US">United States</option><option value="FR">France</option></select>
      <input id="r1" type="radio" name="choice"><input id="r2" type="radio" name="choice"><input id="check" type="checkbox">`;
    const snapshot=()=>Array.from(document.querySelectorAll('input,textarea,select')).map(el=>el instanceof HTMLInputElement && ['radio','checkbox'].includes(el.type)?String(el.checked):(el as HTMLInputElement).value);
    fillPage(fresh);let before=snapshot();
    for(let i=0;i<4;i++){
      fillPage(fresh);const after=snapshot();
      after.forEach((value,index)=>{expect(value,`control ${index}`).not.toBe('');expect(value,`control ${index}`).not.toBe(before[index]);});
      before=after;
    }
  });
  it('fills unknown fields with distinct values and ignores unsupported text patterns',()=>{
    document.body.innerHTML='<input id="mystery" pattern="[A-Z]{3}"><input id="other"><input id="custom"><input id="numeric" type="number" min="2" max="4">';
    const run={...fresh,custom:[{id:'1',label:'custom',value:'PRJ'},{id:'2',label:'numeric',value:'not a number'}]};
    const result=fillPage(run);expect(result.filled).toBe(3);expect(result.invalid).toBe(1);
    const first=field('mystery').value,custom=field('custom').value;
    expect(first).not.toBe(field('other').value);expect(custom).toBe('PRJ');
    fillPage(run);expect(field('mystery').value).not.toBe(first);expect(field('custom').value).toBe(custom);
  });
  it('keeps single-choice and fixed-bound controls fillable without inventing options',()=>{
    document.body.innerHTML='<input id="quantity" type="number" min="1" max="1"><select id="country"><option value="US">United States</option></select>';
    fillPage(fresh);fillPage(fresh);expect(field('quantity').value).toBe('1');expect(field('country').value).toBe('US');
  });
});


describe('readable unknown text',()=>{
  it('rotates readable samples across all text categories without decorating repeated values',()=>{
    const keys=['company','jobTitle','department','industry','address','bio','description','message','subject','notes','search','title'] as const;
    document.body.innerHTML=keys.map(key=>`<input id="${key}" name="${key}">`).join('')+'<input id="site" type="url"><input id="pass" type="password"><input id="confirm" type="password">';
    const run={...request,overwrite:true,fillUnknown:true,passwords:true,exclusions:{skipSearch:false,skipHeader:false,rules:[]}};
    let previous:Record<string,string>={};
    for(let i=0;i<12;i++) {
      expect(fillPage(run).filled).toBe(keys.length+3);
      for(const key of keys) {
        expect(request.samples![key]).toContain(field(key).value);
        expect(field(key).value).not.toBe(previous[key]);
        previous[key]=field(key).value;
      }
      expect(field('site').value).toMatch(/^https:\/\/[a-z]+\.example\.com$/);
      expect(field('pass').value).toMatch(/^[A-Za-z]+-[A-Za-z]+-\d{2}!$/);
      expect(field('confirm').value).toBe(field('pass').value);
      expect(field('site').value).not.toBe(previous.site);expect(field('pass').value).not.toBe(previous.pass);
      previous.site=field('site').value;previous.pass=field('pass').value;
    }
  });
  it('uses readable text for minimum lengths and leaves explicit custom text exact',()=>{
    document.body.innerHTML='<input id="company" minlength="90" maxlength="130"><textarea id="description" minlength="90" maxlength="130"></textarea><input id="custom"><input id="limited" maxlength="2">';
    const run={...request,overwrite:true,fillUnknown:true,custom:[{id:'1',label:'custom',value:'My project'},{id:'2',label:'limited',value:'Keep exactly'}]};
    for(let i=0;i<3;i++) {
      const result=fillPage(run);expect(result.filled).toBe(3);expect(result.invalid).toBe(1);
      for(const key of ['company','description']) {
        expect(field(key).value).toMatch(/^[A-Za-z .]+$/);
        expect(field(key).value.length).toBeGreaterThanOrEqual(90);
        expect(field(key).value.length).toBeLessThanOrEqual(130);
      }
      expect(field('custom').value).toBe('My project');expect(field('limited').value).toBe('');
    }
  });
  it('uses real words and sentences and changes them on every fill',()=>{
    document.body.innerHTML='<input id="mystery"><input id="another"><textarea id="freeform"></textarea><input id="short" maxlength="1"><input id="limited" minlength="4" maxlength="8"><input id="long" minlength="45" maxlength="75">';
    const run={...request,overwrite:true,fillUnknown:true};
    const controls=Array.from(document.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('input,textarea'));
    let previous=controls.map(el=>el.value);
    for(let i=0;i<20;i++) {
      expect(fillPage(run).filled).toBe(6);
      controls.forEach((el,index)=>{
        expect(el.value).toMatch(/^[A-Za-z .]+$/);
        expect(el.value).not.toBe(previous[index]);
      });
      expect(field('mystery').value).not.toBe(field('another').value);
      expect(field('short').value).toMatch(/^[AI]$/);
      expect(field('limited').value.length).toBeGreaterThanOrEqual(4);
      expect(field('limited').value.length).toBeLessThanOrEqual(8);
      expect(field('long').value.length).toBeGreaterThanOrEqual(45);
      expect(field('long').value.length).toBeLessThanOrEqual(75);
      previous=controls.map(el=>el.value);
    }
  });
});


describe('Gemini scanning and suggestions',()=>{
  it('skips cached suggestions containing machine ID fragments',()=>{
    document.body.innerHTML='<label for="project">Project code</label><input id="project">';
    const run={...request,overwrite:true,fillUnknown:true};
    const target=fillPage({...run,mode:'scan'}).unknown![0];
    const result=fillPage({...run,suggestions:{[target.id]:{signature:target.signature!,values:['Garden-efe02541','Cedar']}}});
    expect(field('project').value).toBe('Cedar');expect(result.used).toEqual({[target.id]:'Cedar'});
  });
  it('scans unknown metadata without changing controls or returning entered values',()=>{
    document.body.innerHTML='<label for="project">Project code</label><input id="project" value="private entered text"><input id="firstName"><input type="checkbox" id="box"><input type="password" id="password">';
    const result=fillPage({...request,fillUnknown:true,overwrite:true,mode:'scan'});
    expect(result.unknown).toHaveLength(1);expect(result.unknown![0].label).toBe('Project code');
    expect(JSON.stringify(result)).not.toContain('private entered text');
    expect(field('project').value).toBe('private entered text');expect(field('firstName').value).toBe('');expect(field('box').checked).toBe(false);
  });
  it('uses the next suggested value and ignores metadata mismatches',()=>{
    document.body.innerHTML='<label for="project">Project code</label><input id="project" value="Cedar">';
    const run={...request,fillUnknown:true,overwrite:true};const scan=fillPage({...run,mode:'scan'});
    const target=scan.unknown![0];
    const result=fillPage({...run,expectedDocument:scan.documentId,suggestions:{[target.id]:{signature:target.signature!,values:['Cedar','Maple']}}});
    expect(field('project').value).toBe('Maple');expect(result.used).toEqual({[target.id]:'Maple'});
    field('project').name='changed';
    fillPage({...run,suggestions:{[target.id]:{signature:target.signature!,values:['STALE SUGGESTION']}}});
    expect(field('project').value).not.toBe('STALE SUGGESTION');
  });
  it('does not fill a new document after a delayed response',()=>{
    document.body.innerHTML='<input id="firstName">';
    const result=fillPage({...request,expectedDocument:'old-document'});
    expect(result.stale).toBe(true);expect(field('firstName').value).toBe('');
  });
});

describe('field exclusions',()=>{
  const run={...request,fillUnknown:true,overwrite:true};
  it('skips searches and header/navigation controls by default while filling the main form',()=>{
    document.body.innerHTML='<header><input id="header-text" value="Header"><select id="header-country"><option value="US">United States</option><option value="FR">France</option></select></header><nav><input id="nav-text" value="Navigation"></nav><input id="search" type="search" value="Keep search"><label for="fr">Rechercher des produits</label><input id="fr" value="Keep French search"><input aria-label="البحث" id="ar" value="Keep Arabic search"><div role="search"><input id="query-text" value="Keep role search"></div><input id="firstName">';
    const events=vi.fn();for(const el of document.querySelectorAll('header input,header select,nav input,#search,#fr,#ar,#query-text'))el.addEventListener('change',events);
    expect(fillPage(run).filled).toBe(1);expect(field('firstName').value).toBe(values.firstName);
    expect(field('header-text').value).toBe('Header');expect(field('header-country').value).toBe('US');expect(field('search').value).toBe('Keep search');expect(events).not.toHaveBeenCalled();
    expect(fillPage({...run,mode:'scan'}).unknown).toEqual([]);
  });
  it('lets the user switch off the automatic exclusions',()=>{
    document.body.innerHTML='<header><input id="username"></header><input type="search" id="search">';
    expect(fillPage({...run,exclusions:{skipSearch:false,skipHeader:false,rules:[]}}).filled).toBe(2);
  });
  it('applies label and selector exclusions to filling and Gemini scans',()=>{
    document.body.innerHTML='<label for="language">Language</label><select id="language"><option value="en">English</option><option value="fr">French</option></select><div id="filters"><input id="special" value="Leave alone"></div><input id="project" value="Project before">';
    const exclusions={skipSearch:true,skipHeader:true,rules:[{id:'1',match:'label' as const,value:'language',site:''},{id:'2',match:'selector' as const,value:'#filters',site:''}]};
    const scan=fillPage({...run,exclusions,mode:'scan'});expect(scan.unknown).toHaveLength(1);expect(scan.unknown![0].name).toBe('project');
    fillPage({...run,exclusions});expect(field('language').value).toBe('en');expect(field('special').value).toBe('Leave alone');expect(field('project').value).not.toBe('Project before');
  });
  it('scopes rules to the selected hostname and its subdomains',()=>{
    vi.stubGlobal('location',{origin:'https://shop.example.com',hostname:'shop.example.com'});
    try {
      document.body.innerHTML='<input id="project" value="Keep"><input id="other" value="Change">';
      const exclusions={skipSearch:false,skipHeader:false,rules:[{id:'1',match:'label' as const,value:'project',site:'example.com'},{id:'2',match:'label' as const,value:'other',site:'another.example.com'},{id:'3',match:'selector' as const,value:'[invalid',site:''}]};
      expect(fillPage({...run,exclusions}).filled).toBe(1);expect(field('project').value).toBe('Keep');expect(field('other').value).not.toBe('Change');
    } finally {vi.unstubAllGlobals();}
  });
  it('protects an excluded radio from being unchecked by another radio in its group',()=>{
    document.body.innerHTML='<input id="keep" type="radio" name="shared" checked><input id="other" type="radio" name="shared">';
    fillPage({...run,exclusions:{skipSearch:false,skipHeader:false,rules:[{id:'1',match:'selector',value:'#keep',site:''}]}});
    expect(field('keep').checked).toBe(true);expect(field('other').checked).toBe(false);
  });
});
