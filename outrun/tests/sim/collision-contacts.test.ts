import {worldTest,expect} from '@gameengine/test';
import {math} from '@gameengine/runtime';
import {loadMap01} from '../../src/content/biome.ts';
import {createEmptyTrafficPool} from '../../src/sim/traffic-math.ts';
import {collisionRoadsideHull} from '../../src/sim/collision-metadata.ts';
import {queryCollisionContacts,pruneCollisionLedger,armCollisionContact,type CollisionKey} from '../../src/sim/collision-contacts.ts';
import type {CollisionPlayerMotion} from '../../src/sim/collision-motion.ts';
const q=math.fround;
function player(z0:number,z1=z0,x=0):CollisionPlayerMotion{
  const data=loadMap01(),l=q(x/1600);return{kind:'player',z0,z1,l0:l,ls:l,lc:l,lr:l,lf:l,drift:0,previousGap:data.segments[Math.floor(z0/150)]!.gap,carryApplied:false};
}
function pool(){const result=createEmptyTrafficPool();result.initialized=true;result.population=32;result.epoch=7;
  result.parked.fill(1);result.generation.fill(1);return result;}
function trafficKey(slot=31,generation=1):CollisionKey{return{kind:'traffic',mapId:1,id:slot,epoch:7,generation};}
worldTest('collision.contacts roadside category wins over an earlier traffic TOI with stable source slot ties',()=>{
  const data=loadMap01(),cars=pool();cars.parked[31]=0;cars.active[31]=1;
  cars.previousZ[31]=45100;cars.z[31]=45100;cars.previousOffset[31]=q(-.625);cars.offset[31]=q(-.625);
  const untouched=JSON.stringify({data,cars}),hit=queryCollisionContacts(player(45000,45825,-1000),cars,data,[]);
  expect(hit.contact!.kind).toBe('roadside');expect(hit.contact!.id).toBe(1525);expect(hit.contact!.slot).toBe(0);
  expect(hit.contact!.witness.toi).toBeGreaterThan(0);expect(hit.eligibilityMask).toBe(0);
  expect(JSON.stringify({data,cars})).toBe(untouched);
  const tie=queryCollisionContacts(player(45825,45825,-1000),pool(),data,[]);
  expect(tie.contact!.id).toBe(1525);expect(tie.contact!.slot).toBe(0);expect(tie.contact!.witness.toi).toBe(0);
});
worldTest('collision.contacts slot31 old generation is physical while inactive and retained before recycle finalize',()=>{
  const data=loadMap01(),cars=pool();cars.parked[31]=0;cars.active[31]=0;cars.generation[31]=17;
  cars.previousZ[31]=10000;cars.z[31]=10160;cars.speed[31]=160;
  const before=JSON.stringify(cars),hit=queryCollisionContacts(player(9800,10500),cars,data,[]);
  expect(hit.contact!.kind).toBe('traffic');expect(hit.contact!.id).toBe(31);expect(hit.contact!.slot).toBe(31);
  expect(hit.contact!.epoch).toBe(7);expect(hit.contact!.generation).toBe(17);expect(hit.eligibilityMask).toBe(0);
  expect(hit.ledger).toEqual([trafficKey(31,17)]);expect(JSON.stringify(cars)).toBe(before);
  // Exact TOI ties use stable pool slots, independent of their visual widths.
  cars.parked[0]=0;cars.previousZ[0]=10000;cars.z[0]=10160;cars.speed[0]=160;
  expect(queryCollisionContacts(player(10000),cars,data,[]).contact!.id).toBe(0);
});
worldTest('collision.contacts no hit preserves unsigned all-bits mask and parked cars never participate',()=>{
  const data=loadMap01(),cars=pool();cars.previousZ[31]=10000;cars.z[31]=10000;
  expect(queryCollisionContacts(player(10000),cars,data,[])).toEqual({contact:null,ledger:[],eligibilityMask:4294967295});
  cars.parked[31]=0;cars.previousOffset[31]=10;cars.offset[31]=10;
  expect(queryCollisionContacts(player(10000),cars,data,[]).eligibilityMask).toBe(0xffffffff);
  const barrier=queryCollisionContacts({...player(10000),barrier:true},cars,data,[]);
  expect(barrier.contact).toBe(null);expect(barrier.eligibilityMask).toBe(0);
});
worldTest('collision.contacts ledger holds exact touching and departing initial overlap then rearms after strict START separation',()=>{
  const data=loadMap01(),cars=pool();cars.parked[31]=0;cars.previousZ[31]=10000;cars.z[31]=10000;
  const first=queryCollisionContacts(player(10000),cars,data,[]);expect(first.contact!.id).toBe(31);
  const held=queryCollisionContacts(player(10000,11000),cars,data,first.ledger);
  expect(held.contact).toBe(null);expect(held.ledger).toEqual(first.ledger);
  const touching=queryCollisionContacts(player(10150,11000),cars,data,first.ledger);
  expect(touching.contact).toBe(null);expect(touching.ledger).toEqual(first.ledger);
  const separated=queryCollisionContacts(player(11000,10000),cars,data,first.ledger);
  expect(separated.contact!.id).toBe(31);expect(separated.ledger).toEqual(first.ledger);
  const justApart=queryCollisionContacts(player(q(10150.001),10000),cars,data,first.ledger);
  expect(justApart.contact!.id).toBe(31);
});
worldTest('collision.contacts prune stale map generation before insert and locked ticks prune without accepting',()=>{
  const data=loadMap01(),cars=pool();cars.parked[31]=0;cars.previousZ[31]=10000;cars.z[31]=10000;cars.generation[31]=2;
  const stale=Array.from({length:64},(_,id):CollisionKey=>({kind:'roadside',mapId:2,id,epoch:0,generation:0}));
  expect(queryCollisionContacts(player(10000),cars,data,stale).ledger).toEqual([trafficKey(31,2)]);
  expect(queryCollisionContacts(player(10000),cars,data,[trafficKey(31,1)]).ledger).toEqual([trafficKey(31,2)]);
  expect(queryCollisionContacts(player(10000),cars,data,stale,{locked:true})).toEqual({contact:null,ledger:[],eligibilityMask:0});
  const current=[trafficKey(31,2)];
  expect(queryCollisionContacts(player(10000),cars,data,current,{locked:true}).ledger).toEqual(current);
  const before=JSON.stringify(current);pruneCollisionLedger(current,[]);expect(JSON.stringify(current)).toBe(before);
});
worldTest('collision.contacts ledger capacity fails visibly and malformed prefix cannot expand the47-overlap proof',()=>{
  const keys=Array.from({length:64},(_,id):CollisionKey=>({kind:'roadside',mapId:1,id,epoch:0,generation:0}));
  expect(armCollisionContact(keys,keys[0]!).length).toBe(64);
  let overflow=false;try{armCollisionContact(keys,{kind:'roadside',mapId:1,id:65,epoch:0,generation:0});}catch{overflow=true;}
  expect(overflow).toBe(true);expect(pruneCollisionLedger(keys,[])).toEqual([]);
  const data=loadMap01(),offsets=[...data.objectOffsets];offsets[305]=0;offsets[306]=6;
  let invalid=false;try{queryCollisionContacts(player(45825),pool(),{...data,objectOffsets:offsets},[]);}catch{invalid=true;}
  expect(invalid).toBe(true);
  // Source decorative records are not turned into contacts by image opacity.
  const decorative=data.placements.find(p=>[38,44].includes(data.definitions[p.definition]!.objectId));
  expect(decorative!==undefined).toBe(true);expect(collisionRoadsideHull(data,decorative!)).toBe(null);
});
worldTest('collision.contacts empty candidate windows still reject malformed authoritative stage closure',()=>{
  const data=loadMap01(),cars=pool(),valid=player(10000);
  // No roadside at this source location and every traffic slot is parked.
  expect(queryCollisionContacts(valid,cars,data,[]).contact).toBe(null);
  for(const malformed of [{...valid,lc:1},{...valid,drift:NaN}]){
    let failed=false;try{queryCollisionContacts(malformed,cars,data,[]);}catch{failed=true;}
    expect(failed).toBe(true);
  }
});
worldTest('collision.contacts newly parked old lifetime participates until endpoint but already parked geometry stays excluded',()=>{
  const data=loadMap01(),cars=pool(),limit=data.lastLine*150,oldZ=limit-5;
  cars.parked[31]=1;cars.previousZ[31]=limit;cars.z[31]=limit;cars.generation[31]=17;
  const p=player(oldZ),before=JSON.stringify(cars);
  // This advanced pool alone cannot distinguish an old parked car from park()
  // having overwritten a live car's previousZ during this very tick.
  expect(queryCollisionContacts(p,cars,data,[]).contact).toBe(null);
  const departure={slot:31,epoch:7,generation:17,z0:oldZ,z1:limit+155,offset:0,side:0 as const,until:5/160};
  const hit=queryCollisionContacts(p,cars,data,[],{departures:[departure]});
  expect(hit.contact!.id).toBe(31);expect(hit.contact!.generation).toBe(17);
  expect(hit.contact!.witness.toi).toBe(0);expect(hit.eligibilityMask).toBe(0);
  expect(hit.ledger).toEqual([trafficKey(31,17)]);expect(JSON.stringify(cars)).toBe(before);
  // A disarmed starting overlap stays held through departure, not reaccepted.
  expect(queryCollisionContacts(p,cars,data,hit.ledger,{departures:[departure]}).contact).toBe(null);
});
worldTest('collision.contacts opposite logical arms physically contact in authentic overlap but remain separated in the fork',()=>{
  const data=loadMap01(),cars=pool();cars.parked[31]=0;cars.active[31]=0;cars.side[31]=1;
  const overlapRow=4122,forkRow=4353;
  expect(data.segments[overlapRow]!.gap).toBe(22);expect(data.segments[forkRow]!.gap).toBe(15730);
  const overlapZ=overlapRow*150+100;
  cars.previousZ[31]=overlapZ;cars.z[31]=overlapZ;
  const contact=queryCollisionContacts(player(overlapZ),cars,data,[]).contact!;
  expect(contact.kind).toBe('traffic');expect(contact.id).toBe(31);expect(contact.witness.toi).toBe(0);
  const forkZ=forkRow*150+100;cars.previousZ[31]=forkZ;cars.z[31]=forkZ;
  expect(queryCollisionContacts(player(forkZ),cars,data,[]).contact).toBe(null);
});
worldTest('collision.broadphase distant traffic stays clear without rejecting rounded inclusive face contact',()=>{
  const data=loadMap01(),cars=pool();cars.parked[31]=0;
  const playerZ=q(.00001),carZ=q(150.0000152587890625);
  expect(carZ-playerZ>150).toBe(true);expect(q(carZ-playerZ)).toBe(150);
  cars.previousZ[31]=carZ;cars.z[31]=carZ;
  const face=queryCollisionContacts(player(playerZ),cars,data,[]);
  expect(face.contact!.id).toBe(31);expect(face.contact!.witness.toi).toBe(0);
  cars.previousZ[31]=30000;cars.z[31]=30160;
  expect(queryCollisionContacts(player(playerZ,q(playerZ+200)),cars,data,[])).toEqual({contact:null,ledger:[],eligibilityMask:4294967295});
});
