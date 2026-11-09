// Deterministic ORIGINAL race clock, scoring and ending flow.
import {math} from '@gameengine/runtime';
const q=math.fround;

// Pinned6882721 Game.cpp538–550/638–689/881–899/1005–1080,
// Globals.h42/68, PlayerCar.cpp656–701, Map.cpp661–662.
export const RACE_HZ=60;
export const COUNTDOWN_TICKS=4*RACE_HZ; // source j=3..0, four one-second updates
export const FINISH_POINTS_PER_SECOND=1000000;
export const BONUS_POINTS_PER_TICK=32967; // int(1.5f*1000000/45.5f)
export const RESULTS_HOLD_TICKS=101+52; // source stopped-car hold then fade
export const GOAL_BRAKE_ROW=500;
export const ENDING_ACCELERATION=q(100/6.5);
export const RacePhase={Countdown:0,Racing:1,EndingRecovery:2,EndingRoll:3,EndingBrake:4,Bonus:5,Results:6,GameOver:7,Paused:8}as const;
export type RacePhaseCode=typeof RacePhase[keyof typeof RacePhase];
export type RaceDifficulty=0|1|2; // EASY, NORMAL, HARD; preserve source signs
export interface RaceConfiguration {mapTimeSeconds:number;difficulty:RaceDifficulty;population:9|20|32;}

/** Plain fixed-step state intended for one schema resource. No live objects,
 * callbacks, presentation readiness, audio completion or module caches belong here. */
export interface RaceFlow {
  raceEpoch:number;routeEpoch:number;phase:RacePhaseCode;resumePhase:RacePhaseCode;
  processedStep:number;phaseTicks:number;countdownTicks:number;
  remainingTicks:number;totalTicks:number;stageTicks:number;lastStageTicks:number;
  score:number;finishScore:number;finishRemainingSeconds:number;
  bonusAwarded:boolean;bonusDeciseconds:number;resultsHoldTicks:number;
  outcome:0|1|2; // none, source arrival/win, timeout
  consumedCheckpoints:number;consumedPassBatches:number;consumedArrivals:number;
}
export interface RaceIntent {step:number;pauseToggle:boolean;restart:boolean;}
export type RaceControlMode='locked'|'player'|'recovery'|'roll'|'brake';
export interface RaceAdmission {
  readonly state:RaceFlow;readonly step:number;readonly mode:RaceControlMode;
  readonly racingAdmitted:boolean;readonly activeTick:boolean;readonly resetRoute:boolean;
}
/** Read after the one actor transaction, on this SAME fixed step. The once-only
 * producer counts and identities come from73; never infer a checkpoint from art
 * or apply an unverified pass that73's contact/recycle eligibility rejected. */
export interface RaceObservation {
  routeEpoch:number;mapId:number;playerRow:number;crashPhase:number;legacySpeed:number;
  leftEffect:number;rightEffect:number;
  checkpointCount:number;checkpointStep:number;checkpointBonusSeconds:number;
  passAwardCount:number;passAwardStep:number;passAwardAmount:number;
  arrivalCount:number;arrivalStep:number;
}
function require(value:boolean,message:string):asserts value{if(!value)throw new Error('Race flow: '+message);}
function integer(value:number,min=0):boolean{return Number.isSafeInteger(value)&&value>=min;}
export function initialRaceSeconds(config:RaceConfiguration):number {
  require(integer(config.mapTimeSeconds,1)&&[0,1,2].includes(config.difficulty)&&[9,20,32].includes(config.population),'invalid configuration');
  return config.mapTimeSeconds+(config.difficulty===0?-5:config.difficulty===2?5:0)+(config.population===9?-5:config.population===32?5:0);
}
export function createRaceFlow(config:RaceConfiguration,raceEpoch:number,routeEpoch:number):RaceFlow {
  require(integer(raceEpoch,1)&&integer(routeEpoch,1),'invalid start identity');
  const seconds=initialRaceSeconds(config);require(seconds>0,'initial time must be positive');
  return {raceEpoch,routeEpoch,phase:RacePhase.Countdown,resumePhase:RacePhase.Countdown,
    processedStep:0,phaseTicks:0,countdownTicks:COUNTDOWN_TICKS,remainingTicks:seconds*RACE_HZ,
    totalTicks:0,stageTicks:0,lastStageTicks:0,score:0,finishScore:0,finishRemainingSeconds:0,
    bonusAwarded:false,bonusDeciseconds:0,resultsHoldTicks:0,outcome:0,
    consumedCheckpoints:0,consumedPassBatches:0,consumedArrivals:0};
}
export function raceControlMode(phase:RacePhaseCode):RaceControlMode {
  switch(phase){
    case RacePhase.Racing:return 'player';
    case RacePhase.EndingRecovery:return 'recovery';
    case RacePhase.EndingRoll:return 'roll';
    case RacePhase.EndingBrake:return 'brake';
    default:return 'locked';
  }
}
/** Run BEFORE route/traffic/contact/crash. The owner must apply mode before any
 * actor advances. Zero-at-entry cannot move or revive from a late checkpoint.
 * Countdown/pause/restart consume this fixed tick without admitting movement. */
export function admitRaceTick(previous:Readonly<RaceFlow>,intent:RaceIntent,config:RaceConfiguration):RaceAdmission {
  const firstZero=intent.step===0&&previous.processedStep===0&&previous.phaseTicks===0&&previous.countdownTicks===COUNTDOWN_TICKS&&previous.totalTicks===0;
  require(integer(intent.step)&&(intent.step>previous.processedStep||firstZero),'duplicate/stale fixed step');
  let state={...previous};
  if(intent.restart&&(state.phase===RacePhase.Results||state.phase===RacePhase.GameOver)){
    state=createRaceFlow(config,state.raceEpoch+1,state.routeEpoch+1);
    return {state,step:intent.step,mode:'locked',racingAdmitted:false,activeTick:false,resetRoute:true};
  }
  if(intent.pauseToggle&&state.phase!==RacePhase.Results&&state.phase!==RacePhase.GameOver){
    if(state.phase===RacePhase.Paused)state.phase=state.resumePhase;
    else {state.resumePhase=state.phase;state.phase=RacePhase.Paused;}
    return {state,step:intent.step,mode:'locked',racingAdmitted:false,activeTick:false,resetRoute:false};
  }
  if(state.phase===RacePhase.Paused)return {state,step:intent.step,mode:'locked',racingAdmitted:false,activeTick:false,resetRoute:false};
  if(state.phase===RacePhase.Countdown){
    state.countdownTicks=Math.max(0,state.countdownTicks-1);state.phaseTicks++;
    if(state.countdownTicks===0){state.phase=RacePhase.Racing;state.phaseTicks=0;}
    return {state,step:intent.step,mode:'locked',racingAdmitted:false,activeTick:false,resetRoute:false};
  }
  if(state.phase===RacePhase.Racing&&state.remainingTicks<=0){state.phase=RacePhase.GameOver;state.outcome=2;state.remainingTicks=0;state.phaseTicks=0;}
  return {state,step:intent.step,mode:raceControlMode(state.phase),racingAdmitted:state.phase===RacePhase.Racing,
    activeTick:state.phase>=RacePhase.Racing&&state.phase<=RacePhase.Bonus,resetRoute:false};
}

/** Preserve the source float-expression/cast sequence, including long-long score
 * conversion to binary32 for its compound float addition. NORMAL/SMOKE wheels
 * allow driving score; SAND/GRASS/SNOW/MUD suppress it. Accepted pass batches are
 * integer additions BEFORE this expression, as in Map→Game source order. */
export function sourceDrivingScore(score:number,speed:number,leftEffect:number,rightEffect:number):number {
  if(speed<=5||leftEffect>=2||rightEffect>=2)return score;
  const ratio=q(q(speed-5)/q(141)),scaled=q(q(10+q(q(950)*ratio))/q(3.7));
  const increment=q(Math.trunc(scaled)*q(2.3));
  return Math.trunc(q(q(score)+increment));
}
function newBatch(count:number,consumed:number,producerStep:number,step:number,label:string):boolean {
  require(integer(count)&&count>=consumed,label+' count regressed');
  if(count===consumed)return false;
  require(count===consumed+1&&producerStep===step,label+' missed or stale batch');
  return true;
}
function countBonus(state:RaceFlow):void {
  if(!state.bonusAwarded)return;
  state.score=Math.min(state.finishScore,state.score+BONUS_POINTS_PER_TICK);
  // Source checks its0.01s bonus clock once per nominal60Hz update: one displayed
  // decisecond decrements per tick. Results never depend on this visual counter.
  state.bonusDeciseconds=Math.max(0,state.bonusDeciseconds-1);
}
/** Run AFTER actors. Authored deterministic policy: an admitted positive-entry
 * racing tick gets its actual checkpoint BEFORE one tick expires; actual goal
 * entry on that tick wins expiration. The source timer thread supplied no total
 * order. Continuous deadline phase is NOT reset by lap/checkpoint clock resets. */
export function finishRaceTick(admission:RaceAdmission,observation:RaceObservation):RaceFlow {
  const state={...admission.state};state.processedStep=admission.step;
  if(!admission.activeTick)return state;
  require(observation.routeEpoch===state.routeEpoch,'actor/reset epoch mismatch');
  require(integer(observation.playerRow)&&integer(observation.crashPhase)&&observation.crashPhase<=3,'invalid actor observation');
  if(admission.racingAdmitted){
    const checkpoint=newBatch(observation.checkpointCount,state.consumedCheckpoints,observation.checkpointStep,admission.step,'checkpoint');
    const passes=newBatch(observation.passAwardCount,state.consumedPassBatches,observation.passAwardStep,admission.step,'pass');
    const arrival=newBatch(observation.arrivalCount,state.consumedArrivals,observation.arrivalStep,admission.step,'arrival');
    state.totalTicks++;state.stageTicks++;state.phaseTicks++;
    if(checkpoint){
      require(integer(observation.checkpointBonusSeconds,1)&&observation.mapId!==1&&observation.mapId!==16,'invalid checkpoint award');
      state.remainingTicks+=observation.checkpointBonusSeconds*RACE_HZ;
      state.lastStageTicks=state.stageTicks;state.stageTicks=0;state.consumedCheckpoints=observation.checkpointCount;
    }
    if(passes){
      require(integer(observation.passAwardAmount,1)&&observation.passAwardAmount%20000===0,'invalid accepted pass award');
      state.score+=observation.passAwardAmount;state.consumedPassBatches=observation.passAwardCount;
    }
    state.score=sourceDrivingScore(state.score,observation.legacySpeed,observation.leftEffect,observation.rightEffect);
    state.remainingTicks=Math.max(0,state.remainingTicks-1);
    if(arrival){
      require(observation.mapId===16&&!state.bonusAwarded,'invalid/duplicate genuine arrival');
      state.consumedArrivals=observation.arrivalCount;state.outcome=1;state.bonusAwarded=true;
      state.finishRemainingSeconds=Math.ceil(state.remainingTicks/RACE_HZ);
      state.finishScore=state.score+state.finishRemainingSeconds*FINISH_POINTS_PER_SECOND;
      state.bonusDeciseconds=state.finishRemainingSeconds*10;state.phaseTicks=0;
      state.phase=observation.crashPhase!==0?RacePhase.EndingRecovery:RacePhase.EndingRoll;
    }else if(state.remainingTicks===0){state.phase=RacePhase.GameOver;state.outcome=2;state.phaseTicks=0;}
    return state;
  }
  // Racing clocks/ordinary score are stopped from genuine goal ENTRY onward.
  // Bonus counting is concurrent with recovery, roll and brake, as in source.
  countBonus(state);state.phaseTicks++;
  if(state.phase===RacePhase.EndingRecovery){
    if(observation.crashPhase===0){state.phase=RacePhase.EndingRoll;state.phaseTicks=0;}
  }else if(state.phase===RacePhase.EndingRoll){
    if(observation.playerRow>=GOAL_BRAKE_ROW){state.phase=RacePhase.EndingBrake;state.phaseTicks=0;}
  }else if(state.phase===RacePhase.EndingBrake){
    if(observation.legacySpeed<=0){state.phase=RacePhase.Bonus;state.phaseTicks=0;state.resultsHoldTicks=0;}
  }else if(state.phase===RacePhase.Bonus){
    if(state.score===state.finishScore){
      state.resultsHoldTicks++;
      if(state.resultsHoldTicks>=RESULTS_HOLD_TICKS){state.phase=RacePhase.Results;state.phaseTicks=0;}
    }
  }
  return state;
}

export interface EndingMotion {legacySpeed:number;gear:number;lateral:number;steering:number;wheelEffect:0|1;}
/** Motion operands only: the root's goal actor transaction must perform exactly
 * ONE existing sourceRouteCameraAssignment with this speed. Do not call ordinary
 * advanceDriving as well. Recovery mode stays with the delivered crash kernel;
 * row500 switches the FOLLOWING tick to braking after the row has been reached. */
export function advanceEndingMotion(
  mode:'roll'|'brake',previous:Readonly<Omit<EndingMotion,'wheelEffect'>>,dt:number,
):EndingMotion {
  require(q(dt)===q(1/RACE_HZ),'ending requires nominal60Hz');
  let speed=previous.legacySpeed,lateral=q(previous.lateral),gear=previous.gear;
  if(mode==='roll'){
    gear=1;speed=q(Math.min(200,q(speed+q(ENDING_ACCELERATION*q(dt)))));
    const center=q(q(.5)*q(dt));
    const threshold=q(.1);
    if(lateral>threshold)lateral=q(lateral-center);
    if(lateral<-threshold)lateral=q(lateral+center);
    if(lateral!==0&&lateral<threshold&&lateral>-threshold)lateral=0;
    return {legacySpeed:speed,gear,lateral,steering:0,wheelEffect:0};
  }
  speed=q(Math.max(0,q(speed-q(q(ENDING_ACCELERATION*q(dt))*q(3)))));
  return {legacySpeed:speed,gear,lateral,steering:0,wheelEffect:speed>0?1:0};
}
export function raceClockCentiseconds(ticks:number):number{return Math.floor(ticks*100/RACE_HZ);}
export function raceRemainingSeconds(state:Readonly<RaceFlow>):number{return Math.ceil(state.remainingTicks/RACE_HZ);}
