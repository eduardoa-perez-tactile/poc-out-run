import { defineSystem,read,write,query,meshes,assets } from '@gameengine/runtime';
import { RoadProofState,VehiclePreview,VehicleVisualSlot } from '../schema.gen.ts';
import { buildVehicleBuffers } from './vehicle-buffers.ts';
import { VISUAL_FRAME_SECONDS } from '../content/vehicles/vehicle-poses.ts';
const wheelEffects:[number,number]=[0,0];
export const VehiclePresentation=defineSystem({
  name:'VehiclePresentation',stage:'LateUpdate',
  query:query(read(VehicleVisualSlot)),
  resources:[read(RoadProofState),write(VehiclePreview)],
  run(ctx,q){
    if(ctx.step===0)return;
    const preview=ctx.resource(VehiclePreview);
    const inactive=q.count===0||preview.enabled[0]===0;
    let release=preview.loaded[0]!==0;
    if(preview.reconciled[0]===0){
      // A Session rebuild resets project resources but can retain native groups.
      // Reconcile once per world, never by assuming its first render is step 1.
      if(inactive && assets.stats().groups['player-ferrari1']?.status==='loaded')release=true;
      ctx.setField(VehiclePreview,'reconciled',true);
    }
    if(inactive){
      // The mesh and preload belong to this world's preview, not this module.
      // destroy makes entities still naming the mesh draw nothing. Release only
      // removes the group pin; cached textures may remain until budget eviction.
      if(meshes.info('player-car')!==null)meshes.destroy('player-car');
      if(release){assets.release('player-ferrari1');ctx.setField(VehiclePreview,'loaded',false);}
      if(q.count===0 && preview.enabled[0]!==0)ctx.setField(VehiclePreview,'enabled',false);
      return;
    }
    if(preview.loaded[0]===0){assets.load('player-ferrari1');ctx.setField(VehiclePreview,'loaded',true);}
    // Proof's authoritative pause is read-only. Art cannot advance the road or
    // decide crash duration/recovery. Autoplay is an optional review cycle only.
    const road=ctx.resource(RoadProofState);
    const sample=preview.autoplay[0]!==0 ? Math.floor(road.distance[0]!/(7200*VISUAL_FRAME_SECONDS)) : preview.sample[0]!;
    const pose=preview.pose[0]!;
    const placeholder=preview.placeholder[0]!==0 || assets.progress('player-ferrari1')<1;
    wheelEffects[0]=preview.leftEffect[0]!;wheelEffects[1]=preview.rightEffect[0]!;
    const data=buildVehicleBuffers(pose,sample,preview.effect[0]!,preview.scale[0]!,placeholder,preview.useWheelEffects[0]!==0?wheelEffects:undefined,preview.hidden[0]!==0);
    if(meshes.info('player-car')===null)meshes.create('player-car',data);
    else meshes.update('player-car',data);
  },
});
