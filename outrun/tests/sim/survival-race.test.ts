import {worldTest,expect} from '@gameengine/test';
import {EnterScene} from '@gameengine/runtime';
import {RaceState,RaceMode,RaceRestartRequested,PreRaceAction,RouteDriver,CrashDriver,DrivingState} from '../../src/schema.gen.ts';
import {MenuAction} from '../../src/sim/pre-race-selection.ts';
import {RouteLandmark} from '../../src/sim/routes.cheats.ts';
import {COUNTDOWN_TICKS,RacePhase,createRaceFlow,admitRaceTick,finishRaceTick,type RaceObservation} from '../../src/sim/race-flow-math.ts';
import {raceResultsModel} from '../../src/ui/race-hud-model.ts';
import {recordedScene} from '../helpers/recorded-scene.ts';

worldTest('survival.race crash spin stops before game over, freezes actors and restarts cleanly',async ctx=>{
  for(const action of [MenuAction.Accept,MenuAction.Next,MenuAction.Next,MenuAction.Accept,MenuAction.Accept,MenuAction.Accept,MenuAction.Launch])ctx.input.emit(PreRaceAction,{action,value:0});
  await ctx.step(1);
  ctx.input.emit(EnterScene,{scene:recordedScene('scenes/original-race.scene.json'),release:''});
  await ctx.step(COUNTDOWN_TICKS+1);
  const owner=ctx.world.entities(RouteDriver)[0]!;
  expect(ctx.world.resource(RaceMode).value).toBe(2);
  // Recorded synthetic crash physics uses the existing recovery kernel; this
  // proves the Survival stop boundary, not a new natural contact/RNG workload.
  await ctx.cheat(RouteLandmark,{landmark:'fork-after',side:0,speed:200,quietTraffic:true,recovery:'spin-fixture'});
  expect(ctx.world.get(owner,CrashDriver).phase).toBe(1);
  expect(ctx.world.resource(RaceState).phase).toBe(RacePhase.Racing);
  for(let ticks=0;ticks<240&&ctx.world.resource(RaceState).phase===RacePhase.Racing;ticks++)await ctx.step(1);
  const stopped=ctx.world.resource(RaceState),crash=ctx.world.get(owner,CrashDriver),route=ctx.world.get(owner,RouteDriver);
  expect(crash.phase).toBe(2);expect(crash.reactionTick).toBe(0);
  expect(stopped.phase).toBe(RacePhase.GameOver);expect(stopped.outcome).toBe(3);
  expect(stopped.remainingTicks>0).toBe(true);expect(stopped.bonusAwarded).toBe(false);
  expect(ctx.world.resource(DrivingState).legacySpeed).toBe(0);
  expect(ctx.world.resource(DrivingState).playing).toBe(false);
  expect(raceResultsModel(stopped,2).title).toBe('GAME OVER');
  await ctx.step(3);
  expect(ctx.world.resource(RaceState).remainingTicks).toBe(stopped.remainingTicks);
  expect(ctx.world.get(owner,RouteDriver).camera).toBe(route.camera);
  expect(ctx.world.get(owner,CrashDriver).reactionTick).toBe(0);
  ctx.input.emit(RaceRestartRequested,{});await ctx.step(3);
  const restart=ctx.world.resource(RaceState);
  expect(ctx.world.resource(RaceMode).value).toBe(2);expect(restart.phase).toBe(RacePhase.Countdown);
  expect(restart.outcome).toBe(0);expect(restart.score).toBe(0);expect(restart.consumedCheckpoints).toBe(0);
  expect(ctx.world.get(owner,RouteDriver).mapId).toBe(1);expect(ctx.world.get(owner,CrashDriver).phase).toBe(0);
},{scene:'scenes/pre-race.scene.json'});

worldTest('survival.rules only stopped recovery fails; arrival wins and ordinary modes recover',()=>{
  const config={mapTimeSeconds:160,difficulty:1,population:20} as const;
  const racing={...createRaceFlow(config,1,1),phase:RacePhase.Racing,countdownTicks:0};
  const admission=admitRaceTick(racing,{step:1,pauseToggle:false,restart:false},config);
  const observed:RaceObservation={routeEpoch:1,mapId:1,playerRow:304,crashPhase:0,legacySpeed:0,leftEffect:2,rightEffect:2,
    checkpointCount:0,checkpointStep:0,checkpointBonusSeconds:0,passAwardCount:0,passAwardStep:0,passAwardAmount:0,arrivalCount:0,arrivalStep:0};
  expect(finishRaceTick(admission,observed,2).phase).toBe(RacePhase.Racing);
  expect(finishRaceTick(admission,{...observed,crashPhase:1,legacySpeed:1},2).phase).toBe(RacePhase.Racing);
  for(const mode of [0,1])expect(finishRaceTick(admission,{...observed,crashPhase:2},mode).phase).toBe(RacePhase.Racing);
  const stopped=finishRaceTick(admission,{...observed,crashPhase:2},2);
  expect(stopped.phase).toBe(RacePhase.GameOver);expect(stopped.outcome).toBe(3);expect(stopped.remainingTicks>0).toBe(true);
  const goal=finishRaceTick(admission,{...observed,mapId:16,crashPhase:2,arrivalCount:1,arrivalStep:1},2);
  expect(goal.outcome).toBe(1);expect(goal.phase).toBe(RacePhase.EndingRecovery);expect(goal.bonusAwarded).toBe(true);
  const expired=finishRaceTick(admitRaceTick({...racing,remainingTicks:0},{step:1,pauseToggle:false,restart:false},config),observed,2);
  expect(expired.outcome).toBe(2);expect(expired.phase).toBe(RacePhase.GameOver);
});
