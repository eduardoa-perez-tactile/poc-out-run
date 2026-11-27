import {worldTest,expect,type WorldTestContext} from '@gameengine/test';
import {math,pcg32} from '@gameengine/runtime';
import {RouteDriver,RouteTrafficCoordinates,DrivingState,TerrainDriver,CrashDriver,CollisionDriver,TrafficPool} from '../../src/schema.gen.ts';
import {originalRouteSources} from '../../src/content/route-boot.ts';
import type {SourceBiomeId} from '../../src/content/biome.ts';
import {commitRouteActors,type RouteActorSnapshot} from '../../src/sim/route-transaction.ts';
import {advanceRouteState,type RouteDriverState} from '../../src/sim/route-math.ts';
import {prepareRoutePlayerTick} from '../../src/sim/route-driving-math.ts';
import {beginRouteCrashRecovery} from '../../src/sim/crash-recovery-math.ts';
import {sampleRouteZ} from '../../src/sim/route-space.ts';
import {hydrateRouteTrafficPool,packRouteTrafficPool} from '../../src/sim/route-traffic-state.ts';
import {advanceTrafficPool,rebaseTrafficPool,type TrafficRandom} from '../../src/sim/traffic-math.ts';
import {queryRouteCollisionContacts} from '../../src/sim/route-collision-contacts.ts';
import {collisionOverlaps,type CollisionPlayerMotion} from '../../src/sim/collision-motion.ts';
import {routeCollisionPose} from '../../src/sim/route-collision-motion.ts';
import {PLAYER_COLLIDER,collisionTrafficHull} from '../../src/sim/collision-metadata.ts';

const SCENE={scene:'scenes/original-route-sim.scene.json'},DT=math.fround(1/60);
const GAS={throttle:true,brake:false,left:false,right:false,up:false,down:false};
const content=originalRouteSources;
function clone<T>(value:T):T{return JSON.parse(JSON.stringify(value))as T;}
function trafficRng(){const calls:number[][]=[];const rng:TrafficRandom={range(lo,hi){calls.push([lo,hi]);return lo===-6?0:lo;}};return {calls,rng};}
function routeRng(){const native=pcg32(9,2596069104,0x524f5554,0),calls:number[][]=[];return {calls,rng:{state:native.state,range(lo:number,hi:number){calls.push([lo,hi]);return native.range(lo,hi);}}};}
async function initial(ctx:WorldTestContext):Promise<RouteActorSnapshot>{
  await ctx.step(1);const owners=ctx.world.entities(RouteDriver);expect(owners.length).toBe(1);const e=owners[0]!;
  const snapshot:RouteActorSnapshot={route:ctx.world.get(e,RouteDriver),coordinates:ctx.world.get(e,RouteTrafficCoordinates),driving:ctx.world.resource(DrivingState),
    terrain:ctx.world.get(e,TerrainDriver),crash:ctx.world.get(e,CrashDriver),collision:ctx.world.get(e,CollisionDriver),pool:ctx.world.get(e,TrafficPool)};
  expect(snapshot.route.initialized).toBe(true);expect(snapshot.route.pending).toBe(false);expect(snapshot.route.camera).toBe(45000);expect(snapshot.driving.legacySpeed).toBe(0);expect(snapshot.pool.population).toBe(20);
  // world.get uses shortest native JSON float strings. Restore native f32 values
  // in this LOCAL pure-call snapshot; no world/resource setters are used.
  for(const field of ['offset','previousOffset','speed','target']as const)snapshot.pool[field]=snapshot.pool[field].map(math.fround);
  return snapshot;
}
/** LOCAL boundary supplements derived from the actual startup snapshot. These
 * do not replace the separate recorded normal-input canonical route traversal. */
function boundary(start:RouteActorSnapshot,mapId:SourceBiomeId=1,side:0|1=0,speed=200):RouteActorSnapshot {
  const before=clone(start),node=content().catalog.entries[mapId-1]!,gradient=node.stage===5?1:0,data=content().get(mapId,gradient);
  const camera=(data.lastLine+1)*150-702-speed,index=sampleRouteZ(data,camera+702).row,gap=data.segments[index]!.gap,lateral=side===1?math.fround(gap/1600):0;
  before.route={...before.route,mapId,gradient,stage:node.stage-1,mapEpoch:node.stage,entryCount:node.stage,rangeCalls:Math.min(node.stage,4),
    camera,previousCamera:camera,choiceLatched:true,chosenSide:side,nextMapId:side===0?node.links.left:node.links.right,
    checkpointAwarded:mapId!==1,goalEntered:false,pending:false};
  before.driving={...before.driving,active:true,playing:true,manual:false,distance:camera,previousDistance:camera,lateral,previousLateral:lateral,legacySpeed:speed,gear:1,steering:0};
  before.terrain={...before.terrain,mapId,initialized:true,segment:index,previousGap:gap,roadSide:side,sectionEnd:false,recentering:false};
  before.crash={...before.crash,mapId,phase:0,consumedAcceptedCount:5,pendingStep:0};
  before.collision={...before.collision,mapId,initialized:true,acceptedCount:5,ledgerCount:0};
  const raw=hydrateRouteTrafficPool(start.pool,start.coordinates,{mapId:1,routeEpoch:start.route.routeEpoch,mapEpoch:1},content().get(1,start.route.gradient as -1|0|1));
  raw.mapId=mapId;
  for(let slot=0;slot<raw.population;slot++){raw.parked[slot]=1;raw.active[slot]=0;raw.speed[slot]=0;raw.z[slot]=raw.previousZ[slot]=0;raw.offset[slot]=raw.previousOffset[slot]=0;raw.ai[slot]=1;raw.side[slot]=0;raw.passed[slot]=0;}
  const packed=packRouteTrafficPool(raw,{mapId,routeEpoch:before.route.routeEpoch,mapEpoch:before.route.mapEpoch},data);
  before.pool=packed.pool;before.coordinates=packed.coordinates;return before;
}
function setCar(before:RouteActorSnapshot,slot:number,z:number,offset:number){
  const data=content().get(before.route.mapId as SourceBiomeId,before.route.gradient as -1|0|1),identity={mapId:data.id,routeEpoch:before.route.routeEpoch,mapEpoch:before.route.mapEpoch};
  const raw=hydrateRouteTrafficPool(before.pool,before.coordinates,identity,data);
  raw.parked[slot]=0;raw.active[slot]=1;raw.z[slot]=raw.previousZ[slot]=z;raw.speed[slot]=0;raw.offset[slot]=raw.previousOffset[slot]=math.fround(offset);raw.side[slot]=0;raw.ai[slot]=1;
  const packed=packRouteTrafficPool(raw,identity,data);before.pool=packed.pool;before.coordinates=packed.coordinates;
}
function stage(before:RouteActorSnapshot){
  const old=before.route,data=content().get(old.mapId as SourceBiomeId,old.gradient as -1|0|1),prepared=prepareRoutePlayerTick(before.driving,before.terrain,before.crash,GAS,DT,data);
  const step=old.processedStep+1,random=routeRng(),transition=advanceRouteState({...old,gradient:old.gradient as -1|0|1}as RouteDriverState,prepared.driving.distance,before.terrain.roadSide as 0|1,true,content(),random.rng,step);
  expect(transition.entry!==null).toBe(true);
  const actors:RouteActorSnapshot={...before,route:{...old,...transition.route,pending:true,pendingStep:step,pendingReset:false,pendingHandoff:true,
    pendingFromMapId:old.mapId,pendingFromGradient:old.gradient,pendingOldMapEpoch:old.mapEpoch,pendingPreviousCamera:old.camera,
    pendingOutgoingCamera:prepared.driving.distance,pendingRawCamera:prepared.unwrappedCamera}};
  return {actors,step,prepared,transition,routeCalls:random.calls};
}
function rawResult(result:RouteActorSnapshot){return hydrateRouteTrafficPool(result.pool,result.coordinates,{mapId:result.route.mapId,routeEpoch:result.route.routeEpoch,mapEpoch:result.route.mapEpoch},content().get(result.route.mapId as SourceBiomeId,result.route.gradient as -1|0|1));}
function controlSweep(staged:ReturnType<typeof stage>){
  const {actors,prepared}=staged,route=actors.route,data=content().get(route.pendingFromMapId as SourceBiomeId,route.pendingFromGradient as -1|0|1),identity={mapId:data.id,routeEpoch:route.routeEpoch,mapEpoch:route.pendingOldMapEpoch};
  const raw=hydrateRouteTrafficPool(actors.pool,actors.coordinates,identity,data),player={previousZ:route.pendingPreviousCamera+702,z:prepared.unwrappedCamera+702,
    previousLateral:prepared.driving.lateral,lateral:prepared.driving.lateral,previousSide:actors.terrain.roadSide,side:actors.terrain.roadSide,playing:true};
  const advanced=advanceTrafficPool(raw,player,data,DT,trafficRng().rng,{suppressPass:false,route:{kind:'source-route',routeEpoch:identity.routeEpoch,mapEpoch:identity.mapEpoch}});
  const l=prepared.driving.lateral,trace:CollisionPlayerMotion={kind:'player',z0:player.previousZ,z1:player.z,l0:actors.driving.lateral,ls:l,lc:l,lr:l,lf:l,drift:0,previousGap:actors.terrain.previousGap,carryApplied:false};
  return {advanced,trace,query:queryRouteCollisionContacts(trace,advanced.pool,data,[],{mode:'sweep'}),data};
}

worldTest('routes.transaction both real first exits preserve coowned state and use actual destination gap with one traffic finalize',async ctx=>{
  const start=await initial(ctx);
  for(const side of [0,1]as const){
    const before=boundary(start,1,side),oldGap=before.terrain.previousGap,staged=stage(before),rng=trafficRng(),snapshot=JSON.stringify(staged.actors);
    const result=commitRouteActors(staged.actors,GAS,content(),DT,staged.step,rng.rng);
    expect(result.route.mapId).toBe(side===0?2:3);expect(result.route.camera).toBe(0);expect(result.driving.distance).toBe(0);expect(result.driving.previousDistance).toBe(0);
    expect(result.driving.legacySpeed).toBe(200);expect(result.driving.gear).toBe(1);expect(result.driving.lateral).toBe(before.driving.lateral);
    expect(oldGap).toBe(2);expect(result.terrain.previousGap).toBe(0);expect(result.terrain.mapId).toBe(result.route.mapId);expect(result.crash.mapId).toBe(result.route.mapId);expect(result.collision.mapId).toBe(result.route.mapId);
    expect(result.collision.acceptedCount).toBe(5);expect(result.crash.consumedAcceptedCount).toBe(5);expect(result.hit).toBe(null);expect(result.route.pending).toBe(false);
    expect(result.pool.epoch).toBe(before.pool.epoch);expect(result.pool.generation).toEqual(before.pool.generation);expect(result.pool.ai).toEqual(before.pool.ai);
    expect(result.coordinates.mapEpoch).toBe(2);expect(result.coordinates.routeEpoch).toBe(start.route.routeEpoch);expect(rawResult(result).originZ).toBe(-staged.prepared.driving.distance);
    expect(staged.routeCalls).toEqual([[-1,2]]);expect(rng.calls).toEqual([]);expect(JSON.stringify(staged.actors)).toBe(snapshot);
  }
},SCENE);

worldTest('routes.transaction outgoing colliding genuine pass is consumed without award or outgoing crash acceptance at empty destination',async ctx=>{
  const before=boundary(await initial(ctx));setCar(before,0,before.driving.distance+702+10,0);
  const staged=stage(before),control=controlSweep(staged);expect(control.advanced.passCandidates.length).toBe(1);
  expect(control.query.contact?.kind).toBe('traffic');expect(control.query.contact?.id).toBe(0);expect(control.query.eligibilityMask).toBe(0);
  const rng=trafficRng(),result=commitRouteActors(staged.actors,GAS,content(),DT,staged.step,rng.rng);
  expect(result.hit).toBe(null);expect(result.awards).toEqual([]);expect(result.pool.passed[0]).toBe(1);
  expect(result.collision.acceptedCount).toBe(5);expect(result.collision.ledgerCount).toBe(0);expect(result.crash.consumedAcceptedCount).toBe(5);
  expect(result.crash.pendingStep).toBe(0);expect(result.crash.phase).toBe(0);expect(result.route.passAwardCount).toBe(0);expect(rng.calls).toEqual([]);
  // New player702 versus transferred old car512: genuine old sweep overlapped,
  // but destination endpoint has190 separation (hulls sum150), hence no hit.
  expect(rawResult(result).z[0]).toBe(512);expect(result.driving.distance+702-rawResult(result).z[0]!).toBe(190);
},SCENE);

worldTest('routes.transaction eligible outgoing old map pass awards once and replacement life is not queried before finalize',async ctx=>{
  const before=boundary(await initial(ctx)),destination=content().get(2,0),outgoingCamera=(content().get(1,0).lastLine+1)*150-702;
  setCar(before,0,before.driving.distance+702+10,.8);
  // Source-visible old alias is already behind; exactly one recycle puts the
  // NEW generation at destination player702. It must not enter the earlier query.
  setCar(before,1,outgoingCamera+destination.totalCount*150+702-75000,0);
  const staged=stage(before),control=controlSweep(staged);expect(control.query.contact).toBe(null);expect(control.advanced.recycleSlots).toEqual([1]);
  const rng=trafficRng(),result=commitRouteActors(staged.actors,GAS,content(),DT,staged.step,rng.rng);
  expect(result.awards).toEqual([{epoch:before.pool.epoch,slot:0,generation:1,points:20000,mapId:1,routeEpoch:before.route.routeEpoch,mapEpoch:1}]);
  expect(result.route.passAwardCount).toBe(1);expect(result.route.passAwardAmount).toBe(20000);expect(result.route.passAwardOldMapEpoch).toBe(1);expect(result.route.passAwardStep).toBe(staged.step);
  expect(result.hit).toBe(null);expect(result.collision.acceptedCount).toBe(5);expect(result.crash.pendingStep).toBe(0);
  expect(rng.calls).toEqual([[0,2],[-6,7],[5,10]]);expect(result.pool.generation[1]).toBe(2);
  const raw=rawResult(result),l=result.driving.lateral,trace:CollisionPlayerMotion={kind:'player',z0:702,z1:702,l0:l,ls:l,lc:l,lr:l,lf:l,drift:0,previousGap:0,carryApplied:false};
  expect(sampleRouteZ(destination,raw.z[1]!).canonicalZ).toBe(702);
  const replacementControl=queryRouteCollisionContacts(trace,raw,destination,[],{mode:'endpoint'});
  expect(replacementControl.contact?.id).toBe(1);expect(replacementControl.contact?.generation).toBe(2);
},SCENE);

worldTest('routes.transaction running crash survives ordinary handoff with captured operands counters and acceptance coherence',async ctx=>{
  const before=boundary(await initial(ctx),1,0,100);
  before.collision.acceptedCount=6;
  before.crash=beginRouteCrashRecovery(before.crash,{mapId:1,kind:1,impactSpeed:100,handlingCap:200,collisionDir:math.fround(.2),curve:math.fround(-.75)},1,6);
  before.crash.cadenceTick=1;const staged=stage(before),rng=trafficRng(),result=commitRouteActors(staged.actors,GAS,content(),DT,staged.step,rng.rng);
  expect(result.route.mapId).toBe(2);expect(result.driving.distance).toBe(0);expect(result.driving.legacySpeed).toBe(100);expect(result.crash.mapId).toBe(2);expect(result.crash.phase).toBe(1);
  for(const field of ['variant','kind','impactSpeed','handlingCap','collisionDir','curve','totalAdvances','advances','decrement','reactionTick','consumedAcceptedCount']as const)expect(result.crash[field]).toBe(before.crash[field]);
  expect(result.crash.cadenceTick).toBe(2);expect(result.collision.acceptedCount).toBe(6);expect(result.crash.pendingStep).toBe(0);expect(result.hit).toBe(null);expect(result.awards).toEqual([]);expect(result.terrain.previousGap).toBe(0);expect(rng.calls).toEqual([]);
},SCENE);

worldTest('routes.transaction genuine goal entry suppresses new contact but retains eligible outgoing pass and arrival identity',async ctx=>{
  const before=boundary(await initial(ctx),11),outgoing=content().get(11,1),goal=content().get(16,0),camera=(outgoing.lastLine+1)*150-702;
  setCar(before,0,before.driving.distance+702+10,.8);setCar(before,1,camera+goal.totalCount*150+702,0);
  const staged=stage(before),control=controlSweep(staged);expect(control.query.contact).toBe(null);
  const destination=content().get(16,staged.actors.route.gradient as -1|0|1),transferred=rebaseTrafficPool(control.advanced.pool,16,camera,destination,{kind:'source-route',routeEpoch:before.route.routeEpoch,mapEpoch:6});
  const occupancy=routeCollisionPose({kind:'traffic',z0:transferred.previousZ[1]!,z1:transferred.z[1]!,offset0:0,offset1:0,side:0},true,destination);
  expect(collisionOverlaps({x:0,z:702},PLAYER_COLLIDER,occupancy,collisionTrafficHull(2))).toBe(true);
  const rng=trafficRng(),result=commitRouteActors(staged.actors,GAS,content(),DT,staged.step,rng.rng);
  expect(result.route.mapId).toBe(16);expect(result.route.stage).toBe(5);expect(result.route.goalEntered).toBe(true);expect(result.route.arrivalCount).toBe(1);expect(result.route.arrivalStep).toBe(staged.step);expect(result.route.rangeCalls).toBe(5);
  expect(result.hit).toBe(null);expect(result.collision.acceptedCount).toBe(5);expect(result.crash.consumedAcceptedCount).toBe(5);expect(result.crash.pendingStep).toBe(0);
  expect(result.awards.length).toBe(1);expect(result.awards[0]!.mapId).toBe(11);expect(result.awards[0]!.mapEpoch).toBe(5);expect(result.route.passAwardOldMapEpoch).toBe(5);expect(result.route.passAwardAmount).toBe(20000);
  expect(staged.routeCalls).toEqual([[-1,2]]);expect(rng.calls).toEqual([[0,2],[-6,7],[5,10]]);
},SCENE);

worldTest('routes.transaction all30 actual graph edge boundary supplements publish coherent destination raw coordinates without source mutation',async ctx=>{
  const start=await initial(ctx);let checked=0;
  for(const node of content().catalog.entries){if(node.terminal)continue;
    for(const side of [0,1]as const){
      const before=boundary(start,node.id as SourceBiomeId,side),staged=stage(before),rng=trafficRng(),result=commitRouteActors(staged.actors,GAS,content(),DT,staged.step,rng.rng);
      expect(result.route.mapId).toBe(side===0?node.links.left:node.links.right);expect(result.coordinates.mapEpoch).toBe(node.stage+1);
      expect(result.pool.mapId).toBe(result.route.mapId);expect(result.terrain.mapId).toBe(result.route.mapId);expect(result.crash.mapId).toBe(result.route.mapId);expect(result.collision.mapId).toBe(result.route.mapId);
      expect(rawResult(result).z.length).toBe(32);expect(rawResult(result).previousZ.length).toBe(32);expect(result.hit).toBe(null);expect(result.awards).toEqual([]);expect(rng.calls).toEqual([]);checked++;
    }
  }
  expect(checked).toBe(30);expect(start.route.camera).toBe(45000);expect(start.driving.legacySpeed).toBe(0);
},SCENE);
