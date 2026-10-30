import {worldTest,expect} from '@gameengine/test';
import {math,pcg32} from '@gameengine/runtime';
import {loadMap01} from '../../src/content/biome.ts';
import type {TrafficPoolValue,ReadonlySourceBiomeData} from '../../src/schema.gen.ts';
import {createEmptyTrafficPool,resetTrafficPool,rebaseTrafficPool,advanceTrafficPool,finalizeTrafficPool,
  trafficLogicalX,trafficSegment,TRAFFIC_SPAWN_LANE_LIMIT,type TrafficPlayerSample,type TrafficRandom} from '../../src/sim/traffic-math.ts';

const f=math.fround,DT=f(1/60);
const PLAYER:TrafficPlayerSample={previousZ:45702,z:45702,previousLateral:0,lateral:0,previousSide:0,side:0,playing:true};
const REQUEST={mapId:1,population:32,seedLo:123,seedHi:456,originZ:0};
const FIELDS=['z','previousZ','offset','previousOffset','speed','target','side','ai','active','generation','passed','moving','cooldown','parked'] as const;
function random(){return pcg32(123,456,1414676806,0);}
function spy(){const calls:number[][]=[];const rng:TrafficRandom={range:(lo,hi)=>{calls.push([lo,hi]);return lo;}};return {rng,calls};}
function reset(count=32,data=loadMap01()){return resetTrafficPool(createEmptyTrafficPool(),{...REQUEST,population:count},PLAYER,data,random());}
function isolated(ai=1,z=PLAYER.z):TrafficPoolValue {
  const pool=reset();
  for(let i=0;i<pool.population;i++){pool.parked[i]=1;pool.active[i]=0;pool.speed[i]=0;}
  pool.parked[0]=0;pool.active[0]=1;pool.z[0]=z;pool.previousZ[0]=z;pool.offset[0]=0;pool.previousOffset[0]=0;pool.side[0]=0;pool.ai[0]=ai;
  return pool;
}
function step(pool:TrafficPoolValue,player=PLAYER,rng:TrafficRandom=spy().rng,data:ReadonlySourceBiomeData=loadMap01(),suppressPass=false){
  return advanceTrafficPool(pool,player,data,DT,rng,{suppressPass});
}
function expectError(action:()=>unknown){let failed=false;try{action();}catch{failed=true;}expect(failed).toBe(true);}

worldTest('traffic.source initialization preserves raw first six and density draw schedule',()=>{
  for(const count of [9,20,32]){
    const {rng,calls}=spy(),pool=resetTrafficPool(createEmptyTrafficPool(),{...REQUEST,population:count},PLAYER,loadMap01(),rng);
    expect(pool.epoch).toBe(1);expect(pool.population).toBe(count);expect(calls.length).toBe(1+(count-6)*4);
    expect(pool.z.slice(0,6)).toEqual([28500,25500,24750,24000,23250,22500]);
    expect(pool.offset.slice(0,6)).toEqual([.5,0,-.5,-.25,0,.25]);
    expect(pool.ai.slice(0,8)).toEqual([1,2,3,1,2,3,2,3]);
    expect(calls.slice(1,5)).toEqual([[5,count===9?8:count===20?10:12],[10,17],[-6,7],[0,2]]);
    for(let i=0;i<count;i++){expect(pool.generation[i]).toBe(1);expect(pool.active[i]).toBe(0);expect(Math.abs(pool.offset[i]!)<=TRAFFIC_SPAWN_LANE_LIMIT).toBe(true);}
    for(const field of FIELDS){expect(pool[field].length).toBe(32);for(let i=count;i<32;i++)expect(pool[field][i]).toBe(0);}
  }
});
worldTest('traffic.seed reset repeats layout with explicit epoch and origin identity',()=>{
  const first=reset(),again=resetTrafficPool(first,REQUEST,PLAYER,loadMap01(),random());
  expect(again.epoch).toBe(2);expect({...again,epoch:1}).toEqual(first);
  const changed=resetTrafficPool(createEmptyTrafficPool(),REQUEST,PLAYER,loadMap01(),pcg32(124,456,1414676806,0));
  expect(JSON.stringify(changed.z)===JSON.stringify(first.z)).toBe(false);
  const shifted=resetTrafficPool(first,{...REQUEST,population:9,originZ:1000}, {...PLAYER,z:300000},loadMap01(),random());
  expect(shifted.z[0]).toBe(29500);expect(shifted.generation[0]).toBe(1);
  for(const field of FIELDS)for(let i=9;i<32;i++)expect(shifted[field][i]).toBe(0);
});
worldTest('traffic.bounds reject malformed data and park end exclusive live section',()=>{
  const data=loadMap01(),limit=data.lastLine*data.segmentLength;
  expectError(()=>resetTrafficPool(createEmptyTrafficPool(),{...REQUEST,population:10},PLAYER,data,random()));
  expectError(()=>resetTrafficPool(createEmptyTrafficPool(),{...REQUEST,mapId:2},PLAYER,data,random()));
  expectError(()=>trafficSegment(-1,data));expectError(()=>trafficSegment(data.segments.length*150,data));
  const invalid=isolated();invalid.z=[];expectError(()=>step(invalid));
  for(const z of [-1,limit,limit+1000]){
    const pool=isolated(1,z),next=step(pool).pool;
    expect(next.parked[0]).toBe(1);expect(next.active[0]).toBe(0);expect(next.speed[0]).toBe(0);
    expect(next.z[0]).toBe(Math.max(0,Math.min(limit,z)));expect(next.generation[0]).toBe(1);
  }
});
worldTest('traffic.windows preserve strict activation and inclusive active endpoints',()=>{
  const player={...PLAYER,previousZ:45000,z:45000};
  for(const [index,activates] of [[300,false],[301,true],[499,true],[500,false]] as const){
    const pool=isolated(1,index*150);pool.active[0]=0;pool.aiCursor=3;const {rng,calls}=spy();
    const next=step(pool,player,rng);expect(next.pool.active[0]!==0).toBe(activates);expect(calls.length).toBe(activates?1:0);
  }
  for(const [index,recycles] of [[299,true],[300,false],[500,false],[501,true]] as const){
    const next=step(isolated(1,index*150),player);expect(next.recycleSlots.includes(0)).toBe(recycles);
  }
  for(const [difference,moves] of [[1600,true],[1601,false]] as const){
    const pool=isolated(1,(300+difference)*150);pool.active[0]=0;pool.speed[0]=120;
    expect(step(pool,player).pool.z[0]).toBe(pool.z[0]!+(moves?120:0));
  }
});
worldTest('traffic.pacific and pause consume no AI randomness or hidden counters',()=>{
  const pool=isolated();pool.offset[0]=f(.3);pool.speed[0]=120;
  const {rng,calls}=spy(),next=step(pool,PLAYER,rng);
  expect(next.pool.z[0]).toBe(pool.z[0]!+120);expect(next.pool.offset[0]).toBe(pool.offset[0]);expect(calls.length).toBe(0);
  const paused=isolated(2);paused.cooldown[0]=123;paused.moving[0]=1;
  const stopped=step(paused,{...PLAYER,playing:false},rng);
  expect(stopped.pool).toEqual(paused);expect(stopped.passCandidates.length).toBe(0);expect(calls.length).toBe(0);
});
worldTest('traffic.evasive chooses farther edge tie once and clamps moving targets',()=>{
  for(const [offset,target] of [[.8,.3],[-.8,-.3],[0,-.5]] as const){
    const pool=isolated(2);pool.offset[0]=f(offset);const {rng,calls}=spy(),next=step(pool,PLAYER,rng).pool;
    expect(next.target[0]).toBeCloseTo(target,6);expect(Math.abs(next.offset[0]!-f(offset))).toBeCloseTo(.005,6);
    expect(calls.length).toBe(offset===0?1:0);
  }
  const pool=isolated(2);pool.moving[0]=1;pool.offset[0]=f(.899);pool.target[0]=f(.9);
  const next=step(pool).pool;expect(next.offset[0]).toBe(f(.9));expect(next.cooldown[0]).toBe(200);expect(next.moving[0]).toBe(0);
  let waiting=next;const {rng,calls}=spy();
  for(let i=0;i<200;i++){waiting=step(waiting,PLAYER,rng).pool;expect(waiting.offset[0]).toBe(f(.9));expect(waiting.cooldown[0]).toBe(199-i);}
  expect(step(waiting,PLAYER,rng).pool.offset[0]!<f(.9)).toBe(true);expect(calls.length).toBe(0);
});
worldTest('traffic.obstacle approaches both directions only near same side without overshoot',()=>{
  for(const target of [-.8,.8]){
    const pool=isolated(3),player={...PLAYER,previousLateral:target};
    const next=step(pool,player).pool;expect(next.offset[0]).toBeCloseTo(target<0?-.005:.005,6);
    pool.offset[0]=f(target+(target<0?.001:-.001));expect(step(pool,player).pool.offset[0]).toBe(f(target));
  }
  const other=isolated(3);other.side[0]=1;expect(step(other,{...PLAYER,previousLateral:.8}).pool.offset[0]).toBe(0);
  for(const [distance,moves] of [[20,true],[21,false]] as const){
    const pool=isolated(3,(Math.floor(PLAYER.z/150)+distance)*150);
    expect(step(pool,{...PLAYER,previousLateral:3}).pool.offset[0]!>0).toBe(moves);
    if(moves)expect(step(pool,{...PLAYER,previousLateral:3}).pool.target[0]).toBe(f(.9));
  }
});
worldTest('traffic.logical road sampling uses own car gap and player gap for obstacle target',()=>{
  const base=loadMap01(),rows=base.segments.map(row=>({...row}));rows[305]!.gap=8000;rows[306]!.gap=16000;
  const data={...base,segments:rows},pool=isolated(3,45900);pool.side[0]=1;
  const player={...PLAYER,previousZ:45750,z:45750,previousSide:1,side:1,previousLateral:5.25,lateral:5.25};
  expect(trafficLogicalX(45900,.25,1,data)).toBe(16400);
  expect(step(pool,player,spy().rng,data).pool.target[0]).toBe(.25);
  expect(step(pool,player,spy().rng,data).pool.side[0]).toBe(1);
});
worldTest('traffic.pass continuous crossing is once per lifetime and excludes equality inactive and teleports',()=>{
  const pool=isolated(1,45710),cross={...PLAYER,z:45720};
  const advance=step(pool,cross);expect(advance.passCandidates).toEqual([{epoch:1,slot:0,generation:1,points:20000}]);
  expect(pool.passed[0]).toBe(0);const done=finalizeTrafficPool(advance,0xffffffff,spy().rng);
  expect(done.awards.length).toBe(1);expect(done.pool.passed[0]).toBe(1);
  expect(step(done.pool,{...cross,previousZ:45720,z:45740}).passCandidates.length).toBe(0);
  expect(step(pool,{...PLAYER,z:45710}).passCandidates.length).toBe(0);
  const inactive=isolated(1,45710);inactive.active[0]=0;expect(step(inactive,cross).passCandidates.length).toBe(0);
  expect(step(isolated(1,45700),cross).passCandidates.length).toBe(0);
  const barrier=step(pool,cross,spy().rng,loadMap01(),true);
  expect(barrier.passCandidates.length).toBe(0);expect(barrier.pool.previousZ[0]).toBe(barrier.pool.z[0]);
});
worldTest('traffic.pass mask includes unsigned slot31 and rejection consumes eligibility',()=>{
  const pool=isolated(1,45710);pool.parked[31]=0;pool.active[31]=1;pool.ai[31]=1;pool.z[31]=45710;pool.side[31]=0;
  const pending=step(pool,{...PLAYER,z:45720});expect(pending.passCandidates.map(row=>row.slot)).toEqual([0,31]);
  for(const [mask,slots] of [[0,[]],[1,[0]],[0x80000000,[31]],[0xffffffff,[0,31]]] as const){
    const result=finalizeTrafficPool(pending,mask,spy().rng);expect(result.awards.map(row=>row.slot)).toEqual(slots);
    expect(result.pool.passed[0]).toBe(1);expect(result.pool.passed[31]).toBe(1);
    expect(finalizeTrafficPool({...pending,pool:result.pool},0xffffffff,spy().rng).awards.length).toBe(0);
  }
});
worldTest('traffic.finalize preserves old lifetime until eligibility and recycles in stable slot order',()=>{
  const pool=isolated(1,44999),player={...PLAYER,previousZ:44990,z:45010};
  const crossing=step(pool,player);expect(crossing.recycleSlots).toEqual([]);expect(crossing.pool.z[0]).toBe(44999);
  const awarded=finalizeTrafficPool(crossing,0xffffffff,spy().rng);expect(awarded.awards.length).toBe(1);expect(awarded.awards[0]!.generation).toBe(1);
  const pending=step(awarded.pool,{...player,previousZ:45010,z:45020});expect(pending.recycleSlots).toEqual([0]);
  expect(pending.pool.generation[0]).toBe(1);expect(pending.pool.z[0]).toBe(44999);
  const {rng,calls}=spy(),result=finalizeTrafficPool(pending,0xffffffff,rng);expect(result.awards.length).toBe(0);
  expect(result.pool.generation[0]).toBe(2);expect(result.pool.passed[0]).toBe(0);expect(result.pool.active[0]).toBe(0);
  expect(result.pool.z[0]).toBe(119999);expect(result.pool.previousZ[0]).toBe(119999);
  expect(calls).toEqual([[0,2],[-6,7],[5,12]]);expect(pool.generation[0]).toBe(1);
});
worldTest('traffic.rebase preserves live identities and parks invalid positions without fake sweeps',()=>{
  const pool=reset(),rebased=rebaseTrafficPool(pool,1,500,loadMap01());
  expect(rebased.epoch).toBe(pool.epoch);expect(rebased.originZ).toBe(-500);
  for(let i=0;i<32;i++){expect(rebased.z[i]).toBe(pool.z[i]!-500);expect(rebased.previousZ[i]).toBe(rebased.z[i]);expect(rebased.generation[i]).toBe(pool.generation[i]);}
  const invalid=rebaseTrafficPool(pool,1,1000000,loadMap01());
  for(let i=0;i<32;i++){expect(invalid.parked[i]).toBe(1);expect(invalid.active[i]).toBe(0);expect(invalid.speed[i]).toBe(0);expect(invalid.z[i]).toBe(0);expect(invalid.generation[i]).toBe(1);}
  expect(step(invalid).passCandidates.length).toBe(0);expectError(()=>rebaseTrafficPool(pool,2,0,loadMap01()));
});

worldTest('traffic.inactive near cars still apply source evasive and obstacle tracking',()=>{
  // Same segment is not strictly ahead, so neither car activates. Source calls
  // controlAiTrack unconditionally after activation/recycle bookkeeping.
  for(const ai of [2,3]){
    const pool=isolated(ai);pool.active[0]=0;const {rng,calls}=spy();
    const next=step(pool,{...PLAYER,previousLateral:.8},rng).pool;
    expect(next.active[0]).toBe(0);expect(Math.abs(next.offset[0]!)).toBeCloseTo(.005,6);
    expect(next.target[0]).toBe(ai===2?-.5:f(.8));expect(calls.length).toBe(ai===2?1:0);
  }
});

worldTest('traffic.phased cross slot RNG resolves activation and AI before both ordered recycles',()=>{
  const pool=isolated(1,44999),player={...PLAYER,previousZ:45000,z:45000};
  // Slot0 already needs recycling when the later slot1 activates. Slot2 also
  // recycles. Both replacements wait until all activation/AI draws finish.
  pool.aiCursor=1;
  pool.parked[1]=0;pool.active[1]=0;pool.ai[1]=1;pool.z[1]=45150;pool.offset[1]=0;pool.side[1]=0;
  pool.parked[2]=0;pool.active[2]=1;pool.ai[2]=1;pool.z[2]=44850;pool.offset[2]=0;pool.side[2]=0;
  const values=[13,1,1,-2,7,0,3,9],calls:number[][]=[];
  const rng:TrafficRandom={range:(lo,hi)=>{
    const value=values[calls.length];calls.push([lo,hi]);
    if(value===undefined||value<lo||value>=hi)throw new Error('Unexpected phased RNG draw');
    return value;
  }};
  const pending=step(pool,player,rng);
  expect(pending.recycleSlots).toEqual([0,2]);expect(calls).toEqual([[10,17],[0,2]]);
  expect(pending.pool.ai[1]).toBe(2);expect(pending.pool.speed[1]).toBe(130);
  expect(pending.pool.target[1]).toBe(.5);expect(pending.pool.offset[1]).toBe(f(f(.3)*DT));
  expect(pending.pool.z[0]).toBe(44999);expect(pending.pool.z[2]).toBe(44850);
  expect(pending.pool.generation[0]).toBe(1);expect(pending.pool.generation[2]).toBe(1);
  const result=finalizeTrafficPool(pending,0xffffffff,rng).pool;
  expect(calls).toEqual([[10,17],[0,2],[0,2],[-6,7],[5,12],[0,2],[-6,7],[5,12]]);
  expect(result.side[0]).toBe(1);expect(result.offset[0]).toBe(f(-2*f(.15)));expect(result.z[0]).toBe(149999);
  expect(result.side[2]).toBe(0);expect(result.offset[2]).toBe(f(3*f(.15)));expect(result.z[2]).toBe(179850);
  for(const slot of [0,2]){expect(result.generation[slot]).toBe(2);expect(result.active[slot]).toBe(0);expect(result.previousZ[slot]).toBe(result.z[slot]);}
  expect(result.generation[1]).toBe(1);expect(result.z[1]).toBe(45150);expect(result.target[1]).toBe(.5);
});
