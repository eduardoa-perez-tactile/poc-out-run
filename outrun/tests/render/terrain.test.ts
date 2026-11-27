import {renderTest,expect,type WorldTestContext,type RenderContext} from '@gameengine/test';
import {assets,meshes,EnterScene,RenderTime} from '@gameengine/runtime';
import {DrivingState,DrivingResetRequested,DrivingPauseRequested,TerrainDriver,TerrainVisualState,Map01ArtPreview,VehiclePreview} from '../../src/schema.gen.ts';
import {sourceProjectionStats} from '../../src/render/source-projection.ts';
import {vehicleBufferStats} from '../../src/render/vehicle-buffers.ts';
import {FERRARI1} from '../../src/content/vehicles/ferrari1.manifest.ts';
import {frameForPose,effectFrame} from '../../src/content/vehicles/vehicle-poses.ts';
const SCENE={scene:'scenes/driving-terrain.scene.json',memory:'phone-low' as const};
async function ready(step:WorldTestContext['step'],render:RenderContext,width=1280,height=720){
  await step(1);
  for(let frame=0;frame<120&&(assets.progress('map01-environment')<1||assets.progress('player-ferrari1')<1);frame++)await step(1);
  render.probe({width,height,points:[[0,0]]});await step(1);
  expect(assets.progress('map01-environment')).toBe(1);expect(assets.progress('player-ferrari1')).toBe(1);
  expect(assets.stats().groups['map01-environment']!.failed.length).toBe(0);
  expect(assets.stats().groups['player-ferrari1']!.failed.length).toBe(0);
}
function soleDriver(world:WorldTestContext['world']){
  const owners=world.entities(TerrainDriver);expect(owners.length).toBe(1);return owners[0]!;
}
renderTest('terrain.view recorded reset fixes animation phase independently of earlier frame counts',async({world,input,step,render})=>{
  input.view(1280,720,1);await ready(step,render);
  const points:[number,number][]=[];
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)points.push([490+x*43,545+y*22]);
  const sampleAfterReset=async()=>{
    input.emit(DrivingResetRequested,{manual:false,legacySpeed:40,distance:45000,lateral:1.4});await step(5);
    const view=world.resource(VehiclePreview),driving=world.resource(DrivingState);
    const body=frameForPose(view.pose,view.sample);
    const left=effectFrame(view.leftEffect,view.sample),right=effectFrame(view.rightEffect,view.sample);
    // Import integrity proves every decoded atlas/source texel for these frame
    // hashes. Compare complete selected frames, plus actual car-region pixels.
    const decodedFrames={body:FERRARI1.body[body-1]!.sha256,
      left:left===null?null:FERRARI1.effects[left-1]!.sha256,
      right:right===null?null:FERRARI1.effects[right-1]!.sha256};
    const pixels=render.probe({width:1280,height:720,points}).points.map(point=>point.rgba);
    return{sample:view.sample,pose:view.pose,decodedFrames,pixels,driving};
  };
  const first=await sampleAfterReset();await step(17);const second=await sampleAfterReset();
  expect(second.driving).toEqual(first.driving);
  expect(second.sample).toBe(first.sample);expect(second.pose).toBe(first.pose);
  expect(second.decodedFrames).toEqual(first.decodedFrames);expect(second.pixels).toEqual(first.pixels);
},SCENE);
renderTest('terrain.view source camera follows simulation while art review keys cannot move or unpause it',async({world,input,step,render})=>{
  input.view(1280,720,1);await ready(step,render);
  const driving=world.resource(DrivingState),map=world.resource(Map01ArtPreview);
  expect(map.followDriving).toBe(true);expect(map.cameraOriginZ).toBe(driving.distance);
  expect(map.previousCameraOriginZ).toBe(driving.previousDistance);
  const alpha=world.resource(RenderTime).alpha;
  expect(map.lateral).toBeCloseTo(driving.previousLateral+(driving.lateral-driving.previousLateral)*alpha,6);
  expect(sourceProjectionStats.cameraOriginZ>=Math.min(driving.distance,driving.previousDistance)-.01).toBe(true);
  expect(sourceProjectionStats.cameraOriginZ<=Math.max(driving.distance,driving.previousDistance)+.01).toBe(true);
  input.emit(DrivingPauseRequested,{paused:true});await step(2);
  const pausedDriving={...world.resource(DrivingState)};
  const owner=soleDriver(world),ticks=world.get(owner,TerrainVisualState).animationTicks;
  const pose=world.resource(VehiclePreview).pose,sample=world.resource(VehiclePreview).sample;
  for(const key of ['KeyP','Digit7','Digit8','Digit9','Digit0'] as const)input.key(key,true);
  await step(1);
  for(const key of ['KeyP','Digit7','Digit8','Digit9','Digit0'] as const)input.key(key,false);
  await step(7);
  expect(world.resource(DrivingState)).toEqual(pausedDriving);
  expect(world.resource(Map01ArtPreview).cameraOriginZ).toBe(pausedDriving.distance);
  expect(world.resource(Map01ArtPreview).previousCameraOriginZ).toBe(pausedDriving.previousDistance);
  expect(world.resource(Map01ArtPreview).playing).toBe(false);
  expect(world.get(owner,TerrainVisualState).animationTicks).toBe(ticks);
  expect(world.resource(VehiclePreview).pose).toBe(pose);expect(world.resource(VehiclePreview).sample).toBe(sample);
},SCENE);
for(const [name,lateral,left,right] of [['left wheel',-1.1,2,0],['right wheel',1.1,0,2],['both wheels',1.4,2,2]] as const){
  renderTest(`terrain.view ${name} sand feedback`,async({world,input,step,render})=>{
    input.view(1280,720,1);await ready(step,render);
    input.emit(DrivingResetRequested,{manual:false,legacySpeed:40,distance:45000,lateral});await step(3);
    const driver=world.get(soleDriver(world),TerrainDriver),view=world.resource(VehiclePreview);
    expect(driver.leftEffect).toBe(left);expect(driver.rightEffect).toBe(right);
    expect(view.useWheelEffects).toBe(true);expect(view.leftEffect).toBe(left);expect(view.rightEffect).toBe(right);
    expect(view.hidden).toBe(false);expect(vehicleBufferStats.visible).toBe(left&&right?3:2);
    expect(meshes.info('player-car')!.vertices).toBe(12);
    render.expectScreenshot('feedback',{width:1280,height:720});
  },SCENE);
}
renderTest('terrain.view fast curve skid feedback uses both smoke slots',async({world,input,step,render})=>{
  input.view(882,344,1,[44,0,0,21]);await ready(step,render,882,344);
  input.emit(DrivingResetRequested,{manual:false,legacySpeed:100,distance:300000,lateral:0});
  input.key('ArrowRight',true);await step(12);
  const driver=world.get(soleDriver(world),TerrainDriver),view=world.resource(VehiclePreview);
  expect(driver.skidding).toBe(true);expect(view.leftEffect).toBe(1);expect(view.rightEffect).toBe(1);
  expect(vehicleBufferStats.visible).toBe(3);
  render.expectScreenshot('feedback',{width:882,height:344});
},SCENE);
renderTest('terrain.view recenter hides and restores fixed car geometry while its group stays pinned',async({world,input,step,render})=>{
  input.view(1280,720,1);await ready(step,render);
  input.emit(DrivingResetRequested,{manual:false,legacySpeed:0,distance:45000,lateral:1.4});await step(2);
  const owner=soleDriver(world);
  expect(world.get(owner,TerrainDriver).recentering).toBe(true);
  expect(world.resource(VehiclePreview).hidden).toBe(true);expect(world.resource(VehiclePreview).enabled).toBe(true);
  expect(vehicleBufferStats.visible).toBe(0);expect(meshes.info('player-car')!.vertices).toBe(12);
  expect(assets.stats().groups['player-ferrari1']!.status).toBe('loaded');
  render.expectScreenshot('hidden',{width:1280,height:720});
  for(let frames=0;frames<180&&world.get(owner,TerrainDriver).recentering;frames++){
    await step(1);expect(assets.stats().groups['player-ferrari1']!.status).toBe('loaded');
  }
  expect(world.get(owner,TerrainDriver).recentering).toBe(false);
  expect(world.resource(VehiclePreview).hidden).toBe(false);expect(vehicleBufferStats.visible).toBe(1);
  expect(meshes.info('player-car')!.vertices).toBe(12);expect(assets.stats().groups['player-ferrari1']!.status).toBe('loaded');
  render.expectScreenshot('restored',{width:1280,height:720});
},SCENE);
renderTest('terrain.view leaving the driver preserves standalone review controls and releases driving flags',async({world,input,step,render})=>{
  input.view(1280,720,1);await ready(step,render);
  input.emit(EnterScene,{scene:'scenes/map01-art.scene.json',release:''});await step(2);
  expect(world.count(TerrainDriver)).toBe(0);expect(world.resource(Map01ArtPreview).followDriving).toBe(false);
  expect(world.resource(VehiclePreview).useWheelEffects).toBe(false);expect(world.resource(VehiclePreview).hidden).toBe(false);
  input.key('Digit8',true);await step(1);input.key('Digit8',false);await step(1);
  expect(world.resource(Map01ArtPreview).cameraOriginZ).toBe(54000);
  input.emit(EnterScene,{scene:'scenes/vehicle-preview.scene.json',release:''});await step(3);
  world.setResource(VehiclePreview,{pose:5,effect:3,sample:7});await step(2);
  expect(world.resource(VehiclePreview).pose).toBe(5);expect(world.resource(VehiclePreview).effect).toBe(3);
  expect(world.resource(VehiclePreview).sample).toBe(7);
},SCENE);
