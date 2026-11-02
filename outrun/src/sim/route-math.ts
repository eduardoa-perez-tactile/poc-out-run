import {math,pcg32} from '@gameengine/runtime';
import type {ReadonlySourceBiomeData,ReadonlySourceBiomeCatalogData} from '../schema.gen.ts';
import type {SourceBiomeId} from '../content/biome.ts';

const q=math.fround;
export type RouteGradient=-1|0|1;
export interface RouteContent {
  readonly catalog:ReadonlySourceBiomeCatalogData;
  get(mapId:SourceBiomeId,gradient:RouteGradient):ReadonlySourceBiomeData;
}
/** A borrowed native per-system stream. Never retain it in route state. */
export interface RouteRandom {readonly state:Uint32Array;range(lo:number,hi:number):number}
export interface RouteDriverState {
  initialized:boolean;routeEpoch:number;mapEpoch:number;mapId:number;stage:number;gradient:RouteGradient;
  camera:number;previousCamera:number;choiceLatched:boolean;chosenSide:number;nextMapId:number;
  checkpointAwarded:boolean;goalEntered:boolean;seedLo:number;seedHi:number;rangeCalls:number;entryCount:number;
  checkpointCount:number;checkpointStep:number;checkpointBonusSeconds:number;
  arrivalCount:number;arrivalStep:number;
  passAwardCount:number;passAwardStep:number;passAwardAmount:number;passAwardOldMapEpoch:number;
  processedStep:number;
}
export interface RouteReset {seedLo:number;seedHi:number}
export interface RouteIdentity {routeEpoch:number;mapEpoch:number;mapId:number;stage:number}
export type RouteEvent=
  |(RouteIdentity&{kind:'choice';side:number;nextMapId:number;gradient:RouteGradient})
  |(RouteIdentity&{kind:'entry';fromMapId:number;gradient:RouteGradient})
  |(RouteIdentity&{kind:'checkpoint';checkpointLine:number;bonusSeconds:number})
  |(RouteIdentity&{kind:'goal';gradient:RouteGradient});
export interface RouteEntry {
  readonly fromMapId:number;readonly oldMapEpoch:number;readonly mapId:number;readonly mapEpoch:number;
  readonly stage:number;readonly gradient:RouteGradient;readonly outgoingCamera:number;
}
export interface RouteTransition {route:RouteDriverState;events:RouteEvent[];entry:RouteEntry|null}
function need(value:boolean,message:string):asserts value {if(!value)throw new Error(`Route: ${message}`);}
function uint(value:number,label:string):number {
  need(Number.isInteger(value)&&value>=0&&value<=0xffffffff,`invalid ${label}`);return value;
}
function increment(value:number,label:string):number {uint(value,label);need(value<0xffffffff,`${label} exhausted`);return value+1;}
function integer(value:number,label:string):number {
  need(Number.isInteger(value)&&value>=-2147483648&&value<=2147483647,`invalid int32 ${label}`);return value;
}
function mapId(value:number):SourceBiomeId {
  need(Number.isInteger(value)&&value>=1&&value<=16,`unsupported map ${value}`);return value as SourceBiomeId;
}
function profile(content:RouteContent,id:number,gradient:RouteGradient):ReadonlySourceBiomeData {
  const result=content.get(mapId(id),gradient);
  need(result.id===id&&result.forkGradient===gradient,'selected profile mismatch');
  need(result.segmentLength===150&&result.playerOffsetZ===702,'unsupported source coordinate constants');
  need(Number.isInteger(result.totalCount)&&result.totalCount===result.segments.length&&result.totalCount>0,'invalid source rows');
  need(Number.isInteger(result.swapLine)&&Number.isInteger(result.lastLine)&&result.swapLine<result.lastLine&&result.lastLine<result.totalCount,'invalid source fork bounds');
  return result;
}
function catalogEntry(content:RouteContent,id:number){
  const entry=content.catalog.entries.find(value=>value.id===id);
  need(entry!==undefined,'map missing from catalog');return entry;
}
function identity(route:RouteDriverState):RouteIdentity {
  return {routeEpoch:route.routeEpoch,mapEpoch:route.mapEpoch,mapId:route.mapId,stage:route.stage};
}
function gradient(rng:RouteRandom):RouteGradient {
  const value=rng.range(-1,2);need(value===-1||value===0||value===1,'invalid native gradient');return value;
}
export function emptyRouteDriver():RouteDriverState {
  return {initialized:false,routeEpoch:0,mapEpoch:0,mapId:1,stage:0,gradient:0,camera:45000,previousCamera:45000,
    choiceLatched:false,chosenSide:0,nextMapId:0,checkpointAwarded:false,goalEntered:false,seedLo:0,seedHi:0,rangeCalls:0,entryCount:0,
    checkpointCount:0,checkpointStep:0,checkpointBonusSeconds:0,arrivalCount:0,arrivalStep:0,
    passAwardCount:0,passAwardStep:0,passAwardAmount:0,passAwardOldMapEpoch:0,processedStep:0};
}
/** Recorded full reset only. The caller owns the AdvanceRoute native stream. */
export function resetRouteDriver(previous:RouteDriverState,request:RouteReset,content:RouteContent,rng:RouteRandom,step:number):RouteTransition {
  uint(step,'step');uint(request.seedLo,'seedLo');uint(request.seedHi,'seedHi');
  const epoch=increment(previous.routeEpoch,'route epoch');
  // V8 may expose an overallocated native dispatch view (capacity16). Only the
  // first four PCG words are logical state; keep the borrowed view connected.
  need(rng.state.length>=4,'native RNG needs four borrowed words');
  rng.state.set(pcg32(request.seedLo,request.seedHi,0x524f5554,0).state);
  const selected=gradient(rng);profile(content,1,selected);
  const route:RouteDriverState={...emptyRouteDriver(),initialized:true,routeEpoch:epoch,mapEpoch:1,
    gradient:selected,seedLo:request.seedLo,seedHi:request.seedHi,rangeCalls:1,entryCount:1,processedStep:step};
  return {route,events:[{...identity(route),kind:'entry',fromMapId:0,gradient:selected}],entry:null};
}
/** Source int assignment: FLOAT addition/subtraction rounds before truncation. */
export interface RouteCameraAssignment {camera:number;assignedCamera:number}
export function sourceRouteCameraAssignment(position:number,speed:number,trafficCrash:boolean,totalCount:number):RouteCameraAssignment {
  integer(position,'camera');need(position>=0,'negative camera');
  need(Number.isFinite(speed)&&speed>=0&&speed<=200,'invalid player speed');
  const length=integer(totalCount*150,'track length');need(length>0,'empty track');
  let next=position;
  if(speed>0){
    next=integer(Math.trunc(trafficCrash?q(q(position)-q(q(speed)*q(.5))):q(q(position)+q(speed))),'camera assignment');
    if(trafficCrash&&next<=0)next=0;
  }
  // Equivalent to source repeated integer subtraction/addition, no raw NPC wrap.
  return {camera:((next%length)+length)%length,assignedCamera:next};
}
export function sourceRouteCamera(position:number,speed:number,trafficCrash:boolean,totalCount:number):number {
  return sourceRouteCameraAssignment(position,speed,trafficCrash,totalCount).camera;
}
export function sourceRouteTrafficZ(position:number,speed:number):number {
  integer(position,'traffic Z');need(position>=0,'negative traffic Z');
  need(Number.isFinite(speed)&&speed>=0&&speed<=160,'invalid traffic speed');
  return integer(Math.trunc(q(q(position)+q(speed))),'traffic assignment');
}
export function sourceRouteTransferZ(rawZ:number,outgoingCamera:number):number {
  integer(rawZ,'traffic Z');integer(outgoingCamera,'outgoing camera');
  return integer(rawZ-outgoingCamera,'transferred traffic Z');
}
/** Prepared camera is the one source integer movement, already source-wrapped.
 * This reducer owns graph/latches only; it never advances physics or traffic. */
export function advanceRouteState(previous:RouteDriverState,camera:number,priorRoadSide:0|1,playing:boolean,
  content:RouteContent,rng:RouteRandom,step:number):RouteTransition {
  need(previous.initialized,'route requires recorded reset');uint(step,'step');integer(camera,'prepared camera');
  need(camera>=0,'negative prepared camera');need(priorRoadSide===0||priorRoadSide===1,'invalid prior road side');
  need(step>=previous.processedStep,'step moved backwards');
  if(step===previous.processedStep){need(camera===previous.camera,'same-step route pose changed');return {route:previous,events:[],entry:null};}
  if(!playing||previous.goalEntered)return {route:previous,events:[],entry:null};
  const oldData=profile(content,previous.mapId,previous.gradient);
  need(camera<oldData.totalCount*150,'camera must be source-wrapped before route transition');
  let route={...previous,camera,previousCamera:previous.camera,processedStep:step};
  const events:RouteEvent[]=[];let entry:RouteEntry|null=null;
  const playerRow=Math.floor((camera+oldData.playerOffsetZ)/oldData.segmentLength)%oldData.totalCount;
  if(!route.choiceLatched&&playerRow>oldData.swapLine){
    const current=catalogEntry(content,route.mapId),next=priorRoadSide===0?current.links.left:current.links.right;
    mapId(next);route={...route,choiceLatched:true,chosenSide:priorRoadSide,nextMapId:next};
    events.push({...identity(route),kind:'choice',side:priorRoadSide,nextMapId:next,gradient:route.gradient});
  }
  if(playerRow>oldData.lastLine){
    need(route.choiceLatched&&route.nextMapId!==0,'exit has no latched destination');
    const nextStage=route.stage+1;need(nextStage<=5,'route exceeds five ordinary stages');
    const selected=nextStage===4?1:gradient(rng);
    const destination=profile(content,route.nextMapId,selected),catalog=catalogEntry(content,destination.id);
    need(catalog.stage===nextStage+1&&catalog.terminal===(nextStage===5),'invalid ORIGINAL graph stage');
    const nextEpoch=increment(route.mapEpoch,'map epoch');
    entry={fromMapId:route.mapId,oldMapEpoch:route.mapEpoch,mapId:destination.id,mapEpoch:nextEpoch,
      stage:nextStage,gradient:selected,outgoingCamera:camera};
    route={...route,mapId:destination.id,mapEpoch:nextEpoch,stage:nextStage,gradient:selected,camera:0,previousCamera:0,
      choiceLatched:false,chosenSide:0,nextMapId:0,checkpointAwarded:false,entryCount:increment(route.entryCount,'entry count'),
      rangeCalls:nextStage===4?route.rangeCalls:increment(route.rangeCalls,'range calls')};
    events.push({...identity(route),kind:'entry',fromMapId:entry.fromMapId,gradient:selected});
    if(catalog.terminal){
      route={...route,goalEntered:true,arrivalCount:increment(route.arrivalCount,'arrival count'),arrivalStep:step};
      events.push({...identity(route),kind:'goal',gradient:selected});
    }
  }
  const current=profile(content,route.mapId,route.gradient),catalog=catalogEntry(content,route.mapId);
  if(catalog.hasCheckpoint&&!route.checkpointAwarded&&Math.floor((route.camera+current.playerOffsetZ)/current.segmentLength)%current.totalCount>current.checkpointLine){
    need(route.stage>=1&&route.stage<=4&&current.checkpointLine>=0,'invalid checkpoint stage');
    const factor=[0,.53125,.5,.46875,.4375][route.stage]!;
    const bonus=Math.trunc(q(q(current.timeSeconds)*q(factor)));uint(bonus,'checkpoint bonus');
    route={...route,checkpointAwarded:true,checkpointCount:increment(route.checkpointCount,'checkpoint count'),
      checkpointStep:step,checkpointBonusSeconds:bonus};
    events.push({...identity(route),kind:'checkpoint',checkpointLine:current.checkpointLine,bonusSeconds:bonus});
  }
  return {route,events,entry};
}
/** Immediate accepted-pass BATCH latch. Input identities are validated by the traffic adapter. */
export function publishRoutePassAwards(previous:RouteDriverState,oldMapEpoch:number,amount:number,step:number):RouteDriverState {
  need(previous.initialized,'pass latch needs route');uint(oldMapEpoch,'old map epoch');uint(amount,'pass amount');uint(step,'step');
  need(oldMapEpoch>0&&(oldMapEpoch===previous.mapEpoch||oldMapEpoch+1===previous.mapEpoch),'pass map epoch mismatch');
  if(amount===0)return previous;
  need(previous.passAwardCount===0||step>previous.passAwardStep,'duplicate/stale pass batch');
  return {...previous,passAwardCount:increment(previous.passAwardCount,'pass count'),passAwardStep:step,
    passAwardAmount:amount,passAwardOldMapEpoch:oldMapEpoch};
}
