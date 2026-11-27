import {component,f32,u32} from '@gameengine/schema';

// Optional physical recovery owner. Presentation reads these fixed-step phases;
// renders never advance them. Old proof scenes contain no CrashDriver row.
export const CrashDriver=component('CrashDriver',{
  mapId:u32({default:1}),phase:u32(),consumedAcceptedCount:u32(),pendingStep:u32(),variant:u32(),kind:u32(),
  impactSpeed:f32(),handlingCap:f32(),collisionDir:f32(),curve:f32(),
  totalAdvances:u32(),advances:u32(),cadenceTick:u32(),decrement:f32(),
  reactionTick:u32(),recenterTarget:f32(),
},{sim:true});
