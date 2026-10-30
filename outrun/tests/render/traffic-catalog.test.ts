import {renderTest,expect,type WorldTestContext} from '@gameengine/test';
import {EnterScene,assets,meshes} from '@gameengine/runtime';
import {TrafficArtPreview,TrafficPool,VehicleVisualSlot,DrivingState} from '../../src/schema.gen.ts';
import {TRAFFIC_SOURCE} from '../../src/content/vehicles/traffic-source.manifest.ts';
import {catalogSamples} from '../../src/render/traffic-catalog.ts';

const OPTIONS={memory:'phone-low' as const};
async function enterCatalog({input,step,render,world}:WorldTestContext){
  input.view(1280,720,1);
  input.emit(EnterScene,{scene:'scenes/traffic-catalog.scene.json',release:''});await step(1);
  // Native readback waits queued asset work. The bounded steps then publish the
  // loaded atlas geometry; elapsed IO never advances a traffic simulation here.
  render.probe({width:1280,height:720,points:[[0,0]]});await step(1);
  for(let tick=0;tick<120&&(assets.progress('map01-environment')<1||assets.progress('traffic-source')<1||assets.progress('traffic-catalog')<1);tick++)await step(1);
  for(const name of ['map01-environment','traffic-source','traffic-catalog']){
    const group=assets.stats().groups[name]!;
    expect(group.status).toBe('loaded');expect(group.progress).toBe(1);expect(group.failed).toEqual([]);
  }
  await step(1);
  expect(world.count(TrafficPool)).toBe(0);expect(world.count(VehicleVisualSlot)).toBe(0);
  expect(world.resource(TrafficArtPreview).mode).toBe(1);
  expect(meshes.info('map01-art-props')!.vertices).toBe(256);
  expect(Object.entries(assets.stats().groups).filter(([,group])=>group.status==='loaded').map(([name])=>name).sort())
    .toEqual(['map01-environment','traffic-catalog','traffic-source']);
}

renderTest('traffic.catalog all512 original opaque probes match independent source-color controls',async ctx=>{
  await enterCatalog(ctx);const {world,step,render}=ctx;
  const driving=world.resource(DrivingState);let checked=0;
  for(let frame=1;frame<=16;frame++){
    world.setResource(TrafficArtPreview,{mode:1,frame,caseId:0});await step(1);
    const points:[number,number][]=Array.from({length:32},(_,slot)=>[catalogSamples.probeX[slot]!,catalogSamples.probeY[slot]!]);
    for(let slot=0;slot<32;slot++)points.push([catalogSamples.controlX[slot]!,catalogSamples.controlY[slot]!]);
    const actual=render.probe({width:1280,height:720,points}).points;
    expect(catalogSamples.count).toBe(32);expect(catalogSamples.scale).toBe(2);expect(catalogSamples.frame).toBe(frame);
    expect(actual.length).toBe(64);
    for(let slot=0;slot<32;slot++){
      const image=TRAFFIC_SOURCE.models[slot]!.frames[frame-1]!,expected=Array.from(image.opaqueProbeRgba);
      expect(catalogSamples.model[slot]).toBe(slot+1);expect(catalogSamples.sourceFrame[slot]).toBe(frame);
      expect(Array.from(catalogSamples.rgba.subarray(slot*4,slot*4+4))).toEqual(expected);
      const sprite=actual[slot]!.rgba,control=actual[32+slot]!.rgba;
      if(sprite.some((channel,index)=>channel!==control[index]))console.log('traffic.catalog mismatch',{model:slot+1,frame,source:expected,sprite,control});
      // Identical GPU transfer/quantization, independent source-derived texels.
      // Offline importer tests prove full source/atlas/control byte equality.
      expect(sprite).toEqual(control);expect(sprite[3]).toBe(255);checked++;
    }
  }
  expect(checked).toBe(512);expect(world.resource(DrivingState)).toEqual(driving);expect(world.count(TrafficPool)).toBe(0);
  console.log('traffic.catalog exact independent source-color pairs',{checked});
},OPTIONS);

for(const frame of [1,16]){
  renderTest(`traffic.catalog contact sheet source frame${frame} all32 models`,async ctx=>{
    await enterCatalog(ctx);
    ctx.world.setResource(TrafficArtPreview,{mode:1,frame,caseId:0});await ctx.step(1);
    expect(catalogSamples.count).toBe(32);expect(catalogSamples.frame).toBe(frame);
    ctx.render.expectScreenshot('catalog',{width:1280,height:720});
  },OPTIONS);
}
