import {math} from '@gameengine/runtime';
import type {ReadonlySourceBiomeData,TrafficPoolValue,CollisionDriverValue,DrivingStateValue,ContactAcceptedValue} from '../schema.gen.ts';
import {PLAYER_COLLIDER,collisionTrafficHull} from './collision-metadata.ts';
import {collisionOverlaps,type CollisionPlayerMotion,type CollisionTrafficMotion,type CollisionStaticMotion,type CollisionHull} from './collision-motion.ts';
import {visitCollisionRoadside,collisionContactEarlier,pruneCollisionLedger,armCollisionContact,
  COLLISION_MAX_START_OVERLAPS,type CollisionKey,type CollisionContact,type CollisionLedger,type CollisionQueryResult} from './collision-contacts.ts';
import {readCollisionLedger,writeCollisionLedger,type CollisionEvaluation} from './collision-state.ts';
import {sweptRouteContact,routeCollisionPose} from './route-collision-motion.ts';
import {sampleRouteZ} from './route-space.ts';
import type {TrafficPassCandidate} from './traffic-math.ts';

const q=math.fround;
export interface RouteCollisionHandoff {
  readonly routeEpoch:number;readonly oldMapId:number;readonly oldMapEpoch:number;readonly mapEpoch:number;
  readonly candidates:readonly TrafficPassCandidate[];
}
export interface RouteCollisionOptions {
  readonly mode:'sweep'|'endpoint';readonly locked?:boolean;readonly goal?:boolean;
  readonly handoff?:RouteCollisionHandoff;readonly lifecycle?:boolean;
}
function need(value:boolean,message:string):asserts value {if(!value)throw new Error('Route contacts: '+message);}
function u32(value:number):boolean{return Number.isInteger(value)&&value>=0&&value<=0xffffffff;}
function same(a:CollisionKey,b:CollisionKey){return a.kind===b.kind&&a.mapId===b.mapId&&a.id===b.id&&a.epoch===b.epoch&&a.generation===b.generation;}
function validatePool(pool:Readonly<TrafficPoolValue>,data:ReadonlySourceBiomeData,options:RouteCollisionOptions){
  need(pool.mapId===data.id&&[9,20,32].includes(pool.population),'pool/map/population mismatch');
  need(u32(pool.epoch)&&pool.epoch>0,'invalid pool epoch');
  for(const field of ['z','previousZ','offset','previousOffset','side','generation','parked'] as const)
    need(pool[field].length===32,`invalid ${field} lane count`);
  for(let slot=0;slot<pool.population;slot++){
    need(u32(pool.generation[slot]!)&&pool.generation[slot]!>0,'invalid old generation');
    need(pool.parked[slot]===0||pool.parked[slot]===1,'invalid parked flag');
    need(pool.side[slot]===0||pool.side[slot]===1,'invalid source side');
    need(Number.isFinite(pool.offset[slot])&&Number.isFinite(pool.previousOffset[slot]),'invalid offset');
    if(pool.parked[slot]!==0)continue;
    sampleRouteZ(data,pool.z[slot]!);sampleRouteZ(data,pool.previousZ[slot]!);
    if(options.mode==='endpoint')need(pool.z[slot]===pool.previousZ[slot]&&pool.offset[slot]===pool.previousOffset[slot],
      'endpoint occupancy requires synchronized old-life history');
  }
  const transfer=options.handoff;
  if(!transfer)return;
  need(options.mode==='endpoint','handoff must not sweep across maps');
  need(u32(transfer.routeEpoch)&&transfer.routeEpoch>0&&u32(transfer.oldMapEpoch)&&transfer.oldMapEpoch>0&&
    u32(transfer.mapEpoch)&&transfer.mapEpoch===transfer.oldMapEpoch+1,'invalid handoff epoch');
  need(Number.isInteger(transfer.oldMapId)&&transfer.oldMapId>=1&&transfer.oldMapId<=15&&transfer.oldMapId!==data.id,'invalid outgoing map');
  need(transfer.candidates.length<=32,'candidate bound exceeded');
  let slots=0;
  for(const candidate of transfer.candidates){
    need(Number.isInteger(candidate.slot)&&candidate.slot>=0&&candidate.slot<pool.population,'invalid candidate slot');
    need(((slots>>>candidate.slot)&1)===0,'duplicate candidate slot');slots=(slots|(1<<candidate.slot))>>>0;
    need(candidate.routeEpoch===transfer.routeEpoch&&candidate.mapEpoch===transfer.oldMapEpoch&&candidate.mapId===transfer.oldMapId&&
      candidate.epoch===pool.epoch&&candidate.generation===pool.generation[candidate.slot]&&
      Number.isInteger(candidate.points)&&candidate.points>0&&candidate.points<=0xffffffff,'stale/malformed old-life candidate');
  }
}
function endpoint(player:CollisionPlayerMotion,data:ReadonlySourceBiomeData):CollisionPlayerMotion {
  const gap=data.segments[sampleRouteZ(data,player.z1).row]!.gap;
  return {kind:'player',z0:player.z1,z1:player.z1,l0:player.lf,ls:player.lf,lc:player.lf,lr:player.lf,lf:player.lf,
    drift:0,previousGap:gap,carryApplied:false};
}
/** Visit two short canonical edge ranges at a wrap, never the middle chord. */
function roadside(data:ReadonlySourceBiomeData,player:CollisionPlayerMotion,visit:Parameters<typeof visitCollisionRoadside>[3]){
  const a=sampleRouteZ(data,player.z0),b=sampleRouteZ(data,player.z1),length=data.totalCount*150;
  const seen=new Set<number>();
  const once:typeof visit=(key,slot,motion,hull)=>{if(!seen.has(key.id)){seen.add(key.id);visit(key,slot,motion,hull);}};
  if(a.lap===b.lap)visitCollisionRoadside(data,a.canonicalZ,b.canonicalZ,once,true);
  else if(player.z1>player.z0){visitCollisionRoadside(data,a.canonicalZ,length-1,once,true);visitCollisionRoadside(data,0,b.canonicalZ,once,true);}
  else {visitCollisionRoadside(data,a.canonicalZ,0,once,true);visitCollisionRoadside(data,length-1,b.canonicalZ,once,true);}
}
function traffic(pool:Readonly<TrafficPoolValue>,visit:(key:CollisionKey,slot:number,motion:CollisionTrafficMotion,hull:CollisionHull)=>void){
  for(let slot=0;slot<pool.population;slot++){
    if(pool.parked[slot]!==0)continue;
    visit({kind:'traffic',mapId:pool.mapId,id:slot,epoch:pool.epoch,generation:pool.generation[slot]!},slot,
      {kind:'traffic',z0:pool.previousZ[slot]!,z1:pool.z[slot]!,offset0:pool.previousOffset[slot]!,offset1:pool.offset[slot]!,side:pool.side[slot] as 0|1},collisionTrafficHull(slot+1));
  }
}
/** All-map old-life query. Pool raw integer lanes must be queried BEFORE finalize;
 * visible aliases share canonical contact space, wrap discontinuities never sweep. */
export function queryRouteCollisionContacts(rawPlayer:CollisionPlayerMotion,pool:Readonly<TrafficPoolValue>,data:ReadonlySourceBiomeData,
  ledger:CollisionLedger,options:RouteCollisionOptions):CollisionQueryResult {
  need(options.mode==='sweep'||options.mode==='endpoint','invalid motion mode');
  validatePool(pool,data,options);
  // Validate actual incoming trace even when endpoint mode deliberately drops it.
  routeCollisionPose(rawPlayer,false,data);routeCollisionPose(rawPlayer,true,data);
  const player=options.mode==='endpoint'?endpoint(rawPlayer,data):rawPlayer;
  need(!options.goal||data.id===16,'goal suppression requires real goal map');
  if(data.id===16)return {contact:null,ledger:[],eligibilityMask:options.locked?0:0xffffffff};
  const start=routeCollisionPose(player,false,data),overlaps:CollisionKey[]=[];
  const collect=(key:CollisionKey,_slot:number,motion:CollisionStaticMotion|CollisionTrafficMotion,hull:CollisionHull)=>{
    if(collisionOverlaps(start,PLAYER_COLLIDER,routeCollisionPose(motion,false,data),hull))overlaps.push(key);
  };
  roadside(data,{...player,z1:player.z0},collect);traffic(pool,collect);
  need(overlaps.length<=COLLISION_MAX_START_OVERLAPS,'physical start-overlap bound exceeded');
  const pruned=pruneCollisionLedger(ledger,overlaps);
  if(options.locked||player.barrier)return {contact:null,ledger:pruned,eligibilityMask:0};
  let contact:CollisionContact|null=null;
  const test=(key:CollisionKey,slot:number,motion:CollisionStaticMotion|CollisionTrafficMotion,hull:CollisionHull)=>{
    if(pruned.some(old=>same(old,key)))return;
    const witness=sweptRouteContact(player,PLAYER_COLLIDER,motion,hull,data);if(!witness)return;
    const candidate:CollisionContact={...key,slot,witness};if(collisionContactEarlier(candidate,contact))contact=candidate;
  };
  roadside(data,player,test);traffic(pool,test);
  let mask=0xffffffff;
  // Shared source ordering: roadside wins; nonhandoff contact denies whole tick.
  if(contact){
    const hit=contact as CollisionContact;
    if(!options.handoff||hit.kind==='roadside')mask=0;
    else if(options.handoff.candidates.some(candidate=>candidate.slot===hit.slot&&candidate.epoch===hit.epoch&&candidate.generation===hit.generation))
      mask=(mask&~(1<<hit.slot))>>>0;
  }
  return {contact,ledger:contact?armCollisionContact(pruned,contact):pruned,eligibilityMask:mask};
}
const STAGES={'continuous':0,'pre-jump':1,'post-jump':2,'final-bound':3} as const;
/** Preserve accepted counters across route transfer. Only local ledger/motion
 * changes map; CrashDriver consumed count and RNG remain caller-owned. */
export function evaluateRouteCollisionDriver(previous:CollisionDriverValue,driving:DrivingStateValue,player:CollisionPlayerMotion,
  pool:Readonly<TrafficPoolValue>,data:ReadonlySourceBiomeData,step:number,options:RouteCollisionOptions):CollisionEvaluation {
  need(u32(step),'invalid step');
  if(previous.mapId!==data.id)need(options.handoff!==undefined&&previous.mapId===options.handoff.oldMapId,'unexplained collision map change');
  const transferred=options.handoff!==undefined;
  let driver={...previous,mapId:data.id,locked:options.locked??false};
  if(transferred)driver=writeCollisionLedger({...driver,initialized:true,motionValid:true,motionStep:step},[]);
  if(options.lifecycle||!previous.initialized){
    return {driver:writeCollisionLedger({...driver,initialized:true,motionValid:false,motionStep:step},[]),eligibilityMask:0,hit:null};
  }
  if(!driving.active||!driving.playing)return {driver,eligibilityMask:0,hit:null};
  const result=queryRouteCollisionContacts(player,pool,data,readCollisionLedger(driver),options);
  driver=writeCollisionLedger(driver,result.ledger);
  const contact=result.contact;
  if(!contact)return {driver,eligibilityMask:result.eligibilityMask,hit:null};
  need(u32(driver.acceptedCount)&&driver.acceptedCount<0xffffffff,'acceptance count exhausted');driver.acceptedCount++;
  const row=data.segments[sampleRouteZ(data,player.z1).row]!;
  const curve=contact.kind==='traffic'?0:Math.abs(row.curve)>=2?q(row.curve*q(.3)):row.curve;
  const hit:ContactAcceptedValue={kind:contact.kind==='roadside'?1:2,mapId:data.id,id:contact.id,epoch:contact.epoch,
    generation:contact.generation,slot:contact.slot,toi:contact.witness.toi,stage:STAGES[contact.witness.stage],
    playerX:contact.witness.a.x,playerZ:contact.witness.a.z,otherX:contact.witness.b.x,otherZ:contact.witness.b.z,
    impactSpeed:driving.legacySpeed,handlingCap:driver.handlingCap,collisionDir:driving.lateral,curve};
  return {driver,eligibilityMask:result.eligibilityMask,hit};
}
