import {math} from '@gameengine/runtime';
import type {ReadonlySourceBiomeData,TerrainDriverValue} from '../schema.gen.ts';
import {advanceDriving,LEGACY_UPDATES_PER_SECOND,type DrivingSample,type DrivingControls} from './driving-math.ts';

const f=math.fround;
export const TERRAIN_ROAD_WIDTH=1600;
export const WHEEL_HALF_TRACK=210;
export const WHEEL_CONTACT_HALF_WIDTH=1831;
export const RECENTER_RATE=f(.72);
export const RECENTER_TOLERANCE=f(.05);
export interface TerrainDrivingSample extends DrivingSample {distance:number;playing:boolean;manual:boolean}
export interface TerrainDrivingResult {
  driving:DrivingSample&{distance:number;playing:boolean};
  driver:TerrainDriverValue;
}
export interface WheelContact {leftOutside:boolean;rightOutside:boolean;leftEffect:number;rightEffect:number}

export function resetTerrainDriver(mapId=1):TerrainDriverValue {
  if(mapId!==1)throw new Error(`Unsupported terrain map ${mapId}`);
  return {mapId,segment:0,roadSide:0,previousGap:0,initialized:false,leftOutside:false,rightOutside:false,
    leftEffect:0,rightEffect:0,skidding:false,recentering:false,recenterTarget:0,sectionEnd:false};
}
export function nearestTerrainRoad(lateral:number,gap:number):0|1 {
  const x=f(lateral*TERRAIN_ROAD_WIDTH);
  return Math.abs(x)<=Math.abs(f(x-gap))?0:1;
}
export function terrainWheelContact(lateral:number,gap:number,terrain:number,roadTerrain=0):WheelContact {
  const x=f(lateral*TERRAIN_ROAD_WIDTH);
  const outside=(wheel:number)=>wheel < -WHEEL_CONTACT_HALF_WIDTH||wheel > f(gap+WHEEL_CONTACT_HALF_WIDTH)||
    (gap>2*WHEEL_CONTACT_HALF_WIDTH&&wheel>WHEEL_CONTACT_HALF_WIDTH&&wheel<f(gap-WHEEL_CONTACT_HALF_WIDTH));
  const leftOutside=outside(f(x-WHEEL_HALF_TRACK)),rightOutside=outside(f(x+WHEEL_HALF_TRACK));
  const surface=(id:number)=>id>=1&&id<=4?id+1:0;
  return {leftOutside,rightOutside,leftEffect:surface(leftOutside?terrain:roadTerrain),rightEffect:surface(rightOutside?terrain:roadTerrain)};
}
export function terrainHandlingCap(gear:number,contact:WheelContact,terrain:number):number {
  return (contact.leftOutside||contact.rightOutside)&&terrain>=1&&terrain<=4?75:gear===0?100:200;
}
export function terrainCentrifugalDelta(speed:number,cap:number,curve:number,mirror:boolean,roadSide:number,dt:number):number {
  if(speed<30.5)return 0;
  const coefficient=speed<100?f(.5):f(f(speed-50)/90);
  const delta=f(f(f(curve*f(Math.min(f(speed/cap),1)))*coefficient)*dt);
  return roadSide===1&&mirror?delta:f(-delta);
}
export function boundTerrainLateral(lateral:number,gap:number,mirror:boolean,roadSide:number):number {
  const center=f(gap/TERRAIN_ROAD_WIDTH);
  let x=f(Math.max(-1.5,Math.min(f(1.5+center),lateral)));
  // This source inner-gap rule is separate from the narrower wheel-contact gap.
  if(mirror&&center>3.5&&x>1.75&&x<f(center-1.75))x=roadSide===0?f(1.73):f(center-f(1.73));
  return x;
}
export function terrainSkidding(speed:number,steering:number,curve:number,dt:number,contact:WheelContact):boolean {
  return !contact.leftOutside&&!contact.rightOutside&&speed>70&&Math.abs(curve)>=2.75&&
    Math.abs(steering)>=f(f(speed*dt)*f(.8));
}

export function advanceTerrainDriving(driving:TerrainDrivingSample,previous:TerrainDriverValue,input:DrivingControls,dt:number,data:ReadonlySourceBiomeData):TerrainDrivingResult {
  if(previous.mapId!==1||data.id!==previous.mapId)throw new Error(`Unsupported terrain map ${previous.mapId}/${data.id}`);
  if(!Number.isFinite(dt)||dt<0)throw new Error('Terrain step needs finite nonnegative dt');
  const driver={...previous};
  let current:TerrainDrivingResult['driving']={legacySpeed:driving.legacySpeed,gear:driving.gear,steering:driving.steering,
    lateral:driving.lateral,distance:driving.distance,playing:driving.playing};
  if(driver.initialized&&!current.playing)return {driving:current,driver};
  const limit=f(data.lastLine*data.segmentLength);
  current.distance=f(Math.max(0,Math.min(limit,current.distance)));
  const sample=(distance:number)=>{
    const index=Math.floor(f(distance+data.playerOffsetZ)/data.segmentLength);
    const row=data.segments[index];
    if(!row)throw new Error(`Terrain player segment ${index} is outside map data`);
    return {index,row};
  };
  let point=sample(current.distance);
  if(!driver.initialized){
    driver.initialized=true;driver.previousGap=point.row.gap;driver.roadSide=nearestTerrainRoad(current.lateral,point.row.gap);
  }
  const updateContact=(smoke=false)=>{
    const contact=terrainWheelContact(current.lateral,point.row.gap,data.terrain,data.roadTerrain);
    driver.segment=point.index;driver.previousGap=point.row.gap;
    driver.roadSide=nearestTerrainRoad(current.lateral,point.row.gap);
    driver.leftOutside=contact.leftOutside;driver.rightOutside=contact.rightOutside;
    const effect=(outside:boolean,surface:number)=>current.legacySpeed<=0?0:outside&&surface>=2?surface:smoke?1:surface;
    driver.leftEffect=effect(contact.leftOutside,contact.leftEffect);
    driver.rightEffect=effect(contact.rightOutside,contact.rightEffect);
    return contact;
  };
  const endSection=()=>{
    current={...current,distance:limit,legacySpeed:0,steering:0,playing:false};
    driver.sectionEnd=true;driver.recentering=false;driver.skidding=false;
    point=sample(limit);updateContact();
    return {driving:current,driver};
  };
  if(driver.sectionEnd||current.distance>=limit)return endSection();
  const preContact=terrainWheelContact(current.lateral,point.row.gap,data.terrain,data.roadTerrain);
  if(!current.playing){driver.skidding=false;updateContact();return {driving:current,driver};}
  const recenter=()=>{
    if(!driver.recentering){
      driver.recentering=true;
      driver.recenterTarget=nearestTerrainRoad(current.lateral,point.row.gap)===0?0:f(point.row.gap/TERRAIN_ROAD_WIDTH);
    }
    current.legacySpeed=0;current.steering=0;driver.skidding=false;
    const error=f(current.lateral-driver.recenterTarget);
    if(Math.abs(error)<=RECENTER_TOLERANCE)driver.recentering=false;
    else current.lateral=f(current.lateral+(error<0?1:-1)*Math.min(Math.abs(error),f(RECENTER_RATE*dt)));
    updateContact();
    return {driving:current,driver};
  };
  if(driver.recentering||(current.legacySpeed<=0&&(preContact.leftOutside||preContact.rightOutside)))return recenter();
  const cap=terrainHandlingCap(current.gear,preContact,data.terrain);
  const offRoad=preContact.leftOutside||preContact.rightOutside;
  const eligibleThrottle=!input.brake&&input.throttle&&!offRoad&&current.legacySpeed<=(current.gear===0?100:200);
  const moved=advanceDriving(current,{...input,throttle:input.throttle&&!offRoad},driving.manual,dt,false);
  current={...current,...moved,distance:f(Math.min(limit,f(current.distance+f(moved.legacySpeed*LEGACY_UPDATES_PER_SECOND*dt))))};
  point=sample(current.distance);
  if(current.distance>=limit)return endSection();
  if(current.legacySpeed<=0&&offRoad)return recenter();
  const previousSide=driver.roadSide;
  if(current.legacySpeed>=30.5&&previousSide===1)current.lateral=f(current.lateral+f(f(point.row.gap-driver.previousGap)/TERRAIN_ROAD_WIDTH));
  current.lateral=f(current.lateral+terrainCentrifugalDelta(current.legacySpeed,cap,point.row.curve,point.row.mirror,previousSide,dt));
  current.lateral=boundTerrainLateral(current.lateral,point.row.gap,point.row.mirror,previousSide);
  const postContact=terrainWheelContact(current.lateral,point.row.gap,data.terrain,data.roadTerrain);
  driver.skidding=terrainSkidding(current.legacySpeed,current.steering,point.row.curve,dt,postContact);
  updateContact(driver.skidding||input.brake||(eligibleThrottle&&current.legacySpeed<50));
  return {driving:current,driver};
}
