import {defineSystem,query,read,write,RenderTime} from '@gameengine/runtime';
import {DrivingState,DrivingInput,DrivingResetRequested,TerrainDriver,TerrainVisualState,Map01ArtPreview,VehiclePreview} from '../schema.gen.ts';
import {loadMap01} from '../content/biome.ts';
import {MAP01_ART} from '../content/environments/map01.manifest.ts';
import {VISUAL_FRAME_SECONDS} from '../content/vehicles/vehicle-poses.ts';
import {terrainParallaxOffset,terrainVehiclePose} from './terrain-presentation-math.ts';

export const TerrainPresentation=defineSystem({
  name:'TerrainPresentation',stage:'LateUpdate',before:['Map01ArtPresentation','VehiclePresentation'],
  events:[DrivingResetRequested],
  query:query(read(TerrainDriver),write(TerrainVisualState)),
  resources:[read(DrivingState),read(DrivingInput),read(RenderTime),write(Map01ArtPreview),write(VehiclePreview)],
  run(ctx,owners){
    const map=ctx.resource(Map01ArtPreview),vehicle=ctx.resource(VehiclePreview);
    if(owners.count!==1){
      // Release only this adapter's mode/visibility overrides. Standalone review
      // poses, effects, enabled flags and asset ownership belong to their owners.
      if(map.followDriving[0]!==0)ctx.setField(Map01ArtPreview,'followDriving',false);
      if(vehicle.useWheelEffects[0]!==0||vehicle.hidden[0]!==0)ctx.set(VehiclePreview,{useWheelEffects:false,hidden:false});
      return;
    }
    if(ctx.step===0)return;
    const driving=ctx.resource(DrivingState),input=ctx.resource(DrivingInput),data=loadMap01();
    const playing=driving.playing[0]!==0;
    const resetRequested=ctx.events.count(DrivingResetRequested)>0;
    const alpha=playing?Math.max(0,Math.min(1,ctx.resource(RenderTime).alpha[0]!)):1;
    const current=driving.distance[0]!,previous=driving.previousDistance[0]!;
    for(const chunk of owners.chunks()){
      const driver=chunk.col(TerrainDriver),visual=chunk.col(TerrainVisualState);
      for(let i=0;i<chunk.length;i++){
        if(driver.mapId[i]!==1)throw new Error(`Terrain presentation has unsupported map${driver.mapId[i]}`);
        const recentering=driver.recentering[i]!==0;
        const last=visual.lastStep[i]!,first=last===0;
        const reset=resetRequested&&last!==ctx.step;
        let ticks=visual.animationTicks[i]!;
        // The recorded driving reset also anchors visual phase. IO-dependent
        // startup time cannot choose another source frame after the same reset.
        // Consume it once per fixed step, even if LateUpdate renders it again.
        if(reset)ticks=0;
        else if(playing&&!recentering&&!first&&ctx.step>last)ticks+=ctx.step-last;
        if(last!==ctx.step)chunk.set(TerrainVisualState,i,{lastStep:ctx.step,animationTicks:ticks});
        const sample=Math.floor(ticks*ctx.dt/VISUAL_FRAME_SECONDS);
        const row=data.segments[Math.min(data.totalCount-1,driver.segment[i]!)]!;
        const pose=playing||first||reset?terrainVehiclePose(driving.steering[0]!,row.y1-row.y0,((input.keyboard[0]!|input.ui[0]!)&2)!==0):vehicle.pose[0]!;
        ctx.set(Map01ArtPreview,{
          followDriving:true,playing,cameraOriginZ:current,previousCameraOriginZ:previous,
          lateral:driving.previousLateral[0]!+(driving.lateral[0]!-driving.previousLateral[0]!)*alpha,
          backOffset:terrainParallaxOffset(data,current,0,MAP01_ART.backgrounds.back.sourceSizePx[0]),
          previousBackOffset:terrainParallaxOffset(data,previous,0,MAP01_ART.backgrounds.back.sourceSizePx[0]),
          frontOffset:terrainParallaxOffset(data,current,1,MAP01_ART.backgrounds.front.sourceSizePx[0]),
          previousFrontOffset:terrainParallaxOffset(data,previous,1,MAP01_ART.backgrounds.front.sourceSizePx[0]),
        });
        ctx.set(VehiclePreview,{
          autoplay:false,useWheelEffects:true,pose,sample,hidden:recentering,
          leftEffect:driving.legacySpeed[0]!>0&&!recentering?driver.leftEffect[i]!:0,
          rightEffect:driving.legacySpeed[0]!>0&&!recentering?driver.rightEffect[i]!:0,
        });
      }
    }
  },
});
