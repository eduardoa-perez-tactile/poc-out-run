import {component,event,bool,i32,u32,f32,array} from '@gameengine/schema';

// Optional authority on the SAME entity as terrain, traffic, contacts and crash.
// An absent owner must not dispatch or seed the AdvanceRoute native RNG stream.
export const RouteDriver=component('RouteDriver',{
  initialized:bool(),routeEpoch:u32(),mapEpoch:u32(),mapId:u32({default:1}),stage:u32(),gradient:i32(),
  camera:i32({default:45000}),previousCamera:i32({default:45000}),
  choiceLatched:bool(),chosenSide:u32(),nextMapId:u32(),checkpointAwarded:bool(),goalEntered:bool(),
  seedLo:u32({default:305419896}),seedHi:u32({default:2596069104}),rangeCalls:u32(),entryCount:u32(),
  checkpointCount:u32(),checkpointStep:u32(),checkpointBonusSeconds:u32(),arrivalCount:u32(),arrivalStep:u32(),
  passAwardCount:u32(),passAwardStep:u32(),passAwardAmount:u32(),passAwardOldMapEpoch:u32(),processedStep:u32(),
  // Same-step intent for the following traffic-owned atomic actor transaction.
  pending:bool(),pendingStep:u32(),pendingReset:bool(),pendingHandoff:bool(),
  pendingFromMapId:u32(),pendingFromGradient:i32(),pendingOldMapEpoch:u32(),
  pendingPreviousCamera:i32(),pendingOutgoingCamera:i32(),pendingRawCamera:i32(),
},{sim:true});

// Source NPC Z storage is int32, including odd values above 2^24. The existing
// TrafficPool f32 fields remain compatibility/presentation mirrors on this path.
export const RouteTrafficCoordinates=component('RouteTrafficCoordinates',{
  initialized:bool(),routeEpoch:u32(),mapEpoch:u32(),originZ:i32(),
  rawZ:array(i32(),32),previousRawZ:array(i32(),32),
},{sim:true});

// Full recorded reset only. A biome handoff never emits old driving/pool resets.
export const RouteResetRequested=event('RouteResetRequested',{
  seedLo:u32({default:305419896}),seedHi:u32({default:2596069104}),
  population:u32({default:20}),manual:bool(),
},{sim:true});
const identity={routeEpoch:u32(),mapEpoch:u32(),mapId:u32(),stage:u32()};
export const RouteForkChosen=event('RouteForkChosen',{
  ...identity,side:u32(),nextMapId:u32(),gradient:i32(),
},{sim:true});
export const RouteBiomeEntered=event('RouteBiomeEntered',{
  ...identity,fromMapId:u32(),gradient:i32(),outgoingCamera:i32(),
},{sim:true});
export const RouteCheckpointPassed=event('RouteCheckpointPassed',{
  ...identity,checkpointLine:u32(),bonusSeconds:u32(),
},{sim:true});
export const RouteGoalEntered=event('RouteGoalEntered',{
  ...identity,gradient:i32(),
},{sim:true});
export const RouteTrafficPassed=event('RouteTrafficPassed',{
  ...identity,poolEpoch:u32(),slot:u32(),generation:u32(),points:u32(),
},{sim:true});
// Keep the legacy contact event unchanged; route audit adds lifetime identity.
export const RouteContactAccepted=event('RouteContactAccepted',{
  routeEpoch:u32(),mapEpoch:u32(),routeStage:u32(),
  kind:u32(),mapId:u32(),id:u32(),epoch:u32(),generation:u32(),slot:u32(),
  toi:f32(),stage:u32(),playerX:f32(),playerZ:f32(),otherX:f32(),otherZ:f32(),
  impactSpeed:f32(),handlingCap:f32(),collisionDir:f32(),curve:f32(),
},{sim:true});
