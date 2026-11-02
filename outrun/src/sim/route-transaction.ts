import {math} from '@gameengine/runtime';
import type {RouteDriverValue,RouteTrafficCoordinatesValue,DrivingStateValue,TerrainDriverValue,CrashDriverValue,
  CollisionDriverValue,TrafficPoolValue,ContactAcceptedValue} from '../schema.gen.ts';
import type {RouteContent,RouteDriverState,RouteGradient} from './route-math.ts';
import {publishRoutePassAwards} from './route-math.ts';
import {prepareRoutePlayerTick,finishRoutePlayerTick} from './route-driving-math.ts';
import {resetTerrainDriver,nearestTerrainRoad,terrainWheelContact} from './terrain-math.ts';
import {resetRouteCrashRecovery} from './crash-recovery-math.ts';
import {sampleRouteZ} from './route-space.ts';
import {resetTrafficPool,advanceTrafficPool,finalizeTrafficPool,rebaseTrafficPool,type TrafficRandom,type TrafficPassCandidate} from './traffic-math.ts';
import {hydrateRouteTrafficPool,packRouteTrafficPool} from './route-traffic-state.ts';
import {evaluateRouteCollisionDriver,queryRouteCollisionContacts} from './route-collision-contacts.ts';
import {readCollisionLedger} from './collision-state.ts';
import type {DrivingControls} from './driving-math.ts';
import type {CollisionPlayerMotion} from './collision-motion.ts';
import type {SourceBiomeId} from '../content/biome.ts';

export interface RouteActorSnapshot {
  route:RouteDriverValue;coordinates:RouteTrafficCoordinatesValue;driving:DrivingStateValue;
  terrain:TerrainDriverValue;crash:CrashDriverValue;collision:CollisionDriverValue;pool:TrafficPoolValue;
}
export interface RouteActorResult extends RouteActorSnapshot {
  hit:ContactAcceptedValue|null;awards:TrafficPassCandidate[];
}
function need(value:boolean,message:string):asserts value{if(!value)throw new Error('Route transaction: '+message);}
function gradient(value:number):RouteGradient {need(value===-1||value===0||value===1,'invalid selected gradient');return value;}
function resetCollision(previous:CollisionDriverValue,step:number):CollisionDriverValue{
  return {...previous,mapId:1,initialized:true,motionValid:false,motionStep:step,locked:false,acceptedCount:0,
    z0:0,z1:0,l0:0,ls:0,lc:0,lr:0,lf:0,drift:0,previousGap:0,carryApplied:false,handlingCap:0,
    ledgerCount:0,ledgerKind:Array(64).fill(0),ledgerId:Array(64).fill(0),ledgerEpoch:Array(64).fill(0),ledgerGeneration:Array(64).fill(0)};
}
/** One native AdvanceTraffic invocation supplies its borrowed RNG to BOTH advance
 * and finalize. No scene replacement, second traffic update or new-life query.
 * Route intent is schema-owned; repeat preparation is pure and checked exactly.
 */
export function commitRouteActors(before:RouteActorSnapshot,controls:DrivingControls,content:RouteContent,
  dt:number,step:number,rng:TrafficRandom,population=before.pool.population):RouteActorResult{
  dt=math.fround(dt);need(dt===math.fround(1/60),'requires nominal source60Hz');
  const route=before.route;
  need(route.initialized&&route.pending&&route.pendingStep===step,'missing current route intent');
  need(route.pendingFromMapId>=1&&route.pendingFromMapId<=15,'invalid outgoing route map');
  const outgoing=content.get(route.pendingFromMapId as SourceBiomeId,gradient(route.pendingFromGradient));
  const destination=content.get(route.mapId as SourceBiomeId,gradient(route.gradient));
  const oldIdentity={mapId:outgoing.id,routeEpoch:route.routeEpoch,mapEpoch:route.pendingOldMapEpoch};
  const identity={mapId:destination.id,routeEpoch:route.routeEpoch,mapEpoch:route.mapEpoch};
  const domain={kind:'source-route' as const,routeEpoch:route.routeEpoch,mapEpoch:route.pendingOldMapEpoch};
  if(route.pendingReset){
    need(route.mapId===1&&route.mapEpoch===1&&route.stage===0&&!route.pendingHandoff,'invalid reset intent');
    const row=sampleRouteZ(outgoing,45000+702),contact=terrainWheelContact(0,outgoing.segments[row.row]!.gap,outgoing.terrain,outgoing.roadTerrain);
    const terrain={...resetTerrainDriver(),initialized:true,segment:row.row,previousGap:outgoing.segments[row.row]!.gap,
      roadSide:nearestTerrainRoad(0,outgoing.segments[row.row]!.gap),leftOutside:contact.leftOutside,rightOutside:contact.rightOutside};
    const player={previousZ:45702,z:45702,previousLateral:0,lateral:0,previousSide:terrain.roadSide,side:terrain.roadSide,playing:before.driving.playing};
    const raw=resetTrafficPool(before.pool,{mapId:1,population,seedLo:route.seedLo,seedHi:route.seedHi,originZ:0},player,outgoing,rng,domain);
    const advanced=advanceTrafficPool(raw,player,outgoing,dt,rng,{suppressPass:true,route:domain});
    const final=finalizeTrafficPool(advanced,0,rng),packed=packRouteTrafficPool(final.pool,identity,destination);
    return {route:{...route,pending:false},...packed,driving:{...before.driving,distance:45000,previousDistance:45000,
      lateral:0,previousLateral:0,legacySpeed:0,gear:0,steering:0},terrain,crash:resetRouteCrashRecovery(1),
      collision:resetCollision(before.collision,step),hit:null,awards:final.awards};
  }
  need(before.terrain.mapId===outgoing.id&&before.crash.mapId===outgoing.id&&before.collision.mapId===outgoing.id,'physical maps differ from outgoing intent');
  need(before.driving.distance===route.pendingPreviousCamera,'driving camera differs from route authority');
  const rawPool=hydrateRouteTrafficPool(before.pool,before.coordinates,oldIdentity,outgoing);
  const prepared=prepareRoutePlayerTick({...before.driving,distance:route.pendingPreviousCamera},before.terrain,before.crash,controls,dt,outgoing);
  need(prepared.driving.distance===route.pendingOutgoingCamera&&prepared.unwrappedCamera===route.pendingRawCamera,'preparation differs from route intent');
  need(route.camera===(route.pendingHandoff?0:prepared.driving.distance),'route commit camera mismatch');
  const player={previousZ:route.pendingPreviousCamera+702,z:prepared.unwrappedCamera+702,
    // Source handleEvent controls precede outgoing NPC AI; CF/bounds finish later.
    previousLateral:prepared.driving.lateral,lateral:prepared.driving.lateral,
    previousSide:before.terrain.roadSide,side:before.terrain.roadSide,playing:before.driving.playing};
  const advanced=advanceTrafficPool(rawPool,player,outgoing,dt,rng,{suppressPass:false,route:domain});
  // Exit keeps outgoing pass eligibility, but never accepts an outgoing impact.
  // Only control + longitudinal movement occurred there: do not invent old-map
  // CF/recovery finishing before the real destination finishing below.
  let outgoingMask=0xffffffff;
  if(route.pendingHandoff){
    const controlTrace:CollisionPlayerMotion={kind:'player',z0:player.previousZ,z1:player.z,
      l0:before.driving.lateral,ls:prepared.driving.lateral,lc:prepared.driving.lateral,
      lr:prepared.driving.lateral,lf:prepared.driving.lateral,drift:0,
      previousGap:before.terrain.previousGap,carryApplied:false};
    outgoingMask=queryRouteCollisionContacts(controlTrace,advanced.pool,outgoing,
      readCollisionLedger(before.collision),{mode:'sweep',locked:prepared.lockedThisTick}).eligibilityMask;
  }
  const physical=finishRoutePlayerTick(prepared,destination,route.pendingHandoff?{outgoingCamera:route.pendingOutgoingCamera}:null);
  const driving={...before.driving,...physical.driving,previousDistance:route.pendingHandoff?0:route.pendingPreviousCamera,
    previousLateral:route.pendingHandoff?physical.driving.lateral:before.driving.lateral};
  const transferred=route.pendingHandoff
    ?rebaseTrafficPool(advanced.pool,destination.id,route.pendingOutgoingCamera,destination,identityDomain(identity))
    :advanced.pool;
  const motion=physical.motion;
  need(motion!==undefined&&physical.motionMode!=='none','admitted route tick requires physical operands');
  const trace:CollisionPlayerMotion={kind:'player',...motion};
  const collision={...before.collision,motionValid:true,motionStep:step,locked:physical.lockedThisTick,
    ...motion,handlingCap:motion.handlingCap};
  const evaluation=evaluateRouteCollisionDriver(collision,driving,trace,transferred,destination,step,{
    mode:route.pendingHandoff?'endpoint':'sweep',locked:physical.lockedThisTick,goal:route.goalEntered,
    ...(route.pendingHandoff?{handoff:{routeEpoch:route.routeEpoch,oldMapId:outgoing.id,
      oldMapEpoch:route.pendingOldMapEpoch,mapEpoch:route.mapEpoch,candidates:advanced.passCandidates}}:{}),
  });
  let crash=physical.crash;
  if(evaluation.hit){
    const hit=evaluation.hit;
    need(crash.phase===0&&!physical.lockedThisTick&&crash.mapId===hit.mapId,'incoherent accepted crash');
    crash={...crash,pendingStep:step,kind:hit.kind,impactSpeed:hit.impactSpeed,handlingCap:hit.handlingCap,
      collisionDir:hit.collisionDir,curve:hit.curve};
  }
  // Finalize ORIGINAL old lives exactly once, then transfer the finalized pool.
  const final=finalizeTrafficPool(advanced,(outgoingMask&evaluation.eligibilityMask)>>>0,rng);
  const finalRaw=route.pendingHandoff
    ?rebaseTrafficPool(final.pool,destination.id,route.pendingOutgoingCamera,destination,identityDomain(identity))
    :final.pool;
  const packed=packRouteTrafficPool(finalRaw,identity,destination);
  let amount=0;for(const award of final.awards)amount+=award.points;
  const latched=publishRoutePassAwards({...route,gradient:gradient(route.gradient)} as RouteDriverState,route.pendingOldMapEpoch,amount,step);
  return {route:{...route,...latched,pending:false},...packed,driving,terrain:physical.driver,crash,
    collision:evaluation.driver,hit:evaluation.hit,awards:final.awards};
}
function identityDomain(identity:{routeEpoch:number;mapEpoch:number}){
  return {kind:'source-route' as const,routeEpoch:identity.routeEpoch,mapEpoch:identity.mapEpoch};
}
