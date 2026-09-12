import {expect,it,vi} from 'vitest';
import {editableBody,MAX_BODY_BYTES,type RequestEntry} from '../src/network';
import {createDraft,prepareRequest,replayRequest,type RequestDraft} from '../src/request-replay';
const draft=():RequestDraft=>({url:'https://example.com/api?tag=a&tag=b',method:'POST',headers:[{name:'Content-Type',value:'application/json'}],body:'{"email":"new@example.com"}',cookies:false});
it('preserves form encoding and repeated keys while redacting captured secrets',()=>{
 const body=editableBody('name=A%26B&tag=a&tag=b&password=secret','application/x-www-form-urlencoded')!;
 expect([...new URLSearchParams(body)]).toEqual([['name','A&B'],['tag','a'],['tag','b'],['password','[hidden]']]);
 const entry={url:draft().url,method:'POST',editableBody:body,requestHeaders:{Cookie:'[hidden]',Authorization:'[hidden]',Host:'example.com','Content-Type':'application/x-www-form-urlencoded'}} as RequestEntry;
 expect(createDraft(entry).headers).toEqual([{name:'Content-Type',value:'application/x-www-form-urlencoded'}]);
 expect(()=>prepareRequest(createDraft(entry))).toThrow('hidden');
 expect(editableBody('binary','multipart/form-data')).toBeUndefined();
});
it('rejects unsafe or misleading drafts before making any request',()=>{
 for(const url of ['file:///tmp/file','javascript:alert(1)','https://user:pass@example.com/','https://example.com/?token=%5Bhidden%5D'])expect(()=>prepareRequest({...draft(),url})).toThrow();
 for(const name of ['Cookie','Origin','Content-Length','Sec-Fetch-Site','X-HTTP-Method-Override'])expect(()=>prepareRequest({...draft(),headers:[{name,value:'x'}]})).toThrow('browser');
 expect(()=>prepareRequest({...draft(),body:'{bad json'})).toThrow('valid JSON');
 expect(()=>prepareRequest({...draft(),body:'x'.repeat(MAX_BODY_BYTES+1)})).toThrow('64 KB');
 expect(()=>prepareRequest({...draft(),headers:[{name:'X-Test',value:'a\r\nb'}]})).toThrow('Invalid header');
 expect(prepareRequest({...draft(),method:'GET',body:'[hidden]'}).body).toBeUndefined();
});
it('sends edited data exactly once and keeps redacted response and request snapshots',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response('{"ok":true,"token":"private"}',{status:201,headers:{'Content-Type':'application/json','Set-Cookie':'private'}}));
 const request={...draft(),headers:[...draft().headers,{name:'Authorization',value:'Bearer private'}]};
 const result=await replayRequest(request,new AbortController().signal,fetcher);
 expect(fetcher).toHaveBeenCalledTimes(1);
 expect(fetcher).toHaveBeenCalledWith(request.url,expect.objectContaining({method:'POST',body:request.body,credentials:'omit',redirect:'manual'}));
 expect(result).toMatchObject({state:'complete',status:201,requestHeaders:{authorization:'[hidden]'},responseHeaders:{'set-cookie':'[hidden]'}});
 expect(result.responseBody).not.toContain('private');expect(request.headers.at(-1)?.value).toBe('Bearer private');
});
it('bounds streamed responses and reports HTTP errors without retrying',async()=>{
 let canceled=false;
 const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(MAX_BODY_BYTES+1));},cancel(){canceled=true;}});
 const result=await replayRequest(draft(),new AbortController().signal,vi.fn().mockResolvedValue(new Response(stream,{status:422})));
 expect(result.status).toBe(422);expect(result.bodyNote).toContain('64 KB');expect(result.responseBody).toBeUndefined();expect(canceled).toBe(true);
});
it('handles blocked redirects and cancellation without following or retrying',async()=>{
 const redirect=await replayRequest(draft(),new AbortController().signal,vi.fn().mockResolvedValue({type:'opaqueredirect'}));
 expect(redirect.state).toBe('redirected');expect(redirect.bodyNote).toContain('Redirect stopped');
 const controller=new AbortController();controller.abort();const fetcher=vi.fn().mockRejectedValue(new Error('AbortError'));
 const canceled=await replayRequest(draft(),controller.signal,fetcher);expect(canceled.state).toBe('failed');expect(canceled.error).toContain('may already have reached');expect(fetcher).toHaveBeenCalledTimes(1);
});
