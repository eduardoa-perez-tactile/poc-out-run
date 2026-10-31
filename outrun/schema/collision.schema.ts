import {component,event,bool,f32,u32,array} from '@gameengine/schema';

// Optional detector owner. Old proof scenes have no row of this component.
// The authoritative driving step publishes its own operands; collision never
// reconstructs handling from final poses or reads presentation state.
export const CollisionDriver=component('CollisionDriver',{
  mapId:u32({default:1}),initialized:bool(),motionValid:bool(),motionStep:u32(),
  // #62 supplies the recovery lock; the detector foundation never sets it.
  locked:bool(),acceptedCount:u32(),
  z0:f32(),z1:f32(),l0:f32(),ls:f32(),lc:f32(),lr:f32(),lf:f32(),
  drift:f32(),previousGap:f32(),carryApplied:bool(),handlingCap:f32(),
  ledgerCount:u32(),ledgerKind:array(u32(),64),ledgerId:array(u32(),64),
  ledgerEpoch:array(u32(),64),ledgerGeneration:array(u32(),64),
},{sim:true});

// kind1 roadside /2 traffic; stage0 continuous /1 pre-jump /2 post-jump
// /3 final-bound. Traffic keys identify the OLD life before finalize/recycle.
// TOI is a witness only: the fully integrated ordinary hit pose is retained.
export const ContactAccepted=event('ContactAccepted',{
  kind:u32(),mapId:u32(),id:u32(),epoch:u32(),generation:u32(),slot:u32(),
  toi:f32(),stage:u32(),playerX:f32(),playerZ:f32(),otherX:f32(),otherZ:f32(),
  impactSpeed:f32(),handlingCap:f32(),collisionDir:f32(),curve:f32(),
},{sim:true});
