import {worldTest,expect} from '@gameengine/test';
import {math,pcg32} from '@gameengine/runtime';
import type {TrafficPoolValue} from '../../src/schema.gen.ts';
import {originalRouteSources} from '../../src/content/route-boot.ts';
import type {SourceBiomeId} from '../../src/content/biome.ts';
import {createEmptyTrafficPool,resetTrafficPool,rebaseTrafficPool,advanceTrafficPool,finalizeTrafficPool,trafficSegment,trafficLogicalX,type TrafficPlayerSample,type TrafficRandom,type TrafficStep,type TrafficRouteDomain} from '../../src/sim/traffic-math.ts';
import {routeCanonicalOvertake} from '../../src/sim/route-traffic-math.ts';

const DT=math.fround(1/60),ROUTE:TrafficRouteDomain={kind:'source-route',routeEpoch:7,mapEpoch:3};
const PLAYER:TrafficPlayerSample={previousZ:45702,z:45702,previousLateral:0,lateral:0,previousSide:0,side:0,playing:true};
const REQUEST={mapId:1,population:32,seedLo:123,seedHi:456,originZ:0};
function data(mapId:SourceBiomeId=1){return originalRouteSources().get(mapId,0);}
function spy(){const calls:number[][]=[];const rng:TrafficRandom={range:(lo,hi)=>{calls.push([lo,hi]);return lo;}};return {calls,rng};}
function isolated(z:number,speed=0,slot=0):TrafficPoolValue {
  const pool=resetTrafficPool(createEmptyTrafficPool(),REQUEST,PLAYER,data(),spy().rng,ROUTE);
  for(let i=0;i<32;i++){pool.parked[i]=1;pool.active[i]=0;pool.speed[i]=0;}
  pool.parked[slot]=0;pool.active[slot]=1;pool.z[slot]=pool.previousZ[slot]=z;pool.offset[slot]=pool.previousOffset[slot]=0;pool.side[slot]=0;pool.ai[slot]=1;pool.speed[slot]=speed;
  return pool;
}
function player(previousZ:number,z=previousZ):TrafficPlayerSample{return {...PLAYER,previousZ,z};}

worldTest('routes.traffic all48 source profiles preserve initialNPC origin0 density RNG and original layout',()=>{
  const sources=originalRouteSources();let cases=0;
  for(let id=1;id<=16;id++)for(const gradient of [-1,0,1]as const){
    const source=sources.get(id as SourceBiomeId,gradient);
    for(const population of [9,20,32]){
      const routeRng=pcg32(123,456,1414676806,0),legacyRng=pcg32(123,456,1414676806,0),request={...REQUEST,mapId:id,population};
      const actual=resetTrafficPool(createEmptyTrafficPool(),request,PLAYER,source,routeRng,ROUTE),legacy=resetTrafficPool(createEmptyTrafficPool(),request,PLAYER,source,legacyRng);
      expect(actual).toEqual(legacy);expect([...routeRng.state]).toEqual([...legacyRng.state]);
      expect(actual.z.slice(0,6)).toEqual([28500,25500,24750,24000,23250,22500]);expect(actual.originZ).toBe(0);cases++;
    }
  }
  expect(cases).toBe(144);
});

worldTest('routes.traffic full tail and positive aliases remain raw and source AI samples own canonical rows',()=>{
  const source=data(),length=source.totalCount*150;
  const z=(source.lastLine+1)*150+17,pool=isolated(z),before=JSON.stringify(pool);
  const next=advanceTrafficPool(pool,player(z-100),source,DT,spy().rng,{suppressPass:false,route:ROUTE});
  expect(next.pool.parked[0]).toBe(0);expect(next.pool.z[0]).toBe(z);expect(JSON.stringify(pool)).toBe(before);
  const alias=isolated(length+4353*150+17);
  expect(trafficSegment(alias.z[0]!,source,ROUTE)).toBe(4353);
  expect(trafficLogicalX(alias.z[0]!,0,1,source,ROUTE)).toBe(15730);
  expect(()=>trafficSegment(alias.z[0]!,source)).toThrow();
  const retained=advanceTrafficPool(alias,player(4353*150),source,DT,spy().rng,{suppressPass:true,route:ROUTE}).pool;
  expect(retained.parked[0]).toBe(0);expect(retained.z[0]).toBe(alias.z[0]);
});

worldTest('routes.traffic source f32 expression then integer assignment and literal transfer preserve raw histories above float24',()=>{
  const source=data(),raw=16777217,pool=isolated(raw,120,31);
  const next=advanceTrafficPool(pool,player(353017),source,DT,spy().rng,{suppressPass:false,route:ROUTE}).pool;
  expect(next.previousZ[31]).toBe(16777217);expect(next.z[31]).toBe(16777336);expect(next.parked[31]).toBe(0);
  const large=isolated(20000001,0,31);large.z[0]=large.previousZ[0]=100;large.parked[0]=0;large.active[0]=1;large.speed[0]=120;
  const moved=rebaseTrafficPool(large,2,881898,data(2),ROUTE);
  expect(moved.z[31]).toBe(19118103);expect(moved.previousZ[31]).toBe(19118103);expect(moved.generation[31]).toBe(1);expect(moved.epoch).toBe(large.epoch);
  expect(moved.parked[0]).toBe(1);expect(moved.z[0]).toBe(0);expect(moved.previousZ[0]).toBe(0);expect(moved.speed[0]).toBe(0);
  expect(large.z[31]).toBe(20000001);expect(large.z[0]).toBe(100);
});

worldTest('routes.traffic genuine different lap alias overtake awards once with full old life identity including slot31 mask',()=>{
  const source=data(),length=source.totalCount*150,pool=isolated(length+3000,0,31),rng=spy();
  const step=advanceTrafficPool(pool,player(2990,3010),source,DT,rng.rng,{suppressPass:false,route:ROUTE});
  expect(step.passCandidates).toEqual([{epoch:pool.epoch,slot:31,generation:1,points:20000,mapId:1,routeEpoch:7,mapEpoch:3}]);
  const accepted=finalizeTrafficPool(step,0x80000000,rng.rng);expect(accepted.awards).toEqual(step.passCandidates);expect(accepted.pool.passed[31]).toBe(1);
  const denied=finalizeTrafficPool(step,0,rng.rng);expect(denied.awards).toEqual([]);expect(denied.pool.passed[31]).toBe(1);
  const later=advanceTrafficPool(accepted.pool,player(3010,3020),source,DT,rng.rng,{suppressPass:false,route:ROUTE});expect(later.passCandidates).toEqual([]);
  const wrong={...step,route:{...ROUTE,mapEpoch:4}};expect(()=>finalizeTrafficPool(wrong,0xffffffff,rng.rng)).toThrow();expect(rng.calls).toEqual([]);
});

worldTest('routes.traffic wrap jump alone never awards while real passes before and after actors own wraps survive',()=>{
  const source=data(),length=source.totalCount*150;
  const jumped=advanceTrafficPool(isolated(length-50,120),player(length-100),source,DT,spy().rng,{suppressPass:false,route:ROUTE});
  expect(jumped.pool.z[0]).toBe(length+70);expect(jumped.pool.parked[0]).toBe(0);expect(jumped.passCandidates).toEqual([]);expect(jumped.recycleSlots).toEqual([0]);
  for(const [car0,speed,player0,player1]of [[length-100,120,length-150,length+50],[length-30,120,length-50,length+110]]as const){
    const step=advanceTrafficPool(isolated(car0,speed),player(player0,player1),source,DT,spy().rng,{suppressPass:false,route:ROUTE});
    expect(step.passCandidates.length).toBe(1);expect(step.passCandidates[0]!.generation).toBe(1);
  }
  expect(routeCanonicalOvertake(source,20,20,length+20,length-20)).toBe(false);
  expect(routeCanonicalOvertake(source,length+3000,length+3000,2990,3010)).toBe(true);
  expect(()=>routeCanonicalOvertake(source,0,length+1,0,0)).toThrow();
});

worldTest('routes.traffic canonical activation and inactive AI precede recycle draws in unchanged stable slot order',()=>{
  const source=data(),pool=isolated(4000);pool.active[0]=0;pool.aiCursor=1;
  pool.parked[1]=0;pool.active[1]=1;pool.z[1]=pool.previousZ[1]=0;pool.offset[1]=0;pool.ai[1]=1;pool.speed[1]=0;
  const rng=spy(),step=advanceTrafficPool(pool,player(3000),source,DT,rng.rng,{suppressPass:false,route:ROUTE});
  expect(rng.calls).toEqual([[10,17],[0,2]]);expect(step.pool.active[0]).toBe(1);expect(step.pool.ai[0]).toBe(2);expect(step.recycleSlots).toEqual([1]);
  const finalized=finalizeTrafficPool(step,0xffffffff,rng.rng);
  expect(rng.calls).toEqual([[10,17],[0,2],[0,2],[-6,7],[5,12]]);expect(finalized.pool.generation[1]).toBe(2);expect(finalized.pool.z[1]).toBe(75000);
  const aliased={...pool,z:pool.z.slice(),previousZ:pool.previousZ.slice()};aliased.z[0]=aliased.previousZ[0]=source.totalCount*150+4000;
  const second=spy(),aliasStep=advanceTrafficPool(aliased,player(3000),source,DT,second.rng,{suppressPass:false,route:ROUTE});
  expect(second.calls).toEqual([[10,17],[0,2]]);expect(aliasStep.pool.offset[0]).toBe(step.pool.offset[0]);expect(aliasStep.pool.z[0]).toBe(aliased.z[0]);
});

worldTest('routes.traffic recycle uses exact integer addition with no raw alias cap and overflow is terminal without input pool writes',()=>{
  const source=data(),length=source.totalCount*150,pool=isolated(length+100);
  const rng=spy(),step:TrafficStep={pool,passCandidates:[],recycleSlots:[0],limitZ:length,route:ROUTE};
  const next=finalizeTrafficPool(step,0xffffffff,rng.rng).pool;expect(next.z[0]).toBe(length+75100);expect(next.parked[0]).toBe(0);expect(next.generation[0]).toBe(2);
  const overflowing=isolated(2147433647),before=JSON.stringify(overflowing),draws=spy();
  expect(()=>finalizeTrafficPool({pool:overflowing,passCandidates:[],recycleSlots:[0],limitZ:length,route:ROUTE},0xffffffff,draws.rng)).toThrow();
  expect(JSON.stringify(overflowing)).toBe(before);expect(draws.calls).toEqual([[0,2],[-6,7],[5,12]]);
  // Actual selected random addition may overflow AFTER its native draw. This is
  // a terminal validation error, never caught and continued in production.
  const movement=isolated(2147483647,120),motionBefore=JSON.stringify(movement),motionRng=spy();
  expect(()=>advanceTrafficPool(movement,player(488797),source,DT,motionRng.rng,{suppressPass:false,route:ROUTE})).toThrow();
  expect(JSON.stringify(movement)).toBe(motionBefore);expect(motionRng.calls).toEqual([]);
});
