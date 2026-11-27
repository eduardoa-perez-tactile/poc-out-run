import {math} from '@gameengine/runtime';
import type {ReadonlySourceBiomeData,TerrainDriverValue,CrashDriverValue} from '../schema.gen.ts';
import {advanceDriving,type DrivingControls} from './driving-math.ts';
import {nearestTerrainRoad,terrainWheelContact,terrainHandlingCap,terrainCentrifugalDelta,boundTerrainLateral,
  terrainSkidding,RECENTER_RATE,RECENTER_TOLERANCE,type TerrainDrivingSample,type TerrainDrivingResult} from './terrain-math.ts';
import {finishCrashRecoveryAtCamera} from './crash-recovery-math.ts';
import {sourceRouteCameraAssignment} from './route-math.ts';

const q=math.fround;
export interface RoutePlayerPreparation {
  readonly source:TerrainDrivingSample;readonly terrain:TerrainDriverValue;readonly crash:CrashDriverValue;
  readonly driving:TerrainDrivingResult['driving'];readonly input:Readonly<DrivingControls>;
  readonly dt:number;readonly cap:number;readonly mode:'paused'|'ordinary'|'recenter'|'recovery';
  readonly lockedThisTick:boolean;readonly eligibleThrottle:boolean;
  /** Source integer assignment BEFORE camera modulo, for continuous route CCD. */
  readonly unwrappedCamera:number;
}
export interface RoutePlayerResult extends TerrainDrivingResult {
  crash:CrashDriverValue;lockedThisTick:boolean;handoff:boolean;motionMode:'none'|'sweep'|'endpoint';
}
export interface RoutePlayerEntry {readonly outgoingCamera:number}
function need(condition:boolean,message:string):asserts condition {if(!condition)throw new Error('Route driving: '+message);}
function point(camera:number,data:ReadonlySourceBiomeData){
  const index=Math.floor((camera+data.playerOffsetZ)/data.segmentLength)%data.totalCount;
  const row=data.segments[index];need(row!==undefined,'missing source player row');return{index,row};
}
function sample(source:TerrainDrivingSample):TerrainDrivingResult['driving'] {
  return {distance:source.distance,lateral:source.lateral,legacySpeed:source.legacySpeed,gear:source.gear,
    steering:source.steering,playing:source.playing};
}
/** Controls and exactly ONE source integer longitudinal assignment. No row-dependent
 * finish, route commit, RNG, contact, reaction clock or spin counter is advanced here. */
export function prepareRoutePlayerTick(source:TerrainDrivingSample,terrain:TerrainDriverValue,crash:CrashDriverValue,
  input:Readonly<DrivingControls>,dt:number,outgoing:ReadonlySourceBiomeData):RoutePlayerPreparation {
  need(terrain.mapId===outgoing.id&&crash.mapId===outgoing.id,'owner maps differ');
  need(outgoing.id>=1&&outgoing.id<=16&&outgoing.segmentLength===150&&outgoing.playerOffsetZ===702,'unsupported source data');
  need(q(dt)===q(1/60),'requires nominal60Hz');
  need(Number.isInteger(source.distance)&&source.distance>=0&&source.distance<outgoing.totalCount*150,'camera must be source integer');
  need([source.lateral,source.legacySpeed,source.steering,terrain.previousGap].every(Number.isFinite),'nonfinite actor');
  need(source.legacySpeed>=0&&source.legacySpeed<=200&&Number.isInteger(crash.phase)&&crash.phase>=0&&crash.phase<=3,'invalid physical state');
  const start=point(source.distance,outgoing),driver={...terrain,sectionEnd:false};
  if(!driver.initialized){driver.initialized=true;driver.previousGap=start.row.gap;driver.roadSide=nearestTerrainRoad(source.lateral,start.row.gap);}
  const contact=terrainWheelContact(source.lateral,start.row.gap,outgoing.terrain,outgoing.roadTerrain);
  const cap=crash.phase!==0?crash.handlingCap:terrainHandlingCap(source.gear,contact,outgoing.terrain);
  const base={source:{...source},terrain:driver,crash:{...crash},input:{...input},dt:q(dt),cap,lockedThisTick:crash.phase!==0,eligibleThrottle:false,unwrappedCamera:source.distance};
  if(!source.playing)return {...base,driving:sample(source),mode:'paused'};
  if(crash.phase!==0){
    const step=crash.phase===1?sourceRouteCameraAssignment(source.distance,source.legacySpeed,crash.kind===2,outgoing.totalCount):{camera:source.distance,assignedCamera:source.distance};
    return {...base,driving:{...sample(source),distance:step.camera},unwrappedCamera:step.assignedCamera,mode:'recovery'};
  }
  const outside=contact.leftOutside||contact.rightOutside;
  if(driver.recentering||(source.legacySpeed<=0&&outside))return {...base,driving:sample(source),mode:'recenter'};
  const moved=advanceDriving(source,{...input,throttle:input.throttle&&!outside},source.manual,q(dt),false);
  const step=sourceRouteCameraAssignment(source.distance,moved.legacySpeed,false,outgoing.totalCount);
  const driving={...sample(source),...moved,distance:step.camera};
  return {...base,driving,unwrappedCamera:step.assignedCamera,mode:moved.legacySpeed<=0&&outside?'recenter':'ordinary',
    eligibleThrottle:!input.brake&&input.throttle&&!outside&&source.legacySpeed<=(source.gear===0?100:200)};
}
/** Destination physics finishing only. Handoff is endpoint occupancy, never a
 * swept chord across map relocation. Non-entry motion Z stays UNWRAPPED through
 * camera modulo; motionMode tells the route sampler to split actual lap jumps.
 * Actual held input is retained by the caller. */
export function finishRoutePlayerTick(prepared:RoutePlayerPreparation,destination:ReadonlySourceBiomeData,
  entry:RoutePlayerEntry|null):RoutePlayerResult {
  const handoff=entry!==null;
  need(destination.id>=1&&destination.id<=16,'invalid destination');
  need(handoff?destination.id!==prepared.terrain.mapId:destination.id===prepared.terrain.mapId,'unexpected destination map');
  if(entry)need(entry.outgoingCamera===prepared.driving.distance,'handoff camera mismatch');
  const camera=handoff?0:prepared.driving.distance;
  let driving={...prepared.driving,distance:camera},driver={...prepared.terrain,mapId:destination.id,sectionEnd:false};
  let crash={...prepared.crash,mapId:destination.id};
  const landing=point(camera,destination);
  if(handoff){
    driver.previousGap=landing.row.gap;
    driver.roadSide=nearestTerrainRoad(driving.lateral,landing.row.gap);
    // Source Map728–740 derives a center each tick, not a captured target.
    // Reanchor the port latch to destination terrain (explicit adaptation);
    // impact operands/counters/lifetime and RNG remain unchanged.
    if(crash.phase===3)crash.recenterTarget=driver.roadSide===0?0:q(landing.row.gap/1600);
    if(driver.recentering)driver.recenterTarget=driver.roadSide===0?0:q(landing.row.gap/1600);
  }
  if(prepared.mode==='paused')return {driving,driver,crash,lockedThisTick:prepared.lockedThisTick,handoff,motionMode:'none'};
  if(prepared.mode==='recovery'){
    const source={...prepared.source,distance:handoff?0:prepared.source.distance};
    const result=finishCrashRecoveryAtCamera(crash,source,driver,destination,prepared.dt,camera,source.distance);
    // The shared finisher receives wrapped physical camera. Only trace Z is
    // restored to the already-computed raw step: no second integration.
    const motion=result.motion?{...result.motion,z0:(handoff?0:prepared.source.distance)+702,
      z1:(handoff?0:prepared.unwrappedCamera)+702}:undefined;
    return {...result,motion,handoff,motionMode:handoff?'endpoint':'sweep'};
  }
  const previousGap=driver.previousGap,l0=prepared.source.lateral;
  let ls=driving.lateral,lc=ls,lr=ls,drift=0,carryApplied=false;
  const diagnostics=(smoke:boolean)=>{
    const {index,row}=point(driving.distance,destination);
    const contact=terrainWheelContact(driving.lateral,row.gap,destination.terrain,destination.roadTerrain);
    const effect=(surface:number)=>driving.legacySpeed<=0?0:surface>=2?surface:smoke?1:surface;
    driver={...driver,segment:index,previousGap:row.gap,roadSide:nearestTerrainRoad(driving.lateral,row.gap),
      leftOutside:contact.leftOutside,rightOutside:contact.rightOutside,
      leftEffect:effect(contact.leftEffect),rightEffect:effect(contact.rightEffect)};
  };
  if(prepared.mode==='recenter'){
    if(!driver.recentering){driver.recentering=true;
      driver.recenterTarget=nearestTerrainRoad(driving.lateral,landing.row.gap)===0?0:q(landing.row.gap/1600);}
    driving.legacySpeed=0;driving.steering=0;driver.skidding=false;
    const error=q(driving.lateral-driver.recenterTarget);
    if(Math.abs(error)<=RECENTER_TOLERANCE)driver.recentering=false;
    else driving.lateral=q(driving.lateral+(error<0?1:-1)*Math.min(Math.abs(error),q(RECENTER_RATE*prepared.dt)));
    ls=driving.lateral;lc=ls;lr=ls;diagnostics(false);
  }else{
    carryApplied=driving.legacySpeed>=30.5&&driver.roadSide===1;
    lc=carryApplied?q(ls+q(q(landing.row.gap-previousGap)/1600)):ls;
    drift=terrainCentrifugalDelta(driving.legacySpeed,prepared.cap,landing.row.curve,landing.row.mirror,driver.roadSide,prepared.dt);
    lr=q(lc+drift);driving.lateral=boundTerrainLateral(lr,landing.row.gap,landing.row.mirror,driver.roadSide);
    const contact=terrainWheelContact(driving.lateral,landing.row.gap,destination.terrain,destination.roadTerrain);
    driver.skidding=terrainSkidding(driving.legacySpeed,driving.steering,landing.row.curve,prepared.dt,contact);
    diagnostics(driver.skidding||prepared.input.brake||(prepared.eligibleThrottle&&driving.legacySpeed<50));
  }
  return {driving,driver,crash,lockedThisTick:false,handoff,motionMode:handoff?'endpoint':'sweep',motion:{
    z0:(handoff?0:prepared.source.distance)+702,z1:(handoff?0:prepared.unwrappedCamera)+702,l0,ls,lc,lr,lf:driving.lateral,
    drift,previousGap,carryApplied,handlingCap:prepared.cap}};
}
