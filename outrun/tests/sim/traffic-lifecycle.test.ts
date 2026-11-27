import {worldTest,expect} from '@gameengine/test';
import {EnterScene,math} from '@gameengine/runtime';
import {DrivingState,DrivingPauseRequested,DrivingResetRequested,TrafficPool,TrafficResetRequested,
  TrafficRebaseRequested,TrafficPassed,TerrainDriver,type TrafficPoolValue} from '../../src/schema.gen.ts';
import {loadMap01} from '../../src/content/biome.ts';

const SCENE='scenes/driving-traffic.scene.json';
const RESET={mapId:1,population:20,seedLo:305419896,seedHi:2596069104,originZ:0};
const LANES=['z','previousZ','offset','previousOffset','speed','target','side','ai','active','generation','passed','moving','cooldown','parked'] as const;
function layout(pool:TrafficPoolValue){return {...pool,epoch:0};}
function bounded(pool:TrafficPoolValue){
  expect(pool.initialized).toBe(true);
  expect([9,20,32].includes(pool.population)).toBe(true);
  const end=loadMap01().lastLine*loadMap01().segmentLength;
  for(const lane of LANES){
    expect(pool[lane].length).toBe(32);
    for(let i=0;i<32;i++){
      expect(Number.isFinite(pool[lane][i]!)).toBe(true);
      if(i>=pool.population)expect(pool[lane][i]).toBe(0);
    }
  }
  for(let i=0;i<pool.population;i++){
    expect(pool.generation[i]!).toBeGreaterThanOrEqual(1);
    expect(pool.z[i]!).toBeGreaterThanOrEqual(0);expect(pool.z[i]!).toBeLessThanOrEqual(end);
    expect(Math.abs(math.fround(pool.offset[i]!))).toBeLessThanOrEqual(math.fround(6*math.fround(.15)));
    expect(pool.side[i]===0||pool.side[i]===1).toBe(true);
    expect(pool.ai[i]!).toBeGreaterThanOrEqual(1);expect(pool.ai[i]!).toBeLessThanOrEqual(3);
  }
}

worldTest('traffic.lifecycle recorded seeded resets reproduce all density layouts while paused',async({world,input,step})=>{
  input.emit(EnterScene,{scene:SCENE,release:''});await step(2);
  expect(world.count(TrafficPool)).toBe(1);
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  const owner=world.entities(TrafficPool)[0]!;
  for(const population of [9,20,32]){
    input.emit(TrafficResetRequested,{...RESET,population});await step(1);
    const first=world.get(owner,TrafficPool);bounded(first);
    expect(first.population).toBe(population);
    expect(first.z.slice(0,6)).toEqual([28500,25500,24750,24000,23250,22500]);
    expect(first.speed.slice(0,6)).toEqual([120,120,120,120,120,120]);
    expect(first.offset.slice(0,6)).toEqual([.5,0,-.5,-.25,0,.25]);
    expect(first.side.slice(0,6)).toEqual([1,1,1,1,1,1]);
    expect(first.generation.slice(0,population)).toEqual(Array(population).fill(1));
    await step(11);expect(world.get(owner,TrafficPool)).toEqual(first);
    input.emit(TrafficResetRequested,{...RESET,population});await step(1);
    const second=world.get(owner,TrafficPool);
    expect(layout(second)).toEqual(layout(first));expect(second.epoch).toBe(first.epoch+1);
    expect(world.events(TrafficPassed).length).toBe(0);
  }
  input.emit(TrafficResetRequested,{...RESET,population:32,seedLo:123});await step(1);
  const changed=world.get(owner,TrafficPool);
  input.emit(TrafficResetRequested,{...RESET,population:32});await step(1);
  expect(JSON.stringify(changed.z.slice(6))).not.toBe(JSON.stringify(world.get(owner,TrafficPool).z.slice(6)));
});

worldTest('traffic.lifecycle final recorded reset wins and scene reentry restores its own pool',async({world,input,step})=>{
  input.emit(EnterScene,{scene:SCENE,release:''});await step(2);
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  let owner=world.entities(TrafficPool)[0]!;
  input.emit(TrafficResetRequested,{...RESET,population:9,seedLo:111,originZ:10000});
  input.emit(TrafficResetRequested,{...RESET,population:32,seedLo:222});await step(1);
  const final=world.get(owner,TrafficPool);bounded(final);
  expect(final.population).toBe(32);expect(final.seedLo).toBe(222);expect(final.originZ).toBe(0);
  input.emit(TrafficResetRequested,{...RESET,population:32,seedLo:222});await step(1);
  expect(layout(world.get(owner,TrafficPool))).toEqual(layout(final));
  input.emit(EnterScene,{scene:'scenes/map01-data.scene.json',release:''});await step(2);
  expect(world.count(TrafficPool)).toBe(0);expect(world.resource(DrivingState).active).toBe(false);
  input.emit(TrafficResetRequested,{...RESET,population:9});
  input.emit(TrafficRebaseRequested,{mapId:1,shift:100000});await step(3);
  expect(world.count(TrafficPool)).toBe(0);expect(world.events(TrafficPassed).length).toBe(0);
  input.emit(EnterScene,{scene:SCENE,release:''});await step(2);
  owner=world.entities(TrafficPool)[0]!;
  const restored=world.get(owner,TrafficPool);bounded(restored);
  expect(restored.population).toBe(32);expect(restored.seedLo).toBe(RESET.seedLo);
  expect(restored.seedHi).toBe(RESET.seedHi);expect(restored.originZ).toBe(0);
  expect(restored.generation.slice(0,32)).toEqual(Array(32).fill(1));
  expect(world.resource(DrivingState).active).toBe(true);
  input.emit(EnterScene,{scene:SCENE,release:''});
  input.emit(EnterScene,{scene:'scenes/driving-proof.scene.json',release:''});await step(2);
  expect(world.count(TrafficPool)).toBe(0);expect(world.resource(DrivingState).active).toBe(true);
});

worldTest('traffic.lifecycle recorded rebase and driving reset form pass barriers without reseeding',async({world,input,step})=>{
  input.emit(EnterScene,{scene:SCENE,release:''});await step(2);
  await step(200);
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  const owner=world.entities(TrafficPool)[0]!,before=world.get(owner,TrafficPool);
  expect(before.active.slice(0,6).some(value=>value===1)).toBe(true);
  input.emit(DrivingResetRequested,{manual:false,legacySpeed:0,distance:44500,lateral:0});
  input.emit(TrafficRebaseRequested,{mapId:1,shift:500});
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  const shifted=world.get(owner,TrafficPool);bounded(shifted);
  expect(shifted.epoch).toBe(before.epoch);expect(shifted.generation).toEqual(before.generation);
  for(let i=0;i<shifted.population;i++){
    expect(shifted.z[i]).toBe(before.z[i]!-500);
    expect(shifted.previousZ[i]).toBe(shifted.z[i]);
    expect(shifted.previousOffset[i]).toBe(shifted.offset[i]);
  }
  expect(world.events(TrafficPassed).length).toBe(0);
  // A driver teleport across all cars is a reset, never a swept overtake.
  input.emit(DrivingResetRequested,{manual:false,legacySpeed:0,distance:200000,lateral:0});
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  expect(world.get(owner,TrafficPool).generation).toEqual(before.generation);
  expect(world.events(TrafficPassed).length).toBe(0);
  input.emit(TrafficRebaseRequested,{mapId:1,shift:1000000});await step(1);
  const parked=world.get(owner,TrafficPool);bounded(parked);
  expect(parked.parked.slice(0,parked.population)).toEqual(Array(parked.population).fill(1));
  expect(parked.active.slice(0,parked.population)).toEqual(Array(parked.population).fill(0));
  expect(parked.speed.slice(0,parked.population)).toEqual(Array(parked.population).fill(0));
  expect(world.events(TrafficPassed).length).toBe(0);
  // Full traffic reset wins every rebase in the same tick, including a later
  // rebase, while driver reset remains a pass barrier and pause still applies.
  input.emit(TrafficRebaseRequested,{mapId:1,shift:1000000});
  input.emit(TrafficResetRequested,{...RESET,population:9,seedLo:111});
  input.emit(DrivingResetRequested,{manual:false,legacySpeed:180,distance:45000,lateral:0});
  input.emit(TrafficResetRequested,{...RESET});
  input.emit(TrafficRebaseRequested,{mapId:1,shift:500});
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  const reset=world.get(owner,TrafficPool);bounded(reset);
  expect(reset.epoch).toBe(parked.epoch+1);expect(reset.population).toBe(20);
  expect(reset.z.slice(0,6)).toEqual([28500,25500,24750,24000,23250,22500]);
  expect(reset.parked.slice(0,20)).toEqual(Array(20).fill(0));
  expect(world.events(TrafficPassed).length).toBe(0);
  expect(world.resource(DrivingState).playing).toBe(false);
  await step(5);expect(world.get(owner,TrafficPool)).toEqual(reset);
});

worldTest('traffic.lifecycle paused driver reset snaps moving history without rebase or reseed',async({world,input,step})=>{
  input.emit(EnterScene,{scene:SCENE,release:''});await step(2);
  await step(200);
  const owner=world.entities(TrafficPool)[0]!,moving=world.get(owner,TrafficPool);
  expect(moving.z.some((z,slot)=>z!==moving.previousZ[slot])).toBe(true);
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  const paused=world.get(owner,TrafficPool);
  expect(paused).toEqual(moving);
  // No TrafficRebaseRequested here: a driver-only reset must independently
  // clear swept history even though the initialized pool remains paused.
  input.emit(DrivingResetRequested,{manual:false,legacySpeed:180,distance:200000,lateral:0});
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  const snapped=world.get(owner,TrafficPool);
  expect(snapped).toEqual({...paused,previousZ:[...paused.z],previousOffset:[...paused.offset]});
  expect(world.resource(DrivingState).playing).toBe(false);
  expect(world.events(TrafficPassed).length).toBe(0);
  await step(5);expect(world.get(owner,TrafficPool)).toEqual(snapped);
});

worldTest('traffic.lifecycle source traffic keeps moving while the stopped driver recenters',async({world,input,step})=>{
  input.emit(EnterScene,{scene:SCENE,release:''});await step(2);
  await step(200);
  const owner=world.entities(TrafficPool)[0]!,driver=world.entities(TerrainDriver)[0]!;
  input.emit(DrivingResetRequested,{manual:false,legacySpeed:0,distance:45000,lateral:1.1});await step(1);
  expect(world.get(driver,TerrainDriver).recentering).toBe(true);
  const first=world.resource(DrivingState),before=world.get(owner,TrafficPool);
  expect(first.playing).toBe(true);expect(first.legacySpeed).toBe(0);
  await step(8);
  const during=world.resource(DrivingState),traffic=world.get(owner,TrafficPool);
  expect(world.get(driver,TerrainDriver).recentering).toBe(true);
  expect(during.distance).toBe(first.distance);expect(during.legacySpeed).toBe(0);
  expect(during.lateral).toBeLessThan(first.lateral);
  expect(traffic.epoch).toBe(before.epoch);
  expect(traffic.z.some((z,slot)=>z>before.z[slot]!)).toBe(true);
});
