import {renderTest,expect,type WorldTestContext} from '@gameengine/test';
import {assets,meshes} from '@gameengine/runtime';
import {TrafficArtPreview,TrafficPool} from '../../src/schema.gen.ts';
import {loadMap01} from '../../src/content/biome.ts';
import {TRAFFIC_SOURCE} from '../../src/content/vehicles/traffic-source.manifest.ts';
import {makeTrafficArtFixture} from '../../src/render/traffic-art-fixtures.ts';
import {trafficCompositeSamples,trafficCompositeStats} from '../../src/render/traffic-buffers.ts';
import {sourceProjectionBuffers,sourceProjectionStats} from '../../src/render/source-projection.ts';
import {catalogSamples} from '../../src/render/traffic-catalog.ts';
import {map01ArtStats} from '../../src/render/map01-art-buffers.ts';
const OPTIONS={scene:'scenes/traffic-art.scene.json',memory:'phone-low' as const};
const W=1280,H=720,ASPECT=W/H;
async function fixture(ctx:WorldTestContext,caseId:number){
  ctx.input.view(W,H,1);ctx.world.setResource(TrafficArtPreview,{mode:2,caseId,frame:1});await ctx.step(1);
  // Readback flushes native asset work; the following fixed frame publishes
  // geometry after that work, rather than inspecting the pre-ready JS scratch.
  ctx.render.probe({width:W,height:H,points:[[0,0]]});await ctx.step(1);
  for(let frame=0;frame<120&&(assets.progress('map01-environment')<1||assets.progress('traffic-source')<1);frame++)await ctx.step(1);
  expect(assets.progress('map01-environment')).toBe(1);expect(assets.progress('traffic-source')).toBe(1);
  await ctx.step(1);expect(map01ArtStats.ready).toBe(true);
  ctx.render.probe({width:W,height:H,points:[[0,0]]});
  expect(ctx.world.count(TrafficPool)).toBe(0);
}
function quad(slot:number){
  return{left:trafficCompositeSamples.left[slot]!,right:trafficCompositeSamples.right[slot]!,bottom:trafficCompositeSamples.bottom[slot]!,
    top:trafficCompositeSamples.top[slot]!,fraction:trafficCompositeSamples.fraction[slot]!,frame:trafficCompositeSamples.frame[slot]!};
}
function sourcePoint(slot:number,q:ReturnType<typeof quad>,sourceY?:number){
  const image=TRAFFIC_SOURCE.models[slot]!.frames[q.frame-1]!;
  const left=(q.left/ASPECT+1)*W/2,top=(1-q.top)*H/2,width=(q.right-q.left)/ASPECT*W/2,fullHeight=(q.top-q.bottom)/q.fraction*H/2;
  const point:[number,number]=[Math.floor(left+(image.opaqueProbePx[0]+.5)/image.sourceSizePx[0]*width),
    Math.floor(top+((sourceY??image.opaqueProbePx[1])+.5)/image.sourceSizePx[1]*fullHeight)];
  // Compare the exact texel selected at this real raster sample, not the nominal
  // probe texel: far quads can cover less than one pixel per original texel.
  const texel:[number,number]=[Math.floor((point[0]+.5-left)/width*image.sourceSizePx[0]),Math.floor((point[1]+.5-top)/fullHeight*image.sourceSizePx[1])];
  expect(texel[0]).toBeGreaterThanOrEqual(0);expect(texel[0]).toBeLessThan(image.sourceSizePx[0]);
  expect(texel[1]).toBeGreaterThanOrEqual(0);expect(texel[1]).toBeLessThan(image.sourceSizePx[1]);
  return{point,texel};
}
async function gpuSource(ctx:WorldTestContext,slot:number,frame:number,texels:readonly[number,number][]){
  ctx.world.setResource(TrafficArtPreview,{mode:1,frame,caseId:0});await ctx.step(1);
  ctx.render.probe({width:W,height:H,points:[[0,0]]});await ctx.step(1);
  for(let tick=0;tick<120&&(assets.progress('traffic-catalog')<1||catalogSamples.frame!==frame||catalogSamples.width!==W||catalogSamples.height!==H);tick++)await ctx.step(1);
  expect(assets.progress('traffic-catalog')).toBe(1);expect(catalogSamples.frame).toBe(frame);
  expect(catalogSamples.width).toBe(W);expect(catalogSamples.height).toBe(H);
  const scale=catalogSamples.scale;
  const points:[number,number][]=texels.map(([x,y])=>[catalogSamples.left[slot]!+x*scale+Math.floor(scale/2),catalogSamples.top[slot]!+y*scale+Math.floor(scale/2)]);
  return ctx.render.probe({width:W,height:H,points}).points.map(point=>point.rgba);
}
function sourceNotBackground(rgba:readonly number[]){
  expect(rgba[3]).toBe(255);expect(Math.max(...rgba.slice(0,3))).toBeGreaterThan(20);
  for(const color of [loadMap01().palette[0]!,loadMap01().palette[3]!,loadMap01().palette[4]!])
    expect(Math.max(...rgba.slice(0,3).map((c,i)=>Math.abs(c-color[i]!)))).toBeGreaterThan(10);
}

renderTest('traffic.art projection both mirrored fork arms use their source row endpoints',async ctx=>{
  await fixture(ctx,6);
  console.log('traffic.art fork preconditions',{stats:{...trafficCompositeStats},projection:{...sourceProjectionStats},
    setup:{camera:makeTrafficArtFixture(loadMap01(),6).cameraOriginZ,lateral:makeTrafficArtFixture(loadMap01(),6).lateral,z:makeTrafficArtFixture(loadMap01(),6).pool.z.slice(0,2),sides:makeTrafficArtFixture(loadMap01(),6).pool.side.slice(0,2)},
    near:[sourceProjectionBuffers.left[160],sourceProjectionBuffers.right[160],sourceProjectionBuffers.ground[160],sourceProjectionBuffers.scale[160]],
    far:[sourceProjectionBuffers.farLeft[160],sourceProjectionBuffers.farRight[160],sourceProjectionBuffers.farGround[160],sourceProjectionBuffers.farScale[160]],clip:sourceProjectionBuffers.clip[160]});
  expect(trafficCompositeStats.visible).toBe(2);
  const setup=makeTrafficArtFixture(loadMap01(),6),base=Math.floor(setup.cameraOriginZ/150),n=160,t=.5;
  expect(setup.data.segments[base+n]!.mirror).toBe(true);
  const quads=[quad(0),quad(1)],samples=quads.map((q,slot)=>sourcePoint(slot,q));
  for(let slot=0;slot<2;slot++){
    const near=slot?sourceProjectionBuffers.right:sourceProjectionBuffers.left,far=slot?sourceProjectionBuffers.farRight:sourceProjectionBuffers.farLeft;
    expect((quads[slot]!.left+quads[slot]!.right)/2).toBeCloseTo(near[n]!+(far[n]!-near[n]!)*t,6);
  }
  expect((quads[0]!.left+quads[0]!.right)/2).toBeLessThan(0);
  expect((quads[1]!.left+quads[1]!.right)/2).toBeGreaterThan(0);
  const actual=ctx.render.probe({width:W,height:H,points:samples.map(sample=>sample.point)}).points.map(point=>point.rgba);
  const controls=[];
  for(let slot=0;slot<2;slot++)controls.push((await gpuSource(ctx,slot,quads[slot]!.frame,[samples[slot]!.texel]))[0]!);
  console.log('traffic.art controlled fork',{quads,samples,actual,controls});
  for(let slot=0;slot<2;slot++){sourceNotBackground(controls[slot]!);expect(actual[slot]).toEqual(controls[slot]);}
  await fixture(ctx,6);ctx.render.expectScreenshot('both-arms',{width:W,height:H});
},OPTIONS);

renderTest('traffic.art projection real source crest crops geometry and retains original top texels',async ctx=>{
  await fixture(ctx,7);expect(trafficCompositeStats.visible).toBe(1);expect(trafficCompositeStats.partial).toBe(1);
  const q=quad(0);expect(q.fraction).toBeGreaterThan(.5);expect(q.fraction).toBeLessThan(.9);
  const setup=makeTrafficArtFixture(loadMap01(),7),n=74;
  expect(q.bottom).toBeCloseTo(sourceProjectionBuffers.clip[n]!,6);
  const image=TRAFFIC_SOURCE.models[0]!.frames[q.frame-1]!;
  const samples=[8,13,18,23,28].map(y=>sourcePoint(0,q,y));
  const below:[number,number]=[samples[0]!.point[0],Math.ceil((1-q.bottom)*H/2)+1];
  const actual=ctx.render.probe({width:W,height:H,points:[...samples.map(sample=>sample.point),below]}).points.map(point=>point.rgba);
  await fixture(ctx,8);
  const background=ctx.render.probe({width:W,height:H,points:[...samples.map(sample=>sample.point),below]}).points.map(point=>point.rgba);
  const controls=await gpuSource(ctx,0,q.frame,samples.map(sample=>sample.texel));
  console.log('traffic.art controlled crest',{camera:setup.cameraOriginZ,z:setup.pool.z[0],q,frame:image.sourceFrame,samples,below,actual,background,controls});
  expect(actual[actual.length-1]).toEqual(background[background.length-1]);
  let distinct=false,visibleContrast=false;
  for(let i=0;i<samples.length;i++){
    sourceNotBackground(controls[i]!);expect(actual[i]).toEqual(controls[i]);
    if(i>0&&JSON.stringify(controls[i])!==JSON.stringify(controls[0]))distinct=true;
    if(actual[i]!.slice(0,3).some((c,channel)=>Math.abs(c-background[i]![channel]!)>10))visibleContrast=true;
  }
  expect(distinct).toBe(true);expect(visibleContrast).toBe(true);
  await fixture(ctx,7);ctx.render.expectScreenshot('crest-crop',{width:W,height:H});
},OPTIONS);

renderTest('traffic.art projection controlled maximum population emits all32 road cars in fixed capacity',async ctx=>{
  await fixture(ctx,9);
  expect(trafficCompositeStats.visible).toBe(32);expect(trafficCompositeStats.total).toBe(32);
  expect(trafficCompositeStats.capacity).toBe(288);expect(meshes.info('map01-art-props')!.vertices).toBe(288*4);
  const slot=7,q=quad(slot),sample=sourcePoint(slot,q);
  const actual=ctx.render.probe({width:W,height:H,points:[sample.point]}).points[0]!.rgba;
  const control=(await gpuSource(ctx,slot,q.frame,[sample.texel]))[0]!;
  console.log('traffic.art controlled32',{q,sample,actual,control});sourceNotBackground(control);expect(actual).toEqual(control);
  await fixture(ctx,9);ctx.render.expectScreenshot('all32-projected',{width:W,height:H});
},OPTIONS);

renderTest('traffic.art projection fractional final view row uses the valid far endpoint on GPU',async ctx=>{
  await fixture(ctx,10);expect(trafficCompositeStats.visible).toBe(1);
  const q=quad(0),sample=sourcePoint(0,q),near=sourceProjectionBuffers.ground[199]!,far=sourceProjectionBuffers.farGround[199]!;
  expect(sourceProjectionBuffers.scale.length).toBe(201);
  expect(q.bottom).toBeCloseTo(near+(far-near)*.75,6);
  expect(sourceProjectionStats.cameraOriginZ).toBe(450000);
  const actual=ctx.render.probe({width:W,height:H,points:[sample.point]}).points[0]!.rgba;
  const control=(await gpuSource(ctx,0,q.frame,[sample.texel]))[0]!;
  console.log('traffic.art controlled final row',{q,sample,actual,control,near,far});sourceNotBackground(control);expect(actual).toEqual(control);
  await fixture(ctx,10);ctx.render.expectScreenshot('last-row',{width:W,height:H});
},OPTIONS);
