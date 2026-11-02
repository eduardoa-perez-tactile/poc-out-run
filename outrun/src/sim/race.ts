import {defineSystem,query,read,write} from '@gameengine/runtime';
import {RaceOwner,RaceState,RaceRestartRequested,RouteDriver,RouteResetRequested,TerrainDriver,CrashDriver,
  DrivingState,DrivingPauseRequested,type RaceStateValue} from '../schema.gen.ts';
import {originalRouteSources} from '../content/route-boot.ts';
import type {SourceBiomeId} from '../content/biome.ts';
import {createRaceFlow,admitRaceTick,finishRaceTick,raceControlMode,RacePhase,
  type RaceFlow,type RaceConfiguration,type RaceControlMode,type RacePhaseCode,type RaceAdmission} from './race-flow-math.ts';

export const RaceControl={Locked:0,Player:1,Recovery:2,Roll:3,Brake:4}as const;
function modeCode(mode:RaceControlMode):number {
  return mode==='player'?RaceControl.Player:mode==='recovery'?RaceControl.Recovery:mode==='roll'?RaceControl.Roll:mode==='brake'?RaceControl.Brake:RaceControl.Locked;
}
function flow(value:RaceStateValue):RaceFlow {
  if(!Number.isInteger(value.phase)||value.phase<0||value.phase>8||!Number.isInteger(value.resumePhase)||value.resumePhase<0||value.resumePhase>8||value.outcome>2)throw new Error('Invalid persisted race phase');
  return {...value,phase:value.phase as RacePhaseCode,resumePhase:value.resumePhase as RacePhaseCode,outcome:value.outcome as 0|1|2};
}
function configuration(value:RaceStateValue):RaceConfiguration {
  if(value.difficulty!==0&&value.difficulty!==1&&value.difficulty!==2)throw new Error('Invalid race difficulty');
  if(value.population!==9&&value.population!==20&&value.population!==32)throw new Error('Invalid race population');
  return {mapTimeSeconds:originalRouteSources().get(1,0).timeSeconds,difficulty:value.difficulty,population:value.population};
}
function decodeMode(value:number):RaceControlMode {
  if(value===RaceControl.Locked)return 'locked';if(value===RaceControl.Player)return 'player';
  if(value===RaceControl.Recovery)return 'recovery';if(value===RaceControl.Roll)return 'roll';if(value===RaceControl.Brake)return 'brake';
  throw new Error('Invalid race control admission');
}

/** Admission precedes the one route/traffic transaction. Only the explicit race
 * owner connects this flow; all delivered ownerless proof scenes remain inert. */
export const AdmitRace=defineSystem({
  name:'AdmitRace',after:['CaptureDrivingInput'],before:['AdvanceDriving','AdvanceRoute'],
  runIf:{query:query(read(RaceOwner))},
  query:query(read(RaceOwner),read(RouteDriver)),
  resources:[write(RaceState),write(DrivingState)],events:[RaceRestartRequested,RouteResetRequested,DrivingPauseRequested],
  run(ctx,owners){
    if(owners.count!==1)throw new Error('Race requires one co-owned route authority');
    for(const chunk of owners.chunks())for(let row=0;row<chunk.length;row++){
      if(chunk.col(RaceOwner).enabled[row]===0)return;
      const route=chunk.get(RouteDriver,row),previous=ctx.get(RaceState),driving=ctx.get(DrivingState);
      let reset:import('../schema.gen.ts').RouteResetRequestedValue|undefined;
      for(const request of ctx.events.read(RouteResetRequested))reset=request;
      const configured=reset?{...previous,population:reset.population}:previous,config=configuration(configured);
      // A restart event is delivered to AdvanceRoute on the next fixed tick.
      // The countdown is already locked while that recorded reset is pending.
      const expectedNext=route.routeEpoch+1;
      const initialize=!previous.initialized||!route.initialized||(reset!==undefined&&previous.routeEpoch!==expectedNext);
      let before=initialize?createRaceFlow(config,previous.raceEpoch+1,expectedNext):flow(previous);
      let pauseToggle=!initialize&&driving.playing!==previous.lastPublishedPlaying;
      // UI sends desired pause state, whereas Space toggles the legacy reducer.
      // In particular a redundant resume must not pause a locked countdown.
      for(const request of ctx.events.read(DrivingPauseRequested))pauseToggle=!initialize&&((before.phase===RacePhase.Paused)!==request.paused);
      const restart=ctx.events.count(RaceRestartRequested)>0;
      const admission=admitRaceTick(before,{step:ctx.step,pauseToggle,restart},config),code=modeCode(admission.mode),playing=code!==RaceControl.Locked;
      if(admission.resetRoute)ctx.events.emit(RouteResetRequested,{seedLo:route.seedLo,seedHi:route.seedHi,population:config.population,manual:driving.manual});
      ctx.set(RaceState,{...admission.state,initialized:true,mapTimeSeconds:config.mapTimeSeconds,population:config.population,
        mapId:initialize||admission.resetRoute?1:previous.mapId,stage:initialize||admission.resetRoute?0:previous.stage,
        controlMode:code,admittedStep:ctx.step,activeTick:admission.activeTick,racingAdmitted:admission.racingAdmitted,lastPublishedPlaying:playing});
      // Do not cancel the held throttle during countdown. Input capture owns
      // cancellation on real pause, scene entry and the recorded full reset.
      ctx.set(DrivingState,{active:true,playing});
    }
  },
});

/** Read immediate route/contact/crash state after its native transaction, never
 * a delayed event as evidence for a same-step checkpoint, pass or genuine goal. */
export const FinishRace=defineSystem({
  name:'FinishRace',after:['AdvanceTraffic','BeginCrashRecovery'],
  runIf:{query:query(read(RaceOwner))},
  query:query(read(RaceOwner),read(RouteDriver),read(TerrainDriver),read(CrashDriver)),
  resources:[write(RaceState),write(DrivingState)],
  run(ctx,owners){
    if(owners.count!==1)throw new Error('Race finish requires one complete actor owner');
    for(const chunk of owners.chunks())for(let row=0;row<chunk.length;row++){
      if(chunk.col(RaceOwner).enabled[row]===0)return;
      const previous=ctx.get(RaceState);if(!previous.initialized||previous.admittedStep!==ctx.step)throw new Error('Missing current race admission');
      const route=chunk.get(RouteDriver,row),terrain=chunk.get(TerrainDriver,row),crash=chunk.get(CrashDriver,row),driving=ctx.get(DrivingState);
      const admission:RaceAdmission={state:flow(previous),step:ctx.step,mode:decodeMode(previous.controlMode),
        racingAdmitted:previous.racingAdmitted,activeTick:previous.activeTick,resetRoute:false};
      if(route.gradient!==-1&&route.gradient!==0&&route.gradient!==1)throw new Error('Invalid race route profile');
      const data=originalRouteSources().get(route.mapId as SourceBiomeId,route.gradient);
      const next=finishRaceTick(admission,{routeEpoch:route.routeEpoch,mapId:route.mapId,
        playerRow:Math.floor((route.camera+data.playerOffsetZ)/data.segmentLength)%data.totalCount,
        crashPhase:crash.phase,legacySpeed:driving.legacySpeed,leftEffect:terrain.leftEffect,rightEffect:terrain.rightEffect,
        checkpointCount:route.checkpointCount,checkpointStep:route.checkpointStep,checkpointBonusSeconds:route.checkpointBonusSeconds,
        passAwardCount:route.passAwardCount,passAwardStep:route.passAwardStep,passAwardAmount:route.passAwardAmount,
        arrivalCount:route.arrivalCount,arrivalStep:route.arrivalStep});
      // A phase transition can terminally lock this tick. Countdown completion
      // and resume retain their admission lock until the following fixed tick.
      const code=admission.activeTick?modeCode(raceControlMode(next.phase)):previous.controlMode,playing=code!==RaceControl.Locked;
      const sameEpoch=route.routeEpoch===next.routeEpoch;
      ctx.set(RaceState,{...next,mapId:sameEpoch?route.mapId:previous.mapId,stage:sameEpoch?route.stage:previous.stage,
        controlMode:code,lastPublishedPlaying:playing,
        activeTick:admission.activeTick&&next.phase!==RacePhase.Results&&next.phase!==RacePhase.GameOver});
      ctx.setField(DrivingState,'playing',playing);
    }
  },
});
