import { renderTest, expect } from '@gameengine/test';
import { meshes,assets,EnterScene } from '@gameengine/runtime';
import { VehiclePreview,VehicleVisualSlot,RoadProofState } from '../../src/schema.gen.ts';
import { FERRARI1 } from '../../src/content/vehicles/ferrari1.manifest.ts';
import { POSE_NAMES,VISUAL_POOL_CAPACITY,poseRange,frameForPose } from '../../src/content/vehicles/vehicle-poses.ts';
import { vehicleBufferStats } from '../../src/render/vehicle-buffers.ts';
const SCENE={scene:'scenes/vehicle-preview.scene.json',memory:'phone-low' as const};
for(let pose=0;pose<POSE_NAMES.length;pose++) {
  for(const sample of pose<18?[10]:[0,100]) {
    renderTest(`vehicle.pose ${POSE_NAMES[pose]} sample ${sample}`,async({input,step,render,world})=>{
      input.view(1280,720,1);
      world.setResource(VehiclePreview,{pose,sample,scale:3.2});
      await step(3);
      const before=world.resource(RoadProofState);
      render.expectScreenshot('car',{width:1280,height:720});
      expect(vehicleBufferStats.visible).toBe(1);
      expect(meshes.info('player-car')!==null).toBe(true);
      render.expectDrawCalls('<=',8,{width:1280,height:720});
      expect(world.resource(RoadProofState)).toEqual(before);
    },SCENE);
  }
}
for(let effect=1;effect<=5;effect++) {
  renderTest(`vehicle.effects paired family ${effect}`,async({input,step,render,world})=>{
    input.view(882,344,1,[44,0,0,21]);
    world.setResource(VehiclePreview,{pose:1,sample:10,effect});
    await step(3);
    render.expectScreenshot('effects',{width:882,height:344});
    expect(vehicleBufferStats.visible).toBe(VISUAL_POOL_CAPACITY);
    expect(vehicleBufferStats.vertices).toBe(12);expect(vehicleBufferStats.indices).toBe(18);
  },SCENE);
}
renderTest('vehicle.residency selected car and fixed pool survive repeated preview changes',async({input,step,render,world})=>{
  input.view(882,344,1);
  for(let i=0;i<46;i++) {
    world.setResource(VehiclePreview,{pose:i%23,sample:i,effect:i%6});
    await step(1);
  }
  render.probe({width:882,height:344,points:[[441,300]]});
  expect(meshes.info('player-car')!.vertices).toBe(12);
  const stats=assets.stats();
  expect(stats.groups['player-ferrari1']!.failed.length).toBe(0);
  expect(stats.resident.textures).toBeLessThanOrEqual(10*1024*1024);
  expect(Object.keys(stats.groups)).toEqual(['player-ferrari1']);
},SCENE);
renderTest('vehicle.placeholder stays distinct and centered in narrow landscape',async({input,step,render,world})=>{
  input.view(720,540,1);
  world.setResource(VehiclePreview,{placeholder:true,effect:1});
  await step(3);
  render.expectScreenshot('placeholder',{width:720,height:540});
  expect(vehicleBufferStats.visible).toBe(1);
},SCENE);

// Run this same test with --cooked: every one of the 148 referenced body frames
// must display an opaque source texel unchanged through the real atlas/material.
renderTest('vehicle.cooked-pixels every body frame preserves its source texel',async({input,step,render,world})=>{
  input.view(1280,720,1);
  await step(3);
  // A cold cooked load may initially draw the procedural placeholder. A probe
  // waits for queued assets; the next presentation step replaces that mesh.
  render.probe({width:1280,height:720,points:[[0,0]]});
  await step(1);
  expect(assets.progress('player-ferrari1')).toBe(1);
  for(let pose=0;pose<POSE_NAMES.length;pose++) {
    const range=poseRange(pose);
    for(let sample=0;sample<=range.last-range.first;sample++) {
      world.setResource(VehiclePreview,{pose,sample,effect:0,scale:3.2});
      await step(1);
      const frame=FERRARI1.body[frameForPose(pose,sample)-1]!;
      const [px,py]=frame.opaqueProbePx,[w,h]=frame.sourceSizePx;
      const x=Math.floor(640+(px+.5-w/2)*3.2),y=Math.floor(684-(h-py-.5)*3.2);
      const actual=render.probe({width:1280,height:720,points:[[x,y]]}).points[0]!.rgba;
      for(let channel=0;channel<3;channel++){
        const delta=Math.abs(actual[channel]!-frame.opaqueProbeRgba[channel]!);
        if(delta>2)throw new Error(`Frame ${frame.sourceFrame} channel ${channel}: cooked/display ${actual.join(',')} source ${frame.opaqueProbeRgba.join(',')}`);
      }
    }
  }
},SCENE);

renderTest('vehicle.lifecycle disabling destroys geometry releases preload and re-enables cleanly',async({input,step,render,world})=>{
  input.view(1280,720,1);await step(3);
  render.probe({width:1280,height:720,points:[[0,0]]});await step(1);
  expect(meshes.info('player-car')!.vertices).toBe(12);
  expect(assets.stats().groups['player-ferrari1']!.status).toBe('loaded');
  world.setResource(VehiclePreview,{enabled:false});await step(1);
  expect(meshes.info('player-car')).toBe(null);
  expect(assets.stats().groups['player-ferrari1']!.status).toBe('released');
  expect(world.resource(VehiclePreview).loaded).toBe(false);
  world.setResource(VehiclePreview,{enabled:true});await step(3);
  render.probe({width:1280,height:720,points:[[640,620]]});await step(1);
  expect(meshes.info('player-car')!.vertices).toBe(12);
  expect(assets.stats().groups['player-ferrari1']!.status).toBe('loaded');
},SCENE);
renderTest('vehicle.lifecycle losing the preview slot or leaving its scene releases ownership',async({input,step,render,world})=>{
  input.view(1280,720,1);await step(3);
  render.probe({width:1280,height:720,points:[[0,0]]});await step(1);
  for(const entity of world.entities(VehicleVisualSlot))world.despawn(entity);
  await step(1);
  expect(meshes.info('player-car')).toBe(null);
  expect(world.resource(VehiclePreview).loaded).toBe(false);
  expect(world.resource(VehiclePreview).enabled).toBe(false);
  expect(assets.stats().groups['player-ferrari1']!.status).toBe('released');
  input.emit(EnterScene,{scene:'scenes/vehicle-preview.scene.json',release:''});await step(3);
  render.probe({width:1280,height:720,points:[[0,0]]});await step(1);
  expect(world.count(VehicleVisualSlot)).toBe(1);
  expect(meshes.info('player-car')!.vertices).toBe(12);
  // No explicit release in EnterScene: this controller must own scene-exit cleanup.
  input.emit(EnterScene,{scene:'scenes/road-proof.scene.json',release:''});await step(2);
  expect(world.count(VehicleVisualSlot)).toBe(0);
  expect(meshes.info('player-car')).toBe(null);
  expect(world.resource(VehiclePreview).loaded).toBe(false);
  expect(world.resource(VehiclePreview).enabled).toBe(false);
  expect(assets.stats().groups['player-ferrari1']!.status).toBe('released');
},SCENE);

renderTest('vehicle.lifecycle disabling an initial preload cannot resurrect preview state',async({input,step,world})=>{
  input.view(1280,720,1);
  await step(1); // Do not wait for the first asynchronous native asset reads.
  world.setResource(VehiclePreview,{enabled:false});
  await step(1);
  expect(meshes.info('player-car')).toBe(null);
  expect(world.resource(VehiclePreview).loaded).toBe(false);
  await step(8);
  expect(meshes.info('player-car')).toBe(null);
  expect(world.resource(VehiclePreview).enabled).toBe(false);
  expect(world.resource(VehiclePreview).loaded).toBe(false);
  expect(assets.stats().groups['player-ferrari1']!.status).toBe('released');
},SCENE);

renderTest('vehicle.lifecycle resource reset reconciles a surviving native group pin',async({input,step,render,world})=>{
  input.view(1280,720,1);await step(3);
  render.probe({width:1280,height:720,points:[[0,0]]});await step(1);
  expect(assets.stats().groups['player-ferrari1']!.status).toBe('loaded');
  // Session.rebuild replaces project resources while retaining its native asset
  // book. Reproduce that ownership boundary without inventing a reset API.
  world.setResource(VehiclePreview,{enabled:false,loaded:false,reconciled:false});
  await step(1);
  expect(meshes.info('player-car')).toBe(null);
  expect(world.resource(VehiclePreview).reconciled).toBe(true);
  expect(assets.stats().groups['player-ferrari1']!.status).toBe('released');
},SCENE);
