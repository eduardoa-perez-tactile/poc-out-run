import {renderTest,expect,type WorldTestContext,type RenderContext} from '@gameengine/test';
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
function expectTransparentPanoramaTop(render:RenderContext,width:number,height:number){
  const top=sourceProjectionStats.horizonY+MAP01_PANORAMA_HEIGHT_PX*2/MAP01_PANORAMA_REFERENCE_HEIGHT;
  // Probe the first raster-covered row, not just sky outside the quad. At a
  // minified viewport even a base-level V clamp can sample wrapped mip texels.
  const first=Math.ceil((1-top)*height/2-.5);
  expect(first>0&&first<height-2).toBe(true);
  const points:[number,number][]=[];
  for(const fraction of [.125,.3125,.5,.6875,.875])for(const y of [first-1,first,first+1])points.push([Math.floor(width*fraction),y]);
  const sky=loadMap01().palette[0]!;
  for(const pixel of render.probe({width,height,points}).points){
    for(let channel=0;channel<3;channel++)expect(Math.abs(pixel.rgba[channel]!-sky[channel]!)).toBeLessThanOrEqual(1);
  }
}
renderTest('environment.profile canonical recorded dense travel',async({world,input,step,render})=>{
  // Start from the configured project scene. Every scene/sample/transport change
  // below is recorded input, so the resulting tape is valid for budget playback.
  expect(world.count(Map01ArtSlot)).toBe(0);
  input.view(1280,720,1);
  input.emit(EnterScene,{scene:'scenes/map01-art.scene.json',release:''});await ready(step);
  input.key('Digit9',true);await step(1);input.key('Digit9',false);await step(1);
  expect(world.resource(Map01ArtPreview).cameraOriginZ).toBe(1930*150);
  render.probe({width:1280,height:720,points:[[640,60],[640,650]]});await step(1);
  const start=world.resource(Map01ArtPreview).cameraOriginZ;
  const submittedBefore=map01ArtStats.submittedBytes;
  const meshesBefore=NAMES.map(name=>meshes.info(name)!);
  expect(meshesBefore.every(info=>info!==null)).toBe(true);
  expect(meshesBefore.map(info=>info.vertices)).toEqual([7200,1024,4,4]);
  input.key('KeyP',true);await step(1);input.key('KeyP',false);await step(1);
  let peakDraws=0,peakVisited=0,peakDrawn=0,peakFrameBytes=0,peakOwnedMeshBytes=0;
  let minDrawn=Infinity;
  for(let sample=0;sample<8;sample++){
    await step(15);
    const frame=render.stats({width:1280,height:720});
    expect(map01ArtStats.ready).toBe(true);
    expect(map01ArtStats.roadQuads).toBeGreaterThan(0);
    expect(map01ArtStats.drawn).toBeGreaterThan(0);
    expect(map01ArtStats.frameUploadCalls).toBe(4);
    //1800 road+256 prop+2 panorama quads, all streams and Uint16 indices.
    expect(map01ArtStats.frameSubmittedBytes).toBe(452760);
    const owned=NAMES.map(name=>meshes.info(name)!);
    expect(owned.map(info=>info.vertices)).toEqual([7200,1024,4,4]);
    peakOwnedMeshBytes=Math.max(peakOwnedMeshBytes,owned.reduce((bytes,info)=>bytes+info.bytes,0));
    if(sample===0)console.log('Map1 active render stats',frame);
    peakDraws=Math.max(peakDraws,frame.drawCalls);peakVisited=Math.max(peakVisited,map01ArtStats.visited);
    peakDrawn=Math.max(peakDrawn,map01ArtStats.drawn);minDrawn=Math.min(minDrawn,map01ArtStats.drawn);
    peakFrameBytes=Math.max(peakFrameBytes,map01ArtStats.frameSubmittedBytes);
  }
  expect(world.resource(Map01ArtPreview).cameraOriginZ).toBeGreaterThan(start+14000);
  expect(world.resource(Map01ArtPreview).playing).toBe(true);
  // Four mesh instances plus the capture target's post.present blit.
  expect(peakDraws).toBeLessThanOrEqual(5);expect(peakVisited).toBeLessThanOrEqual(138);
  expect(peakOwnedMeshBytes).toBeLessThanOrEqual(512*1024);
  expect(map01ArtStats.submittedBytes-submittedBefore).toBeGreaterThan(452760*120);
  const group=assets.stats().groups[GROUP]!;
  expect(group.status).toBe('loaded');expect(group.progress).toBe(1);expect(group.failed.length).toBe(0);
  console.log('Map1 selected group actual',group,'meshCPUBytes',peakOwnedMeshBytes,'submittedBytes',map01ArtStats.submittedBytes-submittedBefore);
  expect(group.resident.textures).toBeGreaterThan(0);
  // Loose PNGs acquire an engine-generated mip chain; cooked KTX keeps the
  // authored single level. Bound both charged paths, and log their actual bytes.
  expect(group.resident.textures).toBeLessThanOrEqual(11*1024*1024);
  expect(assets.stats().groups['player-ferrari1']?.status==='loaded').toBe(false);
  console.log('Map1 environment travel evidence',{
    start,end:world.resource(Map01ArtPreview).cameraOriginZ,peakDraws,peakVisited,peakDrawn,minDrawn,
    peakFrameSubmittedBytes:peakFrameBytes,submittedBytes:map01ArtStats.submittedBytes-submittedBefore,
    ownedNativeMeshBytes:peakOwnedMeshBytes,meshCapacities:meshesBefore,
    selectedGroup:group,sourceRgbaBytesArithmetic:7864320,
  });
},{memory:'phone-low'});
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
    if(name==='hill')expectTransparentPanoramaTop(render,1280,720);
    render.expectScreenshot('art',{width:1280,height:720});
  },SCENE);
}
renderTest('environment.art narrow landscape keeps source metadata and fills both panorama layers',async({world,input,step,render})=>{
  input.view(882,344,1,[44,0,0,21]);world.setResource(Map01ArtPreview,{cameraOriginZ:1930*150});
  await ready(step);
  expect(loadMap01().placements.length).toBe(1475);
  expect(meshes.info('map01-art-back')!.vertices).toBe(4);expect(meshes.info('map01-art-front')!.vertices).toBe(4);
  expectTransparentPanoramaTop(render,882,344);
  render.expectScreenshot('art',{width:882,height:344});
},SCENE);
for(const [width,height] of [[852,393],[1080,810],[1280,720],[720,540]] as const){
  renderTest(`environment.panorama transparent top stays clear at ${width}x${height}`,async({world,input,step,render})=>{
    input.view(width,height,1);world.setResource(Map01ArtPreview,{cameraOriginZ:1930*150});await ready(step);
    expectTransparentPanoramaTop(render,width,height);
  },SCENE);
}
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
