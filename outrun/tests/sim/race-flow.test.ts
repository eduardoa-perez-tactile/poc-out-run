import {worldTest,expect} from '@gameengine/test';
import {EnterScene} from '@gameengine/runtime';
import {RaceState,RaceRestartRequested,RouteDriver,RouteTrafficCoordinates,TerrainDriver,TrafficPool,CrashDriver,CollisionDriver,
  DrivingState,DrivingInput} from '../../src/schema.gen.ts';
import {RouteLandmark} from '../../src/sim/routes.cheats.ts';
import {COUNTDOWN_TICKS,RACE_HZ,RacePhase,createRaceFlow,admitRaceTick,finishRaceTick,type RaceObservation} from '../../src/sim/race-flow-math.ts';

const SCENE={scene:'scenes/original-race.scene.json'};

worldTest('race.flow real countdown holds throttle until GO then pause timeout and recorded restart preserve one actor',async({world,step,input})=>{
  input.emit(EnterScene,{scene:'scenes/original-race.scene.json',release:''});
  await step(1);const owner=world.entities(RouteDriver)[0]!;
  const initial=world.resource(RaceState),initialTicks=initial.remainingTicks;
  expect(initial.phase).toBe(RacePhase.Countdown);expect(initialTicks).toBe(160*RACE_HZ);
  input.key('ArrowUp',true);await step(COUNTDOWN_TICKS-2);
  expect(world.resource(RaceState).countdownTicks).toBe(1);
  expect(world.get(owner,RouteDriver).camera).toBe(45000);expect(world.resource(DrivingState).legacySpeed).toBe(0);
  expect(world.resource(RaceState).remainingTicks).toBe(initialTicks);expect(world.resource(DrivingInput).keyboard&1).toBe(1);
  await step(1);expect(world.resource(RaceState).phase).toBe(RacePhase.Racing);
  expect(world.get(owner,RouteDriver).camera).toBe(45000);
  await step(120);expect(world.get(owner,RouteDriver).camera>45000).toBe(true);
  expect(world.resource(DrivingState).legacySpeed>0).toBe(true);

  input.key('Space',true);await step(1);
  const paused=world.resource(RaceState),pausedCamera=world.get(owner,RouteDriver).camera;
  expect(paused.phase).toBe(RacePhase.Paused);expect(world.resource(DrivingState).playing).toBe(false);
  input.key('Space',false);input.key('ArrowUp',false);await step(30);
  const stillPaused=world.resource(RaceState);
  expect(stillPaused.remainingTicks).toBe(paused.remainingTicks);expect(stillPaused.totalTicks).toBe(paused.totalTicks);
  expect(stillPaused.stageTicks).toBe(paused.stageTicks);expect(world.get(owner,RouteDriver).camera).toBe(pausedCamera);
  input.key('Space',true);await step(1);
  input.key('Space',false);input.key('ArrowUp',true);await step(120);
  expect(world.resource(RaceState).phase).toBe(RacePhase.Racing);
  expect(world.get(owner,RouteDriver).camera>pausedCamera).toBe(true);
  input.key('ArrowUp',false);await step(1);
  // This is the genuine unmodified remaining deadline, not a shortened timer.
  for(let ticks=0;ticks<9600&&world.resource(RaceState).phase!==RacePhase.GameOver;ticks+=240)await step(240);
  const expired=world.resource(RaceState),oldRoute=world.get(owner,RouteDriver);
  expect(expired.phase).toBe(RacePhase.GameOver);expect(expired.outcome).toBe(2);expect(expired.remainingTicks).toBe(0);
  expect(world.resource(DrivingState).playing).toBe(false);expect(expired.bonusAwarded).toBe(false);
  input.emit(RaceRestartRequested,{});await step(3);
  const restarted=world.resource(RaceState),route=world.get(owner,RouteDriver);
  expect(world.entities(RouteDriver).length).toBe(1);expect(world.entities(RouteDriver)[0]).toBe(owner);
  expect(route.routeEpoch).toBe(oldRoute.routeEpoch+1);expect(route.camera).toBe(45000);expect(route.goalEntered).toBe(false);
  expect(restarted.routeEpoch).toBe(route.routeEpoch);expect(restarted.raceEpoch).toBe(expired.raceEpoch+1);
  expect(restarted.phase).toBe(RacePhase.Countdown);expect(restarted.remainingTicks).toBe(initialTicks);
  expect(restarted.totalTicks).toBe(0);expect(restarted.stageTicks).toBe(0);expect(restarted.score).toBe(0);
  for(const component of [TerrainDriver,TrafficPool,RouteTrafficCoordinates,CrashDriver])expect(world.entities(component)[0]).toBe(owner);
});

worldTest('race.priority positive entry admits checkpoint and goal before expiry while zero entry cannot revive',()=>{
  const config={mapTimeSeconds:160,difficulty:1,population:9}as const;
  const boundary={...createRaceFlow(config,1,1),phase:RacePhase.Racing,countdownTicks:0,remainingTicks:1};
  const intent={step:1,pauseToggle:false,restart:false};
  const observed:RaceObservation={routeEpoch:1,mapId:2,playerRow:204,crashPhase:0,legacySpeed:0,leftEffect:0,rightEffect:0,
    checkpointCount:1,checkpointStep:1,checkpointBonusSeconds:90,passAwardCount:0,passAwardStep:0,passAwardAmount:0,arrivalCount:0,arrivalStep:0};
  const checkpoint=finishRaceTick(admitRaceTick(boundary,intent,config),observed);
  expect(checkpoint.phase).toBe(RacePhase.Racing);expect(checkpoint.remainingTicks).toBe(90*RACE_HZ);
  expect(checkpoint.consumedCheckpoints).toBe(1);
  const goal={...observed,mapId:16,playerRow:4,checkpointCount:0,checkpointStep:0,checkpointBonusSeconds:0,arrivalCount:1,arrivalStep:1};
  const arrived=finishRaceTick(admitRaceTick(boundary,intent,config),goal);
  expect(arrived.phase).toBe(RacePhase.EndingRoll);expect(arrived.outcome).toBe(1);expect(arrived.remainingTicks).toBe(0);
  expect(arrived.bonusAwarded).toBe(true);expect(arrived.consumedArrivals).toBe(1);
  const zero=admitRaceTick({...boundary,remainingTicks:0},intent,config);
  expect(zero.racingAdmitted).toBe(false);expect(zero.mode).toBe('locked');
  const terminal=finishRaceTick(zero,{...goal,checkpointCount:1,checkpointStep:1,checkpointBonusSeconds:90});
  expect(terminal.phase).toBe(RacePhase.GameOver);expect(terminal.outcome).toBe(2);expect(terminal.remainingTicks).toBe(0);
  expect(terminal.bonusAwarded).toBe(false);expect(terminal.consumedCheckpoints).toBe(0);expect(terminal.consumedArrivals).toBe(0);
});

worldTest('race.flow SYNTHETIC recorded landmarks and spin supplement reach genuine goal recovery ending results and restart',async ctx=>{
  await ctx.step(COUNTDOWN_TICKS+1);const owner=ctx.world.entities(RouteDriver)[0]!;
  expect(ctx.world.resource(RaceState).phase).toBe(RacePhase.Racing);
  // Recorded boundary/recovery fixtures supplement normal play. This does not
  // claim a normal-input winning race or a naturally accepted spin impact.
  let checkpoints=0;
  for(const [stage,mapId]of [[1,2],[2,4],[3,7],[4,11],[5,16]]as const){
    if(stage>1){
      await ctx.cheat(RouteLandmark,{landmark:'checkpoint-after',side:0,speed:0,quietTraffic:true,recovery:'preserve'});
      checkpoints++;
      expect(ctx.world.get(owner,RouteDriver).checkpointCount).toBe(checkpoints);
      expect(ctx.world.resource(RaceState).consumedCheckpoints).toBe(checkpoints);
    }
    await ctx.cheat(RouteLandmark,{landmark:'exit-before',side:0,speed:200,quietTraffic:true,
      recovery:stage===5?'spin-fixture':'preserve'});
    const route=ctx.world.get(owner,RouteDriver);
    expect(route.mapId).toBe(mapId);expect(route.stage).toBe(stage);expect(route.pending).toBe(false);
    for(const component of [TerrainDriver,TrafficPool,RouteTrafficCoordinates,CrashDriver])expect(ctx.world.entities(component)[0]).toBe(owner);
  }
  const arrived=ctx.world.resource(RaceState),route=ctx.world.get(owner,RouteDriver),crash=ctx.world.get(owner,CrashDriver);
  expect(route.goalEntered).toBe(true);expect(route.arrivalCount).toBe(1);expect(route.rangeCalls).toBe(5);
  expect(route.checkpointCount).toBe(4);expect(arrived.consumedCheckpoints).toBe(4);
  expect(arrived.phase).toBe(RacePhase.EndingRecovery);expect(crash.phase).toBe(1);expect(crash.mapId).toBe(16);
  expect(ctx.world.get(owner,CollisionDriver).acceptedCount).toBe(crash.consumedAcceptedCount);
  expect(arrived.outcome).toBe(1);expect(arrived.bonusAwarded).toBe(true);
  const target=arrived.finishScore;
  expect(target).toBe(arrived.score+arrived.finishRemainingSeconds*1000000);
  const seen=new Set<number>([arrived.phase]);let previousScore=arrived.score;
  for(let ticks=0;ticks<30000&&ctx.world.resource(RaceState).phase!==RacePhase.Results;ticks+=60){
    await ctx.step(60);const current=ctx.world.resource(RaceState);seen.add(current.phase);
    expect(current.remainingTicks).toBe(arrived.remainingTicks);expect(current.totalTicks).toBe(arrived.totalTicks);
    expect(current.finishScore).toBe(target);expect(current.score>=previousScore&&current.score<=target).toBe(true);
    previousScore=current.score;
  }
  const results=ctx.world.resource(RaceState);
  expect(results.phase).toBe(RacePhase.Results);expect(results.score).toBe(target);expect(results.outcome).toBe(1);
  expect(ctx.world.resource(DrivingState).legacySpeed).toBe(0);expect(ctx.world.get(owner,CrashDriver).phase).toBe(0);
  for(const phase of [RacePhase.EndingRecovery,RacePhase.EndingRoll,RacePhase.EndingBrake,RacePhase.Bonus])expect(seen.has(phase)).toBe(true);
  await ctx.step(60);
  expect(ctx.world.resource(RaceState).score).toBe(target);expect(ctx.world.get(owner,RouteDriver).arrivalCount).toBe(1);
  ctx.input.emit(RaceRestartRequested,{});await ctx.step(3);
  const restarted=ctx.world.resource(RaceState),fresh=ctx.world.get(owner,RouteDriver);
  expect(ctx.world.entities(RouteDriver).length).toBe(1);expect(ctx.world.entities(RouteDriver)[0]).toBe(owner);
  expect(fresh.routeEpoch).toBe(route.routeEpoch+1);expect(fresh.mapId).toBe(1);expect(fresh.camera).toBe(45000);
  expect(fresh.goalEntered).toBe(false);expect(fresh.arrivalCount).toBe(0);expect(fresh.rangeCalls).toBe(1);
  expect(restarted.phase).toBe(RacePhase.Countdown);expect(restarted.remainingTicks).toBe(160*RACE_HZ);
  expect(restarted.score).toBe(0);expect(restarted.finishScore).toBe(0);expect(restarted.bonusAwarded).toBe(false);
},SCENE);
