import {worldTest,renderTest,expect} from '@gameengine/test';
import {RaceState,RouteDriver,DrivingPauseRequested} from '../../src/schema.gen.ts';
import {SceneSpriteClock} from '../../src/render/scene-sprite-clock.ts';
import {createRaceFlow,RacePhase} from '../../src/sim/race-flow-math.ts';
import {originalRouteSources} from '../../src/content/route-boot.ts';
import {buildSourceRoad} from '../../src/render/source-projection.ts';
import {buildMap01ArtProps,map01PropSamples,map01AtlasLookup} from '../../src/render/map01-art-buffers.ts';
import {MAP01_ART} from '../../src/content/environments/map01.manifest.ts';
import {GOAL_ART} from '../../src/content/environments/goal.manifest.ts';
import {createEnvironmentBuffers} from '../../src/render/environment-buffers.ts';
import {RouteLandmark} from '../../src/sim/routes.cheats.ts';
import {routePresentationStats} from '../../src/render/route-presentation.ts';

worldTest('scene-sprites.clock freezes pause and repeated renders, resets goal and restart',()=>{
  const clock=new SceneSpriteClock(),base={...createRaceFlow({mapTimeSeconds:160,difficulty:1,population:20},1,1),initialized:true} as import('../../src/schema.gen.ts').RaceStateValue;
  expect(clock.sample(1,base)).toEqual({flagger:1,semaphore:39});
  const goal={...base,phase:RacePhase.EndingRoll,phaseTicks:0,processedStep:250,countdownTicks:0};
  expect(clock.sample(16,goal)!.flagger).toBe(1);
  const waving={...goal,phaseTicks:8,processedStep:258};
  expect(clock.sample(16,waving)!.flagger).toBe(4);expect(clock.sample(16,waving)!.flagger).toBe(4);
  expect(clock.sample(16,{...waving,phase:RacePhase.Paused,resumePhase:RacePhase.EndingRoll,processedStep:400})!.flagger).toBe(4);
  expect(clock.sample(16,{...waving,processedStep:401})!.flagger).toBe(4);
  expect(clock.sample(16,{...waving,phaseTicks:14,processedStep:407})!.flagger).toBe(5);
  expect(clock.sample(1,{...base,raceEpoch:2})).toEqual({flagger:1,semaphore:39});
});

worldTest('scene-sprites.geometry swaps source UVs only at exact start and goal placements',()=>{
  const data=originalRouteSources().get(1,0),before=JSON.stringify(data),aspect=852/393;
  const atlas={sizePx:MAP01_ART.atlas.sizePx,byObjectId:map01AtlasLookup(MAP01_ART.images),scene:{sizePx:GOAL_ART.pages[0].sizePx,byObjectId:map01AtlasLookup(GOAL_ART.images)}};
  buildSourceRoad(data,45000,0,aspect);
  const initial=buildMap01ArtProps(data,852,aspect,atlas,{flagger:1,semaphore:39});
  const positions=Array.from(initial.positions),uvs=Array.from(initial.uvs!);
  const changed=buildMap01ArtProps(data,852,aspect,atlas,{flagger:8,semaphore:42});
  expect(Array.from(changed.positions)).toEqual(positions);expect(Array.from(changed.uvs!)).not.toEqual(uvs);
  const flag=map01PropSamples.placementId.indexOf(1531),lights=map01PropSamples.placementId.indexOf(1556);
  expect(flag>=0&&lights>=0).toBe(true);expect(map01PropSamples.objectId[flag]).toBe(8);expect(map01PropSamples.objectId[lights]).toBe(42);
  expect(JSON.stringify(data)).toBe(before);
  const goal=originalRouteSources().get(16,0),goalBefore=JSON.stringify(goal),renderer=createEnvironmentBuffers();
  const view={cameraOriginZ:72000,lateral:0,viewWidth:852,aspect};
  const first=renderer.build(goal,view,GOAL_ART,[],undefined,{flagger:1,semaphore:39});
  const goalPositions=Array.from(first.positions),goalUvs=Array.from(first.uvs!);
  const final=renderer.build(goal,view,GOAL_ART,[],undefined,{flagger:14,semaphore:39});
  const target=renderer.samples.placementId.indexOf(2521);
  expect(target>=0).toBe(true);expect(renderer.samples.objectId[target]).toBe(14);
  expect(Array.from(final.positions)).toEqual(goalPositions);expect(Array.from(final.uvs!)).not.toEqual(goalUvs);
  expect(JSON.stringify(goal)).toBe(goalBefore);
});

renderTest('scene-sprites.live countdown and genuine goal animate original art and freeze on pause',async ctx=>{
  ctx.input.view(852,393,1);await ctx.step(3);ctx.render.waitForAssets({width:852,height:393});await ctx.step(2);
  expect(routePresentationStats.sceneSemaphore).toBe(39);expect(routePresentationStats.sceneFlagger).toBe(1);
  ctx.world.setResource(RaceState,{countdownTicks:120});await ctx.step(1);
  expect(routePresentationStats.sceneSemaphore).toBe(40);expect(routePresentationStats.sceneFlagger).toBe(2);
  ctx.input.emit(DrivingPauseRequested,{paused:true});await ctx.step(3);
  expect(routePresentationStats.sceneSemaphore).toBe(40);
  ctx.input.emit(DrivingPauseRequested,{paused:false});await ctx.step(1);
  ctx.world.setResource(RaceState,{countdownTicks:1});await ctx.step(2);
  expect(routePresentationStats.sceneSemaphore).toBe(42);
  // Existing recorded exit boundaries reach the genuine goal; this is a short
  // animation integration fixture, not a normal-input whole-race claim.
  for(let stage=0;stage<5;stage++)await ctx.cheat(RouteLandmark,{landmark:'exit-before',side:0,speed:200,quietTraffic:true,recovery:'preserve'});
  expect(ctx.world.get(ctx.world.entities(RouteDriver)[0]!,RouteDriver).mapId).toBe(16);
  ctx.render.waitForAssets({width:852,height:393});await ctx.step(2);
  const initial=routePresentationStats.sceneFlagger;await ctx.step(18);
  expect(routePresentationStats.sceneFlagger>initial).toBe(true);
  ctx.input.emit(DrivingPauseRequested,{paused:true});await ctx.step(1);
  const paused=routePresentationStats.sceneFlagger;await ctx.step(18);
  expect(routePresentationStats.sceneFlagger).toBe(paused);
  expect(ctx.render.stats({width:852,height:393}).drawCalls>0).toBe(true);
},{scene:'scenes/original-race.scene.json'});
