import type {CDPSession} from '@playwright/test';

// Native side panels are separate CDP targets, not ordinary Playwright tabs.
export async function attachPanel(cdp:CDPSession,targetId:string) {
  const {sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:false});
  let next=0;
  const errors:string[]=[];
  const waiting=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void}>();
  cdp.on('Target.receivedMessageFromTarget',event=>{
    if(event.sessionId!==sessionId)return;
    const reply=JSON.parse(event.message);
    if(reply.method==='Runtime.exceptionThrown')errors.push(reply.params.exceptionDetails.text);
    const pending=waiting.get(reply.id);
    if(!pending)return;
    waiting.delete(reply.id);
    if(reply.error)pending.reject(new Error(reply.error.message));else pending.resolve(reply.result);
  });
  async function send(method:string,params:Record<string,unknown>={}) {
    const id=++next;
    const promise=new Promise<any>((resolve,reject)=>waiting.set(id,{resolve,reject}));
    await cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method,params})});
    return promise;
  }
  async function evaluate(expression:string){
    const reply=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
    if(reply.exceptionDetails)throw new Error(reply.exceptionDetails.exception?.description || reply.exceptionDetails.text);
    return reply.result.value;
  }
  await send('Runtime.enable');
  return {send,evaluate,errors};
}
