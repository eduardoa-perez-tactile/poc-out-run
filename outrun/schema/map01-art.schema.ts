import { resource,component,bool,f32,u32 } from '@gameengine/schema';

// Authoring transport and residency only; race outcomes never read these fields.
export const Map01ArtPreview=resource('Map01ArtPreview',{
  enabled:bool(),playing:bool(),followDriving:bool(),
  cameraOriginZ:f32({default:45000}),previousCameraOriginZ:f32({default:45000}),
  lateral:f32(),speed:f32({default:7200}),lastStep:u32(),controlHeld:u32(),
  lastCameraOriginZ:f32({default:45000}),
  backOffset:f32({default:1000}),frontOffset:f32({default:1000}),
  previousBackOffset:f32({default:1000}),previousFrontOffset:f32({default:1000}),
  loaded:bool(),reconciled:bool(),
},{sim:false});

export const Map01ArtSlot=component('Map01ArtSlot',{
  slot:u32(),
},{sim:false});
