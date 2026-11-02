import {component,resource,bool,u32,f32,array} from '@gameengine/schema';

export const RouteLiveSlot=component('RouteLiveSlot',{slot:u32()},{sim:false});
// Acquired leases persist through scene changes; never author this ledger in a scene.
export const RouteLiveVisual=resource('RouteLiveVisual',{
  reconciled:bool(),ownerValid:bool(),ownsActive:bool(),ownsIncoming:bool(),ownsShared:bool(),failed:bool(),ioReady:bool(),renderSettled:bool(),swapping:bool(),transitionComplete:bool(),
  ownerIndex:u32(),ownerGeneration:u32(),routeEpoch:u32(),mapEpoch:u32(),mapId:u32(),active:u32(),incoming:u32(),epoch:u32(),lastFrame:u32(),lastStep:u32(),animationTicks:u32(),transitionTarget:u32(),backgroundMapId:u32(),
  slidePx:f32(),nominalRemainder:f32(),backOffset:f32({default:1000}),frontOffset:f32({default:1000}),parallaxAnchorCamera:f32(),parallaxBaseBack:f32({default:1000}),parallaxBaseFront:f32({default:1000}),
  palette:array(u32(),33),
},{sim:false});
