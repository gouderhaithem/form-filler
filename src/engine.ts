import type { CustomField, Values, Exclusions, Identity } from './data';
import type { FieldSamples } from './samples';

export interface UnknownField { signature?:string; id:string; label:string; name:string; placeholder:string; type:string; min:string; max:string; step:string; minLength:number; maxLength:number }
export interface SuggestedField { signature:string; values:string[] }
export interface FillRequest { samples?:FieldSamples; identities?:Identity[]; exclusions?:Exclusions; mode?:'scan'; suggestionsExpireAt?:number; suggestions?:Record<string,SuggestedField>; expectedDocument?:string; values: Values; custom: CustomField[]; overwrite: boolean; fillUnknown: boolean; passwords: boolean }
export interface FillResult { unknown?:UnknownField[]; documentId?:string; origin?:string; used?:Record<string,string>; stale?:boolean; filled: number; preserved: number; unmatched: number; invalid: number }

// This function is serialized by chrome.scripting; keep all runtime dependencies inside it.
export function fillPage(request: FillRequest): FillResult {
  const normalize = (text: string) => text.replace(/([a-z])([A-Z])/g, '$1 $2').normalize('NFD').replace(/[\u0300-\u036f\u064b-\u065f]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const aliases: Record<string, string[]> = {
    middleName: ['middle name', 'second prenom', 'الاسم الاوسط'],
    birthDate: ['date of birth', 'birth date', 'birthday', 'dob', 'date de naissance', 'تاريخ الميلاد'],
    age: ['age', 'العمر'], gender: ['gender', 'sex', 'genre', 'sexe', 'الجنس'], nationality: ['nationality', 'nationalite', 'الجنسية'],
    department: ['department', 'departement', 'service', 'القسم'], industry: ['industry', 'secteur', 'الصناعة'], employeeCount: ['employee count', 'number of employees', 'effectif', 'عدد الموظفين'],
    address2: ['address line 2', 'address 2', 'apartment', 'suite', 'complement adresse', 'appartement', 'الشقة'],
    bio: ['bio', 'biography', 'about me', 'biographie', 'نبذة'], description: ['description', 'details', 'الوصف', 'التفاصيل'],
    message: ['message', 'comment', 'commentaire', 'الرسالة', 'تعليق'], subject: ['subject', 'sujet', 'objet', 'الموضوع'], notes: ['notes', 'remarques', 'ملاحظات'],
    quantity: ['quantity', 'qty', 'quantite', 'الكمية'], price: ['price', 'prix', 'السعر'], amount: ['amount', 'montant', 'المبلغ'], salary: ['salary', 'salaire', 'الراتب'], percentage: ['percentage', 'pourcentage', 'النسبة'], rating: ['rating', 'score', 'evaluation', 'التقييم'],
    date: ['date', 'التاريخ'], startDate: ['start date', 'date de debut', 'تاريخ البداية'], endDate: ['end date', 'date de fin', 'تاريخ النهاية'], time: ['time', 'heure', 'الوقت'], color: ['color', 'colour', 'couleur', 'اللون'], search: ['search', 'recherche', 'بحث'], title: ['title', 'titre', 'العنوان المختصر'],
    password: ['password', 'confirm password', 'repeat password', 'mot de passe', 'confirmation mot de passe', 'كلمة المرور', 'تاكيد كلمة المرور'],
    username: ['username', 'user name', 'login', 'identifiant', 'nom utilisateur', 'nom d utilisateur', 'اسم المستخدم'],
    fullName: ['full name', 'name', 'your name', 'nom complet', 'nom et prenom', 'prenom et nom', 'الاسم الكامل', 'الاسم واللقب'],
    firstName: ['first name', 'firstname', 'given name', 'prenom', 'الاسم الاول', 'الاسم الشخصي', 'الاسم'],
    lastName: ['last name', 'lastname', 'surname', 'family name', 'nom', 'nom de famille', 'اللقب', 'اسم العائلة'],
    email: ['email', 'e mail', 'email address', 'courriel', 'adresse electronique', 'البريد الالكتروني'],
    phone: ['phone', 'phone number', 'telephone', 'tel', 'mobile', 'numero de telephone', 'الهاتف', 'رقم الهاتف'],
    company: ['company', 'company name', 'organization', 'organisation', 'entreprise', 'societe', 'الشركة', 'اسم الشركة'],
    jobTitle: ['job title', 'profession', 'poste', 'المهنة', 'المسمي الوظيفي'],
    address: ['address', 'street address', 'address line 1', 'adresse', 'adresse postale', 'العنوان', 'عنوان الشارع'],
    city: ['city', 'town', 'ville', 'المدينة'],
    state: ['state', 'province', 'region', 'wilaya', 'الولاية'],
    postalCode: ['postal code', 'postcode', 'zip', 'zip code', 'code postal', 'الرمز البريدي'],
    country: ['country', 'country name', 'pays', 'البلد', 'الدولة'],
    website: ['website', 'web site', 'url', 'site web', 'الموقع الالكتروني'],
  };
  const autocomplete: Record<string, keyof Values> = { username: 'username', name: 'fullName', 'given-name': 'firstName', 'family-name': 'lastName', email: 'email', tel: 'phone', organization: 'company', 'organization-title': 'jobTitle', 'street-address': 'address', 'address-line1': 'address', 'address-level2': 'city', 'address-level1': 'state', 'postal-code': 'postalCode', country: 'country', 'country-name': 'country', url: 'website', 'additional-name': 'middleName', bday: 'birthDate', sex: 'gender', 'address-line2': 'address2', 'new-password': 'password', 'current-password': 'password' };
  const pageState = globalThis as typeof globalThis & { __formlyDocumentId?:string };
  pageState.__formlyDocumentId ||= crypto.randomUUID();
  const result: FillResult = { filled: 0, preserved: 0, unmatched: 0, invalid: 0, documentId:pageState.__formlyDocumentId, origin:location.origin };
  if (request.expectedDocument && request.expectedDocument !== result.documentId) return {...result,stale:true};
  if (request.mode==='scan') result.unknown=[];
  if (request.suggestions) result.used={};
  const excluded = /credit card|card number|cvv|cvc|one time|otp|verification code|security code|رقم البطاقة|رمز التحقق/u;
  const consent = /consent|agree|terms|privacy|subscribe|newsletter|accept|conditions|confidentialite|abonn|accepte|موافق|الشروط|خصوصية|اشتراك/u;
  const radioGroups = new Set<string>();
  const random = (max:number) => max > 0 ? crypto.getRandomValues(new Uint32Array(1))[0] % max : 0;
  const machineId = /\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b|(?:^|[\s._-])(?=[0-9a-f]*[a-f])[0-9a-f]{8,}(?=$|[\s._-])/i;
  const usedText = new Set<string>();
  const words = ['Garden','River','Meadow','Forest','Ocean','Sunshine','Morning','Breeze','Willow','Orchard','Mountain','Valley','Rainbow','Cloud','Summer','Autumn','Winter','Spring','Harbor','Village','Market','Library','Workshop','Journey','Picnic','Lantern','Candle','Window','Basket','Flower','Apple','Orange','Cherry','Peach','Olive','Maple','Cedar','Robin','Sparrow','Butterfly','Welcome','Friendly','Peaceful','Bright','Fresh','Gentle','Calm','Kind','Home','Book','Tree','Leaf','Sky','Sun','Sea','Tea','Go','Be','We','Us','It','A','I'];
  const sentences = ['The garden is quiet today.', 'A gentle breeze moves through the trees.', 'We enjoyed a walk beside the river.', 'The morning sun lights up the room.', 'Fresh flowers brighten the house.', 'A friendly welcome makes a lovely day.', 'The village market opens in the morning.', 'We found a peaceful place by the sea.'];
  const readableText = (el:HTMLInputElement | HTMLTextAreaElement) => {
    const max = el.maxLength < 0 ? Infinity : el.maxLength;
    const min = Math.max(0,el.minLength);
    const preferred = el instanceof HTMLTextAreaElement ? sentences : words;
    let choices = preferred.filter(word => word.length <= max && word.length >= min);
    if (!choices.length) choices = words.filter(word => word.length <= max);
    const different = choices.filter(word => word !== el.value);
    if (different.length) choices = different;
    const unused = choices.filter(word => !usedText.has(word));
    if (unused.length) choices = unused;
    let value = choices[random(choices.length)] || '';
    while (value && value.length < min) {
      const fitting = words.filter(word => value.length + 1 + word.length <= max);
      if (!fitting.length) break;
      value += ` ${fitting[random(fitting.length)].toLowerCase()}`;
    }
    // Longer minimum lengths may produce the same phrase; choose a new opening word.
    if (request.overwrite && value === el.value && value.includes(' ')) {
      const [first,...rest] = value.split(' ');
      const alternatives = words.filter(word => word !== first && word.length <= first.length);
      if (alternatives.length) value = `${alternatives[random(alternatives.length)]} ${rest.join(' ')}`;
    }
    usedText.add(value);
    return value;
  };
  const exclusions=request.exclusions || {skipSearch:true,skipHeader:true,rules:[]};
  const fieldSignals = (el:HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
    const labels=Array.from(el.labels || []).map(label=>label.textContent || '');
    const accessible=(el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id=>document.getElementById(id)?.textContent || '').join(' ');
    return [...labels,labels.join(' '),accessible,el.getAttribute('aria-label') || '',el.name,el.id,el.getAttribute('placeholder') || ''].map(normalize).filter(Boolean);
  };
  const shouldExclude = (el:HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
    if(exclusions.skipHeader && el.closest('header, nav, [role="banner"], [role="navigation"]')) return true;
    const signals=fieldSignals(el);
    if(exclusions.skipSearch) {
      if((el instanceof HTMLInputElement && el.type==='search') || el.closest('search, [role="search"]')) return true;
      const terms=['search','recherche','rechercher','بحث','البحث'];
      if(signals.some(signal=>signal==='q' || signal==='query' || terms.some(term=>` ${signal} `.includes(` ${normalize(term)} `)))) return true;
    }
    const hostname=location.hostname.toLowerCase().replace(/\.$/,'');
    for(const rule of exclusions.rules) {
      const site=rule.site.toLowerCase().replace(/\.$/,'');
      if(site && hostname!==site && !hostname.endsWith(`.${site}`)) continue;
      if(!rule.value.trim()) continue;
      if(rule.match==='label' && signals.includes(normalize(rule.value))) return true;
      if(rule.match==='selector') {try{if(el.closest(rule.value)) return true;}catch{/* Ignore malformed selectors from old/imported settings. */}}
    }
    return false;
  };
  const editable = (el:HTMLInputElement) => !el.disabled && !el.matches(':disabled') && !el.closest('[inert]') && !!el.getClientRects().length && getComputedStyle(el).visibility === 'visible';
  const controls = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select');
  const identityKeys = ['firstName','middleName','lastName','fullName','username','email'] as const;
  let values = request.values;
  if(request.mode!=='scan' && request.overwrite && (request.identities?.length || request.samples)) {
    // Choose one coherent alternative for the entire form, including after a worker restart.
    // Inspect values locally only; they are never included in the Gemini scan result.
    const current = Array.from(controls).filter(el=>!el.disabled && !('readOnly' in el && el.readOnly) && el.getClientRects().length && !shouldExclude(el)).map(el=>({value:el.value.trim(),maxLength:'maxLength' in el?el.maxLength:-1})).filter(el=>el.value);
    const repeatsValue=(value:string)=>current.some(el=>(el.maxLength<0?value:value.slice(0,el.maxLength))===el.value);
    const repeats = (identity:Identity) => identityKeys.some(key=>repeatsValue(identity[key]));
    if(request.identities?.length && repeats(values)) {
      const alternatives=request.identities.filter(identity=>!repeats(identity));
      if(alternatives.length) values={...values,...alternatives[random(alternatives.length)]};
    }
    // Select once per field category so repeated fields (especially password confirmation)
    // share the same readable value instead of independently choosing alternatives.
    for(const [key,choices] of Object.entries(request.samples || {}) as [keyof Values,readonly string[]][]) {
      if(identityKeys.some(identityKey=>identityKey===key) || !repeatsValue(values[key])) continue;
      const alternatives=choices.filter(candidate=>!repeatsValue(candidate));
      if(alternatives.length) values={...values,[key]:alternatives[random(alternatives.length)]};
    }
  }
  for (const [controlIndex,el] of Array.from(controls).entries()) {
    if (el.disabled || el.matches(':disabled') || ('readOnly' in el && el.readOnly) || el.closest('[inert]') || !el.getClientRects().length || getComputedStyle(el).visibility !== 'visible') continue;
    if (shouldExclude(el)) continue;
    if (el instanceof HTMLInputElement && ['hidden', 'file', 'submit', 'button', 'reset', 'image'].includes(el.type)) continue;
    if (el instanceof HTMLInputElement && el.type === 'password' && !request.passwords) continue;
    const ac = el.autocomplete?.trim().split(/\s+/).filter(t => t !== 'webauthn').at(-1) || '';
    const label = Array.from(el.labels || []).map(l => l.textContent || '').join(' ');
    const labelledBy = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ');
    const signals = [label, el.getAttribute('aria-label') || '', labelledBy, el.name, el.id, el.getAttribute('placeholder') || ''].map(normalize).filter(Boolean);
    if (ac.startsWith('cc-') || ac === 'one-time-code' || signals.some(s => excluded.test(s))) continue;
    if (!request.passwords && (ac.includes('password') || signals.some(s => /password|mot de passe|كلمة المرور/u.test(s)))) continue;
    if (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type)) {
      if(request.mode==='scan') continue;
      const groupText = normalize(el.closest('fieldset')?.querySelector('legend')?.textContent || '');
      if (!request.fillUnknown || signals.some(s => consent.test(s)) || consent.test(groupText)) continue;
      let target = el;
      let checked = !el.checked;
      if (el.type === 'radio') {
        const group = `${Array.from(document.forms).indexOf(el.form!)}:${el.name || `unnamed-${Array.from(controls).indexOf(el)}`}`;
        if (radioGroups.has(group)) continue;
        radioGroups.add(group);
        const members = Array.from(controls).filter((c): c is HTMLInputElement => c instanceof HTMLInputElement && c.type === 'radio' && c.form === el.form && (el.name ? c.name === el.name : c === el));
        if (members.some(shouldExclude)) continue;
        if (!request.overwrite && members.some(c => c.checked)) { result.preserved++; continue; }
        const candidates = members.filter(c => editable(c) && !consent.test(normalize([c.name,c.id,c.getAttribute('aria-label') || '',...Array.from(c.labels || []).map(l=>l.textContent || '')].join(' '))));
        const different = candidates.filter(c => !c.checked);
        const choices = request.overwrite && different.length ? different : candidates;
        if (!choices.length) continue;
        target = choices[random(choices.length)]; checked = true;
      } else if (el.checked && !request.overwrite) { result.preserved++; continue; }
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set?.call(target, checked);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      result.filled++; continue;
    }
    let value: string | undefined;
    let genericText = false;
    let literalCustom = false;
    let matchedKey:keyof Values | undefined;
    if (autocomplete[ac]) {matchedKey=autocomplete[ac];value = values[matchedKey];}
    if (value === undefined) {
      // Exact matches outrank longer labels containing a known phrase.
      for (const exact of [true, false]) {
        for (const signal of signals) {
          const custom = request.custom.find(c => c.label.trim() && normalize(c.label) === signal);
          if (custom) {value=custom.value;literalCustom=true;break;}
          const candidates = Object.entries(aliases).flatMap(([key, names]) => names.map(name => ({ key, name: normalize(name) })))
            .filter(c => exact ? signal === c.name : c.name.split(' ').length > 1 && ` ${signal} `.includes(` ${c.name} `))
            .sort((a, b) => b.name.length - a.name.length);
          if (candidates.length) {matchedKey=candidates[0].key as keyof Values;value = values[matchedKey]; break; }
        }
        if (value !== undefined) break;
      }
    }
    if (value === undefined && el instanceof HTMLInputElement) {
      if (el.type === 'email') {matchedKey='email';value = values.email;}
      if (el.type === 'tel') {matchedKey='phone';value = values.phone;}
      if (el.type === 'url') {matchedKey='website';value = values.website;}
      if (el.type === 'password' && request.passwords) {matchedKey='password';value = values.password;}
    }
    if (value === undefined && request.fillUnknown && !(el instanceof HTMLSelectElement)) {
      const field:UnknownField={id:`field_${controlIndex}`,label:(label || el.getAttribute('aria-label') || labelledBy || '').trim().slice(0,160),name:(el.name || el.id).slice(0,120),placeholder:(el.getAttribute('placeholder') || '').slice(0,160),type:el instanceof HTMLTextAreaElement?'textarea':el.type,min:el.getAttribute('min') || '',max:el.getAttribute('max') || '',step:el.getAttribute('step') || '',minLength:el.minLength,maxLength:el.maxLength};
      field.signature=JSON.stringify(field);
      if(request.mode==='scan') {
        if((request.overwrite || !el.value.trim()) && result.unknown!.length<30) result.unknown!.push(field);
      } else {
        const supplied=request.suggestions?.[field.id];
        if(supplied?.signature===field.signature && (!request.suggestionsExpireAt || request.suggestionsExpireAt>Date.now())) {
          value=supplied.values.find(v=>typeof v==='string' && v.trim() && v!==el.value && !machineId.test(v));
          if(value!==undefined) {genericText=true;if(result.used) result.used[field.id]=value;}
        }
      }
    }
    if(request.mode==='scan') continue;
    if (value === undefined && request.fillUnknown) {
      if (el instanceof HTMLInputElement) {
        const fallback: Record<string,string> = { number:String(1+random(1000)),range:String(random(101)),date:request.values.date,'datetime-local':`${request.values.date}T${request.values.time}`,month:request.values.date.slice(0,7),week:`${request.values.date.slice(0,4)}-W${String(1+random(52)).padStart(2,'0')}`,time:request.values.time,color:request.values.color };
        value = fallback[el.type];
        if (value === undefined) { value = readableText(el); genericText = true; }
      } else if (el instanceof HTMLTextAreaElement) { value = readableText(el); genericText = true; }
      else value = 'Sample';
    }
    if (!value) { result.unmatched++; continue; }
    if (el.value.trim() && !request.overwrite) { result.preserved++; continue; }
    if (el instanceof HTMLSelectElement) {
      const options = Array.from(el.options).filter(o => !o.disabled && !(o.parentElement instanceof HTMLOptGroupElement && o.parentElement.disabled));
      const alternatives = value === 'United States' ? [value,'US','USA','États-Unis','الولايات المتحدة'] : value === 'France' ? [value,'FR','فرنسا'] : value === 'Algeria' ? [value,'DZ','Algérie','الجزائر'] : [value];
      const eligible = options.filter(o => o.value && !/select|choose|choisir|selectionner|اختر/i.test(o.textContent || ''));
      const different = eligible.filter(o => !o.selected);
      const match = options.find(o => alternatives.some(v => normalize(o.value) === normalize(v) || normalize(o.textContent || '') === normalize(v)));
      const choices = request.overwrite && different.length ? different : eligible;
      const option = literalCustom ? match : request.overwrite && match?.selected && request.fillUnknown && different.length ? different[random(different.length)] : match || (request.fillUnknown ? choices[random(choices.length)] : undefined);
      if (!option) { result.invalid++; continue; }
      value = option.value;
    } else {
      if (!literalCustom && el instanceof HTMLInputElement && ['number','range'].includes(el.type)) {
        let number = Number(value);
        if (!Number.isFinite(number)) { if(request.fillUnknown) number=1+random(1000); else {result.invalid++;continue;} }
        const min = el.min !== '' ? Number(el.min) : el.type === 'range' ? 0 : -Infinity;
        const max = el.max !== '' ? Number(el.max) : el.type === 'range' ? 100 : Infinity;
        number = Math.max(min, Math.min(max, number));
        const step = el.step === 'any' ? 0 : Number(el.step || 1);
        const base = Number.isFinite(min) ? min : Number(el.getAttribute('value') || 0);
        if (step > 0) number = base + Math.round((number-base)/step)*step;
        if (number > max && step > 0) number -= step;
        if (request.overwrite && el.value !== '' && number === Number(el.value)) {
          const increment = step > 0 ? step : 0.01;
          if (number + increment <= max) number += increment;
          else if (number - increment >= min) number -= increment;
        }
        value = String(Number(number.toFixed(8)));
      }
      if (!literalCustom && el instanceof HTMLInputElement && ['date','datetime-local','month','week','time'].includes(el.type)) {
        if (el.type === 'datetime-local' && /^\d{4}-\d{2}-\d{2}$/.test(value)) value += `T${request.values.time}`;
        if (el.type === 'month') value = value.slice(0,7);
        const formatProbe = el.cloneNode() as HTMLInputElement; formatProbe.value = value;
        if (!formatProbe.value && request.fillUnknown) {
          value = el.type==='date' ? request.values.date : el.type==='datetime-local' ? `${request.values.date}T${request.values.time}` : el.type==='month' ? request.values.date.slice(0,7) : el.type==='week' ? `${request.values.date.slice(0,4)}-W${String(1+random(52)).padStart(2,'0')}` : request.values.time;
        }
        if (el.min && value < el.min) value = el.min;
        if (el.max && value > el.max) value = el.max;
        if (request.overwrite && value === el.value) {
          const step = Math.max(1,Number(el.step) || (el.type==='time'||el.type==='datetime-local'?60:1));
          for (const direction of [1,-1]) {
            let next = value;
            if (el.type==='month') {
              const d=new Date(`${value}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth()+direction*step); next=d.toISOString().slice(0,7);
            } else if (el.type==='week') {
              let [year,week]=value.split('-W').map(Number); week+=direction*step;
              while(week>52){year++;week-=52;} while(week<1){year--;week+=52;}
              next=`${year}-W${String(week).padStart(2,'0')}`;
            } else {
              const d=new Date(el.type==='date'?`${value}T00:00:00Z`:el.type==='time'?`2000-01-01T${value}Z`:`${value}Z`);
              d.setTime(d.getTime()+direction*step*(el.type==='date'?86400000:1000));
              next=el.type==='date'?d.toISOString().slice(0,10):el.type==='time'?d.toISOString().slice(11,19):d.toISOString().slice(0,19);
            }
            if ((!el.min||next>=el.min)&&(!el.max||next<=el.max)) {value=next;break;}
          }
        }
      }
      if (!(el instanceof HTMLInputElement) || ['text','search','email','tel','url','password'].includes(el.type)) {
        const fit=(text:string)=>el.maxLength<0?text:text.slice(0,el.maxLength);
        if (!literalCustom && matchedKey && request.overwrite && fit(value)===el.value) {
          if(['age','employeeCount','quantity','price','amount','salary','percentage','rating'].includes(matchedKey) && Number.isFinite(Number(value))) value=String(Number(value)+1);
          else if(matchedKey==='phone') value=`+1 202 555 01${String((Number(value.slice(-2))+1)%100).padStart(2,'0')}`;
        }
        if (request.fillUnknown && !literalCustom) {
          // Length requirements use complete words, never ID padding or character scrambling.
          if(!genericText && matchedKey && ['company','jobTitle','department','industry','address','bio','description','message','subject','notes','search','title'].includes(matchedKey)) {
            const max=el.maxLength<0?5000:Math.min(5000,el.maxLength);
            while(value.length<el.minLength) {
              const fitting=(request.samples?.[matchedKey] || sentences).filter(sentence=>value!.length+1+sentence.length<=max);
              if(!fitting.length) break;
              value+=` ${fitting[random(fitting.length)]}`;
            }
          }
          if (el.maxLength >= 0) value = fit(value);
        }
      }
      if (!literalCustom && el instanceof HTMLInputElement && el.type==='color' && request.overwrite && value===el.value) {
        value=`#${((parseInt(value.slice(1),16)+1)%0x1000000).toString(16).padStart(6,'0')}`;
      }
      const probe = el.cloneNode() as HTMLInputElement | HTMLTextAreaElement;
      probe.value = value;
      if (probe.value && el instanceof HTMLInputElement && ['date','datetime-local','month','week','time'].includes(el.type)) value=probe.value;
      if (probe.value !== value || (el.maxLength >= 0 && value.length > el.maxLength) || (!request.fillUnknown && !probe.checkValidity())) { result.invalid++; continue; }
    }
    const prototype = el instanceof HTMLInputElement ? HTMLInputElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLSelectElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (el.value === value) {result.filled++;} else result.invalid++;
  }
  return result;
}
