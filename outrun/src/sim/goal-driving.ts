import type {ReadonlySourceBiomeData,TerrainDriverValue,CrashDriverValue} from '../schema.gen.ts';
import type {TerrainDrivingSample} from './terrain-math.ts';
import {nearestTerrainRoad,terrainWheelContact} from './terrain-math.ts';
import {prepareRoutePlayerTick,finishRoutePlayerTick,type RoutePlayerPreparation,type RoutePlayerResult} from './route-driving-math.ts';
import {sourceRouteCameraAssignment} from './route-math.ts';
import {sampleRouteZ} from './route-space.ts';
import {advanceEndingMotion} from './race-flow-math.ts';

export type GoalDrivingMode=2|3|4; // existing recovery, source roll, source brake
const NO_CONTROLS=Object.freeze({throttle:false,brake:false,left:false,right:false,up:false,down:false});
function require(value:boolean,message:string):asserts value {if(!value)throw new Error('Goal driving: '+message);}

/** The race admission owns mode selection. Recovery retains the delivered
 * kernel; autopilot never runs ordinary throttle/coast or integrates Z twice. */
export function prepareGoalPlayerTick(
  source:TerrainDrivingSample,terrain:TerrainDriverValue,crash:CrashDriverValue,
  mode:GoalDrivingMode,dt:number,data:ReadonlySourceBiomeData,
):RoutePlayerPreparation {
  require(data.id===16&&terrain.mapId===16&&crash.mapId===16,'requires genuine goal owners');
  require(mode===2||mode===3||mode===4,'invalid ending mode');
  if(mode===2){
    require(crash.phase!==0,'ending recovery requires the existing running crash');
    return prepareRoutePlayerTick(source,terrain,crash,NO_CONTROLS,dt,data);
  }
  require(crash.phase===0,'autopilot cannot replace a running crash');
  // A paused preparation validates source units/physical operands and performs
  // no acceleration or camera assignment. It is not a second movement update.
  const base=prepareRoutePlayerTick({...source,playing:false},terrain,crash,NO_CONTROLS,dt,data);
  if(!source.playing)return base;
  const moved=advanceEndingMotion(mode===3?'roll':'brake',source,dt);
  const step=sourceRouteCameraAssignment(source.distance,moved.legacySpeed,false,data.totalCount);
  return {...base,source:{...source},mode:'ordinary',cap:200,lockedThisTick:false,eligibleThrottle:false,
    unwrappedCamera:step.assignedCamera,
    driving:{distance:step.camera,lateral:moved.lateral,legacySpeed:moved.legacySpeed,
      gear:moved.gear,steering:moved.steering,playing:true}};
}

/** Complete only row diagnostics for source ending autopilot. PlayerCar's
 * centering/braking already chose lateral/speed; ordinary CF, terrain clamps or
 * automatic recenter must not rewrite them. No handoff or new contact occurs. */
export function finishGoalPlayerTick(
  prepared:RoutePlayerPreparation,data:ReadonlySourceBiomeData,mode:GoalDrivingMode,
):RoutePlayerResult {
  require(data.id===16&&prepared.terrain.mapId===16&&prepared.crash.mapId===16,'requires genuine goal owners');
  require(mode===2||mode===3||mode===4,'invalid ending mode');
  if(mode===2||prepared.mode==='paused')return finishRoutePlayerTick(prepared,data,null);
  require(prepared.crash.phase===0,'autopilot cannot replace a running crash');
  const driving={...prepared.driving},point=sampleRouteZ(data,driving.distance+data.playerOffsetZ),row=data.segments[point.row]!;
  const contact=terrainWheelContact(driving.lateral,row.gap,data.terrain,data.roadTerrain);
  const effect=mode===4&&driving.legacySpeed>0?1:0;
  const driver={...prepared.terrain,initialized:true,segment:point.row,previousGap:row.gap,
    roadSide:nearestTerrainRoad(driving.lateral,row.gap),leftOutside:contact.leftOutside,rightOutside:contact.rightOutside,
    leftEffect:effect,rightEffect:effect,recentering:false,recenterTarget:0,sectionEnd:false,skidding:false};
  const lateral=driving.lateral;
  return {driving,driver,crash:{...prepared.crash},lockedThisTick:false,handoff:false,motionMode:'sweep',motion:{
    z0:prepared.source.distance+data.playerOffsetZ,z1:prepared.unwrappedCamera+data.playerOffsetZ,
    l0:prepared.source.lateral,ls:lateral,lc:lateral,lr:lateral,lf:lateral,
    drift:0,previousGap:prepared.terrain.previousGap,carryApplied:false,handlingCap:prepared.cap}};
}
