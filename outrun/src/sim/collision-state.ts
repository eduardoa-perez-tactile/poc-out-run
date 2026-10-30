import {math} from '@gameengine/runtime';
import type {CollisionDriverValue,ContactAcceptedValue,DrivingStateValue,ReadonlySourceBiomeData} from '../schema.gen.ts';
import type {TrafficStep} from './traffic-math.ts';
import {queryCollisionContacts,type CollisionKey} from './collision-contacts.ts';

const f=math.fround;
const STAGES=Object.freeze({'continuous':0,'pre-jump':1,'post-jump':2,'final-bound':3});
export interface CollisionEvaluation {
  driver:CollisionDriverValue;eligibilityMask:number;hit:ContactAcceptedValue|null;
}
function ledger(driver:CollisionDriverValue):CollisionKey[]{
  if(driver.ledgerCount>64)throw new Error('Collision ledger exceeds its64-key capacity');
  const keys:CollisionKey[]=[];
  for(let i=0;i<driver.ledgerCount;i++){
    const kind=driver.ledgerKind[i];
    if(kind!==1&&kind!==2)throw new Error('Invalid persisted collision key');
    keys.push({kind:kind===1?'roadside':'traffic',mapId:driver.mapId,id:driver.ledgerId[i]!,
      epoch:driver.ledgerEpoch[i]!,generation:driver.ledgerGeneration[i]!});
  }
  return keys;
}
function store(driver:CollisionDriverValue,keys:readonly CollisionKey[]):CollisionDriverValue {
  if(keys.length>64)throw new Error('Collision ledger overflow');
  const next={...driver,ledgerCount:keys.length,ledgerKind:Array(64).fill(0),ledgerId:Array(64).fill(0),
    ledgerEpoch:Array(64).fill(0),ledgerGeneration:Array(64).fill(0)};
  for(let i=0;i<keys.length;i++){
    const key=keys[i]!;
    if(key.mapId!==driver.mapId)throw new Error('Collision ledger retained a different map');
    next.ledgerKind[i]=key.kind==='roadside'?1:2;next.ledgerId[i]=key.id;
    next.ledgerEpoch[i]=key.epoch;next.ledgerGeneration[i]=key.generation;
  }
  return next;
}
/** Optional-owner adapter inside the original AdvanceTraffic RNG owner, after
 * advance and before finalize. No contact can inspect the replacement life. */
export function evaluateCollisionDriver(previous:CollisionDriverValue,driving:DrivingStateValue,
  advanced:TrafficStep,data:ReadonlySourceBiomeData,step:number,lifecycle:boolean):CollisionEvaluation {
  if(!previous.initialized||lifecycle||previous.mapId!==data.id){
    return {driver:store({...previous,mapId:data.id,initialized:true,motionValid:false,locked:false,acceptedCount:0},[]),
      eligibilityMask:0,hit:null};
  }
  if(!driving.active||!driving.playing)return {driver:previous,eligibilityMask:0,hit:null};
  if(!previous.motionValid||previous.motionStep!==step)throw new Error('Collision requires this tick\'s authoritative terrain trajectory');
  const result=queryCollisionContacts({kind:'player',z0:previous.z0,z1:previous.z1,l0:previous.l0,ls:previous.ls,
    lc:previous.lc,lr:previous.lr,lf:previous.lf,drift:previous.drift,previousGap:previous.previousGap,
    carryApplied:previous.carryApplied},advanced.pool,data,ledger(previous),{locked:previous.locked,departures:advanced.departures});
  const next=store(previous,result.ledger),contact=result.contact;
  if(!contact)return {driver:next,eligibilityMask:result.eligibilityMask,hit:null};
  if(next.acceptedCount===0xffffffff)throw new Error('Collision acceptance counter exhausted');
  next.acceptedCount++;
  const playerRow=data.segments[Math.floor(f(driving.distance+data.playerOffsetZ)/data.segmentLength)];
  if(!playerRow)throw new Error('Collision impact outside source rows');
  const curve=contact.kind==='traffic'?0:Math.abs(playerRow.curve)>=2?f(playerRow.curve*f(.3)):playerRow.curve;
  return {driver:next,eligibilityMask:result.eligibilityMask,hit:{
    kind:contact.kind==='roadside'?1:2,mapId:contact.mapId,id:contact.id,epoch:contact.epoch,
    generation:contact.generation,slot:contact.slot,toi:contact.witness.toi,stage:STAGES[contact.witness.stage],
    playerX:contact.witness.a.x,playerZ:contact.witness.a.z,otherX:contact.witness.b.x,otherZ:contact.witness.b.z,
    impactSpeed:driving.legacySpeed,handlingCap:previous.handlingCap,collisionDir:driving.lateral,curve,
  }};
}
