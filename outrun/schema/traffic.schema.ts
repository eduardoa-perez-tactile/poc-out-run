import {component,event,bool,f32,u32,array} from '@gameengine/schema';

// One optional scene-owned, stable-slot pool. Slot n is source model n+1.
// Numeric schema arrays keep all authoritative lifetime/AI state replayable.
export const TrafficPool=component('TrafficPool',{
  mapId:u32({default:1}),initialized:bool(),population:u32({default:20}),
  seedLo:u32({default:305419896}),seedHi:u32({default:2596069104}),originZ:f32(),aiCursor:u32({default:1}),epoch:u32(),
  z:array(f32(),32),previousZ:array(f32(),32),offset:array(f32(),32),previousOffset:array(f32(),32),speed:array(f32(),32),target:array(f32(),32),
  side:array(u32(),32),ai:array(u32(),32),active:array(u32(),32),generation:array(u32(),32),passed:array(u32(),32),
  moving:array(u32(),32),cooldown:array(u32(),32),parked:array(u32(),32),
  // Six moving fixed steps per two-frame cycle; presentation never accumulates it.
  motionTicks:array(u32(),32),
},{sim:true});
export const TrafficResetRequested=event('TrafficResetRequested',{
  mapId:u32({default:1}),population:u32({default:20}),seedLo:u32({default:305419896}),seedHi:u32({default:2596069104}),originZ:f32(),
},{sim:true});
// Route progression owns the request; rebasing itself never grants a pass.
export const TrafficRebaseRequested=event('TrafficRebaseRequested',{mapId:u32({default:1}),shift:f32()},{sim:true});
export const TrafficPassed=event('TrafficPassed',{epoch:u32(),slot:u32(),generation:u32(),points:u32()},{sim:true});
