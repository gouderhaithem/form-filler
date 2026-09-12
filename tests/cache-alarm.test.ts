import { afterEach, expect, it, vi } from 'vitest';
afterEach(()=>vi.unstubAllGlobals());
it('deletes expired cache entries when Chrome fires the cleanup alarm',async()=>{
  const cache={'gemini-cache:1:expired':{expiresAt:Date.now()-1,values:{field_1:['Cedar']}},'gemini-cache:2:live':{expiresAt:Date.now()+300000,values:{field_2:['Maple']}}};
  const remove=vi.fn().mockResolvedValue(undefined),alarm=vi.fn();
  vi.stubGlobal('chrome',{
    storage:{onChanged:{addListener:vi.fn()},local:{setAccessLevel:vi.fn().mockResolvedValue(undefined)},session:{get:vi.fn().mockResolvedValue(cache),remove}},
    alarms:{onAlarm:{addListener:alarm},create:vi.fn().mockResolvedValue(undefined),clear:vi.fn().mockResolvedValue(undefined)},
    tabs:{onUpdated:{addListener:vi.fn()},onRemoved:{addListener:vi.fn()}},
    contextMenus:{onClicked:{addListener:vi.fn()}},commands:{onCommand:{addListener:vi.fn()}},
    action:{onClicked:{addListener:vi.fn()}},runtime:{onInstalled:{addListener:vi.fn()},onMessage:{addListener:vi.fn()}},
  });
  await import('../src/background');
  alarm.mock.calls[0][0]({name:'gemini-cache-expiry'});
  await vi.waitFor(()=>expect(remove).toHaveBeenCalledWith(['gemini-cache:1:expired']));
});
