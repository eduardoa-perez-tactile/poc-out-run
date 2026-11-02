import {worldTest,expect,type WorldTestContext} from '@gameengine/test';
import {pcg32} from '@gameengine/runtime';
import {RouteLandmark} from '../../src/sim/routes.cheats.ts';
import {RouteDriver,RouteTrafficCoordinates,TerrainDriver,TrafficPool,CollisionDriver,CrashDriver,DrivingState,DrivingInput,
  RouteResetRequested,DrivingPauseRequested,RouteForkChosen,RouteCheckpointPassed,RouteGoalEntered,ContactAccepted,RouteTrafficPassed,TrafficPassed} from '../../src/schema.gen.ts';
import {originalRouteSources} from '../../src/content/route-boot.ts';

const SCENE={scene:'scenes/original-route-sim.scene.json'};
// These recorded cheats are compact CURRENT-map boundary supplements. They do
// not stand in for normal startup-to-goal traversal, natural impacts or art.
async function start(ctx:WorldTestContext){
  await ctx.step(1);const owner=ctx.world.entities(RouteDriver)[0]!;
  ctx.input.emit(DrivingPauseRequested,{paused:true});await ctx.step(1);
  ctx.input.emit(RouteResetRequested,{seedLo:9,seedHi:2596069104,population:32,manual:true});await ctx.step(1);
  expect(ctx.world.entities(RouteDriver)[0]).toBe(owner);return owner;
}
async function pause(ctx:WorldTestContext,paused:boolean){ctx.input.emit(DrivingPauseRequested,{paused});await ctx.step(1);}
async function landmark(ctx:WorldTestContext,side:0|1,kind:'fork-at'|'exit-at'|'exit-before'|'checkpoint-at'|'checkpoint-after',speed=100){
  await ctx.cheat(RouteLandmark,{landmark:kind,side,speed,quietTraffic:true,recovery:'preserve'});
}

worldTest('routes.handoff recorded landmark supplement proves both actual first forks on the same actor',async ctx=>{
  const owner=await start(ctx);
  for(const side of [0,1] as const){
    if(side===1){ctx.input.emit(RouteResetRequested,{seedLo:9,seedHi:2596069104,population:32,manual:true});await ctx.step(1);}
    const first=ctx.world.get(owner,RouteDriver),source=originalRouteSources().get(1,first.gradient as -1|0|1);
    await landmark(ctx,side,'fork-at');
    expect(ctx.world.get(owner,RouteDriver).camera).toBe(source.swapLine*150-702);
    expect(ctx.world.get(owner,RouteDriver).choiceLatched).toBe(false);
    await pause(ctx,false); // <150 units, equality row still cannot choose
    expect(ctx.world.get(owner,RouteDriver).choiceLatched).toBe(false);
    await ctx.step(1);
    expect(ctx.world.get(owner,RouteDriver).choiceLatched).toBe(true);
    expect(ctx.world.get(owner,RouteDriver).nextMapId).toBe(side===0?2:3);
    expect(ctx.world.events(RouteForkChosen).some(event=>event.side===side)).toBe(true);
    await pause(ctx,true);await landmark(ctx,side,'exit-before');await pause(ctx,false);
    const result=ctx.world.get(owner,RouteDriver);
    expect(result.mapId).toBe(side===0?2:3);expect(result.mapEpoch).toBe(2);expect(result.camera).toBe(0);
    expect(result.pending).toBe(false);expect(result.rangeCalls).toBe(2);
    for(const token of [TerrainDriver,TrafficPool,CollisionDriver,CrashDriver,RouteTrafficCoordinates])expect(ctx.world.entities(token)[0]).toBe(owner);
    expect(ctx.world.get(owner,CollisionDriver).acceptedCount).toBe(ctx.world.get(owner,CrashDriver).consumedAcceptedCount);
    await pause(ctx,true);
  }
},SCENE);

worldTest('routes.handoff actual destination checkpoints cross strict equality once for90 and85 seconds',async ctx=>{
  const owner=await start(ctx);
  for(const side of [0,1] as const){
    if(side===1){ctx.input.emit(RouteResetRequested,{seedLo:9,seedHi:2596069104,population:32,manual:true});await ctx.step(1);}
    await landmark(ctx,side,'exit-before');await pause(ctx,false);await pause(ctx,true);
    const id=side===0?2:3;expect(ctx.world.get(owner,RouteDriver).mapId).toBe(id);
    await landmark(ctx,0,'checkpoint-at');
    expect(ctx.world.get(owner,RouteDriver).checkpointCount).toBe(0);
    await pause(ctx,false);expect(ctx.world.get(owner,RouteDriver).checkpointCount).toBe(0);
    await ctx.step(1);
    let result=ctx.world.get(owner,RouteDriver);
    expect(result.checkpointCount).toBe(1);expect(result.checkpointBonusSeconds).toBe(side===0?90:85);
    expect(ctx.world.events(RouteCheckpointPassed).some(event=>event.bonusSeconds===(side===0?90:85)&&event.mapId===id)).toBe(true);
    const stamp=result.checkpointStep;
    await pause(ctx,true);await landmark(ctx,0,'checkpoint-after');await pause(ctx,false);await ctx.step(3);
    result=ctx.world.get(owner,RouteDriver);expect(result.checkpointCount).toBe(1);expect(result.checkpointStep).toBe(stamp);
    await pause(ctx,true);
  }
},SCENE);

worldTest('routes.handoff five native landmark exits preserve ROUT schedule forced fifth and real goal entry',async ctx=>{
  const owner=await start(ctx),reference=pcg32(9,2596069104,0x524f5554,0);
  const expected=[reference.range(-1,2),reference.range(-1,2),reference.range(-1,2),reference.range(-1,2),1,reference.range(-1,2)];
  expect(expected).toEqual([-1,-1,1,0,1,-1]);
  expect(ctx.world.get(owner,RouteDriver).gradient).toBe(expected[0]);
  for(const [stage,id,calls] of [[1,2,2],[2,4,3],[3,7,4],[4,11,4],[5,16,5]] as const){
    await landmark(ctx,0,'exit-before',0);await pause(ctx,false);
    // Pause/resume intentionally clears holds. Press only AFTER running, then
    // the fourth source ramp assignment crosses the final one-unit gap.
    ctx.input.key('ArrowUp',true);await ctx.step(4);
    const result=ctx.world.get(owner,RouteDriver);
    expect(result.mapId).toBe(id);expect(result.stage).toBe(stage);expect(result.gradient).toBe(expected[stage]);
    expect(result.rangeCalls).toBe(calls);expect(result.entryCount).toBe(stage+1);expect(result.camera).toBe(0);
    expect(ctx.world.resource(DrivingInput).keyboard&1).toBe(1);
    expect(ctx.world.events(ContactAccepted).length).toBe(0);
    if(stage<5){ctx.input.key('ArrowUp',false);await pause(ctx,true);}
  }
  const arrived=ctx.world.get(owner,RouteDriver),driving=ctx.world.resource(DrivingState);
  expect(arrived.goalEntered).toBe(true);expect(arrived.arrivalCount).toBe(1);expect(arrived.rangeCalls).toBe(5);
  expect(ctx.world.events(RouteGoalEntered).some(event=>event.mapId===16&&event.stage===5)).toBe(true);
  expect(driving.legacySpeed).toBeGreaterThan(0); // no false stopped-car/results claim
  await ctx.step(4);expect(ctx.world.get(owner,RouteDriver).camera).toBe(0);
  expect(ctx.world.get(owner,RouteDriver).arrivalCount).toBe(1);expect(ctx.world.events(ContactAccepted).length).toBe(0);
  await pause(ctx,true);const before=ctx.world.get(owner,RouteDriver);await ctx.step(5);
  expect(ctx.world.get(owner,RouteDriver)).toEqual(before);
},SCENE);

worldTest('routes.handoff recorded synthetic spin fixture preserves captured recovery through native map transfer',async ctx=>{
  const owner=await start(ctx);
  await landmark(ctx,0,'exit-before',0);await pause(ctx,false);
  ctx.input.key('ArrowUp',true);await ctx.step(1); // a real running hold, before the boundary crossing
  expect(ctx.world.resource(DrivingInput).keyboard&1).toBe(1);
  const previousCount=ctx.world.get(owner,CollisionDriver).acceptedCount;
  // The recorded cheat seeds synthetic recovery on a RUNNING tick. Actual
  // AdvanceRoute/Traffic then cross the real exit on that same fixed step.
  await ctx.cheat(RouteLandmark,{landmark:'exit-before',side:0,speed:200,quietTraffic:true,recovery:'spin-fixture'});
  const after=ctx.world.get(owner,CrashDriver),route=ctx.world.get(owner,RouteDriver);
  expect(route.mapId).toBe(2);expect(route.camera).toBe(0);expect(after.mapId).toBe(2);
  expect(after.phase).toBe(1);expect(after.cadenceTick).toBe(1);
  const captured={variant:0,kind:1,impactSpeed:200,handlingCap:200,curve:Math.fround(1.67),collisionDir:0,
    decrement:6.25,advances:0,reactionTick:0,totalAdvances:32,consumedAcceptedCount:previousCount+1};
  for(const key of Object.keys(captured) as (keyof typeof captured)[])
    expect(Math.fround(after[key])).toBe(Math.fround(captured[key]));
  expect(ctx.world.get(owner,CollisionDriver).acceptedCount).toBe(previousCount+1);
  expect(ctx.world.resource(DrivingInput).keyboard&1).toBe(1);expect(ctx.world.events(ContactAccepted).length).toBe(0);
  await pause(ctx,true);const stopped=ctx.world.get(owner,CrashDriver);await ctx.step(8);
  expect(ctx.world.get(owner,CrashDriver)).toEqual(stopped);expect(ctx.world.entities(RouteDriver)[0]).toBe(owner);
},SCENE);

worldTest('routes.handoff exit equality and quiet source fixture preserve generations epochs and pause',async ctx=>{
  const owner=await start(ctx),poolBefore=ctx.world.get(owner,TrafficPool);
  await landmark(ctx,0,'exit-at',0);
  const source=originalRouteSources().get(1,ctx.world.get(owner,RouteDriver).gradient as -1|0|1);
  expect(ctx.world.get(owner,RouteDriver).camera).toBe(source.lastLine*150-702);
  const quiet=ctx.world.get(owner,TrafficPool),coords=ctx.world.get(owner,RouteTrafficCoordinates);
  expect(quiet.epoch).toBe(poolBefore.epoch);expect(quiet.generation).toEqual(poolBefore.generation);
  expect(quiet.side).toEqual(poolBefore.side);expect(quiet.ai).toEqual(poolBefore.ai);
  expect(quiet.parked.every(value=>value===1)).toBe(true);expect(coords.rawZ.every(value=>value===0)).toBe(true);
  await pause(ctx,false);await ctx.step(2);
  expect(ctx.world.get(owner,RouteDriver).mapId).toBe(1);expect(ctx.world.get(owner,RouteDriver).mapEpoch).toBe(1);
  await pause(ctx,true);const before=ctx.world.get(owner,RouteDriver);await ctx.step(5);
  expect(ctx.world.get(owner,RouteDriver)).toEqual(before);
  await landmark(ctx,0,'exit-before');await pause(ctx,false);
  expect(ctx.world.get(owner,RouteDriver).mapId).toBe(2);expect(ctx.world.get(owner,RouteDriver).camera).toBe(0);
},SCENE);

for(const passFixture of ['eligible','colliding'] as const){
  worldTest(`routes.handoff recorded synthetic ${passFixture} old-life pass crosses actual native map transaction`,async ctx=>{
    const owner=await start(ctx),initialRoute=ctx.world.get(owner,RouteDriver),initialPool=ctx.world.get(owner,TrafficPool);
    const initialCount=ctx.world.get(owner,CollisionDriver).acceptedCount,initialConsumed=ctx.world.get(owner,CrashDriver).consumedAcceptedCount;
    await ctx.cheat(RouteLandmark,{landmark:'exit-before',side:0,speed:200,quietTraffic:true,recovery:'preserve',passFixture});
    const fixtureRoute=ctx.world.get(owner,RouteDriver),fixturePool=ctx.world.get(owner,TrafficPool),fixtureCoordinates=ctx.world.get(owner,RouteTrafficCoordinates);
    expect(fixturePool.epoch).toBe(initialPool.epoch);expect(fixturePool.generation[0]).toBe(initialPool.generation[0]);
    expect(fixturePool.passed[0]).toBe(0);expect(fixtureCoordinates.rawZ[0]).toBe(fixtureRoute.camera+702+10);
    expect(ctx.world.events(RouteTrafficPassed).length).toBe(0);
    await pause(ctx,false); // native outgoing advance, mask, finalize and transfer
    const route=ctx.world.get(owner,RouteDriver),pool=ctx.world.get(owner,TrafficPool),coordinates=ctx.world.get(owner,RouteTrafficCoordinates);
    expect(route.mapId).toBe(2);expect(route.mapEpoch).toBe(initialRoute.mapEpoch+1);expect(route.routeEpoch).toBe(initialRoute.routeEpoch);
    expect(route.camera).toBe(0);expect(route.pending).toBe(false);expect(ctx.world.entities(RouteDriver)[0]).toBe(owner);
    expect(pool.epoch).toBe(initialPool.epoch);expect(pool.generation[0]).toBe(initialPool.generation[0]);
    expect(pool.passed[0]).toBe(1);expect(coordinates.rawZ[0]).toBe(fixtureCoordinates.rawZ[0]!-route.pendingOutgoingCamera);
    expect(702-coordinates.rawZ[0]!).toBeGreaterThan(150); // destination occupancy cannot be the outgoing hit
    expect(ctx.world.get(owner,CollisionDriver).acceptedCount).toBe(initialCount);
    expect(ctx.world.get(owner,CrashDriver).consumedAcceptedCount).toBe(initialConsumed);
    expect(ctx.world.get(owner,CrashDriver).phase).toBe(0);expect(ctx.world.events(ContactAccepted).length).toBe(0);
    const awards=ctx.world.events(RouteTrafficPassed),legacy=ctx.world.events(TrafficPassed);
    if(passFixture==='eligible'){
      expect(awards.length).toBe(1);expect(legacy.length).toBe(1);
      const award=awards[0]!;
      expect(award.mapId).toBe(1);expect(award.mapEpoch).toBe(initialRoute.mapEpoch);expect(award.routeEpoch).toBe(initialRoute.routeEpoch);
      expect(award.poolEpoch).toBe(initialPool.epoch);expect(award.slot).toBe(0);expect(award.generation).toBe(initialPool.generation[0]);
      expect(award.points).toBe(20000);expect(route.passAwardCount).toBe(initialRoute.passAwardCount+1);
      expect(route.passAwardAmount).toBe(20000);expect(route.passAwardStep).toBe(route.processedStep);
      expect(route.passAwardOldMapEpoch).toBe(initialRoute.mapEpoch);
    }else{
      expect(awards.length).toBe(0);expect(legacy.length).toBe(0);
      expect(route.passAwardCount).toBe(initialRoute.passAwardCount);expect(route.passAwardStep).toBe(initialRoute.passAwardStep);
      expect(route.passAwardAmount).toBe(initialRoute.passAwardAmount);
    }
    console.log('routes.handoff native old-life pass supplement',{passFixture,mapId:route.mapId,oldMapEpoch:initialRoute.mapEpoch,
      mapEpoch:route.mapEpoch,passAwardCount:route.passAwardCount,passAwardStep:route.passAwardStep,awards,
      acceptedCount:ctx.world.get(owner,CollisionDriver).acceptedCount,hash:ctx.world.hash()});
  },SCENE);
}
