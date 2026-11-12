import { defineSystem,read,write,query,meshes,assets,MaterialOverrides } from '@gameengine/runtime';
import { RoadProofState,VehiclePreview,VehicleVisualSlot,PreRaceSelection } from '../schema.gen.ts';
import { PLAYER_COLORS } from '../content/vehicles/player-colors.ts';
import { buildVehicleBuffers } from './vehicle-buffers.ts';
import { VISUAL_FRAME_SECONDS } from '../content/vehicles/vehicle-poses.ts';
const wheelEffects:[number,number]=[0,0];
export const VehiclePresentation=defineSystem({
  name:'VehiclePresentation',stage:'LateUpdate',
  query:query(read(VehicleVisualSlot),write(MaterialOverrides)),
  resources:[read(RoadProofState),write(VehiclePreview),read(PreRaceSelection)],
  run(ctx,q){
    if(ctx.step===0)return;
    const preview=ctx.resource(VehiclePreview);
    const selection=ctx.resource(PreRaceSelection);
    const selected=selection.launch[0]!==0?Math.max(0,Math.min(PLAYER_COLORS.length-1,selection.car[0]!)):0;
    const color=PLAYER_COLORS[selected]!;
    const previous=PLAYER_COLORS[Math.min(PLAYER_COLORS.length-1,preview.loadedCar[0]!)]!;
    const inactive=q.count===0||preview.enabled[0]===0;
    let release=preview.loaded[0]!==0;
    if(preview.reconciled[0]===0){
      // A Session rebuild resets project resources but can retain native groups.
      // Reconcile once per world, never by assuming its first render is step 1.
      const groups=assets.stats().groups;
      for(const entry of PLAYER_COLORS){
        // A live owned pin is released below, exactly once. All other stale
        // colors are released without loading the full color catalog.
        if((inactive||entry.index!==selected)&&!(release&&entry.index===previous.index)&&groups[entry.group]?.status==='loaded')assets.release(entry.group);
      }
      ctx.setField(VehiclePreview,'reconciled',true);
    }
    if(inactive){
      // The mesh and preload belong to this world's preview, not this module.
      // destroy makes entities still naming the mesh draw nothing. Release only
      // removes the group pin; cached textures may remain until budget eviction.
      if(meshes.info('player-car')!==null)meshes.destroy('player-car');
      if(release){assets.release(previous.group);ctx.setField(VehiclePreview,'loaded',false);}
      if(q.count===0 && preview.enabled[0]!==0)ctx.setField(VehiclePreview,'enabled',false);
      return;
    }
    if(release&&previous.index!==selected){assets.release(previous.group);ctx.setField(VehiclePreview,'loaded',false);release=false;}
    if(!release){assets.load(color.group);ctx.setField(VehiclePreview,'loaded',true);ctx.setField(VehiclePreview,'loadedCar',selected);}
    const values=`atlas=${color.texture}`;
    for(const chunk of q.chunks())for(let row=0;row<chunk.length;row++){
      if(!chunk.is(MaterialOverrides,row,'values',values))chunk.setField(MaterialOverrides,row,'values',values);
    }
    // Proof's authoritative pause is read-only. Art cannot advance the road or
    // decide crash duration/recovery. Autoplay is an optional review cycle only.
    const road=ctx.resource(RoadProofState);
    const sample=preview.autoplay[0]!==0 ? Math.floor(road.distance[0]!/(7200*VISUAL_FRAME_SECONDS)) : preview.sample[0]!;
    const pose=preview.pose[0]!;
    const placeholder=preview.placeholder[0]!==0 || assets.progress(color.group)<1;
    wheelEffects[0]=preview.leftEffect[0]!;wheelEffects[1]=preview.rightEffect[0]!;
    const data=buildVehicleBuffers(pose,sample,preview.effect[0]!,preview.scale[0]!,placeholder,preview.useWheelEffects[0]!==0?wheelEffects:undefined,preview.hidden[0]!==0);
    if(meshes.info('player-car')===null)meshes.create('player-car',data);
    else meshes.update('player-car',data);
  },
});
