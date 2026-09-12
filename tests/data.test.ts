import { describe, expect, it, vi } from 'vitest';
import { defaults, generateValues, validateSettings } from '../src/data';
import { generateSamples } from '../src/samples';
describe('generation and upgrade defaults',()=>{
  it.each(['en','fr','ar'] as const)('keeps every generated field free of random ID fragments in %s',locale=>{
    const uuid=vi.spyOn(crypto,'randomUUID').mockReturnValue('efe02541-d401-4f2f-bacb-74789df37591');
    try {
      let previous=generateValues(locale);
      for(let i=0;i<20;i++) {
        const values=generateValues(locale);
        for(const value of Object.values(values)) {
          expect(value).not.toMatch(/efe02541|d401|4f2f|bacb|74789df37591/i);
          expect(value).not.toMatch(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/i);
        }
        for(const key of ['company','jobTitle','department','industry','address','address2','bio','description','message','subject','notes','website','search','title','password'] as const) {
          expect(generateSamples(locale)[key]).toContain(values[key]);
          expect(values[key]).not.toBe(previous[key]);
        }
        expect(values.website).toMatch(/^https:\/\/[a-z]+\.example\.com$/);
        expect(values.password).toMatch(/^[A-Za-z]+-[A-Za-z]+-\d{2}!$/);
        expect(values.color).toMatch(/^#[0-9a-f]{6}$/);
        previous=values;
      }
      expect(uuid).not.toHaveBeenCalled();
    } finally {uuid.mockRestore();}
  });
  it('upgrades previously saved settings to refill all editable fields',()=>{
    const upgraded=validateSettings({locale:'fr',overwrite:false,fillUnknown:false,passwords:true,custom:[]});
    expect(upgraded).toMatchObject({version:3,locale:'fr',overwrite:true,fillUnknown:true,passwords:true});
    expect(validateSettings({...upgraded,overwrite:false,fillUnknown:false})).toMatchObject({overwrite:false,fillUnknown:false});
    expect(defaults).toMatchObject({overwrite:true,fillUnknown:true});
    expect(upgraded.exclusions).toEqual({skipSearch:true,skipHeader:true,rules:[]});
    expect(validateSettings({...upgraded,exclusions:{skipSearch:false,skipHeader:false,rules:[]}}).exclusions.skipSearch).toBe(false);
  });
  it('creates distinct identities and text data with internally consistent names',()=>{
    const first=generateValues('en'),second=generateValues('en');
    for(const key of ['username','email','firstName','lastName','fullName','company','description','notes','website'] as const) expect(first[key]).not.toBe(second[key]);
    expect(first.fullName).toBe(`${first.firstName} ${first.lastName}`);
    expect(first.email).toBe(`${first.username}@example.com`);
  });
  it.each(['en','fr','ar'] as const)('generates natural names and readable usernames in %s without ID suffixes',locale=>{
    let previous=generateValues(locale);
    for(let i=0;i<20;i++) {
      const next=generateValues(locale);
      for(const key of ['firstName','middleName','lastName','fullName'] as const) {
        expect(next[key]).toMatch(/^[\p{L} ]+$/u);
        expect(next[key]).not.toBe(previous[key]);
      }
      expect(next.fullName).toBe(`${next.firstName} ${next.lastName}`);
      expect(next.username).toMatch(/^[a-z]+\.[a-z]+$/);
      expect(next.username).not.toBe(previous.username);
      expect(next.email).toBe(`${next.username}@example.com`);
      previous=next;
    }
  });
});
