import {worldTest,expect} from '@gameengine/test';
import {originalRouteSources} from '../../src/content/route-boot.ts';
import type {SourceBiomeId} from '../../src/content/biome.ts';
import type {CollisionDriverValue,DrivingStateValue,TrafficPoolValue} from '../../src/schema.gen.ts';
import {createEmptyTrafficPool,type TrafficPassCandidate} from '../../src/sim/traffic-math.ts';
import {collisionRoadsideHull} from '../../src/sim/collision-metadata.ts';
import type {CollisionPlayerMotion} from '../../src/sim/collision-motion.ts';
import {queryRouteCollisionContacts,evaluateRouteCollisionDriver,type RouteCollisionHandoff} from '../../src/sim/route-collision-contacts.ts';

const SCENE={scene:'scenes/map01-data.scene.json'};
function data(id:SourceBiomeId=1){return originalRouteSources().get(id,0);}
function player(z0=10000,z1=z0,x=0):CollisionPlayerMotion {
  return {kind:'player',z0,z1,l0:x,ls:x,lc:x,lr:x,lf:x,drift:0,previousGap:0,carryApplied:false};
}
/** Pure old-life detector fixture; no world pool writes or runtime traffic claim. */
function pool(id:SourceBiomeId=1):TrafficPoolValue {
  const value=createEmptyTrafficPool();value.mapId=id;value.population=32;value.initialized=true;value.epoch=3;
  value.generation.fill(1);value.parked.fill(1);return value;
}
function car(value:TrafficPoolValue,slot:number,z0:number,z1=z0,offset=0){
  value.parked[slot]=0;value.active[slot]=1;value.previousZ[slot]=z0;value.z[slot]=z1;
  value.previousOffset[slot]=offset;value.offset[slot]=offset;value.side[slot]=0;return value;
}
function driver(mapId=1):CollisionDriverValue {
  return {mapId,initialized:true,motionValid:true,motionStep:1,locked:false,acceptedCount:7,
    z0:10000,z1:10000,l0:0,ls:0,lc:0,lr:0,lf:0,drift:0,previousGap:0,carryApplied:false,handlingCap:200,
    ledgerCount:0,ledgerKind:Array(64).fill(0),ledgerId:Array(64).fill(0),ledgerEpoch:Array(64).fill(0),ledgerGeneration:Array(64).fill(0)};
}
function driving():DrivingStateValue {
  return {active:true,manual:true,legacySpeed:120,gear:1,steering:0,lateral:0,previousLateral:0,
    distance:9298,previousDistance:9298,playing:true};
}
function candidate(slot:number,generation=1):TrafficPassCandidate {
  return {mapId:1,routeEpoch:4,mapEpoch:1,epoch:3,slot,generation,points:20000};
}
function handoff(candidates:readonly TrafficPassCandidate[]):RouteCollisionHandoff {
  return {routeEpoch:4,oldMapId:1,oldMapEpoch:1,mapEpoch:2,candidates};
}
function reject(fn:()=>unknown){let failed=false;try{fn();}catch{failed=true;}expect(failed).toBe(true);}

worldTest('routes.collision real all15 roadside prefixes use source hulls and retain priority over traffic',()=>{
  let checked=0;
  for(let id=1;id<=15;id++){
    const source=data(id as SourceBiomeId),placement=source.placements.find(p=>collisionRoadsideHull(source,p,true)!==null)!;
    expect(placement!==undefined).toBe(true);
    const hull=collisionRoadsideHull(source,placement,true)!,z=(hull.minZ+hull.maxZ)/2;
    const p=player(z,z,Math.fround(hull.centerX/1600)),cars=car(pool(id as SourceBiomeId),0,z,z,Math.fround(hull.centerX/1600));
    const result=queryRouteCollisionContacts(p,cars,source,[],{mode:'sweep'});
    expect(result.contact!.kind).toBe('roadside');expect(result.contact!.mapId).toBe(id);
    expect(result.eligibilityMask).toBe(0);expect(result.ledger.length).toBe(1);checked++;
  }
  expect(checked).toBe(15);
},SCENE);

worldTest('routes.collision visible one-lap traffic alias and high slot31 contact in canonical source space',()=>{
  const source=data(),length=source.totalCount*150,cars=car(pool(),31,length+10000);
  const before=JSON.stringify(cars),result=queryRouteCollisionContacts(player(),cars,source,[],{mode:'sweep'});
  expect(result.contact!.kind).toBe('traffic');expect(result.contact!.slot).toBe(31);
  expect(result.contact!.epoch).toBe(3);expect(result.contact!.generation).toBe(1);
  expect(result.contact!.witness.b.z).toBe(10000);expect(result.eligibilityMask).toBe(0);
  expect(JSON.stringify(cars)).toBe(before);
},SCENE);

worldTest('routes.collision wrap-safe roadside broadphase never visits a false middle-road sweep',()=>{
  const source=data(),length=source.totalCount*150;
  const p=player(length-30,length+30,-1.1790588),result=queryRouteCollisionContacts(p,pool(),source,[],{mode:'sweep'});
  expect(result.contact).toBe(null);expect(result.ledger).toEqual([]);expect(result.eligibilityMask).toBe(0xffffffff);
  const reverse=queryRouteCollisionContacts(player(length+30,length-30,-1.1790588),pool(),source,[],{mode:'sweep'});
  expect(reverse.contact).toBe(null);
},SCENE);

worldTest('routes.collision start overlap ledger disarms aliases until strict start separation',()=>{
  const source=data(),cars=car(pool(),0,10000),first=queryRouteCollisionContacts(player(),cars,source,[],{mode:'sweep'});
  expect(first.contact!.kind).toBe('traffic');
  const repeated=queryRouteCollisionContacts(player(),cars,source,first.ledger,{mode:'sweep'});
  expect(repeated.contact).toBe(null);expect(repeated.ledger.length).toBe(1);
  const apart=queryRouteCollisionContacts(player(10000,10000,10),cars,source,repeated.ledger,{mode:'sweep'});
  expect(apart.ledger.length).toBe(0);
  expect(queryRouteCollisionContacts(player(),cars,source,apart.ledger,{mode:'sweep'}).contact!.kind).toBe('traffic');
},SCENE);

worldTest('routes.collision handoff endpoint high-slot mask denies only matching outgoing old lifetime',()=>{
  const source=data(2),cars=car(pool(2),31,10000),p=player();
  const result=queryRouteCollisionContacts(p,cars,source,[],{mode:'endpoint',handoff:handoff([candidate(31),candidate(0)])});
  expect(result.contact!.slot).toBe(31);expect(result.eligibilityMask).toBe(0x7fffffff);
  // Contact cannot deny the unrelated old-life candidate in slot0.
  const unrelated=queryRouteCollisionContacts(p,cars,source,[],{mode:'endpoint',handoff:handoff([candidate(0)])});
  expect(unrelated.contact!.slot).toBe(31);expect(unrelated.eligibilityMask).toBe(0xffffffff);
  reject(()=>queryRouteCollisionContacts(p,cars,source,[],{mode:'endpoint',handoff:handoff([candidate(31,2)])}));
  reject(()=>queryRouteCollisionContacts(p,cars,source,[],{mode:'endpoint',handoff:handoff([{...candidate(31),routeEpoch:3}])}));
  reject(()=>queryRouteCollisionContacts(p,cars,source,[],{mode:'sweep',handoff:handoff([candidate(31)])}));
  const unsynced=car(pool(2),31,9999,10000);
  reject(()=>queryRouteCollisionContacts(p,unsynced,source,[],{mode:'endpoint',handoff:handoff([candidate(31)])}));
},SCENE);

worldTest('routes.collision handoff roadside denies whole tick while goal preserves outgoing pass eligibility',()=>{
  const source=data(2),placement=source.placements.find(p=>collisionRoadsideHull(source,p,true)!==null)!,hull=collisionRoadsideHull(source,placement,true)!;
  const p=player((hull.minZ+hull.maxZ)/2,(hull.minZ+hull.maxZ)/2,Math.fround(hull.centerX/1600));
  const result=queryRouteCollisionContacts(p,pool(2),source,[],{mode:'endpoint',handoff:handoff([candidate(0)])});
  expect(result.contact!.kind).toBe('roadside');expect(result.eligibilityMask).toBe(0);
  const goal=data(16),cars=car(pool(16),31,10000);
  const goalOptions={mode:'endpoint' as const,goal:true,handoff:handoff([candidate(31)])};
  const arrived=queryRouteCollisionContacts(player(),cars,goal,[],goalOptions);
  expect(arrived.contact).toBe(null);expect(arrived.eligibilityMask).toBe(0xffffffff);
  expect(queryRouteCollisionContacts(player(),cars,goal,[],{...goalOptions,locked:true}).eligibilityMask).toBe(0);
},SCENE);

worldTest('routes.collision evaluator preserves accepted counter across map change and emits destination physical operands',()=>{
  const previous=driver(),cars=car(pool(2),31,10000);
  previous.ledgerCount=1;previous.ledgerKind[0]=2;previous.ledgerId[0]=31;previous.ledgerEpoch[0]=3;previous.ledgerGeneration[0]=1;
  const before=JSON.stringify(previous);
  const result=evaluateRouteCollisionDriver(previous,driving(),player(),cars,data(2),9,{mode:'endpoint',handoff:handoff([candidate(31)])});
  expect(result.driver.acceptedCount).toBe(8);expect(result.driver.mapId).toBe(2);
  expect(result.driver.ledgerCount).toBe(1);expect(result.hit!.mapId).toBe(2);expect(result.hit!.slot).toBe(31);
  expect(result.hit!.impactSpeed).toBe(120);expect(result.hit!.handlingCap).toBe(200);expect(result.hit!.curve).toBe(0);
  expect(result.driver.motionStep).toBe(9);expect(result.eligibilityMask).toBe(0x7fffffff);
  expect(previous.acceptedCount).toBe(7);expect(previous.mapId).toBe(1);expect(JSON.stringify(previous)).toBe(before);
  const goal=evaluateRouteCollisionDriver(driver(),driving(),player(),car(pool(16),31,10000),data(16),9,
    {mode:'endpoint',goal:true,handoff:handoff([candidate(31)])});
  expect(goal.driver.acceptedCount).toBe(7);expect(goal.hit).toBe(null);expect(goal.eligibilityMask).toBe(0xffffffff);
},SCENE);

worldTest('routes.collision recovery lock prunes stale local ledger but never accepts or awards',()=>{
  const source=data(),cars=car(pool(),31,10000),first=queryRouteCollisionContacts(player(),cars,source,[],{mode:'sweep'});
  const locked=queryRouteCollisionContacts(player(10000,10000,10),cars,source,first.ledger,{mode:'sweep',locked:true});
  expect(locked.contact).toBe(null);expect(locked.ledger.length).toBe(0);expect(locked.eligibilityMask).toBe(0);
  const malformed=pool();malformed.generation[31]=0;
  reject(()=>queryRouteCollisionContacts(player(),malformed,source,[],{mode:'sweep'}));
  reject(()=>queryRouteCollisionContacts(player(),pool(),source,[],{mode:'sweep',goal:true}));
},SCENE);
