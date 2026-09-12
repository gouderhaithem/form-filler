import {expect,it,vi} from 'vitest';
import {NetworkRecorder} from '../src/network-recorder';
import {bodyPreview,cleanHeaders,cleanURL,MAX_BODY_BYTES,MAX_REQUESTS} from '../src/network';
function setup(){const api={attach:vi.fn().mockResolvedValue(undefined),detach:vi.fn().mockResolvedValue(undefined),command:vi.fn().mockResolvedValue({body:'{"created":true}'})};return {api,recorder:new NetworkRecorder(api)};}
const request=(id='r',url='https://example.com/api/customers')=>({requestId:id,type:'Fetch',timestamp:10,wallTime:20,request:{url,method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer secret'},postData:'{"name":"Maya","password":"private"}'}});
it('hides known credentials in headers, URLs, JSON, and form data',()=>{
 expect(cleanHeaders({Authorization:'secret','Set-Cookie':'session=abc','X-API-Key':'abc','Content-Type':'application/json'})).toEqual({Authorization:'[hidden]','Set-Cookie':'[hidden]','X-API-Key':'[hidden]','Content-Type':'application/json'});
 expect(cleanURL('https://user:pass@example.com/api?token=abc&name=Maya')).not.toMatch(/abc|user:pass/);
 expect(bodyPreview('{"user":{"password":"abc","name":"Maya"},"accessToken":"abc"}','application/json').text).not.toContain('abc');
 expect(bodyPreview('name=Maya&password=abc','application/x-www-form-urlencoded').text).toBe('name: Maya\npassword: [hidden]');
 expect(bodyPreview('a'.repeat(MAX_BODY_BYTES+1),'text/plain')).toMatchObject({note:expect.stringContaining('64 KB')});
 expect(bodyPreview('secret file contents','multipart/form-data')).not.toHaveProperty('text');
});
it('captures status, timing and bodies only for the explicitly recorded tab',async()=>{
 const {recorder}=setup();await recorder.start(7,'example.com');
 await recorder.event(8,'Network.requestWillBeSent',request('other'));
 expect(recorder.state.entries).toHaveLength(0);
 await recorder.event(7,'Network.requestWillBeSent',request());
 await recorder.event(7,'Network.responseReceived',{requestId:'r',response:{status:201,statusText:'Created',mimeType:'application/json',headers:{'set-cookie':'private'}}});
 await recorder.event(7,'Network.loadingFinished',{requestId:'r',timestamp:10.25});
 expect(recorder.state.entries[0]).toMatchObject({status:201,duration:250,state:'complete',requestHeaders:{Authorization:'[hidden]'},responseHeaders:{'set-cookie':'[hidden]'},responseBody:'{\n  "created": true\n}'});
 expect(recorder.state.entries[0].requestBody).not.toContain('private');
 expect(recorder.view().entries[0].responseBody).toBeUndefined();
 expect(recorder.view(recorder.state.entries[0].id).entries[0].responseBody).toContain('created');
});
it('does not restore a cleared or stopped capture when an older response resolves',async()=>{
 const {recorder,api}=setup();await recorder.start(7,'example.com');await recorder.event(7,'Network.requestWillBeSent',request());
 let resolve:(value:unknown)=>void=()=>{};
 api.command.mockImplementation(()=>new Promise(done=>{resolve=done;}));
 const pending=recorder.event(7,'Network.loadingFinished',{requestId:'r',timestamp:11});
 recorder.clear();resolve({body:'old response'});await pending;
 expect(recorder.state.entries).toHaveLength(0);
 await recorder.stop();await recorder.event(7,'Network.requestWillBeSent',request('later'));expect(recorder.state.entries).toHaveLength(0);
});
it('keeps redirect hops separate and records network failures',async()=>{
 const {recorder}=setup();await recorder.start(7,'example.com');await recorder.event(7,'Network.requestWillBeSent',request());
 await recorder.event(7,'Network.requestWillBeSent',{...request('r','https://example.com/thanks'),timestamp:10.1,redirectResponse:{status:302,statusText:'Found',headers:{location:'/thanks'}}});
 await recorder.event(7,'Network.loadingFailed',{requestId:'r',timestamp:10.2,errorText:'net::ERR_FAILED'});
 expect(recorder.state.entries.map(entry=>entry.state)).toEqual(['redirected','failed']);expect(recorder.state.entries[0].status).toBe(302);expect(recorder.state.entries[1].error).toBe('net::ERR_FAILED');
});
it('bounds request history and ignores static resources',async()=>{
 const {recorder}=setup();await recorder.start(7,'example.com');
 await recorder.event(7,'Network.requestWillBeSent',{...request(),type:'Image'});expect(recorder.state.entries).toHaveLength(0);
 for(let i=0;i<MAX_REQUESTS+5;i++)await recorder.event(7,'Network.requestWillBeSent',request(String(i)));
 expect(recorder.state.entries).toHaveLength(MAX_REQUESTS);
 recorder.detached(7,'canceled_by_user');expect(recorder.state.recording).toBe(false);expect(recorder.state.entries.every(entry=>entry.state==='stopped')).toBe(true);
});
it('leaves recording off after attach failure without detaching someone else',async()=>{
 const {recorder,api}=setup();api.attach.mockRejectedValue(new Error('Another debugger is attached'));
 await expect(recorder.start(7,'example.com')).rejects.toThrow();expect(api.detach).not.toHaveBeenCalled();expect(recorder.state.recording).toBe(false);
});
