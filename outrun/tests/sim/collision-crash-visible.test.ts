import {worldTest,expect} from '@gameengine/test';
import {EnterScene,math} from '@gameengine/runtime';
import {DrivingState,DrivingResetRequested,DrivingPauseRequested,TrafficPool,TrafficResetRequested,CrashDriver,ContactAccepted,TrafficPassed} from '../../src/schema.gen.ts';

const q=math.fround;
for(const resumeOnly of [true,false])worldTest(`collision.crash.visible active low traffic ${resumeOnly?'paused approach resumes into contact without steering':'approach followed by recorded left input'} uses a real source lifetime`,async({world,input,step})=>{
  input.emit(EnterScene,{scene:'scenes/driving-crash.scene.json',release:''});await step(2);
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  input.emit(DrivingResetRequested,{manual:false,legacySpeed:20,distance:28750-702,lateral:q(6560/1600)});
  input.emit(TrafficResetRequested,{mapId:1,population:32,seedLo:9,seedHi:2596069104,originZ:0});
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  const owner=world.entities(CrashDriver)[0]!,initial=world.get(owner,TrafficPool);
  input.emit(DrivingPauseRequested,{paused:false});
  for(let tick=0;tick<3;tick++){await step(1);expect(world.events(ContactAccepted).length).toBe(0);}
  const pool=world.get(owner,TrafficPool),driving=world.resource(DrivingState);
  expect(pool.active[0]).toBe(1);expect(pool.parked[0]).toBe(0);
  expect(pool.epoch).toBe(initial.epoch);expect(pool.generation[0]).toBe(initial.generation[0]);
  expect(q(pool.z[0]!-q(driving.distance+702))).toBeGreaterThan(0);
  expect(world.get(owner,CrashDriver).phase).toBe(0);
  if(resumeOnly){
    input.emit(DrivingPauseRequested,{paused:true});await step(2);
    expect(world.get(owner,TrafficPool)).toEqual(pool);
    expect(world.resource(DrivingState).distance).toBe(driving.distance);
    expect(world.resource(DrivingState).lateral).toBe(driving.lateral);
    input.emit(DrivingPauseRequested,{paused:false});
  }else input.key('ArrowLeft',true);
  await step(1);
  const hits=world.events(ContactAccepted);expect(hits.length).toBe(1);
  const hit=hits[0]!;
  expect(hit.kind).toBe(2);expect(hit.id).toBe(0);expect(hit.slot).toBe(0);
  expect(hit.epoch).toBe(pool.epoch);expect(hit.generation).toBe(pool.generation[0]);
  expect(hit.impactSpeed).toBeGreaterThan(0);expect(hit.impactSpeed).toBeLessThanOrEqual(20);
  expect(world.get(owner,TrafficPool).active[0]).toBe(1);
  expect(world.get(owner,CrashDriver).phase).toBe(1);expect(world.events(TrafficPassed).length).toBe(0);
  console.log('collision.crash.visible candidate A',{resumeOnly,approach:{relativeZ:q(pool.z[0]!-q(driving.distance+702)),playerX:q(driving.lateral*1600),carZ:q(pool.z[0]!),active:pool.active[0]},hit});
  // Active/in-front is the SIM prerequisite only. Native T1 must separately
  // prove source-frame/cropped bounds AND actual opaque traffic pixels.
});
