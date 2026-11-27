import {math} from '@gameengine/runtime';
import type {TrafficPoolValue,RouteTrafficCoordinatesValue,ReadonlySourceBiomeData} from '../schema.gen.ts';
import {sampleRouteZ} from './route-space.ts';
import {routeTrafficInteger} from './route-traffic-math.ts';

export interface RouteTrafficIdentity {readonly mapId:number;readonly routeEpoch:number;readonly mapEpoch:number;}
const ARRAYS=['z','previousZ','offset','previousOffset','speed','target','side','ai','active','generation','passed','moving','cooldown','parked','motionTicks']as const;
function require(value:unknown,message:string):asserts value {if(!value)throw new Error('Route traffic state: '+message);}
function uint(value:number,min=0):boolean{return Number.isInteger(value)&&value>=min&&value<=0xffffffff;}
function validatePool(pool:Readonly<TrafficPoolValue>,identity:RouteTrafficIdentity,data:ReadonlySourceBiomeData):void {
  require(Number.isInteger(identity.mapId)&&identity.mapId>=1&&identity.mapId<=16&&identity.mapId===pool.mapId&&identity.mapId===data.id,'map identity mismatch');
  require(uint(identity.routeEpoch,1)&&uint(identity.mapEpoch,1),'invalid route epochs');
  require(pool.initialized===true&&uint(pool.epoch,1),'raw pool must be initialized');
  require(pool.population===9||pool.population===20||pool.population===32,'invalid population');
  sampleRouteZ(data,0);
  for(const field of ARRAYS)require(pool[field].length===32&&pool[field].every(Number.isFinite),field+' needs32 finite lanes');
  for(let slot=0;slot<32;slot++){
    require(pool.parked[slot]===0||pool.parked[slot]===1,'invalid parked flag');
    require(uint(pool.generation[slot]!,slot<pool.population?1:0)&&(slot<pool.population||pool.generation[slot]===0),'invalid generation');
  }
}
function copy(pool:Readonly<TrafficPoolValue>):TrafficPoolValue {
  const next={...pool};for(const field of ARRAYS)next[field]=pool[field].slice();return next;
}
function raw(value:number):number {routeTrafficInteger(value);require(value>=0,'negative raw coordinate');return value;}
function mirror(data:ReadonlySourceBiomeData,value:number,parked:number):number {
  // Parked presentation is zero; authoritative parked history stays in coords.
  const sample=sampleRouteZ(data,raw(value));return parked!==0?0:math.fround(sample.canonicalZ);
}

/** Restore source int32 authority BEFORE SIM math. Mirrors are checked for
 * integrity, never used as a fallback or a source of raw/lap information. */
export function hydrateRouteTrafficPool(
  pool:Readonly<TrafficPoolValue>,coordinates:Readonly<RouteTrafficCoordinatesValue>,identity:RouteTrafficIdentity,data:ReadonlySourceBiomeData,
):TrafficPoolValue {
  validatePool(pool,identity,data);
  require(coordinates.initialized===true,'coordinate owner is uninitialized');
  require(coordinates.routeEpoch===identity.routeEpoch&&coordinates.mapEpoch===identity.mapEpoch,'stale coordinate epochs');
  require(coordinates.rawZ.length===32&&coordinates.previousRawZ.length===32,'coordinate arrays need32 lanes');
  const origin=routeTrafficInteger(coordinates.originZ);
  require(pool.originZ===math.fround(origin),'origin mirror mismatch');
  for(let slot=0;slot<32;slot++){
    require(pool.z[slot]===mirror(data,coordinates.rawZ[slot]!,pool.parked[slot]!),`current mirror mismatch slot${slot}`);
    require(pool.previousZ[slot]===mirror(data,coordinates.previousRawZ[slot]!,pool.parked[slot]!),`previous mirror mismatch slot${slot}`);
  }
  const next=copy(pool);next.originZ=origin;next.z=coordinates.rawZ.slice();next.previousZ=coordinates.previousRawZ.slice();return next;
}

/** Explicit reset/transaction publication. Plain rawPool may contain odd int32
 * values beyond f32 precision; only its outgoing presentation copy is rounded. */
export function packRouteTrafficPool(
  rawPool:Readonly<TrafficPoolValue>,identity:RouteTrafficIdentity,data:ReadonlySourceBiomeData,
):{pool:TrafficPoolValue;coordinates:RouteTrafficCoordinatesValue} {
  validatePool(rawPool,identity,data);const origin=routeTrafficInteger(rawPool.originZ);
  const current=rawPool.z.map(raw),previous=rawPool.previousZ.map(raw);
  const pool=copy(rawPool);pool.originZ=math.fround(origin);
  for(let slot=0;slot<32;slot++){
    pool.z[slot]=mirror(data,current[slot]!,pool.parked[slot]!);pool.previousZ[slot]=mirror(data,previous[slot]!,pool.parked[slot]!);
  }
  return {pool,coordinates:{initialized:true,routeEpoch:identity.routeEpoch,mapEpoch:identity.mapEpoch,originZ:origin,rawZ:current,previousRawZ:previous}};
}
