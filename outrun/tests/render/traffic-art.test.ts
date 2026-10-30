import {renderTest,expect,type WorldTestContext} from '@gameengine/test';
import {EnterScene,assets} from '@gameengine/runtime';
import {DrivingState,DrivingResetRequested,DrivingPauseRequested,TrafficPool,TrafficResetRequested} from '../../src/schema.gen.ts';
import {trafficCompositeStats,trafficCompositeSamples} from '../../src/render/traffic-buffers.ts';
const SCENE={scene:'scenes/driving-traffic.scene.json',memory:'phone-low' as const};
async function ready(step:WorldTestContext['step']){
  await step(1);
  for(let frame=0;frame<120&&(assets.progress('map01-environment')<1||assets.progress('traffic-source')<1||assets.progress('player-ferrari1')<1);frame++)await step(1);
  for(const name of ['map01-environment','traffic-source','player-ferrari1']){
    expect(assets.progress(name)).toBe(1);expect(assets.stats().groups[name]!.failed.length).toBe(0);
  }
}
for(const [name,originZ] of [['near',75000],['middle',85000],['far',100000]] as const){
  renderTest(`traffic.art source ${name} projected vehicles share the scenery compositor`,async({world,input,step,render})=>{
    input.view(1280,720,1);await ready(step);
    input.emit(DrivingResetRequested,{manual:false,legacySpeed:0,distance:100000,lateral:0});
    input.emit(TrafficResetRequested,{mapId:1,population:32,seedLo:305419896,seedHi:2596069104,originZ});await step(1);
    const owner=world.entities(TrafficPool)[0]!,before=world.get(owner,TrafficPool),driving=world.resource(DrivingState);
    const frame=render.stats({width:1280,height:720});
    expect(trafficCompositeStats.visible).toBeGreaterThan(0);expect(trafficCompositeStats.visible).toBeLessThanOrEqual(32);
    expect(trafficCompositeStats.total).toBe(trafficCompositeStats.props+trafficCompositeStats.visible);
    expect(frame.drawCalls).toBeGreaterThan(0);
    expect(world.get(owner,TrafficPool)).toEqual(before);expect(world.resource(DrivingState)).toEqual(driving);
    console.log('traffic.art sample',{name,originZ,visible:trafficCompositeStats.visible,partial:trafficCompositeStats.partial,
      frames:Array.from(trafficCompositeSamples.frame),draws:frame.drawCalls});
    render.expectScreenshot('source',{width:1280,height:720});
  },SCENE);
}
renderTest('traffic.art lifecycle pause holds sampled frames and exit releases only the traffic group',async({world,input,step,render})=>{
  input.view(852,393,1);
  console.log('traffic.art cold residency before first rendered step',assets.stats());
  await ready(step);
  // Native asset accounting is published after the completed GPU frame.
  for(let frame=0;frame<8&&assets.stats().groups['traffic-source']!.resident.textures===0;frame++){
    render.probe({width:852,height:393,points:[[426,10]]});await step(1);
  }
  expect(assets.stats().groups['traffic-source']!.resident.textures).toBeGreaterThan(0);
  console.log('traffic.art active residency after actual render',assets.stats());
  input.emit(TrafficResetRequested,{mapId:1,population:32,seedLo:305419896,seedHi:2596069104,originZ:20000});await step(1);
  input.emit(DrivingPauseRequested,{paused:true});await step(2);
  render.probe({width:852,height:393,points:[[426,10]]});
  const owner=world.entities(TrafficPool)[0]!,pool=world.get(owner,TrafficPool),frames=Array.from(trafficCompositeSamples.frame);
  await step(8);render.probe({width:852,height:393,points:[[426,10]]});
  expect(world.get(owner,TrafficPool)).toEqual(pool);expect(Array.from(trafficCompositeSamples.frame)).toEqual(frames);
  expect(trafficCompositeStats.visible).toBeGreaterThan(0);
  input.emit(EnterScene,{scene:'scenes/map01-art.scene.json',release:''});await step(2);
  render.probe({width:852,height:393,points:[[426,10]]});
  expect(world.count(TrafficPool)).toBe(0);
  expect(assets.stats().groups['traffic-source']!.status).toBe('released');
  expect(assets.stats().groups['map01-environment']!.status).toBe('loaded');
  console.log('traffic.art released cache residency',assets.stats());
  input.emit(EnterScene,{scene:'scenes/driving-traffic.scene.json',release:''});await ready(step);
  expect(world.count(TrafficPool)).toBe(1);expect(assets.stats().groups['traffic-source']!.status).toBe('loaded');
  expect(assets.stats().groups['traffic-catalog']?.status==='loaded').toBe(false);
  input.emit(EnterScene,{scene:'scenes/traffic-catalog.scene.json',release:''});await step(2);
  render.probe({width:852,height:393,points:[[0,0]]});await step(1);
  expect(world.count(TrafficPool)).toBe(0);expect(assets.stats().groups['traffic-catalog']!.status).toBe('loaded');
  input.emit(EnterScene,{scene:'scenes/driving-traffic.scene.json',release:''});await ready(step);
  render.probe({width:852,height:393,points:[[0,0]]});
  expect(world.count(TrafficPool)).toBe(1);expect(assets.stats().groups['traffic-catalog']!.status).toBe('released');
  expect(assets.stats().groups['traffic-source']!.status).toBe('loaded');

},SCENE);

for(const population of [9,20,32]){
  renderTest(`traffic.art source population${population} keeps configured slots and bounded projected output`,async({world,input,step,render})=>{
    input.view(852,393,1);await ready(step);
    input.emit(DrivingResetRequested,{manual:false,legacySpeed:180,distance:100000,lateral:0});
    input.emit(TrafficResetRequested,{mapId:1,population,seedLo:305419896,seedHi:2596069104,originZ:75000});await step(1);
    const owner=world.entities(TrafficPool)[0]!;let peakVisible=0;
    for(let sample=0;sample<4;sample++){
      await step(15);render.stats({width:852,height:393});
      const pool=world.get(owner,TrafficPool);
      expect(pool.population).toBe(population);expect(pool.active.length).toBe(32);
      expect(pool.generation.slice(0,population).every(value=>value>=1)).toBe(true);
      expect(pool.active.slice(population).every(value=>value===0)).toBe(true);
      expect(trafficCompositeStats.visible).toBeLessThanOrEqual(population);
      peakVisible=Math.max(peakVisible,trafficCompositeStats.visible);
    }
    expect(peakVisible).toBeGreaterThan(0);
    console.log('traffic.art actual source population',{population,peakVisible});
  },SCENE);
}
