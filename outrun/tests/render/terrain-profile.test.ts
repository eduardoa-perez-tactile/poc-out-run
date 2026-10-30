import {renderTest,expect,type WorldTestContext} from '@gameengine/test';
import {assets,meshes,EnterScene} from '@gameengine/runtime';
import {DrivingState,DrivingInput,DrivingResetRequested,DrivingPauseRequested,TerrainDriver,TerrainVisualState,
  Map01ArtPreview,VehiclePreview} from '../../src/schema.gen.ts';
import {sourceProjectionStats} from '../../src/render/source-projection.ts';
import {map01ArtStats} from '../../src/render/map01-art-buffers.ts';
import {vehicleBufferStats} from '../../src/render/vehicle-buffers.ts';

const MAP_MESHES=['map01-art-road','map01-art-props','map01-art-back','map01-art-front'];
const OWNED_MESHES=[...MAP_MESHES,'player-car'];
function soleDriver(world:WorldTestContext['world']){
  const entities=world.entities(TerrainDriver);expect(entities.length).toBe(1);return entities[0]!;
}
function chargedGroups(){
  const stats=assets.stats(),map=stats.groups['map01-environment']!,car=stats.groups['player-ferrari1']!;
  expect(stats.class).toBe('phone-low');expect(stats.overBudget).toBe(null);
  expect(Object.entries(stats.groups).filter(([,group])=>group.status==='loaded').map(([name])=>name).sort()).toEqual(['map01-environment','player-ferrari1']);
  for(const group of [map,car]){expect(group.progress).toBe(1);expect(group.failed).toEqual([]);expect(group.resident.textures).toBeGreaterThan(0);}
  expect(map.members).toBe(8);expect(car.members).toBe(2);
  // Actual loose mip-chain charges and cooked base-level charges differ. Keep
  // selected-family bounds and inspect their reported values in both lanes.
  expect(map.resident.textures).toBeLessThanOrEqual(11*1024*1024);
  expect(car.resident.textures).toBeLessThanOrEqual(6*1024*1024);
  expect(stats.budget.textures!==null&&stats.budget.total!==null).toBe(true);
  expect(stats.resident.textures).toBeLessThanOrEqual(128*1024*1024);
  expect(stats.resident.textures).toBeLessThanOrEqual(stats.budget.textures!);
  expect(stats.resident.total).toBeLessThanOrEqual(stats.budget.total!);
  return {map,car,global:stats.resident,budget:stats.budget};
}

renderTest('terrain.profile recorded source drive skid edge pause and recenter',async({world,input,step,render})=>{
  // Configured project startup, not an unrecorded test-scene override. Every
  // scene, driving reset, pause and control below is replayable recorded input.
  expect(world.count(TerrainDriver)).toBe(0);
  input.view(1280,720,1);
  input.emit(EnterScene,{scene:'scenes/driving-terrain.scene.json',release:''});await step(1);
  // Native readback waits queued assets without manufacturing simulated time.
  render.probe({width:1280,height:720,points:[[640,60],[640,650]]});await step(1);
  expect(assets.progress('map01-environment')).toBe(1);expect(assets.progress('player-ferrari1')).toBe(1);
  expect(map01ArtStats.ready).toBe(true);expect(map01ArtStats.roadQuads).toBeGreaterThan(0);
  expect(map01ArtStats.drawn).toBeGreaterThan(0);chargedGroups();
  const owner=soleDriver(world);
  let sawSkid=false,sawOutside=false,peakDraws=0,peakMapFrameBytes=0,peakOwnedMeshCPUBytes=0,peakAllMeshCPUBytes=0;
  const frameDraws:{phase:string;drawCalls:number;instances:number;triangles:number;passes:string[];
    uiModelsRendered:number;uiCellPasses:number;culled2d:number;transparent2d:number;worldOccluded:boolean}[]=[];
  const observeFrame=(phase='sample')=>{
    const driving=world.resource(DrivingState),map=world.resource(Map01ArtPreview);
    expect(map.followDriving).toBe(true);expect(map.cameraOriginZ).toBe(driving.distance);
    expect(map.previousCameraOriginZ).toBe(driving.previousDistance);
    expect(sourceProjectionStats.cameraOriginZ>=Math.min(driving.distance,driving.previousDistance)-.01).toBe(true);
    expect(sourceProjectionStats.cameraOriginZ<=Math.max(driving.distance,driving.previousDistance)+.01).toBe(true);
    expect(map01ArtStats.ready).toBe(true);expect(map01ArtStats.roadQuads).toBeGreaterThan(0);
    const frame=render.stats({width:1280,height:720});expect(frame.drawCalls).toBeGreaterThan(0);
    frameDraws.push({phase,drawCalls:frame.drawCalls,instances:frame.instances,triangles:frame.triangles,passes:frame.passes,
      uiModelsRendered:frame.uiModelsRendered,uiCellPasses:frame.uiCellPasses,culled2d:frame.culled2d,
      transparent2d:frame.transparent2d,worldOccluded:frame.worldOccluded});
    const owned=OWNED_MESHES.map(name=>meshes.info(name)!);
    expect(owned.every(info=>info!==null)).toBe(true);
    expect(owned.map(info=>info.vertices)).toEqual([7200,1024,4,4,12]);
    peakDraws=Math.max(peakDraws,frame.drawCalls);
    peakMapFrameBytes=Math.max(peakMapFrameBytes,map01ArtStats.frameSubmittedBytes);
    peakOwnedMeshCPUBytes=Math.max(peakOwnedMeshCPUBytes,owned.reduce((sum,info)=>sum+info.bytes,0));
    peakAllMeshCPUBytes=Math.max(peakAllMeshCPUBytes,meshes.list().bytes);
    return frame;
  };
  observeFrame('ready');
  input.emit(DrivingResetRequested,{manual:false,legacySpeed:100,distance:300000,lateral:0});
  input.key('ArrowRight',true);input.key('ArrowUp',true);
  for(let tick=0;tick<72;tick++){
    await step(1);
    const driver=world.get(owner,TerrainDriver),view=world.resource(VehiclePreview);
    if(driver.skidding){
      sawSkid=true;expect(view.leftEffect).toBe(1);expect(view.rightEffect).toBe(1);
      expect(view.hidden).toBe(false);expect(vehicleBufferStats.visible).toBe(3);
    }
    if(driver.leftOutside||driver.rightOutside){
      sawOutside=true;
      expect(view.leftEffect).toBe(driver.leftEffect);expect(view.rightEffect).toBe(driver.rightEffect);
      if(driver.leftOutside)expect(view.leftEffect).toBe(2);
      if(driver.rightOutside)expect(view.rightEffect).toBe(2);
    }
    if(tick%12===11)observeFrame(`drive-${tick+1}`);
  }
  expect(sawSkid).toBe(true);expect(sawOutside).toBe(true);
  expect(world.resource(DrivingState).distance).toBeGreaterThan(307000);

  input.key('ArrowRight',false);input.key('ArrowUp',false);
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  const paused={...world.resource(DrivingState)},pausedDriver={...world.get(owner,TerrainDriver)};
  const pausedTicks=world.get(owner,TerrainVisualState).animationTicks;
  expect(world.resource(DrivingInput).keyboard).toBe(0);expect(world.resource(DrivingInput).ui).toBe(0);
  await step(3);
  expect(world.resource(DrivingState)).toEqual(paused);expect(world.get(owner,TerrainDriver)).toEqual(pausedDriver);
  expect(world.get(owner,TerrainVisualState).animationTicks).toBe(pausedTicks);
  observeFrame('paused');
  input.emit(DrivingPauseRequested,{paused:false});await step(1);
  expect(world.resource(DrivingState).playing).toBe(true);
  expect(world.resource(DrivingInput).keyboard).toBe(0);expect(world.resource(DrivingInput).ui).toBe(0);
  observeFrame('resumed');

  input.emit(DrivingResetRequested,{manual:false,legacySpeed:0,distance:45000,lateral:-1.1});await step(1);
  expect(world.get(owner,TerrainDriver).recentering).toBe(true);
  expect(world.resource(VehiclePreview).hidden).toBe(true);expect(vehicleBufferStats.visible).toBe(0);
  expect(meshes.info('player-car')!.vertices).toBe(12);chargedGroups();observeFrame('hidden');
  // -1.1 reaches within0.05 after88 nominal moves, then completes on its next
  // check. The first recorded reset step above already performed one move.
  await step(88);
  const completed=world.get(owner,TerrainDriver),driving=world.resource(DrivingState);
  expect(completed.recentering).toBe(false);expect(Math.abs(driving.lateral)).toBeLessThanOrEqual(.05);
  expect(driving.legacySpeed).toBe(0);expect(driving.distance).toBe(45000);
  expect(world.resource(VehiclePreview).hidden).toBe(false);expect(vehicleBufferStats.visible).toBe(1);
  expect(meshes.info('player-car')!.vertices).toBe(12);
  observeFrame('restored');const charges=chargedGroups();
  expect(peakOwnedMeshCPUBytes).toBeLessThanOrEqual(500*1024);
  console.log('Terrain combined canonical profile',{
    sawSkid,sawOutside,peakDraws,frameDraws,peakMapFrameBytes,carRawBytesPerSubmission:660,
    combinedRawBytesPerOneMapAndCarBuild:452760+660,
    peakOwnedMeshCPUBytes,peakAllMeshCPUBytes,charges,
    accounting:'Raw arrays count JS-to-native submissions; mesh.info bytes are CPU storage with a GPU copy. These are not measured GPU bandwidth or hardware memory. JS allocation/GC come from the runner budget report.',
  });
},{memory:'phone-low'});
