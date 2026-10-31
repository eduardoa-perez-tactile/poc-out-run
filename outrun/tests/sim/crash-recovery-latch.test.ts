import {worldTest,expect} from '@gameengine/test';
import {hasNewCrashImpact} from '../../src/sim/crash-lifecycle.ts';
import type {CrashDriverValue} from '../../src/schema.gen.ts';

function pending(overrides:Partial<CrashDriverValue>={}):CrashDriverValue {
  return {mapId:1,phase:0,consumedAcceptedCount:2,pendingStep:42,variant:0,kind:2,
    impactSpeed:120,handlingCap:200,collisionDir:3.5,curve:0,totalAdvances:0,advances:0,
    cadenceTick:0,decrement:0,reactionTick:0,recenterTarget:0,...overrides};
}
function rejects(fn:()=>unknown){let failed=false;try{fn();}catch{failed=true;}expect(failed).toBe(true);}
worldTest('collision.recovery.latch only an exact current new acceptance permits the native RNG draw',()=>{
  const value=pending();
  expect(hasNewCrashImpact(value,3,42,1,false)).toBe(true);
  expect(value).toEqual(pending()); // Validation is pure; it cannot consume/clear a hit.
  expect(hasNewCrashImpact(pending({kind:1,impactSpeed:0,handlingCap:75}),3,42,1,false)).toBe(true);
  expect(hasNewCrashImpact(pending({impactSpeed:200,handlingCap:100}),3,42,1,false)).toBe(true);
  for(const invalid of [
    ()=>hasNewCrashImpact(value,1,42,1,false),
    ()=>hasNewCrashImpact(value,4,42,1,false),
    ()=>hasNewCrashImpact(value,3.5,42,1,false),
    ()=>hasNewCrashImpact(value,NaN,42,1,false),
    ()=>hasNewCrashImpact(pending({pendingStep:41}),3,42,1,false),
    ()=>hasNewCrashImpact(pending({pendingStep:43}),3,42,1,false),
    ()=>hasNewCrashImpact(pending({phase:1}),3,42,1,false),
    ()=>hasNewCrashImpact(value,3,42,1,true),
    ()=>hasNewCrashImpact(value,3,42,2,false),
    ()=>hasNewCrashImpact(pending({mapId:2}),3,42,2,false),
  ])rejects(invalid);
});
worldTest('collision.recovery.latch rejects malformed new impact fields before choosing a variant',()=>{
  for(const patch of [
    {kind:0},{kind:3},{impactSpeed:-1},{impactSpeed:201},{impactSpeed:NaN},{impactSpeed:Infinity},
    {handlingCap:0},{handlingCap:150},{handlingCap:NaN},{handlingCap:Infinity},
    {collisionDir:NaN},{collisionDir:Infinity},{curve:NaN},{curve:Infinity},
  ])rejects(()=>hasNewCrashImpact(pending(patch),3,42,1,false));
});
worldTest('collision.recovery.latch consumed counts fast return without interpreting stale physical payloads',()=>{
  const consumed=pending({pendingStep:0,phase:2,kind:0,impactSpeed:NaN,handlingCap:0,collisionDir:Infinity,curve:NaN});
  expect(hasNewCrashImpact(consumed,2,43,1,true)).toBe(false);
  expect(hasNewCrashImpact(consumed,2,999,1,false)).toBe(false);
  expect(hasNewCrashImpact(pending({consumedAcceptedCount:0,pendingStep:0,kind:0,impactSpeed:0,handlingCap:0}),0,1,1,false)).toBe(false);
  rejects(()=>hasNewCrashImpact(consumed,2,43,2,true));
});
