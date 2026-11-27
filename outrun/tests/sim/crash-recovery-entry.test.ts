import {worldTest,expect,type WorldTestContext} from '@gameengine/test';
import {EnterScene,math} from '@gameengine/runtime';
import {CrashDriver,CollisionDriver,TerrainDriver,TrafficPool,TrafficPassed,ContactAccepted,DrivingState,DrivingInput,
  DrivingResetRequested,DrivingPauseRequested,TrafficResetRequested,TrafficRebaseRequested,DrivingControlChanged,TrafficArtPreview} from '../../src/schema.gen.ts';
import {loadMap01} from '../../src/content/biome.ts';

const q=math.fround,SCENE='scenes/driving-crash.scene.json';
const SEED={mapId:1,population:32,seedLo:9,seedHi:2596069104,originZ:0};
async function enter(ctx:WorldTestContext,scene:string){ctx.input.emit(EnterScene,{scene,release:''});await ctx.step(2);}
async function setup(ctx:WorldTestContext,distance=28100-702,speed=200,lateral=q(5180/1600+.5)){
  await enter(ctx,SCENE);ctx.input.emit(DrivingPauseRequested,{paused:true});await ctx.step(1);
  ctx.input.emit(DrivingResetRequested,{manual:false,legacySpeed:speed,distance,lateral});
  ctx.input.emit(TrafficResetRequested,SEED);ctx.input.emit(DrivingPauseRequested,{paused:true});await ctx.step(1);
  expect(ctx.world.count(CrashDriver)).toBe(1);return ctx.world.entities(CrashDriver)[0]!;
}
async function impact(ctx:WorldTestContext){
  const owner=await setup(ctx);ctx.input.emit(DrivingPauseRequested,{paused:false});
  let found=false;
  for(let tick=0;tick<50&&!found;tick++){await ctx.step(1);const hits=ctx.world.events(ContactAccepted);if(hits.length){expect(hits.length).toBe(1);expect(hits[0]!.kind).toBe(2);expect(hits[0]!.id).toBe(0);found=true;}}
  expect(found).toBe(true);expect(ctx.world.get(owner,CrashDriver).phase).toBe(1);return owner;
}
async function phase(ctx:WorldTestContext,owner:ReturnType<WorldTestContext['world']['entities']>[number],target:number){
  for(let tick=0;tick<1000;tick++){
    if(ctx.world.get(owner,CrashDriver).phase===target)return;
    expect(ctx.world.get(owner,CrashDriver).phase).toBeGreaterThan(0);await ctx.step(1);
    expect(ctx.world.events(ContactAccepted).length).toBe(0);expect(ctx.world.events(TrafficPassed).length).toBe(0);
  }
  throw new Error(`Recovery never entered phase ${target}`);
}
function idle(ctx:WorldTestContext,owner:ReturnType<WorldTestContext['world']['entities']>[number]){
  expect(ctx.world.get(owner,CrashDriver)).toEqual({mapId:1,phase:0,consumedAcceptedCount:0,pendingStep:0,variant:0,kind:0,impactSpeed:0,handlingCap:0,collisionDir:0,curve:0,totalAdvances:0,advances:0,cadenceTick:0,decrement:0,reactionTick:0,recenterTarget:0});
  const collision=ctx.world.get(owner,CollisionDriver),terrain=ctx.world.get(owner,TerrainDriver);
  expect(collision.locked).toBe(false);expect(collision.ledgerCount).toBe(0);expect(collision.acceptedCount).toBe(0);
  expect(terrain.recentering).toBe(false);expect(terrain.skidding).toBe(false);
  expect(terrain.leftEffect).toBe(0);expect(terrain.rightEffect).toBe(0);
  expect(ctx.world.events(ContactAccepted).length).toBe(0);expect(ctx.world.events(TrafficPassed).length).toBe(0);
}
worldTest('collision.recovery.entry pause freezes every phase detector pool and physical state without catchup',async ctx=>{
  for(const target of [1,2,3]){
    const owner=await impact(ctx);await phase(ctx,owner,target);
    ctx.input.emit(DrivingPauseRequested,{paused:true});await ctx.step(1);
    const crash=ctx.world.get(owner,CrashDriver),detector=ctx.world.get(owner,CollisionDriver),terrain=ctx.world.get(owner,TerrainDriver),pool=ctx.world.get(owner,TrafficPool),driving=ctx.world.resource(DrivingState);
    expect(crash.phase).toBe(target);expect(driving.playing).toBe(false);
    for(let tick=0;tick<4;tick++){await ctx.step(1);
      expect(ctx.world.get(owner,CrashDriver)).toEqual(crash);expect(ctx.world.get(owner,CollisionDriver)).toEqual(detector);
      expect(ctx.world.get(owner,TerrainDriver)).toEqual(terrain);expect(ctx.world.get(owner,TrafficPool)).toEqual(pool);
      expect(ctx.world.resource(DrivingState)).toEqual(driving);
      expect(ctx.world.events(ContactAccepted).length).toBe(0);expect(ctx.world.events(TrafficPassed).length).toBe(0);
    }
    ctx.input.emit(DrivingPauseRequested,{paused:false});await ctx.step(1);
    const resumed=ctx.world.get(owner,CrashDriver);
    expect(ctx.world.resource(DrivingState).playing).toBe(true);expect(ctx.world.get(owner,CollisionDriver).locked).toBe(true);
    if(target===1)expect(resumed.cadenceTick).toBe(crash.cadenceTick+1);
    if(target===2)expect(resumed.reactionTick).toBe(crash.reactionTick+1);
    if(target===3)expect(Math.abs(q(ctx.world.resource(DrivingState).lateral)-q(driving.lateral))).toBeLessThanOrEqual(.012001);
  }
});
worldTest('collision.recovery.entry paused traffic reset and rebase cancel recovery without restoring impact speed or teleporting',async ctx=>{
  for(const operation of ['reset','rebase'] as const){
    const owner=await impact(ctx);await ctx.step(4);
    ctx.input.key('KeyM',true);await ctx.step(1); // Setting changes; captured crash cap must not.
    ctx.input.emit(DrivingPauseRequested,{paused:true});await ctx.step(1);
    const before=ctx.world.resource(DrivingState);expect(before.manual).toBe(true);
    if(operation==='reset')ctx.input.emit(TrafficResetRequested,SEED);else ctx.input.emit(TrafficRebaseRequested,{mapId:1,shift:500});
    await ctx.step(1);idle(ctx,owner);
    const after=ctx.world.resource(DrivingState);
    expect(q(after.distance)).toBe(q(before.distance));expect(q(after.previousDistance)).toBe(q(before.distance));
    expect(q(after.lateral)).toBe(q(before.lateral));expect(q(after.previousLateral)).toBe(q(before.lateral));
    expect(q(after.legacySpeed)).toBe(q(before.legacySpeed));expect(after.gear).toBe(before.gear);expect(after.manual).toBe(true);
    expect(after.steering).toBe(0);expect(after.playing).toBe(false);
    await ctx.step(3);idle(ctx,owner);expect(ctx.world.resource(DrivingState)).toEqual(after);
  }
});
worldTest('collision.recovery.entry driver reset and dirty scene reentry clear optional state and all held controls cooked or loose',async ctx=>{
  let owner=await impact(ctx);await phase(ctx,owner,2);
  ctx.input.emit(DrivingResetRequested,{manual:true,legacySpeed:0,distance:45000,lateral:.2});
  ctx.input.emit(DrivingPauseRequested,{paused:true});await ctx.step(1);idle(ctx,owner);
  const reset=ctx.world.resource(DrivingState);
  expect(reset.manual).toBe(true);expect(reset.gear).toBe(0);expect(reset.legacySpeed).toBe(0);
  expect(reset.distance).toBe(45000);expect(q(reset.lateral)).toBe(q(.2));expect(reset.playing).toBe(false);
  // Fresh authentic hit; dirty holds while locked, then leave/reenter with NO
  // reset/pause/cancel/release to hide the cooked all-default-row entry hazard.
  owner=await impact(ctx);
  ctx.input.key('ArrowUp',true);ctx.input.key('ArrowLeft',true);ctx.input.key('KeyE',true);ctx.input.key('KeyQ',true);ctx.input.key('KeyM',true);
  ctx.input.emit(DrivingControlChanged,{control:3,source:1,down:true});await ctx.step(2);
  const held=ctx.world.resource(DrivingInput);expect(held.keyboard).toBe(5);expect(held.ui).toBe(8);expect(held.upHeld&&held.downHeld&&held.modeHeld).toBe(true);
  await enter(ctx,'scenes/driving-traffic.scene.json');expect(ctx.world.count(CrashDriver)).toBe(0);
  await enter(ctx,SCENE);owner=ctx.world.entities(CrashDriver)[0]!;idle(ctx,owner);
  expect(ctx.world.resource(DrivingInput)).toEqual({keyboard:0,ui:0,shiftUp:false,shiftDown:false,upHeld:false,downHeld:false,pauseHeld:false,modeHeld:false});
  expect(ctx.world.resource(DrivingState)).toEqual({active:true,playing:true,manual:false,legacySpeed:0,gear:0,steering:0,distance:45000,previousDistance:45000,lateral:0,previousLateral:0});
  await enter(ctx,'scenes/traffic-catalog.scene.json');expect(ctx.world.count(CrashDriver)).toBe(0);expect(ctx.world.resource(TrafficArtPreview).mode).toBe(1);
  ctx.input.emit(EnterScene,{scene:'scenes/traffic-catalog.scene.json',release:''});ctx.input.emit(EnterScene,{scene:SCENE,release:''});await ctx.step(2);
  owner=ctx.world.entities(CrashDriver)[0]!;idle(ctx,owner);expect(ctx.world.resource(TrafficArtPreview)).toEqual({mode:0,frame:1,caseId:0});
  ctx.input.emit(EnterScene,{scene:SCENE,release:''});ctx.input.emit(EnterScene,{scene:'scenes/driving-contact.scene.json',release:''});await ctx.step(2);
  expect(ctx.world.count(CrashDriver)).toBe(0);expect(ctx.world.count(CollisionDriver)).toBe(1);
});
worldTest('collision.recovery.entry recorded normal endpoint is a paused idle contact barrier and legacy scenes stay ownerless',async ctx=>{
  const data=loadMap01(),limit=data.lastLine*data.segmentLength;
  const owner=await setup(ctx,limit-1,200,0);
  ctx.input.emit(DrivingPauseRequested,{paused:false});await ctx.step(1);
  idle(ctx,owner);const driving=ctx.world.resource(DrivingState),terrain=ctx.world.get(owner,TerrainDriver);
  expect(driving.distance).toBe(limit);expect(driving.playing).toBe(false);expect(driving.legacySpeed).toBe(0);expect(driving.steering).toBe(0);expect(terrain.sectionEnd).toBe(true);
  expect(ctx.world.get(owner,CollisionDriver).motionValid).toBe(false);
  // AdvanceDriving snapshots the incoming pose before reaching the bound. Its
  // first paused tick then settles interpolation history to that final pose.
  expect(driving.previousDistance).toBe(limit-1);
  await ctx.step(1);idle(ctx,owner);
  const settled=ctx.world.resource(DrivingState);
  expect(settled).toEqual({...driving,previousDistance:driving.distance,previousLateral:driving.lateral});
  await ctx.step(3);idle(ctx,owner);expect(ctx.world.resource(DrivingState)).toEqual(settled);
  for(const scene of ['scenes/driving-terrain.scene.json','scenes/driving-traffic.scene.json','scenes/driving-contact.scene.json']){await enter(ctx,scene);expect(ctx.world.count(CrashDriver)).toBe(0);}
  // Authentic forward roadside crashes cannot reach this distant bound before
  // stopping; active-spin endpoint cancellation is separately pinned by pure math.
});
