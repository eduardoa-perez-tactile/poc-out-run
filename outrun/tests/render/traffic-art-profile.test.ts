import {renderTest,expect} from '@gameengine/test';
import {EnterScene,assets,meshes} from '@gameengine/runtime';
import {DrivingState,DrivingResetRequested,DrivingPauseRequested,TrafficPool,TrafficPassed} from '../../src/schema.gen.ts';
import {map01ArtStats} from '../../src/render/map01-art-buffers.ts';
import {trafficCompositeStats,TRAFFIC_COMPOSITE_BYTES} from '../../src/render/traffic-buffers.ts';

renderTest('traffic.art.profile canonical source busy drive measures composite residency and submissions',async({world,input,step,render})=>{
  input.view(1280,720,1);
  input.emit(EnterScene,{scene:'scenes/driving-traffic.scene.json',release:''});await step(2);
  for(let frame=0;frame<120&&(assets.progress('map01-environment')<1||assets.progress('traffic-source')<1||assets.progress('player-ferrari1')<1);frame++)await step(1);
  for(const group of ['map01-environment','traffic-source','player-ferrari1'])expect(assets.progress(group)).toBe(1);
  await step(200);
  input.emit(DrivingResetRequested,{manual:false,legacySpeed:180,distance:45000,lateral:0});await step(1);
  input.key('ArrowUp',true);
  const owner=world.entities(TrafficPool)[0]!;let peakVisible=0,peakDraws=0,peakBytes=0,peakFrameCalls=0,recycled=0,passes=0;
  const awardedLifetimes=new Set<string>();
  for(let sample=0;sample<10;sample++){
    // Same60 fixed frames and input boundaries as the original scenario. Read
    // each current-step event batch so a pass between render samples is retained.
    for(let tick=0;tick<60;tick++){
      await step(1);let lastSlot=-1;
      for(const award of world.events(TrafficPassed)){
        expect(award.points).toBe(20000);expect(award.slot).toBeGreaterThan(lastSlot);
        expect(award.slot).toBeLessThan(32);lastSlot=award.slot;
        const lifetime=`${award.epoch}:${award.slot}:${award.generation}`;
        expect(awardedLifetimes.has(lifetime)).toBe(false);awardedLifetimes.add(lifetime);passes++;
      }
    }
    const stats=render.stats({width:1280,height:720});
    expect(trafficCompositeStats.total).toBeLessThanOrEqual(288);
    expect(trafficCompositeStats.visible).toBeLessThanOrEqual(32);
    const mesh=meshes.info('map01-art-props')!;expect(mesh.vertices).toBe(288*4);
    // Pinned native mesh book accounting, separately measured from raw arrays.
    expect(mesh.bytes).toBe(76032);
    expect(trafficCompositeStats.submittedBytes).toBe(TRAFFIC_COMPOSITE_BYTES);
    // One road, one shared props/traffic mesh and two panoramas: replacement,
    // never an additional car uploader. Actual loose+cooked sample=4/469016.
    expect(map01ArtStats.frameUploadCalls).toBe(4);
    expect(map01ArtStats.frameSubmittedBytes).toBe(469016);
    // Observed8 includes source world/player/UI/present work. A10-draw ceiling
    // allows limited UI batching variance while forbidding per-car draw growth.
    expect(stats.drawCalls).toBeLessThanOrEqual(10);
    if(sample===0)console.log('traffic.art.profile first frame',stats);
    peakVisible=Math.max(peakVisible,trafficCompositeStats.visible);peakDraws=Math.max(peakDraws,stats.drawCalls);
    peakBytes=Math.max(peakBytes,map01ArtStats.frameSubmittedBytes);peakFrameCalls=Math.max(peakFrameCalls,map01ArtStats.frameUploadCalls);
    const pool=world.get(owner,TrafficPool);for(const generation of pool.generation)recycled=Math.max(recycled,generation-1);
  }
  input.key('ArrowUp',false);await step(1);
  expect(peakVisible).toBeGreaterThan(0);expect(recycled).toBeGreaterThan(0);
  expect(passes).toBeGreaterThan(0);expect(awardedLifetimes.size).toBe(passes);
  expect(world.resource(DrivingState).distance).toBeGreaterThan(45000);
  const group=assets.stats().groups['traffic-source']!;
  expect(group.status).toBe('loaded');expect(group.progress).toBe(1);expect(group.members).toBe(3);expect(group.failed.length).toBe(0);
  // Measured cooked single-level=8388672; loose generated-mip charge=11184876.
  // These are engine residency charges including uniforms, not phone memory.
  expect(group.resident.textures).toBeGreaterThanOrEqual(8388672);
  expect(group.resident.textures).toBeLessThanOrEqual(11184876);
  const catalog=assets.stats().groups['traffic-catalog'];
  if(catalog){expect(catalog.status).toBe('unloaded');expect(catalog.resident.textures).toBe(0);}
  expect(assets.stats().overBudget).toBe(null);
  console.log('traffic.art.profile measured desktop structural evidence',{peakVisible,peakDraws,peakFrameCalls,peakRawSubmittedBytes:peakBytes,
    passes,uniqueAwardedLifetimes:awardedLifetimes.size,maxRecycles:recycled,
    fixedCompositeBytes:TRAFFIC_COMPOSITE_BYTES,mesh:meshes.info('map01-art-props'),group,wholeScene:assets.stats().resident});
  input.emit(DrivingPauseRequested,{paused:true});await step(2);
  const paused=world.get(owner,TrafficPool);await step(8);
  expect(world.get(owner,TrafficPool)).toEqual(paused);
  const pausedDriving=world.resource(DrivingState);
  input.emit(DrivingPauseRequested,{paused:false});await step(15);
  const resumed=world.get(owner,TrafficPool),resumedDriving=world.resource(DrivingState);
  expect(resumedDriving.playing).toBe(true);expect(resumedDriving.distance).toBeGreaterThan(pausedDriving.distance);
  expect(resumed.z.some((z,slot)=>resumed.active[slot]!==0&&(z!==paused.z[slot]||resumed.motionTicks[slot]!==paused.motionTicks[slot]))).toBe(true);
  const resumedFrame=render.stats({width:1280,height:720});
  expect(resumedFrame.drawCalls).toBeGreaterThan(0);expect(resumedFrame.drawCalls).toBeLessThanOrEqual(10);
  expect(map01ArtStats.frameUploadCalls).toBe(4);expect(map01ArtStats.frameSubmittedBytes).toBe(469016);
  console.log('traffic.art.profile resumed frame',{draws:resumedFrame.drawCalls,visible:trafficCompositeStats.visible,distance:resumedDriving.distance});
  // Resume deliberately extends the original814-frame profile by15 fixed
  // frames before its first recording; this is new input coverage, not a claim
  // that the earlier scenario was unchanged.
  // This natural recorded layout previously peaked at7 visible cars. The separate
  // controlled32-car fixture proves capacity; no full32-visibility claim is made
  // for this drive. Replay playback, excluding test reads/assertions, supplies
  // allocation/GC measurements before those structural budgets are accepted.
},{memory:'phone-low'});
