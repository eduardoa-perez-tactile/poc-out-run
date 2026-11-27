import {worldTest,expect} from '@gameengine/test';
import {EnterScene} from '@gameengine/runtime';
import {RaceState,RaceMode,RaceRestartRequested,PreRaceSelection,PreRaceAction,RouteDriver,TerrainDriver,TrafficPool,CrashDriver,RouteTrafficCoordinates,DrivingState} from '../../src/schema.gen.ts';
import {MenuAction} from '../../src/sim/pre-race-selection.ts';
import {RouteLandmark} from '../../src/sim/routes.cheats.ts';
import {COUNTDOWN_TICKS,RacePhase} from '../../src/sim/race-flow-math.ts';
import {raceHudModel} from '../../src/ui/race-hud-model.ts';
import {recordedScene} from '../helpers/recorded-scene.ts';

for(const mode of [1,2])worldTest(`${mode===1?'continuous':'survival'}.race recorded selection connects fifteen actor handoffs, finish and restart`,async ctx=>{
  // Drive the real recorded menu reducer for the selected source mode.
  for(const action of [MenuAction.Accept,...Array(mode).fill(MenuAction.Next),MenuAction.Accept,MenuAction.Accept,MenuAction.Accept,MenuAction.Launch])ctx.input.emit(PreRaceAction,{action,value:0});
  await ctx.step(1);expect(ctx.world.resource(PreRaceSelection).mode).toBe(mode);
  ctx.input.emit(EnterScene,{scene:recordedScene('scenes/original-race.scene.json'),release:''});
  await ctx.step(COUNTDOWN_TICKS+1);
  const owner=ctx.world.entities(RouteDriver)[0]!;
  expect(ctx.world.resource(RaceMode).value).toBe(mode);
  expect(ctx.world.resource(RaceState).phase).toBe(RacePhase.Racing);
  expect(raceHudModel(ctx.world.resource(RaceState),ctx.world.resource(DrivingState),mode).stage).toBe('STAGE 1/15');
  // Recorded current-map boundaries exercise real actor transactions, not a
  // claim of a fifteen-stage normal-input drive or a new performance workload.
  for(let id=1;id<=15;id++){
    expect(ctx.world.get(owner,RouteDriver).mapId).toBe(id);
    if(id>1){
      await ctx.cheat(RouteLandmark,{landmark:'checkpoint-after',side:0,speed:0,quietTraffic:true,recovery:'preserve'});
      expect(ctx.world.resource(RaceState).consumedCheckpoints).toBe(id-1);
    }
    if(id===15)ctx.world.setResource(RaceState,{remainingTicks:60}); // bounded bonus fixture only
    await ctx.cheat(RouteLandmark,{landmark:'exit-before',side:1,speed:200,quietTraffic:true,recovery:'preserve'});
    expect(ctx.world.get(owner,RouteDriver).mapId).toBe(id+1);
    expect(ctx.world.get(owner,RouteDriver).stage).toBe(id);
    for(const component of [TerrainDriver,TrafficPool,CrashDriver,RouteTrafficCoordinates])expect(ctx.world.entities(component)[0]).toBe(owner);
  }
  const arrived=ctx.world.resource(RaceState);
  expect(arrived.outcome).toBe(1);expect(arrived.consumedCheckpoints).toBe(14);
  expect(ctx.world.get(owner,RouteDriver).rangeCalls).toBe(0);
  for(let ticks=0;ticks<1500&&ctx.world.resource(RaceState).phase!==RacePhase.Results;ticks+=30)await ctx.step(30);
  expect(ctx.world.resource(RaceState).phase).toBe(RacePhase.Results);
  expect(ctx.world.resource(DrivingState).legacySpeed).toBe(0);
  ctx.input.emit(RaceRestartRequested,{});await ctx.step(3);
  const restart=ctx.world.resource(RaceState),route=ctx.world.get(owner,RouteDriver);
  expect(ctx.world.resource(RaceMode).value).toBe(mode);expect(restart.phase).toBe(RacePhase.Countdown);
  expect(restart.score).toBe(0);expect(restart.consumedCheckpoints).toBe(0);
  expect(route.mapId).toBe(1);expect(route.stage).toBe(0);expect(route.goalEntered).toBe(false);
},{scene:'scenes/pre-race.scene.json'});
