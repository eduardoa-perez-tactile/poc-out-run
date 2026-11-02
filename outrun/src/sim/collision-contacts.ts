import {math} from '@gameengine/runtime';
import type {ReadonlySourceBiomeData,TrafficPoolValue} from '../schema.gen.ts';
import {PLAYER_COLLIDER,collisionTrafficHull,collisionRoadsideHull} from './collision-metadata.ts';
import {sweptContact,collisionPose,collisionOverlaps,validatePlayerMotion,type CollisionPlayerMotion,type CollisionTrafficMotion,
  type CollisionStaticMotion,type CollisionWitness,type CollisionHull,type TrafficContactDeparture} from './collision-motion.ts';

const q=math.fround;
export const COLLISION_LEDGER_CAPACITY=64;
export const COLLISION_MAX_START_OVERLAPS=47;
export interface CollisionKey {readonly kind:'roadside'|'traffic';readonly mapId:number;readonly id:number;readonly epoch:number;readonly generation:number}
export interface CollisionContact extends CollisionKey {readonly slot:number;readonly witness:CollisionWitness}
export type CollisionLedger=readonly CollisionKey[];
export interface CollisionQueryResult {readonly contact:CollisionContact|null;readonly ledger:CollisionKey[];readonly eligibilityMask:number}
function require(ok:boolean,message:string):asserts ok{if(!ok)throw new Error(`Collision contacts: ${message}`);}
function same(a:CollisionKey,b:CollisionKey){return a.kind===b.kind&&a.mapId===b.mapId&&a.id===b.id&&a.epoch===b.epoch&&a.generation===b.generation;}
function validateKey(key:CollisionKey){
  require(key.kind==='roadside'||key.kind==='traffic','unknown ledger kind');
  for(const n of [key.mapId,key.id,key.epoch,key.generation])require(Number.isSafeInteger(n)&&n>=0,'invalid ledger identity');
}
/** Rearm only after strict START-pose separation, before any new insertion.
 * Removing a departing overlap at its final pose would re-accept its t0 occupancy.
 * Current start occupancies also remove old-map and replaced-generation keys. */
export function pruneCollisionLedger(ledger:CollisionLedger,overlappingStartKeys:readonly CollisionKey[]):CollisionKey[]{
  require(ledger.length<=COLLISION_LEDGER_CAPACITY,'ledger overflow');
  const result:CollisionKey[]=[];
  for(const key of ledger){
    validateKey(key);require(!result.some(old=>same(old,key)),'duplicate ledger key');
    if(overlappingStartKeys.some(current=>same(current,key)))result.push({...key});
  }
  return result;
}
/** Disarm an accepted lifetime; never evict another key to hide overflow. */
export function armCollisionContact(ledger:CollisionLedger,key:CollisionKey):CollisionKey[]{
  validateKey(key);require(ledger.length<=COLLISION_LEDGER_CAPACITY,'ledger overflow');
  if(ledger.some(old=>same(old,key)))return ledger.map(old=>({...old}));
  require(ledger.length<COLLISION_LEDGER_CAPACITY,'ledger overflow');
  return [...ledger.map(old=>({...old})),{kind:key.kind,mapId:key.mapId,id:key.id,epoch:key.epoch,generation:key.generation}];
}
function earlier(a:CollisionContact,b:CollisionContact|null):boolean{
  if(!b)return true;
  if(a.kind!==b.kind)return a.kind==='roadside';
  if(a.witness.toi!==b.witness.toi)return a.witness.toi<b.witness.toi;
  return a.slot!==b.slot?a.slot<b.slot:a.id!==b.id?a.id<b.id:a.epoch!==b.epoch?a.epoch<b.epoch:a.generation<b.generation;
}
function rowRange(data:ReadonlySourceBiomeData,z0:number,z1:number){
  const first=Math.max(0,Math.floor((Math.min(z0,z1)-PLAYER_COLLIDER.halfLength)/150)-1);
  const last=Math.min(data.segments.length-1,Math.floor((Math.max(z0,z1)+PLAYER_COLLIDER.halfLength)/150));
  return {first,last};
}
function eachRoadside(data:ReadonlySourceBiomeData,z0:number,z1:number,visit:(key:CollisionKey,slot:number,motion:CollisionStaticMotion,hull:CollisionHull)=>void,route=false){
  const {first,last}=rowRange(data,z0,z1);
  for(let row=first;row<=last;row++){
    const start=data.objectOffsets[row],end=data.objectOffsets[row+1];
    require(start!==undefined&&end!==undefined&&Number.isInteger(start)&&Number.isInteger(end)&&start>=0&&end>=start&&end<=data.placements.length&&end-start<=5,'invalid five-slot placement prefix');
    let mask=0;
    for(let i=start;i<end;i++){
      const placement=data.placements[i]!;
      require(placement.segment===row&&placement.slot>=0&&placement.slot<5&&(mask&(1<<placement.slot))===0,'invalid source placement row/slot');
      mask|=1<<placement.slot;
      const box=collisionRoadsideHull(data,placement,route);if(!box)continue;
      require(q(box.maxZ-box.minZ)===150,'roadside band must remain150');
      visit({kind:'roadside',mapId:data.id,id:box.placementId,epoch:0,generation:0},box.slot,
        {kind:'static',x:box.centerX,z:q((box.minZ+box.maxZ)/2)},{halfWidth:box.halfWidth,halfLength:75});
    }
  }
}
function eachTraffic(pool:Readonly<TrafficPoolValue>,departures:readonly TrafficContactDeparture[],visit:(key:CollisionKey,slot:number,motion:CollisionTrafficMotion,hull:CollisionHull)=>void){
  for(let slot=0;slot<pool.population;slot++){
    const departure=departures.find(old=>old.slot===slot);
    if(departure){
      visit({kind:'traffic',mapId:pool.mapId,id:slot,epoch:departure.epoch,generation:departure.generation},slot,
        {kind:'traffic',z0:departure.z0,z1:departure.z1,offset0:departure.offset,offset1:departure.offset,side:departure.side,activeUntil:departure.until,disappears:true},collisionTrafficHull(slot+1));
      continue;
    }
    if(pool.parked[slot]!==0||pool.generation[slot]===0)continue;
    visit({kind:'traffic',mapId:pool.mapId,id:slot,epoch:pool.epoch,generation:pool.generation[slot]!},slot,
      {kind:'traffic',z0:pool.previousZ[slot]!,z1:pool.z[slot]!,offset0:pool.previousOffset[slot]!,offset1:pool.offset[slot]!,side:pool.side[slot] as 0|1},collisionTrafficHull(slot+1));
  }
}
// Route queries reuse source five-slot placement validation and contact ordering.
// Their canonical wrap/old-life motion policy is a separate caller-owned layer.
export {eachRoadside as visitCollisionRoadside,earlier as collisionContactEarlier};
/** Pure detector at AdvanceTraffic's advance/finalize seam: pool still contains
 * the OLD generation/side and physical pre/current poses. No RNG or writes. */
export function queryCollisionContacts(player:CollisionPlayerMotion,pool:Readonly<TrafficPoolValue>,data:ReadonlySourceBiomeData,
  ledger:CollisionLedger,options:{readonly locked?:boolean;readonly departures?:readonly TrafficContactDeparture[]}={}):CollisionQueryResult{
  // Closure belongs to the authoritative tick, even when the spatial query is empty.
  validatePlayerMotion(player,data);
  require(data.id===pool.mapId&&data.segmentLength===150,'unsupported map/segment contract');
  require([9,20,32].includes(pool.population)&&pool.population<=32,'population bound exceeded');
  require(PLAYER_COLLIDER.halfLength===75,'player extent invalidates47-overlap bound');
  for(const lane of ['previousZ','z','previousOffset','offset','side','generation','parked'] as const)require(pool[lane].length===32,'invalid fixed traffic lanes');
  const departures=options.departures??[];
  require(departures.length<=32,'departure bound exceeded');
  const departureSlots=new Set<number>(),limit=q(data.lastLine*data.segmentLength);
  for(const old of departures){
    require(Number.isInteger(old.slot)&&old.slot>=0&&old.slot<pool.population&&!departureSlots.has(old.slot),'invalid departure slot');departureSlots.add(old.slot);
    require(pool.parked[old.slot]===1&&old.epoch===pool.epoch&&old.generation===pool.generation[old.slot]&&old.generation>0,'departure must retain newly parked old lifetime');
    require([old.z0,old.z1,old.offset,old.until].every(Number.isFinite)&&old.z0>=0&&old.z0<limit&&old.z1>=limit&&old.z1>old.z0,'invalid departure motion');
    require((old.side===0||old.side===1)&&old.until===(limit-q(old.z0))/(q(old.z1)-q(old.z0)),'invalid terminal ratio');
  }
  const playerStart=collisionPose(player,0,Math.floor(q(player.z0)/150),data),overlaps:CollisionKey[]=[];
  const collect=(key:CollisionKey,_slot:number,motion:CollisionStaticMotion|CollisionTrafficMotion,hull:CollisionHull)=>{
    const z=motion.kind==='static'?motion.z:motion.z0;
    if(collisionOverlaps(playerStart,PLAYER_COLLIDER,collisionPose(motion,0,Math.floor(q(z)/150),data),hull))overlaps.push(key);
  };
  eachRoadside(data,player.z0,player.z0,collect);eachTraffic(pool,departures,collect);
  // Player150Z intersects at most3closed150-row bands x5slots plus32cars.
  require(overlaps.length<=COLLISION_MAX_START_OVERLAPS,'physical overlap bound exceeded');
  const pruned=pruneCollisionLedger(ledger,overlaps);
  if(player.barrier||options.locked)return {contact:null,ledger:pruned,eligibilityMask:0};
  let contact:CollisionContact|null=null;
  const playerMinZ=Math.min(q(player.z0),q(player.z1)),playerMaxZ=Math.max(q(player.z0),q(player.z1));
  const test=(key:CollisionKey,slot:number,motion:CollisionStaticMotion|CollisionTrafficMotion,hull:CollisionHull)=>{
    if(pruned.some(old=>same(old,key)))return;
    const z0=q(motion.kind==='static'?motion.z:motion.z0),z1=q(motion.kind==='static'?motion.z:motion.z1);
    const radius=q(PLAYER_COLLIDER.halfLength+hull.halfLength);
    // Conservative monotone Z intervals reject distant actors before row-event
    // allocation. Compare rounded relative gaps, matching inclusive f32 slabs:
    // an unrounded >radius test would wrongly reject sub-ULP face contacts.
    // Departures use their full proposed range, safely beyond actual expiry.
    if(q(Math.min(z0,z1)-playerMaxZ)>radius||q(playerMinZ-Math.max(z0,z1))>radius)return;
    const witness=sweptContact(player,PLAYER_COLLIDER,motion,hull,data);if(!witness)return;
    const candidate:CollisionContact={...key,slot,witness};if(earlier(candidate,contact))contact=candidate;
  };
  eachRoadside(data,player.z0,player.z1,test);eachTraffic(pool,departures,test);
  return {contact,ledger:contact?armCollisionContact(pruned,contact):pruned,eligibilityMask:contact?0:0xffffffff};
}
