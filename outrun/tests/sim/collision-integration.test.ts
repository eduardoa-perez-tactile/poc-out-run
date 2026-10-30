import {worldTest,expect,type WorldTestContext} from '@gameengine/test';
import {EnterScene,math} from '@gameengine/runtime';
import {CollisionDriver,ContactAccepted,DrivingState,DrivingResetRequested,DrivingPauseRequested,
  TrafficPool,TrafficResetRequested,TrafficRebaseRequested,TrafficPassed} from '../../src/schema.gen.ts';
import {loadMap01} from '../../src/content/biome.ts';
import {collisionRoadsideHull} from '../../src/sim/collision-metadata.ts';
import {trafficLogicalX} from '../../src/sim/traffic-math.ts';

const f=math.fround;
async function setup(ctx:WorldTestContext,distance:number,lateral:number,speed:number){
  ctx.input.view(1280,720,1);
  ctx.input.emit(EnterScene,{scene:'scenes/driving-contact.scene.json',release:''});await ctx.step(2);
  ctx.input.emit(DrivingPauseRequested,{paused:true});await ctx.step(1);
  ctx.input.emit(DrivingResetRequested,{manual:false,legacySpeed:speed,distance,lateral});
  ctx.input.emit(TrafficResetRequested,{mapId:1,population:32,seedLo:9,seedHi:2596069104,originZ:0});
  ctx.input.emit(DrivingPauseRequested,{paused:true});await ctx.step(1);
  expect(ctx.world.count(CollisionDriver)).toBe(1);
  expect(ctx.world.events(ContactAccepted).length).toBe(0);
  expect(ctx.world.events(TrafficPassed).length).toBe(0);
  const owner=ctx.world.entities(CollisionDriver)[0]!;
  expect(ctx.world.get(owner,CollisionDriver).ledgerCount).toBe(0);
  return owner;
}
worldTest('collision.integration recorded roadside crossing accepts original placement once and keeps the completed driving pose',async ctx=>{
  const data=loadMap01(),placement=data.placements.find(p=>p.id===9451)!;
  const box=collisionRoadsideHull(data,placement)!;
  expect([box.objectId,box.minZ,box.maxZ]).toEqual([57,283500,283650]);
  const owner=await setup(ctx,283200-data.playerOffsetZ,f(box.centerX/1600),200);
  ctx.input.emit(DrivingPauseRequested,{paused:false});
  const hits=[];
  for(let tick=0;tick<8;tick++){
    await ctx.step(1);
    for(const hit of ctx.world.events(ContactAccepted)){
      hits.push(hit);
      const state=ctx.world.resource(DrivingState),motion=ctx.world.get(owner,CollisionDriver);
      expect(hit.kind).toBe(1);expect(hit.id).toBe(9451);expect(hit.slot).toBe(1);
      expect(hit.epoch).toBe(0);expect(hit.generation).toBe(0);
      // The world-query JSON encodes f32 with shortest round-trip decimals.
      expect(f(state.distance)).toBe(f(f(motion.z1)-data.playerOffsetZ));
      expect(f(state.lateral)).toBe(f(motion.lf));
      expect(ctx.world.events(TrafficPassed).length).toBe(0);
    }
  }
  expect(hits.length).toBe(1);expect(ctx.world.get(owner,CollisionDriver).acceptedCount).toBe(1);
  expect(hits[0]!.toi).toBeGreaterThanOrEqual(0);expect(hits[0]!.toi).toBeLessThanOrEqual(1);
  console.log('collision.integration roadside',{hit:hits[0],hash:ctx.world.hash()});
});
worldTest('collision.integration recorded seeded traffic contact identifies its live old generation before finalize',async ctx=>{
  const data=loadMap01(),z=28100,gap=data.segments[Math.floor(z/150)]!.gap;
  const owner=await setup(ctx,z-data.playerOffsetZ,f(gap/1600+.5),200);
  const initial=ctx.world.get(owner,TrafficPool),epoch=initial.epoch,generation=initial.generation[0]!;
  ctx.input.emit(DrivingPauseRequested,{paused:false});
  let hitCount=0;
  for(let tick=0;tick<40;tick++){
    await ctx.step(1);
    for(const hit of ctx.world.events(ContactAccepted)){
      expect(hit.kind).toBe(2);expect(hit.id).toBe(0);expect(hit.slot).toBe(0);
      expect(hit.epoch).toBe(epoch);expect(hit.generation).toBe(generation);
      expect(hit.curve).toBe(0);expect(ctx.world.events(TrafficPassed).length).toBe(0);
      expect(ctx.world.get(owner,TrafficPool).generation[0]).toBe(generation);
      console.log('collision.integration traffic',{tick,hit,hash:ctx.world.hash()});hitCount++;
    }
  }
  expect(hitCount).toBe(1);expect(ctx.world.get(owner,CollisionDriver).acceptedCount).toBe(1);
});
worldTest('collision.integration pause freezes detector and reset rebase and scene reentry are contact barriers',async ctx=>{
  const owner=await setup(ctx,283200-702,f(-1886.494140625/1600),200);
  const paused=ctx.world.get(owner,CollisionDriver);
  for(let tick=0;tick<4;tick++){
    await ctx.step(1);expect(ctx.world.get(owner,CollisionDriver)).toEqual(paused);
    expect(ctx.world.events(ContactAccepted).length).toBe(0);
  }
  ctx.input.emit(DrivingPauseRequested,{paused:false});await ctx.step(3);
  expect(ctx.world.get(owner,CollisionDriver).acceptedCount).toBe(1);
  ctx.input.emit(TrafficRebaseRequested,{mapId:1,shift:500});await ctx.step(1);
  expect(ctx.world.events(ContactAccepted).length).toBe(0);expect(ctx.world.events(TrafficPassed).length).toBe(0);
  expect(ctx.world.get(owner,CollisionDriver).ledgerCount).toBe(0);
  ctx.input.emit(DrivingResetRequested,{manual:false,legacySpeed:0,distance:45000,lateral:0});await ctx.step(1);
  expect(ctx.world.events(ContactAccepted).length).toBe(0);expect(ctx.world.get(owner,CollisionDriver).acceptedCount).toBe(0);
  ctx.input.emit(EnterScene,{scene:'scenes/driving-traffic.scene.json',release:''});await ctx.step(2);
  expect(ctx.world.count(CollisionDriver)).toBe(0);
  ctx.input.emit(EnterScene,{scene:'scenes/driving-contact.scene.json',release:''});await ctx.step(2);
  expect(ctx.world.count(CollisionDriver)).toBe(1);
  const reentered=ctx.world.get(ctx.world.entities(CollisionDriver)[0]!,CollisionDriver);
  expect(reentered.acceptedCount).toBe(0);expect(reentered.ledgerCount).toBe(0);
});
worldTest('collision.integration live initial traffic contact survives parking later in the same recorded tick',async ctx=>{
  const {input,step,world}=ctx,data=loadMap01();input.view(1280,720,1);
  input.emit(EnterScene,{scene:'scenes/driving-contact.scene.json',release:''});await step(2);
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  input.emit(TrafficResetRequested,{mapId:1,population:32,seedLo:9,seedHi:2596069104,originZ:807445});await step(1);
  const owner=world.entities(CollisionDriver)[0]!,seeded=world.get(owner,TrafficPool);
  expect(f(seeded.z[30]!)).toBe(882445);expect(seeded.parked[30]).toBe(0);
  const lateral=f(trafficLogicalX(f(seeded.z[30]!),f(seeded.offset[30]!),seeded.side[30]!,data)/1600);
  // All setup is recorded; no individual car is patched or teleported.
  input.emit(DrivingResetRequested,{manual:false,legacySpeed:0,distance:882440-702,lateral});
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  const before=world.get(owner,TrafficPool);
  input.emit(DrivingPauseRequested,{paused:false});await step(1);
  const hits=world.events(ContactAccepted);expect(hits.length).toBe(1);
  const hit=hits[0]!,after=world.get(owner,TrafficPool);
  expect(hit.kind).toBe(2);expect(hit.toi).toBe(0);expect(hit.epoch).toBe(before.epoch);
  expect(hit.generation).toBe(before.generation[hit.slot]);expect(before.parked[hit.slot]).toBe(0);
  expect(f(before.z[hit.slot]!)).toBe(882445);
  expect(after.parked[hit.slot]).toBe(1);expect(f(after.z[hit.slot]!)).toBe(882450);
  expect(world.events(TrafficPassed).length).toBe(0);
  for(let tick=0;tick<3;tick++){await step(1);expect(world.events(ContactAccepted).length).toBe(0);}
  expect(world.get(owner,CollisionDriver).acceptedCount).toBe(1);
  console.log('collision.integration incoming terminal old life',{hit,hash:world.hash()});
});
for(const recycle of [false,true])worldTest(recycle?'collision.integration old-life contact survives actual same-tick recycle':'collision.integration accepted old-life contact suppresses and consumes a real same-tick pass',async ctx=>{
  const {world,input,step}=ctx,data=loadMap01(),gap=data.segments[Math.floor(28100/150)]!.gap;
  const owner=await setup(ctx,28100-702,f(gap/1600+.5),200);
  // Activate an actual seeded car by ordinary movement before the final setup
  // reset. No individual traffic pose, active bit or lifetime is ever patched.
  input.emit(DrivingPauseRequested,{paused:false});await step(recycle?7:1);
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  const activated=world.get(owner,TrafficPool);
  expect(activated.active[0]).toBe(1);expect(activated.generation[0]).toBe(1);
  if(!recycle)expect(activated.passed[0]).toBe(0);
  const playerZ=recycle?(Math.floor(f(activated.z[0]!)/150)+1)*150+1:f(activated.z[0]!)-(197-f(activated.speed[0]!));
  const lateral=f(trafficLogicalX(f(activated.z[0]!),f(activated.offset[0]!),activated.side[0]!,data)/1600);
  input.emit(DrivingResetRequested,{manual:false,legacySpeed:recycle?0:200,distance:f(playerZ-702),lateral});
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  const before=world.get(owner,TrafficPool),driverBefore=world.resource(DrivingState);
  input.emit(DrivingPauseRequested,{paused:false});await step(1);
  const hits=world.events(ContactAccepted),after=world.get(owner,TrafficPool),driverAfter=world.resource(DrivingState);
  expect(hits.length).toBe(1);expect(hits[0]!.kind).toBe(2);expect(hits[0]!.slot).toBe(0);
  expect(hits[0]!.epoch).toBe(before.epoch);expect(hits[0]!.generation).toBe(before.generation[0]);
  // The pass variant proves an active, unpassed OLD life crosses from >=0
  // to<0. The separate recycle variant uses the source's PREVIOUS player row.
  const oldZ=f(before.z[0]!),advancedZ=f(oldZ+f(f(before.speed[0]!)*60*f(1/60)));
  expect(world.events(TrafficPassed).length).toBe(0);
  if(recycle){
    expect(Math.floor(advancedZ/150)).toBeLessThan(Math.floor(f(f(driverBefore.distance)+702)/150));
    expect(after.generation[0]).toBe(before.generation[0]!+1);expect(after.passed[0]).toBe(0);
  }else{
    expect(f(oldZ-f(f(driverBefore.distance)+702))).toBeGreaterThanOrEqual(0);
    expect(f(advancedZ-f(f(driverAfter.distance)+702))).toBeLessThan(0);
    expect(after.generation[0]).toBe(before.generation[0]);expect(after.passed[0]).toBe(1);
    await step(1);expect(world.events(TrafficPassed).length).toBe(0);
  }
  console.log('collision.integration old-life seam',{recycle,passCandidate:!recycle,oldGeneration:before.generation[0],newGeneration:after.generation[0],hit:hits[0],hash:world.hash()});
});

worldTest.replay('tests/replays/collision_integration_recorded_roadside_crossing_accepts_original_placement_once_and_keeps_the_completed_driving_pose.greplay');
