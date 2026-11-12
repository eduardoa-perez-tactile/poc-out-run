import {recordedScene} from '../helpers/recorded-scene.ts';
// Independent playback: input choices come ONLY from this frozen static fixture.
import {worldTest,expect} from '@gameengine/test';
import {EnterScene} from '@gameengine/runtime';
import {RaceOwner,RaceState,RaceRestartRequested,RouteDriver,RouteTrafficCoordinates,TerrainDriver,TrafficPool,
 CrashDriver,CollisionDriver,DrivingState,DrivingInput,RouteBiomeEntered,RouteCheckpointPassed,RouteGoalEntered} from '../../src/schema.gen.ts';
import {RacePhase,COUNTDOWN_TICKS} from '../../src/sim/race-flow-math.ts';
import plan from '../fixtures/routes/normal-timed-victory.inputs.json';

const KEYS=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight']as const;
// SDK0.1.34 stores scenes:current as a GUID. The frozen0.1.21 input plan and
// every physical/timing/event assertion stay unchanged; only these whole-world
// identity hashes migrate (compact old/new trace differs only in that document).
const GUID_HASHES=[
 {atStep:22816,legacy:'05b28ef37f8891c2',hash:'f01116dd7cb52c9c'},
 {atStep:28191,legacy:'5f249dab77554454',hash:'ec2cbd6af79b213a'},
]as const;
worldTest('race.victory fixed normal keyboard inputs win five stages ending results and recorded restart',async({world,step,input})=>{
 expect(plan.format).toBe('outrun-normal-timed-fixed-inputs-v1');
 expect(plan.sourceCommit).toBe('6882721c99bc79365f815f68d389bf5078129e68');expect(plan.engineVersion).toBe('0.1.21');
 expect(plan.scene).toBe('scenes/original-race.scene.json');expect(plan.keys).toEqual(KEYS);expect(plan.view).toEqual([1280,720,1]);
 expect(plan.start).toEqual({kind:'recorded EnterScene',atStep:1});expect(plan.steps).toBe(28191);
 expect(plan.configuration).toEqual({mapTimeSeconds:160,difficulty:1,population:20,manual:false,seedLo:305419896,seedHi:2596069104});
 const validationHeld=[0,0,0,0];let previousStep=1;
 for(const [at,key,down]of plan.commands){
  expect(Number.isInteger(at)&&at!>=previousStep&&at!>=2&&at!<=plan.steps).toBe(true);
  expect(Number.isInteger(key)&&key!>=0&&key!<KEYS.length&&(down===0||down===1)).toBe(true);
  expect(validationHeld[key!]!==down).toBe(true);validationHeld[key!]=down!;previousStep=at!;
 }
 expect(plan.commands.length).toBe(24902);expect(plan.expected.visited).toEqual([1,2,4,7,11,16]);
 const targets=new Set<number>([1,plan.steps]);
 for(const command of plan.commands)targets.add(command[0]!);
 for(const milestone of plan.expected.milestones)targets.add(milestone.atStep);
 for(const hash of plan.expected.hashes)targets.add(hash.atStep);
 input.view(1280,720,1);input.emit(EnterScene,{scene:recordedScene(plan.scene),release:''});
 let current=0,commandIndex=0,checkedMilestones=0;
 let owner:ReturnType<typeof world.entities>[number]|undefined;
 for(const target of [...targets].sort((a,b)=>a-b)){
  if(target-current>1){await step(target-current-1);current=target-1;}
  while(plan.commands[commandIndex]?.[0]===target){
   const command=plan.commands[commandIndex++]!;input.key(KEYS[command[1]!]!,command[2]===1);
  }
  await step(1);current=target;
  // Observation targets are frozen in the fixture. No observation selects input.
  const milestone=plan.expected.milestones.find(row=>row.atStep===target);
  const expectedHash=plan.expected.hashes.find(row=>row.atStep===target);
  if(expectedHash){const migrated=GUID_HASHES.find(row=>row.atStep===target);expect(migrated?.legacy).toBe(expectedHash.hash);expect(world.hash()).toBe(migrated!.hash);}
  if(!milestone)continue;
  checkedMilestones++;
  const owners=world.entities(RaceOwner);expect(owners.length).toBe(1);
  if(owner===undefined)owner=owners[0]!;expect(owners[0]).toBe(owner);
  for(const component of [RouteDriver,RouteTrafficCoordinates,TerrainDriver,TrafficPool,CrashDriver,CollisionDriver]){
   const actors=world.entities(component);expect(actors.length).toBe(1);expect(actors[0]).toBe(owner);
  }
  const actor=owner!,race=world.resource(RaceState),route=world.get(actor,RouteDriver),pool=world.get(actor,TrafficPool);
  expect(pool.population).toBe(20);expect(pool.mapId).toBe(route.mapId);expect(world.resource(DrivingState).manual).toBe(false);
  expect(route.seedLo).toBe(plan.configuration.seedLo);expect(route.seedHi).toBe(plan.configuration.seedHi);
  expect(race.population).toBe(20);expect(race.difficulty).toBe(1);expect(race.mapTimeSeconds).toBe(160);
  for(const field of ['mapId','mapEpoch','gradient','stage','camera','checkpointCount','checkpointStep','checkpointBonusSeconds','arrivalCount','arrivalStep']as const)expect(route[field]).toBe(milestone[field]);
  for(const field of ['phase','remainingTicks','totalTicks','score']as const)expect(race[field]).toBe(milestone[field]);
  expect(world.get(actor,CollisionDriver).acceptedCount).toBe(0);expect(world.get(actor,CrashDriver).phase).toBe(0);
  if(milestone.reasons.includes('map')){
   const entries=world.events(RouteBiomeEntered).filter(e=>e.routeEpoch===1&&e.mapEpoch===route.mapEpoch);
   expect(entries.length).toBe(1);expect(entries[0]!.mapId).toBe(route.mapId);expect(entries[0]!.gradient).toBe(route.gradient);
  }
  if(milestone.reasons.includes('checkpoint')&&route.checkpointCount>0){
   expect(route.checkpointStep).toBe(target-1);
   const checkpoints=world.events(RouteCheckpointPassed).filter(e=>e.routeEpoch===1&&e.mapEpoch===route.mapEpoch);
   expect(checkpoints.length).toBe(1);expect(checkpoints[0]!.bonusSeconds).toBe(milestone.checkpointBonusSeconds);
   expect(race.consumedCheckpoints).toBe(route.checkpointCount);
  }
  if(milestone.reasons.includes('arrival')&&route.arrivalCount>0){
   const arrivals=world.events(RouteGoalEntered);expect(arrivals.length).toBe(1);
   expect(arrivals[0]!.mapId).toBe(16);expect(route.goalEntered).toBe(true);expect(route.arrivalStep).toBe(target-1);
   expect(race.outcome).toBe(1);expect(race.remainingTicks>0).toBe(true);
  }
 }
 expect(current).toBe(plan.steps);expect(commandIndex).toBe(plan.commands.length);expect(checkedMilestones).toBe(plan.expected.milestones.length);
 expect(owner===undefined).toBe(false);const actor=owner!;
 expect(world.resource(RaceState)).toEqual(plan.expected.final.race);
 expect(world.get(actor,RouteDriver)).toEqual(plan.expected.final.route);
 expect(world.resource(DrivingState)).toEqual(plan.expected.final.driving);
 expect(world.get(actor,CrashDriver)).toEqual(plan.expected.final.crash);
 expect(world.resource(RaceState).phase).toBe(RacePhase.Results);
 expect(world.resource(RaceState).score).toBe(world.resource(RaceState).finishScore);
 const victoryHash=world.hash();expect(victoryHash).toBe(GUID_HASHES[1].hash);
 // Prescribed recorded intent after full real-input victory; same actor resets.
 expect(plan.restart.atStep).toBe(current+1);input.emit(RaceRestartRequested,{});await step(plan.restart.observeAfterSteps);current+=plan.restart.observeAfterSteps;
 expect(world.entities(RaceOwner).length).toBe(1);expect(world.entities(RaceOwner)[0]).toBe(actor);
 for(const component of [RouteDriver,RouteTrafficCoordinates,TerrainDriver,TrafficPool,CrashDriver,CollisionDriver])expect(world.entities(component)[0]).toBe(actor);
 const restarted=world.resource(RaceState),route=world.get(actor,RouteDriver),driving=world.resource(DrivingState);
 expect(restarted.phase).toBe(RacePhase.Countdown);expect(restarted.countdownTicks>0&&restarted.countdownTicks<COUNTDOWN_TICKS).toBe(true);
 expect(restarted.raceEpoch).toBe(plan.restart.expectedRaceEpoch);expect(restarted.routeEpoch).toBe(plan.restart.expectedRouteEpoch);
 expect(route.routeEpoch).toBe(plan.restart.expectedRouteEpoch);expect(route.mapId).toBe(1);expect(route.mapEpoch).toBe(1);expect(route.stage).toBe(0);
 expect(route.camera).toBe(45000);expect(route.previousCamera).toBe(45000);expect(route.goalEntered).toBe(false);
 expect(route.checkpointCount).toBe(0);expect(route.arrivalCount).toBe(0);expect(route.passAwardCount).toBe(0);expect(route.rangeCalls).toBe(1);
 expect(restarted.remainingTicks).toBe(9600);expect(restarted.totalTicks).toBe(0);expect(restarted.stageTicks).toBe(0);expect(restarted.score).toBe(0);
 expect(restarted.finishScore).toBe(0);expect(restarted.bonusAwarded).toBe(false);expect(restarted.outcome).toBe(0);
 expect(driving.legacySpeed).toBe(0);expect(driving.steering).toBe(0);expect(driving.lateral).toBe(0);
 expect(world.resource(DrivingInput).keyboard).toBe(0);expect(world.get(actor,TrafficPool).population).toBe(20);
 expect(world.get(actor,CollisionDriver).acceptedCount).toBe(0);expect(world.get(actor,CrashDriver).consumedAcceptedCount).toBe(0);
 console.log('RACE_FIXED_VICTORY '+JSON.stringify({steps:current,commands:commandIndex,milestones:checkedMilestones,
  visited:plan.expected.visited,traffic:20,difficulty:1,remainingTicksAtFinish:plan.expected.final.race.remainingTicks,
  impacts:0,score:plan.expected.final.race.score,victoryHash,restartHash:world.hash(),actorPreserved:true}));
},{timeoutSteps:40000});
