import {resource,component,bool,f32,u32} from '@gameengine/schema';

// Opt-in immutable-content review transport. No race system reads this resource.
export const EnvironmentReview=resource('EnvironmentReview',{
  enabled:bool(),mapId:u32({default:2}),mode:u32(),batch:u32(),trafficCount:u32(),
  cameraOriginZ:f32({default:45000}),lateral:f32(),
  backOffset:f32({default:1000}),frontOffset:f32({default:1000}),
},{sim:false});
// Never authored in a scene: scene entry must not reset acquired ownership.
export const EnvironmentResidency=resource('EnvironmentResidency',{
  epoch:u32(),incoming:u32(),active:u32(),
  ownsIncoming:bool(),ownsActive:bool(),ownsTraffic:bool(),
  ioReady:bool(),renderSettled:bool(),failed:bool(),
  inputOwnerIndex:u32(),inputOwnerGeneration:u32(),inputOwned:bool(),
  appliedMapSequence:u32(),appliedModeSequence:u32(),
},{sim:false});
export const EnvironmentReviewSlot=component('EnvironmentReviewSlot',{slot:u32()},{sim:false});
// Recorded scene ownership isolates the legacy synthetic proof. SIM systems
// must never infer this boundary from mutable presentation configuration.
export const EnvironmentReviewIsolation=component('EnvironmentReviewIsolation',{
  held:u32(),sequence:u32(),mapId:u32(),mapSequence:u32(),mode:u32(),modeSequence:u32(),
},{sim:true});
