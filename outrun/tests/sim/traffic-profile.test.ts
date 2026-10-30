import {worldTest,expect} from '@gameengine/test';
import {EnterScene,math} from '@gameengine/runtime';
import {DrivingState,DrivingInput,DrivingResetRequested,DrivingPauseRequested,TrafficPool,TrafficPassed} from '../../src/schema.gen.ts';
import {loadMap01} from '../../src/content/biome.ts';

// Starts at the project's normal scene, so recording this test exercises the
// real scene handoff and seeded pool boot rather than a hand-authored SIM state.
worldTest('traffic.profile canonical busy drive passes recycles and freezes on recorded pause',async({world,input,step})=>{
  await step(1);
  input.emit(EnterScene,{scene:'scenes/driving-traffic.scene.json',release:''});await step(2);
  expect(world.count(TrafficPool)).toBe(1);
  const owner=world.entities(TrafficPool)[0]!,initial=world.get(owner,TrafficPool);
  expect(initial.initialized).toBe(true);expect(initial.population).toBe(32);
  expect(world.resource(DrivingState).distance).toBe(45000);
  expect(world.resource(DrivingState).legacySpeed).toBe(0);
  // Source firstsix start behind this intro camera but still inside their
  // 1600-segment movement window. Allow actual fixed-step catchup, no teleports.
  await step(200);
  const caught=world.get(owner,TrafficPool);
  expect(caught.active.slice(0,6).some(value=>value===1)).toBe(true);
  expect(caught.z[0]!).toBeGreaterThan(initial.z[0]!);
  expect(world.resource(DrivingState).distance).toBe(45000);
  input.emit(DrivingResetRequested,{manual:false,legacySpeed:180,distance:45000,lateral:0});await step(1);
  expect(world.events(TrafficPassed).length).toBe(0);
  const start=world.resource(DrivingState).distance;
  input.key('ArrowUp',true);
  let passes=0,recycled=0,peakActive=0;
  const lifetimes=new Set<string>(),end=loadMap01().lastLine*loadMap01().segmentLength;
  for(let tick=0;tick<600;tick++){
    await step(1);
    const pool=world.get(owner,TrafficPool);
    expect(world.count(TrafficPool)).toBe(1);expect(pool.population).toBe(32);
    let active=0;
    for(let slot=0;slot<32;slot++){
      expect(Number.isFinite(pool.z[slot]!)).toBe(true);
      expect(pool.z[slot]!).toBeGreaterThanOrEqual(0);expect(pool.z[slot]!).toBeLessThanOrEqual(end);
      expect(Number.isFinite(pool.offset[slot]!)).toBe(true);
      expect(Math.abs(math.fround(pool.offset[slot]!))).toBeLessThanOrEqual(math.fround(6*math.fround(.15)));
      active+=pool.active[slot]!;
      recycled=Math.max(recycled,pool.generation[slot]!-1);
    }
    peakActive=Math.max(peakActive,active);expect(active).toBeLessThanOrEqual(32);
    // TestWorld.events reads native read_current, not the system's combined
    // previous/current event view. Every lifetime may therefore appear once.
    let lastSlot=-1;
    for(const award of world.events(TrafficPassed)){
      expect(award.points).toBe(20000);expect(award.slot).toBeGreaterThan(lastSlot);
      expect(award.slot).toBeLessThan(32);expect(award.generation).toBeGreaterThanOrEqual(1);
      const key=`${award.epoch}:${award.slot}:${award.generation}`;
      expect(lifetimes.has(key)).toBe(false);lifetimes.add(key);lastSlot=award.slot;passes++;
    }
    if(tick===199||tick===399||tick===599)console.log('traffic.profile',{
      tick:tick+1,distance:world.resource(DrivingState).distance,active,passes,maxRecycled:recycled,
    });
  }
  input.key('ArrowUp',false);await step(1);
  expect(world.resource(DrivingState).distance).toBeGreaterThan(start);
  expect(peakActive).toBeGreaterThan(0);expect(passes).toBeGreaterThan(0);expect(recycled).toBeGreaterThan(0);
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  const pausedPool=world.get(owner,TrafficPool),pausedDriving=world.resource(DrivingState);
  await step(30);
  expect(world.get(owner,TrafficPool)).toEqual(pausedPool);
  expect(world.resource(DrivingState)).toEqual(pausedDriving);
  expect(world.events(TrafficPassed).length).toBe(0);
  expect(world.resource(DrivingInput).keyboard).toBe(0);
  input.emit(DrivingPauseRequested,{paused:false});input.key('ArrowUp',true);await step(15);
  input.key('ArrowUp',false);await step(1);
  expect(world.resource(DrivingState).distance).toBeGreaterThan(pausedDriving.distance);
  expect(world.get(owner,TrafficPool).population).toBe(32);
  console.log('traffic.profile summary',{population:32,peakActive,passes,uniqueLifetimes:lifetimes.size,maxRecycled:recycled});
});
