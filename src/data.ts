import { generateSamples } from './samples';

export const fields = [
  ['username','Username'], ['fullName','Full name'], ['firstName','First name'], ['middleName','Middle name'], ['lastName','Last name'],
  ['email','Email'], ['phone','Phone'], ['password','Password'], ['birthDate','Date of birth'], ['age','Age'], ['gender','Gender'], ['nationality','Nationality'],
  ['company','Company'], ['jobTitle','Job title'], ['department','Department'], ['industry','Industry'], ['employeeCount','Employee count'],
  ['address','Street address'], ['address2','Apartment / suite'], ['city','City'], ['state','State / wilaya'], ['postalCode','Postal code'], ['country','Country'],
  ['website','Website'], ['bio','Biography'], ['description','Description'], ['message','Message'], ['subject','Subject'], ['notes','Notes'],
  ['quantity','Quantity'], ['price','Price'], ['amount','Amount'], ['salary','Salary'], ['percentage','Percentage'], ['rating','Rating'],
  ['date','Date'], ['startDate','Start date'], ['endDate','End date'], ['time','Time'], ['color','Color'], ['search','Search'], ['title','Title'],
] as const;
export type FieldKey = typeof fields[number][0];
export type Values = Record<FieldKey,string>;
export type Identity = Pick<Values,'firstName'|'middleName'|'lastName'|'fullName'|'username'|'email'>;
export type Locale = 'en' | 'fr' | 'ar';
export interface CustomField { id:string; label:string; value:string }
export interface ExclusionRule { id:string; match:'label'|'selector'; value:string; site:string }
export interface Exclusions { skipSearch:boolean; skipHeader:boolean; rules:ExclusionRule[] }
export const defaultExclusions:Exclusions={skipSearch:true,skipHeader:true,rules:[]};
export function validateExclusions(value:unknown):Exclusions {
  const v=value && typeof value==='object'?value as Partial<Exclusions>:{};
  return {
    skipSearch:v.skipSearch!==false,skipHeader:v.skipHeader!==false,
    rules:Array.isArray(v.rules)?v.rules.filter((rule):rule is ExclusionRule=>!!rule && typeof rule.id==='string' && (rule.match==='label'||rule.match==='selector') && typeof rule.value==='string' && !!rule.value.trim() && typeof rule.site==='string'):[],
  };
}
export interface Settings { version:3; locale:Locale; overwrite:boolean; fillUnknown:boolean; passwords:boolean; custom:CustomField[]; exclusions:Exclusions }
export const defaults:Settings = { version:3, locale:'en', overwrite:true, fillUnknown:true, passwords:false, custom:[], exclusions:defaultExclusions };
const people = {
  en:[['Alex','Morgan'],['Jamie','Parker'],['Jordan','Taylor'],['Casey','Bennett'],['Maya','Chen'],['Noah','Wilson'],['Lena','Brooks'],['Adam','Hayes']],
  fr:[['Camille','Martin'],['Alexandre','Bernard'],['Emma','Laurent'],['Lucas','Robert'],['Chloé','Dubois'],['Hugo','Moreau'],['Léa','Simon'],['Nathan','Lefevre']],
  ar:[['أمين','بن صالح'],['ليلى','منصوري'],['ياسين','عماري'],['سارة','بلقاسم'],['آدم','حداد'],['مريم','بوخاري'],['يوسف','بن عمر'],['هند','رحماني']],
};
const middleNames = {
  en:['Sam','Robin','Noor','Lee','Rose','James','Grace','Daniel'],
  fr:['René','Louis','Marie','Paul','Jeanne','Pierre','Sophie','André'],
  ar:['علي','نور','كريم','أمل','عمر','إيمان','سليم','هدى'],
};
export function generateIdentities(locale:Locale):Identity[] {
  const arabicUsernames=['amine.bensalah','leila.mansouri','yassine.ammari','sara.belkacem','adam.haddad','meriem.boukhari','youssef.benomar','hind.rahmani'];
  return people[locale].map(([firstName,lastName],index)=>{
    const username=locale==='ar'?arabicUsernames[index]:`${firstName}.${lastName}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return {firstName,lastName,middleName:middleNames[locale][index],fullName:`${firstName} ${lastName}`,username,email:`${username}@example.com`};
  });
}
const previousValues:Partial<Record<Locale,Values>>={};
export function generateValues(locale:Locale):Values {
  const random = crypto.getRandomValues(new Uint32Array(12));
  const choices=generateIdentities(locale).filter(identity=>identity.username!==previousValues[locale]?.username);
  const identity=choices[random[0]%choices.length];
  const samples=generateSamples(locale);
  const sample=(key:FieldKey)=>{
    const choices=samples[key]!.filter(value=>value!==previousValues[locale]?.[key]);
    return choices[crypto.getRandomValues(new Uint32Array(1))[0]%choices.length];
  };
  const age = 18 + random[1] % 53;
  const birth = new Date(); birth.setUTCFullYear(birth.getUTCFullYear()-age); birth.setUTCMonth(random[2]%12,1+random[3]%28);
  const now = new Date();
  const actualAge = now.getUTCFullYear()-birth.getUTCFullYear() - (now.toISOString().slice(5,10)<birth.toISOString().slice(5,10)?1:0);
  const start = new Date(); start.setUTCDate(start.getUTCDate()+random[4]%365);
  const end = new Date(start); end.setUTCDate(end.getUTCDate()+1+random[5]%30);
  const time = `${String(random[6]%24).padStart(2,'0')}:${String(random[7]%60).padStart(2,'0')}`;
  const locations = [
    ['Washington','District of Columbia','20001','United States','American'],
    ['Austin','Texas','78701','United States','American'],
    ['Paris','Île-de-France','75001','France','French'],
    ['Algiers','Algiers','16000','Algeria','Algerian'],
  ];
  const differentLocations=locations.filter(place=>place[3]!==previousValues[locale]?.country);
  const [city,state,postalCode,country,nationality] = differentLocations[random[8]%differentLocations.length];
  const values:Values = {
    ...identity,phone:`+1 202 555 01${String(random[10]%100).padStart(2,'0')}`,
    password:sample('password'),birthDate:birth.toISOString().slice(0,10),age:String(actualAge),gender:sample('gender'),nationality,
    company:sample('company'),jobTitle:sample('jobTitle'),department:sample('department'),industry:sample('industry'),employeeCount:String(1+random[3]%500),
    address:sample('address'),address2:sample('address2'),city,state,postalCode,country,website:sample('website'),
    bio:sample('bio'),description:sample('description'),message:sample('message'),subject:sample('subject'),notes:sample('notes'),
    quantity:String(1+random[1]%100),price:((1+random[2]%99999)/100).toFixed(2),amount:String(1+random[3]%10000),salary:String(20000+random[4]%180000),percentage:String(random[5]%101),rating:String(1+random[6]%5),date:start.toISOString().slice(0,10),startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10),time,color:sample('color'),search:sample('search'),title:sample('title'),
  };
  previousValues[locale]=values;
  return values;
}
export function validateSettings(value:unknown):Settings {
  if (!value || typeof value !== 'object') return defaults;
  const v = value as Partial<Settings>;
  return {version:3,exclusions:validateExclusions(v.exclusions),locale:v.locale === 'fr' || v.locale === 'ar' ? v.locale : 'en',overwrite:v.version!==3 || v.overwrite !== false,fillUnknown:v.version!==3 || v.fillUnknown !== false,passwords:v.passwords === true,
    custom:Array.isArray(v.custom) ? v.custom.filter((c):c is CustomField => !!c && typeof c.id === 'string' && typeof c.label === 'string' && typeof c.value === 'string') : []};
}
