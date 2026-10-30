import {renderTest,expect,type WorldTestContext} from '@gameengine/test';
import {EnterScene,assets,meshes} from '@gameengine/runtime';
import {Map01ArtPreview,Map01ArtSlot,DrivingState,RoadProofState} from '../../src/schema.gen.ts';
import {loadMap01} from '../../src/content/biome.ts';
import {map01ArtStats,MAP01_PROP_CAPACITY} from '../../src/render/map01-art-buffers.ts';
import {sourceProjectionStats} from '../../src/render/source-projection.ts';
import {MAP01_PANORAMA_HEIGHT_PX,MAP01_PANORAMA_REFERENCE_HEIGHT} from '../../src/render/map01-art-backgrounds.ts';
const SCENE={scene:'scenes/map01-art.scene.json',memory:'phone-low' as const};
const GROUP='map01-environment';
const NAMES=['map01-art-road','map01-art-props','map01-art-back','map01-art-front'];
async function ready(step:WorldTestContext['step']){
  await step(3);
  for(let frame=0;frame<120&&!map01ArtStats.ready;frame++)await step(1);
  expect(map01ArtStats.ready).toBe(true);
  expect(assets.stats().groups[GROUP]!.failed.length).toBe(0);
}
for(const [name,distance,lateral] of [
  ['start',45000,0],['hill',54000,0],['dense',1930*150,0],['fork',4284*150,0],
  ['palm near',101000,1],['palm middle',97000,1],['palm far',87000,1],
] as const){
  renderTest(`environment.art ${name}`,async({world,input,step,render})=>{
    input.view(1280,720,1);world.setResource(Map01ArtPreview,{cameraOriginZ:distance,lateral});
    await ready(step);
    expect(sourceProjectionStats.playerSampleZ).toBe(distance+702);
    expect(map01ArtStats.visited).toBeLessThanOrEqual(138);
    if(name!=='fork')expect(map01ArtStats.drawn).toBeGreaterThan(0);
    if(name==='start')expect(map01ArtStats.partial).toBeGreaterThan(0);
    expect(map01ArtStats.drawn).toBeLessThanOrEqual(MAP01_PROP_CAPACITY);
    expect(meshes.info('map01-art-props')!.vertices).toBe(MAP01_PROP_CAPACITY*4);
    render.expectDrawCalls('<=',8,{width:1280,height:720});
    if(name==='hill'){
      const top=sourceProjectionStats.horizonY+MAP01_PANORAMA_HEIGHT_PX*2/MAP01_PANORAMA_REFERENCE_HEIGHT;
      // First raster-covered row, rather than a pixel outside the quad that
      // could miss an opaque-bottom wrap fringe along its transparent top.
      const first=Math.ceil((1-top)*360-.5);
      expect(first>0&&first<718).toBe(true);
      const points:[number,number][]=[];
      for(const x of [160,400,640,880,1120])for(const y of [first-1,first,first+1])points.push([x,y]);
      const sky=loadMap01().palette[0]!;
      for(const pixel of render.probe({width:1280,height:720,points}).points){
        for(let channel=0;channel<3;channel++)expect(Math.abs(pixel.rgba[channel]!-sky[channel]!)).toBeLessThanOrEqual(1);
      }
    }
    render.expectScreenshot('art',{width:1280,height:720});
  },SCENE);
}
renderTest('environment.art narrow landscape keeps source metadata and fills both panorama layers',async({world,input,step,render})=>{
  input.view(882,344,1,[44,0,0,21]);world.setResource(Map01ArtPreview,{cameraOriginZ:1930*150});
  await ready(step);
  expect(loadMap01().placements.length).toBe(1475);
  expect(meshes.info('map01-art-back')!.vertices).toBe(4);expect(meshes.info('map01-art-front')!.vertices).toBe(4);
  render.expectScreenshot('art',{width:882,height:344});
},SCENE);
renderTest('environment.lifecycle authoring travel and pause cannot change driving or road simulation',async({world,input,step})=>{
  input.view(1280,720,1);world.setResource(Map01ArtPreview,{cameraOriginZ:1930*150});await ready(step);
  const road={...world.resource(RoadProofState)},driving={...world.resource(DrivingState)};
  const start=world.resource(Map01ArtPreview).cameraOriginZ;
  input.key('KeyP',true);await step(1);input.key('KeyP',false);await step(10);
  expect(world.resource(Map01ArtPreview).playing).toBe(true);
  expect(world.resource(Map01ArtPreview).cameraOriginZ).toBeGreaterThan(start);
  expect(world.resource(Map01ArtPreview).backOffset===1000).toBe(false);
  input.key('KeyP',true);await step(1);input.key('KeyP',false);await step(1);
  const paused={...world.resource(Map01ArtPreview)};await step(10);
  expect(world.resource(Map01ArtPreview).playing).toBe(false);
  expect(world.resource(Map01ArtPreview).cameraOriginZ).toBe(paused.cameraOriginZ);
  expect(world.resource(Map01ArtPreview).backOffset).toBe(paused.backOffset);
  expect(world.resource(Map01ArtPreview).frontOffset).toBe(paused.frontOffset);
  expect(world.resource(RoadProofState)).toEqual(road);expect(world.resource(DrivingState)).toEqual(driving);
  input.key('Digit8',true);await step(1);input.key('Digit8',false);await step(1);
  expect(world.resource(Map01ArtPreview).cameraOriginZ).toBe(54000);
  input.key('KeyP',true);input.key('KeyP',false);await step(1);
  expect(world.resource(Map01ArtPreview).playing).toBe(true);
  const once=world.resource(Map01ArtPreview).cameraOriginZ;
  await step(0);await step(0);
  expect(world.resource(Map01ArtPreview).playing).toBe(true);
  expect(world.resource(Map01ArtPreview).cameraOriginZ).toBe(once);
  await step(3);expect(world.resource(Map01ArtPreview).playing).toBe(true);
},SCENE);
renderTest('environment.lifecycle disable and scene exit release exactly the owned environment meshes and group',async({world,input,step})=>{
  input.view(1280,720,1);await ready(step);
  expect(assets.stats().groups[GROUP]!.status).toBe('loaded');
  expect(assets.stats().groups['player-ferrari1']?.status==='loaded').toBe(false);
  world.setResource(Map01ArtPreview,{enabled:false});await step(1);
  for(const name of NAMES)expect(meshes.info(name)).toBe(null);
  expect(assets.stats().groups[GROUP]!.status).toBe('released');
  world.setResource(Map01ArtPreview,{enabled:true});await ready(step);
  for(const name of NAMES)expect(meshes.info(name)!==null).toBe(true);
  world.setResource(Map01ArtPreview,{
    cameraOriginZ:1930*150,previousCameraOriginZ:1930*150,
    playing:true,controlHeld:31,backOffset:123,frontOffset:456,
    previousBackOffset:123,previousFrontOffset:456,
  });
  await step(3);
  expect(world.resource(Map01ArtPreview).cameraOriginZ).toBeGreaterThan(1930*150);
  expect(world.resource(Map01ArtPreview).playing).toBe(true);
  expect(world.resource(Map01ArtPreview).controlHeld).toBe(31);
  expect(world.resource(Map01ArtPreview).backOffset===1000).toBe(false);
  expect(world.resource(Map01ArtPreview).frontOffset===1000).toBe(false);
  input.emit(EnterScene,{scene:'scenes/map01-data.scene.json',release:''});await step(2);
  expect(world.count(Map01ArtSlot)).toBe(0);
  expect(world.resource(Map01ArtPreview).enabled).toBe(false);
  expect(world.resource(Map01ArtPreview).loaded).toBe(false);
  for(const name of NAMES)expect(meshes.info(name)).toBe(null);
  expect(assets.stats().groups[GROUP]!.status).toBe('released');
  input.emit(EnterScene,{scene:'scenes/map01-art.scene.json',release:''});await ready(step);
  expect(world.count(Map01ArtSlot)).toBe(1);
  const reset=world.resource(Map01ArtPreview);
  expect(reset.playing).toBe(false);
  expect(reset.cameraOriginZ).toBe(45000);expect(reset.previousCameraOriginZ).toBe(45000);
  expect(reset.backOffset).toBe(1000);expect(reset.frontOffset).toBe(1000);
  expect(reset.previousBackOffset).toBe(1000);expect(reset.previousFrontOffset).toBe(1000);
  expect(reset.controlHeld).toBe(0);
  expect(world.resource(DrivingState).active).toBe(false);
  expect(map01ArtStats.drawn).toBeGreaterThan(0);
},SCENE);
renderTest('environment.lifecycle slot loss and resource reset reconcile ownership without late resurrection',async({world,input,step})=>{
  input.view(1280,720,1);await ready(step);
  world.setResource(Map01ArtPreview,{enabled:false,loaded:false,reconciled:false});await step(1);
  expect(world.resource(Map01ArtPreview).reconciled).toBe(true);
  expect(assets.stats().groups[GROUP]!.status).toBe('released');
  world.setResource(Map01ArtPreview,{enabled:true});await ready(step);
  for(const entity of world.entities(Map01ArtSlot))world.despawn(entity);
  await step(1);
  for(const name of NAMES)expect(meshes.info(name)).toBe(null);
  expect(world.resource(Map01ArtPreview).enabled).toBe(false);
  expect(assets.stats().groups[GROUP]!.status).toBe('released');
  await step(8);expect(world.resource(Map01ArtPreview).loaded).toBe(false);
},SCENE);
