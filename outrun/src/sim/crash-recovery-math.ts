import {math} from '@gameengine/runtime';
import type {CrashDriverValue,ContactAcceptedValue,TerrainDriverValue,ReadonlySourceBiomeData} from '../schema.gen.ts';
import {nearestTerrainRoad,terrainWheelContact,terrainCentrifugalDelta,boundTerrainLateral,RECENTER_RATE,RECENTER_TOLERANCE,
  type TerrainDrivingSample,type TerrainDrivingResult,type TerrainMotionTrace} from './terrain-math.ts';

const q=math.fround;
export interface CrashRecoveryResult {
  crash:CrashDriverValue;driving:TerrainDrivingResult['driving'];driver:TerrainDriverValue;
  motion?:TerrainMotionTrace;lockedThisTick:boolean;
}
function require(ok:boolean,message:string):asserts ok{if(!ok)throw new Error(`Crash recovery: ${message}`);}
function speed(value:number){require(Number.isFinite(value)&&value>=0&&value<=200,'speed outside0..200');return q(value);}
export function crashLapCount(value:number):1|2|3|4{
  const v=speed(value);return v<=20?1:v<=60?2:v<=120?3:4;
}
export function crashCadence(value:number):3|4|5|6{
  const v=speed(value);require(v>0,'spin cadence requires positive speed');return v>=100?3:v>=60?4:v>=20?5:6;
}
export function resetCrashRecovery(mapId=1):CrashDriverValue{
  require(mapId===1,'unsupported map');
  return emptyCrashRecovery(mapId);
}
export function resetRouteCrashRecovery(mapId:number):CrashDriverValue{
  require(Number.isInteger(mapId)&&mapId>=1&&mapId<=16,'unsupported route map');
  return emptyCrashRecovery(mapId);
}
function emptyCrashRecovery(mapId:number):CrashDriverValue{
  return {mapId,phase:0,consumedAcceptedCount:0,pendingStep:0,variant:0,kind:0,impactSpeed:0,handlingCap:0,collisionDir:0,curve:0,
    totalAdvances:0,advances:0,cadenceTick:0,decrement:0,reactionTick:0,recenterTarget:0};
}
/** Latch only. The ordinary hit-tick pose belongs to AdvanceDriving, not this helper. */
export function beginCrashRecovery(previous:CrashDriverValue,contact:Readonly<Pick<ContactAcceptedValue,'mapId'|'kind'|'impactSpeed'|'handlingCap'|'collisionDir'|'curve'>>,variant:0|1,acceptedCount:number):CrashDriverValue{
  return beginRecovery(previous,contact,variant,acceptedCount,false);
}
export function beginRouteCrashRecovery(previous:CrashDriverValue,contact:Readonly<Pick<ContactAcceptedValue,'mapId'|'kind'|'impactSpeed'|'handlingCap'|'collisionDir'|'curve'>>,variant:0|1,acceptedCount:number):CrashDriverValue{
  return beginRecovery(previous,contact,variant,acceptedCount,true);
}
function beginRecovery(previous:CrashDriverValue,contact:Readonly<Pick<ContactAcceptedValue,'mapId'|'kind'|'impactSpeed'|'handlingCap'|'collisionDir'|'curve'>>,variant:0|1,acceptedCount:number,route:boolean):CrashDriverValue{
  require(previous.phase===0,'cannot begin while locked');
  require(contact.mapId===previous.mapId&&(route?Number.isInteger(contact.mapId)&&contact.mapId>=1&&contact.mapId<=15:contact.mapId===1),'contact map mismatch');
  require(variant===0||variant===1,'invalid spin variant');
  require(Number.isInteger(acceptedCount)&&acceptedCount>0&&acceptedCount<=0xffffffff&&acceptedCount===previous.consumedAcceptedCount+1,'incoherent acceptance count');
  require(contact.kind===1||contact.kind===2,'invalid contact kind');
  const impact=speed(contact.impactSpeed);
  require([75,100,200].includes(contact.handlingCap),'invalid captured handling cap');
  require(Number.isFinite(contact.collisionDir)&&Number.isFinite(contact.curve),'nonfinite captured drift');
  const total=impact>0?crashLapCount(impact)*8:0;
  return {...emptyCrashRecovery(previous.mapId),phase:impact>0?1:2,consumedAcceptedCount:acceptedCount,
    variant,kind:contact.kind,impactSpeed:impact,handlingCap:q(contact.handlingCap),collisionDir:q(contact.collisionDir),curve:q(contact.curve),
    totalAdvances:total,decrement:total>0?q(impact/total):0};
}

/** One locked fixed tick, replacing ordinary terrain integration. No inputs/RNG/render clock. */
export function advanceCrashRecovery(previous:CrashDriverValue,source:TerrainDrivingSample,terrain:TerrainDriverValue,
  data:ReadonlySourceBiomeData,dt:number):CrashRecoveryResult{
  return advanceRecovery(previous,source,terrain,data,dt);
}
/** Route movement has already happened exactly once, before destination recovery.
 * This entry finishes the same recovery phases without proof endpoint cancellation.
 * originCamera is in the destination domain (zero on a biome handoff).
 */
export function finishCrashRecoveryAtCamera(previous:CrashDriverValue,source:TerrainDrivingSample,terrain:TerrainDriverValue,
  data:ReadonlySourceBiomeData,dt:number,preparedCamera:number,originCamera:number):CrashRecoveryResult{
  require([preparedCamera,originCamera].every(value=>Number.isInteger(value)&&value>=0&&value<data.totalCount*data.segmentLength),'invalid prepared route camera');
  return advanceRecovery(previous,source,terrain,data,dt,{camera:preparedCamera,originCamera});
}
function advanceRecovery(previous:CrashDriverValue,source:TerrainDrivingSample,terrain:TerrainDriverValue,
  data:ReadonlySourceBiomeData,dt:number,route?:Readonly<{camera:number;originCamera:number}>):CrashRecoveryResult{
  require(route!==undefined
    ?Number.isInteger(data.id)&&data.id>=1&&data.id<=16&&previous.mapId===data.id&&terrain.mapId===data.id
    :previous.mapId===1&&terrain.mapId===1&&data.id===1,'unsupported recovery map');
  require(Number.isFinite(dt)&&dt>0,'invalid fixed dt');
  require(Number.isInteger(previous.phase)&&previous.phase>=0&&previous.phase<=3,'invalid phase');
  require([source.distance,source.lateral,source.steering,terrain.previousGap].every(Number.isFinite),'nonfinite physical pose');
  speed(source.legacySpeed);
  let driving:TerrainDrivingResult['driving']={distance:q(source.distance),lateral:q(source.lateral),legacySpeed:q(source.legacySpeed),
    gear:source.gear,steering:q(source.steering),playing:source.playing};
  if(route)driving.distance=route.camera;
  const limit=q(data.lastLine*data.segmentLength);
  require(limit>0&&source.distance>=0,'invalid camera bound');
  const point=(distance:number)=>{
    const sampled=Math.floor(q(distance+data.playerOffsetZ)/data.segmentLength);
    const segment=route?sampled%data.totalCount:sampled,row=data.segments[segment];
    require(row!==undefined,'player outside source rows');return{segment,row};
  };
  const diagnostics=(next:TerrainDriverValue,hidden:boolean,movingSpin:boolean)=>{
    const {segment,row}=point(driving.distance),contact=terrainWheelContact(driving.lateral,row.gap,data.terrain,data.roadTerrain);
    return {...next,initialized:true,segment,previousGap:row.gap,roadSide:nearestTerrainRoad(driving.lateral,row.gap),
      leftOutside:contact.leftOutside,rightOutside:contact.rightOutside,leftEffect:movingSpin?1:0,rightEffect:movingSpin?1:0,
      skidding:false,recentering:hidden};
  };
  // Endpoint cancellation also runs when the game was already paused there.
  if(!route&&(terrain.sectionEnd||driving.distance>=limit)){
    driving={...driving,distance:limit,legacySpeed:0,gear:0,steering:0,playing:false};
    return {crash:resetCrashRecovery(previous.mapId),driving,driver:diagnostics({...terrain,sectionEnd:true,recenterTarget:0},false,false),lockedThisTick:false};
  }
  const locked=previous.phase!==0;
  if(!source.playing||!locked)return {crash:previous,driving,driver:terrain,lockedThisTick:locked};
  require([75,100,200].includes(previous.handlingCap),'invalid persisted handling cap');
  require([previous.collisionDir,previous.curve,previous.decrement,previous.recenterTarget].every(Number.isFinite),'nonfinite recovery operand');
  let crash={...previous},driver={...terrain,sectionEnd:false},ls=driving.lateral,lc=ls,lr=ls,drift=0,carryApplied=false;
  const l0=driving.lateral,z0=q((route?route.originCamera:driving.distance)+data.playerOffsetZ),previousGap=q(terrain.previousGap);
  driving.steering=0;
  if(previous.phase===1){
    require([8,16,24,32].includes(previous.totalAdvances)&&Number.isInteger(previous.advances)&&previous.advances>=0&&previous.advances<previous.totalAdvances,'invalid spin advances');
    const before=speed(driving.legacySpeed),period=crashCadence(before);
    require(Number.isInteger(previous.cadenceTick)&&previous.cadenceTick>=0&&previous.cadenceTick<period&&previous.decrement>0,'invalid cadence state');
    require(previous.kind===1||previous.kind===2,'invalid spin direction kind');
    if(!route){
      const delta=q(before*60*dt),distanceDelta=previous.kind===2?q(delta*q(.5)):delta;
      driving.distance=q(Math.max(0,Math.min(limit,q(driving.distance+(previous.kind===2?-distanceDelta:distanceDelta)))));
      if(driving.distance>=limit){
        driving={...driving,legacySpeed:0,gear:0,steering:0,playing:false};
        return {crash:resetCrashRecovery(previous.mapId),driving,driver:diagnostics({...driver,sectionEnd:true,recenterTarget:0},false,false),lockedThisTick:false};
      }
    }
    crash.cadenceTick++;
    if(crash.cadenceTick===period){
      crash.cadenceTick=0;crash.advances++;
      driving.legacySpeed=crash.advances===crash.totalAdvances?0:q(Math.max(0,q(before-q(crash.decrement))));
    }
    const after=driving.legacySpeed,ratio=Math.min(q(after/crash.handlingCap),1);
    const curve=Math.abs(crash.curve===0?q(1.67):q(crash.curve));
    const collisionDelta=q(q(q(ratio*q(.2))*curve)*dt);
    ls=q(driving.lateral+(crash.collisionDir>=0?-collisionDelta:collisionDelta));
    const {row}=point(driving.distance),side=nearestTerrainRoad(ls,row.gap);
    carryApplied=after>=30.5&&side===1;
    lc=carryApplied?q(ls+q(q(row.gap-previousGap)/1600)):ls;
    drift=terrainCentrifugalDelta(after,crash.handlingCap,row.curve,row.mirror,side,dt);
    lr=q(lc+drift);driving.lateral=boundTerrainLateral(lr,row.gap,row.mirror,side);
    if(crash.advances===crash.totalAdvances){
      driving.legacySpeed=0;driving.gear=0;crash.phase=2;crash.reactionTick=0;crash.collisionDir=0;crash.curve=0;
    }
  }else if(previous.phase===2){
    require(Number.isInteger(previous.reactionTick)&&previous.reactionTick>=0&&previous.reactionTick<105,'invalid reaction counter');
    driving.legacySpeed=0;driving.gear=0;crash.collisionDir=0;crash.curve=0;
    crash.reactionTick++;
    if(crash.reactionTick===105){
      const {row}=point(driving.distance);crash.phase=3;
      crash.recenterTarget=nearestTerrainRoad(driving.lateral,row.gap)===0?0:q(row.gap/1600);
    }
  }else{
    driving.legacySpeed=0;driving.gear=0;
    const error=q(driving.lateral-crash.recenterTarget);
    if(Math.abs(error)<=RECENTER_TOLERANCE)crash.phase=0;
    else driving.lateral=q(driving.lateral+(error<0?1:-1)*Math.min(Math.abs(error),q(RECENTER_RATE*dt)));
    ls=driving.lateral;lc=ls;lr=ls;
  }
  if(previous.phase!==1){ls=driving.lateral;lc=ls;lr=ls;}
  driver=diagnostics({...driver,recenterTarget:crash.recenterTarget},crash.phase===3,crash.phase===1&&driving.legacySpeed>0);
  return {crash,driving,driver,lockedThisTick:true,motion:{z0,z1:q(driving.distance+data.playerOffsetZ),l0,ls,lc,lr,lf:driving.lateral,
    drift,previousGap,carryApplied,handlingCap:crash.handlingCap}};
}
