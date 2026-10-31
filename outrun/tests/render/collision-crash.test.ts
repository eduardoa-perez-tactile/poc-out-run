import {renderTest,expect,type WorldTestContext} from '@gameengine/test';
import {assets,meshes,EnterScene,math} from '@gameengine/runtime';
import {CrashDriver,CollisionDriver,ContactAccepted,TrafficPool,TrafficResetRequested,TrafficPassed,DrivingState,DrivingResetRequested,DrivingPauseRequested,VehiclePreview} from '../../src/schema.gen.ts';
import {FERRARI1} from '../../src/content/vehicles/ferrari1.manifest.ts';
import {TRAFFIC_SOURCE} from '../../src/content/vehicles/traffic-source.manifest.ts';
import {frameForPose} from '../../src/content/vehicles/vehicle-poses.ts';
import {vehicleBufferStats} from '../../src/render/vehicle-buffers.ts';
import {trafficCompositeSamples} from '../../src/render/traffic-buffers.ts';

const q=math.fround,SCENE={scene:'scenes/driving-crash.scene.json',memory:'phone-low' as const};
const SEED={mapId:1,population:32,seedLo:9,seedHi:2596069104,originZ:0};
type Context=WorldTestContext;
type Owner=ReturnType<WorldTestContext['world']['entities']>[number];
function owner(ctx:Context){const all=ctx.world.entities(CrashDriver);expect(all.length).toBe(1);return all[0]!;}
async function ready(ctx:Context,w:number,h:number){
  ctx.input.view(w,h,1);await ctx.step(2);ctx.input.emit(DrivingPauseRequested,{paused:true});await ctx.step(1);
  ctx.render.waitForAssets({width:w,height:h,timeoutMs:15000});await ctx.step(1);ctx.render.stats({width:w,height:h});
  for(const group of ['map01-environment','player-ferrari1','traffic-source']){expect(assets.progress(group)).toBe(1);expect(assets.stats().groups[group]!.failed).toEqual([]);}
}
async function reset(ctx:Context,kind:1|2,low=false){
  const z=kind===1?(low?283400:283200):(low?28750:28100);
  const lateral=kind===1?q(-1886.494140625/1600):low?q(6560/1600):q(5180/1600+.5);
  ctx.input.emit(DrivingResetRequested,{manual:false,legacySpeed:low?20:200,distance:z-702,lateral});
  ctx.input.emit(TrafficResetRequested,SEED);ctx.input.emit(DrivingPauseRequested,{paused:true});await ctx.step(1);
  expect(ctx.world.get(owner(ctx),CrashDriver).phase).toBe(0);
}
async function hit(ctx:Context,kind:1|2,low=false){
  await reset(ctx,kind,low);ctx.input.emit(DrivingPauseRequested,{paused:false});
  for(let tick=0;tick<50;tick++){await ctx.step(1);const hits=ctx.world.events(ContactAccepted);if(hits.length){expect(hits.length).toBe(1);expect(hits[0]!.kind).toBe(kind);expect(hits[0]!.id).toBe(kind===1?9451:0);expect(ctx.world.get(owner(ctx),CrashDriver).phase).toBe(1);return hits[0]!;}}
  throw new Error('Missing authentic source contact');
}
async function until(ctx:Context,predicate:()=>boolean,max=600){for(let tick=0;tick<max;tick++){if(predicate())return;await ctx.step(1);}throw new Error('Missing recovery render phase');}
function resources(){
  const s=assets.stats();expect(s.class).toBe('phone-low');expect(s.overBudget).toBe(null);
  expect(s.groups['player-ferrari1']!.status).toBe('loaded');expect(s.groups['player-ferrari1']!.resident.textures).toBeGreaterThan(0);expect(s.groups['player-ferrari1']!.resident.textures).toBeLessThanOrEqual(6*1024*1024);
  expect(Object.entries(s.groups).filter(([,g])=>g.status==='loaded').map(([name])=>name).sort()).toEqual(['biome-catalog-data','biome-map01-data','map01-environment','player-ferrari1','traffic-source']);
  // These two explicit startup data pins are intentional; all other loaded
  // groups still fail the exact set above. Data must add no texture/audio charge.
  for(const name of ['biome-catalog-data','biome-map01-data']){
    const group=s.groups[name]!;
    expect(group.members).toBe(1);expect(group.progress).toBe(1);expect(group.failed).toEqual([]);
    expect(group.resident.textures).toBe(0);expect(group.resident.audio).toBe(0);
  }
  expect(s.resident.total).toBeLessThanOrEqual(s.budget.total!);
  expect(meshes.info('player-car')!.vertices).toBe(12);expect(vehicleBufferStats.indices).toBe(18);
}
function sourceBody(ctx:Context,w:number,h:number){
  const stats=ctx.render.stats({width:w,height:h}),crash=ctx.world.get(owner(ctx),CrashDriver),view=ctx.world.resource(VehiclePreview);
  expect(stats.drawCalls).toBeGreaterThan(0);resources();
  if(crash.phase===0){expect(view.pose).toBeLessThan(18);expect(view.hidden).toBe(false);expect(vehicleBufferStats.visible).toBeGreaterThan(0);return;}
  const expectedPose=crash.phase===1?(crash.variant===0?18:20):(crash.variant===0?19:21);
  const expectedSample=crash.phase===1?crash.advances%8:crash.phase===2?Math.floor(crash.reactionTick/7)%5:4;
  expect(view.pose).toBe(expectedPose);expect(view.sample).toBe(expectedSample);expect(view.hidden).toBe(crash.phase===3);
  if(crash.phase===3){expect(vehicleBufferStats.visible).toBe(0);return;}
  const frame=FERRARI1.body[frameForPose(view.pose,view.sample)-1]!,[px,py]=frame.opaqueProbePx,[fw,fh]=frame.sourceSizePx;
  const unit=3.2*h/720,x=Math.floor(w/2+(px+.5-fw/2)*unit),y=Math.floor(.95*h-(fh-py-.5)*unit);
  const pixel=ctx.render.probe({width:w,height:h,points:[[x,y]]}).points[0]!.rgba;
  // Known opaque red source probe; pause/resume can apply the real UI dimmer.
  // Preserve chroma proof under that overlay, not a false raw-RGBA comparison.
  expect(view.placeholder).toBe(false);expect(assets.progress('player-ferrari1')).toBe(1);
  expect(pixel[0]!).toBeGreaterThan(60);expect(pixel[0]!-pixel[1]!).toBeGreaterThan(20);expect(pixel[0]!-pixel[2]!).toBeGreaterThan(20);
  expect(vehicleBufferStats.visible).toBe(crash.phase===1?3:1);
}
function shot(ctx:Context,name:string,w:number,h:number){sourceBody(ctx,w,h);ctx.render.expectScreenshot(name,{width:w,height:h});}
for(const [w,h] of [[1280,720],[852,393]] as const)renderTest(`collision.crash source phases both natural variants at ${w}x${h}`,async ctx=>{
  await ready(ctx,w,h);const id=owner(ctx);
  for(const variant of [0,1]){
    let found=false;
    for(let attempt=0;attempt<8;attempt++){await hit(ctx,2);if(ctx.world.get(id,CrashDriver).variant===variant){found=true;break;}}
    expect(found).toBe(true);
    shot(ctx,`first-spin-v${variant}`,w,h);
    ctx.input.emit(DrivingPauseRequested,{paused:true});await ctx.step(2);
    const paused=ctx.world.get(id,CrashDriver),hash=ctx.world.hash();sourceBody(ctx,w,h);
    for(let repeat=0;repeat<4;repeat++)sourceBody(ctx,w,h);
    expect(ctx.world.hash()).toBe(hash);expect(ctx.world.get(id,CrashDriver)).toEqual(paused);
    ctx.input.emit(DrivingPauseRequested,{paused:false});await ctx.step(1);
    await until(ctx,()=>{const c=ctx.world.get(id,CrashDriver);return c.phase===1&&c.advances===3;});
    sourceBody(ctx,w,h);if((w===1280&&variant===0)||(w===852&&variant===1))shot(ctx,`wide-spin-v${variant}`,w,h);
    await until(ctx,()=>ctx.world.get(id,CrashDriver).phase===2);sourceBody(ctx,w,h);if(variant===0)shot(ctx,`reaction-first-v${variant}`,w,h);
    await until(ctx,()=>ctx.world.get(id,CrashDriver).reactionTick===28);sourceBody(ctx,w,h);if(variant===1)shot(ctx,`reaction-frame4-v${variant}`,w,h);
    await until(ctx,()=>ctx.world.get(id,CrashDriver).reactionTick===70);sourceBody(ctx,w,h);if(variant===0)shot(ctx,`reaction-cycle2-v${variant}`,w,h);
    await until(ctx,()=>ctx.world.get(id,CrashDriver).reactionTick===104);sourceBody(ctx,w,h);if(variant===1)shot(ctx,`reaction-last-v${variant}`,w,h);
    await ctx.step(1);expect(ctx.world.get(id,CrashDriver).phase).toBe(3);sourceBody(ctx,w,h);if(variant===0)shot(ctx,`hidden-v${variant}`,w,h);
    await until(ctx,()=>ctx.world.get(id,CrashDriver).phase===0);sourceBody(ctx,w,h);if(variant===1)shot(ctx,`restored-v${variant}`,w,h);
    expect(ctx.world.get(id,CollisionDriver).locked).toBe(true);
    ctx.input.key('ArrowUp',true);await ctx.step(1);expect(ctx.world.resource(DrivingState).legacySpeed).toBeGreaterThan(0);
    console.log('collision.crash natural variant',{w,h,variant,sourceFamilies:variant===0?[121,129]:[134,142]});
  }
},SCENE);
for(const low of [true,false])renderTest(`collision.crash authentic ${low?'low':'high'} roadside source pixels`,async ctx=>{
  await ready(ctx,1280,720);const contact=await hit(ctx,1,low);expect(low?contact.impactSpeed<=20:contact.impactSpeed>120).toBe(true);shot(ctx,'impact',1280,720);
},SCENE);
renderTest('collision.crash actual active low traffic approach pixels then trusted-style resume contact',async ctx=>{
  const w=852,h=393;await ready(ctx,w,h);await reset(ctx,2,true);ctx.input.emit(DrivingPauseRequested,{paused:false});
  for(let tick=0;tick<3;tick++){await ctx.step(1);expect(ctx.world.events(ContactAccepted).length).toBe(0);}
  ctx.input.emit(DrivingPauseRequested,{paused:true});await ctx.step(2);ctx.render.stats({width:w,height:h});
  const pool=ctx.world.get(owner(ctx),TrafficPool),driving=ctx.world.resource(DrivingState),frameId=trafficCompositeSamples.frame[0]!;
  expect(pool.active[0]).toBe(1);expect(q(pool.z[0]!-q(driving.distance+702))).toBeGreaterThan(0);expect(frameId).toBeGreaterThan(0);
  expect(trafficCompositeSamples.fraction[0]!).toBe(1);
  expect(frameId===1||frameId===2).toBe(true);
  // Original Car1 c1/c2 opaque amber lamp pixel(50,25)=[213,115,0,255],
  // independently read from pin6882721c. Its hue survives the pause dimmer.
  const image=TRAFFIC_SOURCE.models[0]!.frames[frameId-1]!,px=50,py=25,[fw,fh]=image.sourceSizePx;
  const aspect=w/h,left=trafficCompositeSamples.left[0]!,right=trafficCompositeSamples.right[0]!,top=trafficCompositeSamples.top[0]!,bottom=trafficCompositeSamples.bottom[0]!;
  const x=Math.floor((left+(right-left)*(px+.5)/fw)/aspect*w/2+w/2),y=Math.floor((1-(top-(top-bottom)*(py+.5)/fh))*h/2);
  expect(x>=0&&x<w&&y>=0&&y<h).toBe(true);
  const pixel=ctx.render.probe({width:w,height:h,points:[[x,y]]}).points[0]!.rgba;
  expect(pixel[0]!).toBeGreaterThan(60);expect(pixel[0]!-pixel[1]!).toBeGreaterThan(15);expect(pixel[1]!).toBeGreaterThan(15);expect(pixel[2]!).toBeLessThanOrEqual(4);
  ctx.render.expectScreenshot('active-approach',{width:w,height:h});
  ctx.input.emit(DrivingPauseRequested,{paused:false});await ctx.step(1);
  const contact=ctx.world.events(ContactAccepted);expect(contact.length).toBe(1);expect(contact[0]!.id).toBe(0);expect(contact[0]!.impactSpeed).toBeLessThanOrEqual(20);
  expect(ctx.world.get(owner(ctx),TrafficPool).active[0]).toBe(1);shot(ctx,'active-low-impact',w,h);
},SCENE);
renderTest('collision.crash inherited presentation regression clears old reaction poses for the same idle paused owner',async ctx=>{
  await ready(ctx,1280,720);await hit(ctx,2);const id=owner(ctx);await until(ctx,()=>ctx.world.get(id,CrashDriver).phase===0);
  ctx.input.emit(DrivingPauseRequested,{paused:true});await ctx.step(2);
  const physical=ctx.world.resource(DrivingState),crash=ctx.world.get(id,CrashDriver);
  for(const pose of [18,19,20,21]){
    // SIMFALSE inherited state models a presenter whose prior crash frame was
    // drawn before completion. Actual skipped-LateUpdate protocol proof is separate.
    ctx.world.setResource(VehiclePreview,{pose,sample:4,hidden:false});await ctx.step(1);sourceBody(ctx,1280,720);
    expect(ctx.world.resource(VehiclePreview).pose).toBeLessThan(18);
    expect(ctx.world.resource(DrivingState)).toEqual(physical);expect(ctx.world.get(id,CrashDriver)).toEqual(crash);
  }
},SCENE);
renderTest('collision.crash forced fallback and absent body cannot prolong reaction fixed ticks',async ctx=>{
  await ready(ctx,1280,720);await hit(ctx,2);const id=owner(ctx);await until(ctx,()=>ctx.world.get(id,CrashDriver).phase===2);
  for(let tick=0;tick<105;tick++){
    if(tick===5)ctx.world.setResource(VehiclePreview,{placeholder:true});
    if(tick===12)ctx.world.setResource(VehiclePreview,{enabled:false});
    if(tick===20)ctx.world.setResource(VehiclePreview,{enabled:true,placeholder:false});
    if([5,12,20].includes(tick)){const hash=ctx.world.hash(),state=ctx.world.get(id,CrashDriver);for(let repeat=0;repeat<3;repeat++)ctx.render.stats({width:1280,height:720});expect(ctx.world.hash()).toBe(hash);expect(ctx.world.get(id,CrashDriver)).toEqual(state);}
    await ctx.step(1);expect(ctx.world.get(id,CrashDriver).reactionTick).toBe(tick+1);expect(ctx.world.events(TrafficPassed).length).toBe(0);
    if(tick<104)expect(ctx.world.get(id,CrashDriver).phase).toBe(2);
  }
  expect(ctx.world.get(id,CrashDriver).phase).toBe(3);
  // This is supported forced-fallback/body-absence coverage, NOT actual late IO.
},SCENE);
renderTest('collision.crash scene exit and cooked reentry release override while standalone review poses remain authored',async ctx=>{
  await ready(ctx,1280,720);await hit(ctx,2);const id=owner(ctx);await until(ctx,()=>ctx.world.get(id,CrashDriver).phase===3);sourceBody(ctx,1280,720);
  ctx.input.emit(EnterScene,{scene:'scenes/vehicle-preview.scene.json',release:''});await ctx.step(2);ctx.render.stats({width:1280,height:720});
  expect(ctx.world.count(CrashDriver)).toBe(0);expect(ctx.world.resource(VehiclePreview).hidden).toBe(false);expect(vehicleBufferStats.visible).toBeGreaterThan(0);
  ctx.world.setResource(VehiclePreview,{pose:21,sample:4});await ctx.step(1);ctx.render.stats({width:1280,height:720});expect(ctx.world.resource(VehiclePreview).pose).toBe(21);expect(ctx.world.resource(VehiclePreview).sample).toBe(4);
  ctx.input.emit(EnterScene,{scene:'scenes/driving-crash.scene.json',release:''});await ctx.step(2);sourceBody(ctx,1280,720);expect(ctx.world.get(owner(ctx),CrashDriver).phase).toBe(0);
},SCENE);
