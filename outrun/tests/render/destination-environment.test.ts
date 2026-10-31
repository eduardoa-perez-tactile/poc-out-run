import {renderTest,expect,type WorldTestContext} from '@gameengine/test';
import {assets,EnterScene,meshes} from '@gameengine/runtime';
import {EnvironmentReview,EnvironmentResidency,DrivingState,RoadProofState} from '../../src/schema.gen.ts';
import {destinationEnvironment,destinationDataGroup,DESTINATION_ENVIRONMENT_IDS} from '../../src/content/environments/destination-environments.ts';
import {environmentCatalogSamples} from '../../src/render/environment-catalog.ts';
import {environmentPresentationStats} from '../../src/render/environment-presentation.ts';

async function select(ctx:WorldTestContext,mapId:number,mode:number){
  ctx.world.setResource(EnvironmentReview,{enabled:true,mapId,mode,batch:0,cameraOriginZ:45000,trafficCount:0});
  await ctx.step(1);
  ctx.render.probe({width:1280,height:720,points:[[0,0]]});
  for(let frame=0;frame<120&&!ctx.world.resource(EnvironmentResidency).ioReady;frame++)await ctx.step(1);
  const state=ctx.world.resource(EnvironmentResidency);
  expect(state.failed).toBe(false);expect(state.ioReady).toBe(true);
  for(const name of [destinationEnvironment(mapId).assetId,destinationDataGroup(mapId),'environment-review-shared']){
    expect(assets.stats().groups[name]!.progress).toBe(1);expect(assets.stats().groups[name]!.failed).toEqual([]);
  }
  await ctx.step(4);
}
renderTest('environment.destination cold two page arrival keeps recurring submissions before readback',async ctx=>{
  ctx.input.view(1280,720,1);
  ctx.world.setResource(EnvironmentReview,{enabled:true,mapId:10,mode:0,batch:0,cameraOriginZ:45000});
  const startUploads=environmentPresentationStats.uploads;let frames=0;
  // No probe/waitForAssets warm loop: each actual test frame runs LateUpdate
  // and normal geometry submission before any final GPU readback is requested.
  do{await ctx.step(1);frames++;}while(frames<240&&!ctx.world.resource(EnvironmentResidency).renderSettled);
  const state=ctx.world.resource(EnvironmentResidency);
  expect(state.failed).toBe(false);expect(state.ioReady).toBe(true);expect(state.renderSettled).toBe(true);
  expect(environmentPresentationStats.uploads-startUploads>=15).toBe(true);
  const stats=ctx.render.stats({width:1280,height:720});expect(stats.drawCalls>0).toBe(true);
  console.log('environment.destination cold recurring uploads',{frames,uploads:environmentPresentationStats.uploads-startUploads,state,group:assets.stats().groups['map10-environment'],render:stats});
},{scene:'scenes/destination-environment.scene.json',memory:'phone-low'});
for(const mapId of DESTINATION_ENVIRONMENT_IDS){
  renderTest(`environment.destination map${mapId} both panorama source witnesses match independent colors`,async ctx=>{
    ctx.input.view(1280,720,1);await select(ctx,mapId,2);
    expect(environmentCatalogSamples.count).toBe(2);
    const points:[number,number][]=[];
    for(let slot=0;slot<2;slot++)points.push([environmentCatalogSamples.probeX[slot]!,environmentCatalogSamples.probeY[slot]!]);
    for(let slot=0;slot<2;slot++)points.push([environmentCatalogSamples.controlX[slot]!,environmentCatalogSamples.controlY[slot]!]);
    points.push([0,0]);
    const result=ctx.render.probe({width:1280,height:720,points}).points;
    for(let slot=0;slot<2;slot++){
      expect(result[slot]!.rgba).toEqual(result[slot+2]!.rgba);expect(result[slot]!.rgba[3]).toBe(255);
      expect(JSON.stringify(result[slot]!.rgba)===JSON.stringify(result[4]!.rgba)).toBe(false);
    }
    console.log('environment.destination independent panorama probes',{mapId,checked:2});
  },{scene:'scenes/destination-environment.scene.json',memory:'phone-low'});
  renderTest(`environment.destination map${mapId} every packed source witness matches independent source color`,async ctx=>{
    ctx.input.view(1280,720,1);await select(ctx,mapId,1);
    const manifest=destinationEnvironment(mapId),before=ctx.world.resource(DrivingState);let checked=0;
    for(let batch=0;batch*32<manifest.images.length;batch++){
      ctx.world.setResource(EnvironmentReview,{batch});await ctx.step(1);
      const count=environmentCatalogSamples.count,points:[number,number][]=[];
      for(let slot=0;slot<count;slot++)points.push([environmentCatalogSamples.probeX[slot]!,environmentCatalogSamples.probeY[slot]!]);
      for(let slot=0;slot<count;slot++)points.push([environmentCatalogSamples.controlX[slot]!,environmentCatalogSamples.controlY[slot]!]);
      const result=ctx.render.probe({width:1280,height:720,points}).points;
      // The public probe is bounded to64 points: keep the32 independent pairs
      // together and read the unchanged clear background separately, without a step.
      const background=ctx.render.probe({width:1280,height:720,points:[[0,0]]}).points[0]!.rgba;
      expect(count).toBe(Math.min(32,manifest.images.length-batch*32));
      for(let slot=0;slot<count;slot++){
        expect(environmentCatalogSamples.objectId[slot]).toBe(manifest.images[batch*32+slot]!.objectId);
        expect(result[slot]!.rgba).toEqual(result[count+slot]!.rgba);expect(result[slot]!.rgba[3]).toBe(255);checked++;
        expect(JSON.stringify(result[slot]!.rgba)===JSON.stringify(background)).toBe(false);
      }
    }
    expect(checked).toBe(manifest.images.length);expect(ctx.world.resource(DrivingState)).toEqual(before);
    console.log('environment.destination independent source probes',{mapId,checked,group:assets.stats().groups[manifest.assetId]});
  },{scene:'scenes/destination-environment.scene.json',memory:'phone-low'});
}
renderTest('environment.destination actual Map4 dense queried1000 and all32 controlled cars use fixed compositor',async ctx=>{
  ctx.input.view(1280,720,1);await select(ctx,4,0);
  ctx.world.setResource(EnvironmentReview,{cameraOriginZ:30450,trafficCount:32});await ctx.step(1);
  const stats=environmentPresentationStats.geometry;
  expect(stats.queriedWindow).toBe(1000);expect(stats.sourceEligible).toBe(980);
  expect(stats.trafficSelected).toBe(32);expect(stats.trafficVisible).toBe(32);expect(stats.trafficHidden).toBe(0);
  expect(stats.props>0).toBe(true);expect(stats.total).toBe(stats.props+32);
  expect(stats.total<=1032).toBe(true);expect(meshes.info('environment-composite')!.vertices).toBe(4128);
  const render=ctx.render.stats({width:1280,height:720});
  expect('validationErrors' in render).toBe(true);
  if('validationErrors' in render)expect(render.validationErrors).toEqual([]);
  expect(render.drawCalls>0).toBe(true);
  console.log('environment.destination dense controlled art',{mapId:4,geometry:{...stats},render});
},{scene:'scenes/destination-environment.scene.json',memory:'phone-low'});

renderTest('environment.destination recorded review keys cannot activate legacy proof UI or clock',async ctx=>{
  ctx.input.view(1280,720,1);await select(ctx,4,0);
  const road=ctx.world.resource(RoadProofState);
  for(let repeat=0;repeat<2;repeat++){
    ctx.input.key('Digit4',true);await ctx.step(2);ctx.input.key('Digit4',false);await ctx.step(3);
    expect(ctx.world.resource(RoadProofState)).toEqual(road);
    const frame=ctx.render.stats({width:1280,height:720});
    expect(frame.passes.includes('2d.ui')).toBe(false);expect(frame.drawCalls).toBe(6);
  }
},{scene:'scenes/destination-environment.scene.json',memory:'phone-low'});
renderTest('environment.destination projected single and two page source art',async ctx=>{
  ctx.input.view(1280,720,1);
  await select(ctx,2,0);ctx.render.expectScreenshot('map02',{width:1280,height:720});
  await select(ctx,10,0);ctx.render.expectScreenshot('map10',{width:1280,height:720});
},{scene:'scenes/destination-environment.scene.json',memory:'phone-low'});
renderTest('environment.destination staged single two page cold projection and owned A B A release',async ctx=>{
  ctx.input.view(1280,720,1);await select(ctx,2,0);
  expect(meshes.info('environment-composite')!.vertices).toBe(4128);
  const initialUploads=environmentPresentationStats.uploads;
  await select(ctx,10,0);expect(environmentPresentationStats.uploads>initialUploads).toBe(true);
  console.log('environment.destination A to B ownership',{ledger:ctx.world.resource(EnvironmentResidency),groups:assets.stats().groups});
  expect(ctx.world.resource(EnvironmentResidency).renderSettled).toBe(true);
  expect(assets.stats().groups['map02-environment']!.status).toBe('released');
  // Data has no GPU/audio retention: settle marks an unpinned data group unloaded.
  expect(assets.stats().groups['biome-map02-data']!.status).toBe('unloaded');
  await select(ctx,2,0);
  expect(ctx.world.resource(EnvironmentResidency).active).toBe(2);
  expect(assets.stats().groups['map10-environment']!.status).toBe('released');
  expect(assets.stats().groups['biome-map10-data']!.status).toBe('unloaded');
  for(const name of ['biome-map01-data','biome-catalog-data'])expect(assets.stats().groups[name]!.status).toBe('loaded');
  console.log('environment.destination staged residency',{stats:assets.stats(),uploads:environmentPresentationStats.uploads,submittedBytes:environmentPresentationStats.submittedBytes});
  ctx.input.emit(EnterScene,{scene:'scenes/road-proof.scene.json',release:''});await ctx.step(1);
  const state=ctx.world.resource(EnvironmentResidency);
  expect(state.ownsActive).toBe(false);expect(state.ownsIncoming).toBe(false);expect(state.ownsTraffic).toBe(false);
  expect(assets.stats().groups['environment-review-shared']!.status).toBe('released');
  expect(meshes.info('environment-composite')).toBe(null);
},{scene:'scenes/destination-environment.scene.json',memory:'phone-low'});

renderTest('environment.destination invalid map mode and batch clear stale art and owned leases',async ctx=>{
  ctx.input.view(1280,720,1);
  for(const invalid of [{mapId:1,mode:0,batch:0},{mapId:2,mode:4,batch:0},{mapId:2,mode:1,batch:999}]){
    await select(ctx,2,0);expect(ctx.world.resource(EnvironmentResidency).renderSettled).toBe(true);
    ctx.world.setResource(EnvironmentReview,invalid);await ctx.step(1);
    const failed=ctx.world.resource(EnvironmentResidency);
    expect(failed.failed).toBe(true);expect(failed.renderSettled).toBe(false);expect(failed.ioReady).toBe(false);
    expect(failed.ownsActive).toBe(false);expect(failed.ownsIncoming).toBe(false);expect(failed.ownsTraffic).toBe(false);
    expect(meshes.info('environment-composite')).toBe(null);expect(environmentPresentationStats.failure.length>0).toBe(true);
    await ctx.step(2);expect(ctx.world.resource(EnvironmentResidency).failed).toBe(true);
    for(const name of ['biome-map01-data','biome-catalog-data'])expect(assets.stats().groups[name]!.status).toBe('loaded');
  }
},{scene:'scenes/destination-environment.scene.json',memory:'phone-low'});

renderTest('environment.destination same config reentry preserves dirty acquired ledger and requires fresh frames',async ctx=>{
  ctx.input.view(1280,720,1);await select(ctx,2,0);
  const previous=ctx.world.resource(EnvironmentResidency);
  expect(previous.active).toBe(2);expect(previous.renderSettled).toBe(true);
  // These are real public acquisitions before recording their owner ledger.
  assets.load(['map10-environment','biome-map10-data']);
  ctx.world.setResource(EnvironmentResidency,{incoming:10,ownsIncoming:true});
  ctx.input.emit(EnterScene,{scene:'scenes/destination-environment.scene.json',release:''});await ctx.step(1);
  const reentry=ctx.world.resource(EnvironmentResidency);
  expect(reentry.epoch>previous.epoch).toBe(true);expect(reentry.renderSettled).toBe(false);
  expect(reentry.active).toBe(2);expect(reentry.ownsActive).toBe(true);expect(reentry.ownsIncoming).toBe(false);
  expect(assets.stats().groups['map10-environment']!.status==='loaded').toBe(false);
  expect(assets.stats().groups['biome-map10-data']!.status==='loaded').toBe(false);
  await ctx.step(4);expect(ctx.world.resource(EnvironmentResidency).renderSettled).toBe(true);
  // The last recorded destination in the step must win without erasing pins.
  ctx.input.emit(EnterScene,{scene:'scenes/destination-environment.scene.json',release:''});
  ctx.input.emit(EnterScene,{scene:'scenes/road-proof.scene.json',release:''});await ctx.step(1);
  expect(ctx.world.resource(EnvironmentResidency).ownsActive).toBe(false);
  expect(ctx.world.resource(EnvironmentResidency).ownsTraffic).toBe(false);
  expect(meshes.info('environment-road')).toBe(null);
},{scene:'scenes/destination-environment.scene.json',memory:'phone-low'});
