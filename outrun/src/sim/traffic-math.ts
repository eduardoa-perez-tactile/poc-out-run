import {math,type Rng} from '@gameengine/runtime';
import type {ReadonlySourceBiomeData,TrafficPoolValue,TrafficResetRequestedValue} from '../schema.gen.ts';
import type {TrafficContactDeparture} from './collision-motion.ts';
import {sampleRouteZ} from './route-space.ts';
import {sourceRouteTrafficZ,sourceRouteTransferZ} from './route-math.ts';
import {routeTrafficInteger,addRouteTrafficZ,routeCanonicalOvertake,validateTrafficRouteDomain,type TrafficRouteDomain} from './route-traffic-math.ts';
export type {TrafficRouteDomain} from './route-traffic-math.ts';

const f=math.fround;
export const TRAFFIC_CAPACITY=32;
export const TRAFFIC_PASS_POINTS=20000;
export const TRAFFIC_VIEW_SEGMENTS=200;
export const TRAFFIC_MOVE_SEGMENTS=1600;
export const TRAFFIC_NEAR_SEGMENTS=20;
export const TRAFFIC_LANE_LIMIT=f(.9);
export const TRAFFIC_SPAWN_LANE_LIMIT=f(6*f(.15));
export const TRAFFIC_AI_RATE=f(.3);
export const TRAFFIC_EVASIVE_COOLDOWN=200;
const ARRAY_FIELDS=['z','previousZ','offset','previousOffset','speed','target','side','ai','active','generation','passed','moving','cooldown','parked','motionTicks'] as const;
export type TrafficRandom=Pick<Rng,'range'>;
export type TrafficResetRequest=TrafficResetRequestedValue;
export interface TrafficPlayerSample {
  previousZ:number;z:number;previousLateral:number;lateral:number;previousSide:number;side:number;playing:boolean;
}
export interface TrafficPassCandidate {epoch:number;slot:number;generation:number;points:number;mapId?:number;routeEpoch?:number;mapEpoch?:number}
export interface TrafficStep {
  pool:TrafficPoolValue;passCandidates:TrafficPassCandidate[];recycleSlots:number[];
  /** Legacy terminal limit; route mode uses the canonical PERIOD, never a raw parking cutoff. */
  limitZ:number;
  /** Optional old-life sweep before terminal park overwrites interpolation history. */
  departures?:TrafficContactDeparture[];
  route?:TrafficRouteDomain;
}
export interface TrafficAdvanceOptions {suppressPass:boolean;captureContact?:boolean;route?:TrafficRouteDomain}

export function createEmptyTrafficPool():TrafficPoolValue {
  return {mapId:1,initialized:false,population:20,seedLo:305419896,seedHi:2596069104,originZ:0,aiCursor:1,epoch:0,
    z:Array(32).fill(0),previousZ:Array(32).fill(0),offset:Array(32).fill(0),previousOffset:Array(32).fill(0),
    speed:Array(32).fill(0),target:Array(32).fill(0),side:Array(32).fill(0),ai:Array(32).fill(0),active:Array(32).fill(0),
    generation:Array(32).fill(0),passed:Array(32).fill(0),moving:Array(32).fill(0),cooldown:Array(32).fill(0),parked:Array(32).fill(0),motionTicks:Array(32).fill(0)};
}
function population(value:number):void {
  if(value!==9&&value!==20&&value!==32)throw new Error(`Traffic population must be9/20/32, got ${value}`);
}
function sectionLimit(data:ReadonlySourceBiomeData,route?:TrafficRouteDomain):number {
  if(route){validateTrafficRouteDomain(route);sampleRouteZ(data,0);return data.totalCount*data.segmentLength;}
  const limit=f(data.lastLine*data.segmentLength);
  if(!(limit>0&&Number.isFinite(limit))||Math.floor(limit/data.segmentLength)>=data.segments.length)throw new Error('Invalid traffic section boundary');
  return limit;
}
function sameMap(mapId:number,data:ReadonlySourceBiomeData):void {
  if(mapId!==data.id)throw new Error(`Traffic map ${mapId} does not match data ${data.id}`);
}
function clonePool(pool:TrafficPoolValue):TrafficPoolValue {
  population(pool.population);
  const next={...pool};
  for(const name of ARRAY_FIELDS){
    if(pool[name].length!==32||!pool[name].every(Number.isFinite))throw new Error(`Traffic ${name} needs32 finite lanes`);
    next[name]=pool[name].slice();
  }
  return next;
}
export function trafficSegment(z:number,data:ReadonlySourceBiomeData,route?:TrafficRouteDomain):number {
  if(route)return sampleRouteZ(data,z).row;
  const index=Math.floor(z/data.segmentLength);
  if(!Number.isFinite(z)||z<0||index<0||index>=data.segments.length)throw new Error(`Traffic sample outside source data: ${z}`);
  return index;
}
export function trafficLogicalX(z:number,offset:number,side:number,data:ReadonlySourceBiomeData,route?:TrafficRouteDomain):number {
  if(!Number.isFinite(offset)||(side!==0&&side!==1))throw new Error('Invalid traffic lateral sample');
  const row=data.segments[trafficSegment(z,data,route)]!;
  return f(f(offset*1600)+(side===1?row.gap:0));
}
function cycle(cursor:number):number {return cursor===3?1:cursor+1;}
function maxHundreds(count:number):number {return count===9?7:count===20?9:11;}
function park(pool:TrafficPoolValue,slot:number,z:number,limit:number,route?:TrafficRouteDomain):void {
  pool.z[slot]=route?Math.max(0,routeTrafficInteger(z)):f(Math.max(0,Math.min(limit,z)));pool.previousZ[slot]=pool.z[slot]!;
  pool.previousOffset[slot]=pool.offset[slot]!;pool.active[slot]=0;pool.speed[slot]=0;pool.parked[slot]=1;
  pool.target[slot]=0;pool.moving[slot]=0;pool.cooldown[slot]=0;
}
function clearPhase(pool:TrafficPoolValue,slot:number):void {pool.target[slot]=0;pool.moving[slot]=0;pool.cooldown[slot]=0;pool.motionTicks[slot]=0;}

export function resetTrafficPool(previous:TrafficPoolValue,request:TrafficResetRequest,_player:TrafficPlayerSample,data:ReadonlySourceBiomeData,rng:TrafficRandom,route?:TrafficRouteDomain):TrafficPoolValue {
  population(request.population);sameMap(request.mapId,data);
  if(!Number.isFinite(request.originZ))throw new Error('Traffic origin must be finite');
  if(!Number.isInteger(previous.epoch)||previous.epoch<0||previous.epoch>=0xffffffff)throw new Error('Traffic reset epoch exhausted');
  const limit=sectionLimit(data,route),next=createEmptyTrafficPool();
  if(route){routeTrafficInteger(request.originZ);if(request.originZ<0)throw new Error('Negative traffic route origin');}
  Object.assign(next,{mapId:request.mapId,population:request.population,seedLo:request.seedLo,seedHi:request.seedHi,
    originZ:route?request.originZ:f(request.originZ),initialized:true,epoch:previous.epoch+1});
  next.aiCursor=rng.range(1,4);
  for(let slot=0;slot<next.population;slot++){
    next.generation[slot]=1;
    if(slot<6){
      const segments=slot===0?190:slot===1?170:slot===2?165:slot===3?160:slot===4?155:150;
      next.z[slot]=route?addRouteTrafficZ(next.originZ,segments*data.segmentLength):f(next.originZ+segments*data.segmentLength);next.speed[slot]=120;
      next.offset[slot]=slot===0?f(.5):slot===1?0:slot===2?f(-.5):slot===3?f(-.25):slot===4?0:f(.25);
      next.side[slot]=1;next.ai[slot]=next.aiCursor;next.aiCursor=cycle(next.aiCursor);
    }else{
      // Explicit source-order contract: Z, speed, offset, side. C++ argument
      // evaluation order/random_device sequences are not a reproducible oracle.
      next.aiCursor=cycle(next.aiCursor);next.ai[slot]=next.aiCursor;
      const distance=rng.range(5,maxHundreds(next.population)+1)*100*data.segmentLength;
      next.z[slot]=route?addRouteTrafficZ(next.originZ,distance):f(next.originZ+distance);
      next.speed[slot]=rng.range(10,17)*10;
      next.offset[slot]=f(rng.range(-6,7)*f(.15));next.side[slot]=rng.range(0,2);
    }
    next.previousZ[slot]=next.z[slot]!;next.previousOffset[slot]=next.offset[slot]!;
    if(next.z[slot]!<0||(!route&&next.z[slot]!>=limit))park(next,slot,next.z[slot]!,limit,route);
  }
  return next;
}

export function rebaseTrafficPool(pool:TrafficPoolValue,mapId:number,shift:number,data:ReadonlySourceBiomeData,route?:TrafficRouteDomain):TrafficPoolValue {
  sameMap(mapId,data);
  if(!Number.isFinite(shift))throw new Error('Traffic rebase shift must be finite');
  const next=clonePool(pool),limit=sectionLimit(data,route);next.mapId=mapId;
  if(route)routeTrafficInteger(shift);
  next.originZ=route?sourceRouteTransferZ(next.originZ,shift):f(next.originZ-shift);
  for(let slot=0;slot<next.population;slot++){
    const z=route?sourceRouteTransferZ(next.z[slot]!,shift):f(next.z[slot]!-shift);
    if(next.parked[slot]!==0||z<0||(!route&&z>=limit))park(next,slot,z,limit,route);
    else {next.z[slot]=z;next.previousZ[slot]=z;next.previousOffset[slot]=next.offset[slot]!;}
  }
  return next;
}

function approach(current:number,target:number,step:number):number {
  return f(current+Math.max(-step,Math.min(step,f(target-current))));
}
function moveAI(pool:TrafficPoolValue,slot:number,player:TrafficPlayerSample,data:ReadonlySourceBiomeData,dt:number,rng:TrafficRandom,route?:TrafficRouteDomain):void {
  const ai=pool.ai[slot]!,near=Math.abs(trafficSegment(pool.z[slot]!,data,route)-trafficSegment(player.previousZ,data,route))<=TRAFFIC_NEAR_SEGMENTS;
  if(ai===1)return; // Pacific never draws randomness or changes its lane.
  const step=f(TRAFFIC_AI_RATE*dt);
  if(ai===2){
    if(pool.cooldown[slot]!>0){pool.cooldown[slot]=pool.cooldown[slot]!-1;return;}
    if(!near)return;
    if(pool.moving[slot]===0){
      const offset=pool.offset[slot]!;
      const direction=offset>0?-1:offset<0?1:rng.range(0,2)===0?-1:1;
      pool.target[slot]=f(Math.max(-TRAFFIC_LANE_LIMIT,Math.min(TRAFFIC_LANE_LIMIT,f(offset+direction*f(.5)))));
      pool.moving[slot]=1;
    }
    pool.offset[slot]=approach(pool.offset[slot]!,pool.target[slot]!,step);
    if(pool.offset[slot]===pool.target[slot]){pool.moving[slot]=0;pool.cooldown[slot]=TRAFFIC_EVASIVE_COOLDOWN;}
  }else if(ai===3){
    if(!near||pool.side[slot]!==player.previousSide)return;
    const playerGap=data.segments[trafficSegment(player.previousZ,data,route)]!.gap;
    const playerOffset=f(player.previousLateral-(player.previousSide===1?f(playerGap/1600):0));
    const target=f(Math.max(-TRAFFIC_LANE_LIMIT,Math.min(TRAFFIC_LANE_LIMIT,playerOffset)));
    pool.target[slot]=target;pool.offset[slot]=approach(pool.offset[slot]!,target,step);pool.moving[slot]=pool.offset[slot]===target?0:1;
  }else throw new Error(`Invalid traffic AI ${ai}`);
}

export function advanceTrafficPool(pool:TrafficPoolValue,player:TrafficPlayerSample,data:ReadonlySourceBiomeData,dt:number,rng:TrafficRandom,options:TrafficAdvanceOptions):TrafficStep {
  sameMap(pool.mapId,data);
  const route=options.route,limit=sectionLimit(data,route);
  if(!pool.initialized)throw new Error('Traffic pool must be initialized before advancing');
  if(!Number.isFinite(dt)||dt<=0)throw new Error('Traffic step requires finite positive dt');
  const next=clonePool(pool),passCandidates:TrafficPassCandidate[]=[],recycleSlots:number[]=[];
  if(route){
    routeTrafficInteger(next.originZ);sampleRouteZ(data,player.previousZ);sampleRouteZ(data,player.z);
    for(let slot=0;slot<next.population;slot++){sampleRouteZ(data,next.z[slot]!);sampleRouteZ(data,next.previousZ[slot]!);}
  }
  if(!player.playing){const paused:TrafficStep={pool:next,passCandidates,recycleSlots,limitZ:limit};if(route)paused.route={...route};return paused;}
  if(route&&dt!==f(1/60))throw new Error('Source route traffic requires nominal60Hz dt');
  const departures:TrafficContactDeparture[]|undefined=options.captureContact&&!options.suppressPass&&!route?[]:undefined;
  const playerIndex=trafficSegment(player.previousZ,data,route);
  trafficSegment(player.z,data,route);
  // Known movement must validate before activation/AI RNG. Scratch only; invalid
  // actual random recycle additions are terminal errors, never caught/retried.
  let routeZs:number[]|undefined;
  if(route){
    routeZs=next.z.slice();
    for(let slot=0;slot<next.population;slot++){
      if(next.parked[slot]!==0)continue;
      if(next.speed[slot]!<0||next.speed[slot]!>160||Math.abs(next.offset[slot]!)>TRAFFIC_SPAWN_LANE_LIMIT)throw new Error(`Invalid traffic pose/speed in slot ${slot}`);
      if(Math.abs(trafficSegment(next.z[slot]!,data,route)-playerIndex)<=TRAFFIC_MOVE_SEGMENTS)routeZs[slot]=sourceRouteTrafficZ(next.z[slot]!,next.speed[slot]!);
    }
  }
  for(let slot=0;slot<next.population;slot++){
    const oldZ=next.z[slot]!,wasActive=next.active[slot]!==0;
    next.previousZ[slot]=oldZ;next.previousOffset[slot]=next.offset[slot]!;
    if(next.parked[slot]!==0)continue;
    if(oldZ<0||(!route&&oldZ>=limit)){park(next,slot,oldZ,limit,route);continue;}
    if(next.speed[slot]!<0||next.speed[slot]!>160||Math.abs(next.offset[slot]!)>TRAFFIC_SPAWN_LANE_LIMIT)throw new Error(`Invalid traffic pose/speed in slot ${slot}`);
    const oldIndex=trafficSegment(oldZ,data,route);
    if(Math.abs(oldIndex-playerIndex)<=TRAFFIC_MOVE_SEGMENTS)next.z[slot]=route?routeZs![slot]!:f(oldZ+f(next.speed[slot]!*60*dt));
    if(next.z[slot]!<0||(!route&&next.z[slot]!>=limit)){
      // Capture the SAME already computed advance, not a second integrator.
      // park deliberately replaces previousZ for presentation; contact retains
      // the valid old life only until this incoming terminal crossing.
      if(departures&&oldZ>=0&&oldZ<limit&&next.z[slot]!>=limit)departures.push({
        slot,epoch:next.epoch,generation:next.generation[slot]!,z0:oldZ,z1:next.z[slot]!,
        offset:next.previousOffset[slot]!,side:next.side[slot] as 0|1,
        until:(limit-oldZ)/(next.z[slot]!-oldZ),
      });
      park(next,slot,next.z[slot]!,limit);continue;
    }
    const index=trafficSegment(next.z[slot]!,data,route);
    if(!wasActive&&index>playerIndex&&index<playerIndex+TRAFFIC_VIEW_SEGMENTS){
      next.active[slot]=1;next.speed[slot]=rng.range(10,17)*10;
      next.aiCursor=cycle(next.aiCursor);next.ai[slot]=next.aiCursor;clearPhase(next,slot);
    }else if(wasActive&&(index<playerIndex||index>playerIndex+TRAFFIC_VIEW_SEGMENTS))recycleSlots.push(slot);
    if(wasActive&&next.passed[slot]===0&&!options.suppressPass&&(route?routeCanonicalOvertake(data,oldZ,next.z[slot]!,player.previousZ,player.z):f(oldZ-player.previousZ)>=0&&f(next.z[slot]!-player.z)<0)){
      const candidate:TrafficPassCandidate={epoch:next.epoch,slot,generation:next.generation[slot]!,points:TRAFFIC_PASS_POINTS};
      if(route)Object.assign(candidate,{mapId:next.mapId,routeEpoch:route.routeEpoch,mapEpoch:route.mapEpoch});
      passCandidates.push(candidate);
    }
    moveAI(next,slot,player,data,dt,rng,route);
    // Publish the source two-frame/three-step cadence from fixed-step state.
    // Dropped renders and asset IO cannot lose pause or lifetime transitions.
    // This field is output-only: no physical or RNG decision reads it.
    if(next.active[slot]!==0&&next.speed[slot]!>0)next.motionTicks[slot]=(next.motionTicks[slot]!+1)%6;
    if(options.suppressPass){next.previousZ[slot]=next.z[slot]!;next.previousOffset[slot]=next.offset[slot]!;}
  }
  const result:TrafficStep={pool:next,passCandidates,recycleSlots,limitZ:limit};
  if(departures)result.departures=departures;
  if(route)result.route={...route};
  return result;
}

export function finalizeTrafficPool(step:TrafficStep,eligibilityMask:number,rng:TrafficRandom):{pool:TrafficPoolValue;awards:TrafficPassCandidate[]} {
  const next=clonePool(step.pool),awards:TrafficPassCandidate[]=[];
  if(step.route)validateTrafficRouteDomain(step.route);
  // Consume a candidate even when collision eligibility rejects its award.
  // All old poses remain available in step.pool until this phase starts.
  for(const candidate of step.passCandidates){
    const slot=candidate.slot;
    if(step.route&&(candidate.mapId!==next.mapId||candidate.routeEpoch!==step.route.routeEpoch||candidate.mapEpoch!==step.route.mapEpoch))throw new Error('Traffic route pass identity mismatch');
    if(slot<0||slot>=next.population||candidate.epoch!==next.epoch||candidate.generation!==next.generation[slot])throw new Error('Traffic pass candidate lifetime mismatch');
    if(next.passed[slot]!==0)continue;
    next.passed[slot]=1;
    if(((eligibilityMask>>>slot)&1)!==0)awards.push({...candidate});
  }
  for(const slot of step.recycleSlots){
    if(slot<0||slot>=next.population||next.parked[slot]!==0)throw new Error('Invalid traffic recycle slot');
    if(next.generation[slot]!>=0xffffffff)throw new Error('Traffic generation exhausted');
    next.side[slot]=rng.range(0,2);next.active[slot]=0;next.speed[slot]=0;
    next.offset[slot]=f(rng.range(-6,7)*f(.15));clearPhase(next,slot);
    const distance=rng.range(5,maxHundreds(next.population)+1)*100*150;
    const z=step.route?addRouteTrafficZ(next.z[slot]!,distance):f(next.z[slot]!+distance);
    next.generation[slot]=next.generation[slot]!+1;next.passed[slot]=0;
    if(z<0||(!step.route&&z>=step.limitZ))park(next,slot,z,step.limitZ,step.route);
    else {next.z[slot]=z;next.previousZ[slot]=z;next.previousOffset[slot]=next.offset[slot]!;}
  }
  return {pool:next,awards};
}
