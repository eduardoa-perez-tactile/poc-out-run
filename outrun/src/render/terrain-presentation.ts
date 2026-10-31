import {defineSystem,query,read,write,RenderTime} from '@gameengine/runtime';
import {DrivingState,DrivingInput,DrivingResetRequested,TerrainDriver,TerrainVisualState,CrashDriver,Map01ArtPreview,VehiclePreview,RouteDriver} from '../schema.gen.ts';
import {loadMap01} from '../content/biome.ts';
import {MAP01_ART} from '../content/environments/map01.manifest.ts';
import {VISUAL_FRAME_SECONDS} from '../content/vehicles/vehicle-poses.ts';
import {terrainParallaxOffset,terrainVehiclePose} from './terrain-presentation-math.ts';
import {crashVehicleSample,type CrashVehicleSample} from './crash-presentation-math.ts';

export const TerrainPresentation=defineSystem({
  name:'TerrainPresentation',stage:'LateUpdate',before:['Map01ArtPresentation','VehiclePresentation'],
  events:[DrivingResetRequested],
  queries:{owners:query(read(TerrainDriver),write(TerrainVisualState)),crashes:query(read(CrashDriver)),routes:query(read(RouteDriver))},
  resources:[read(DrivingState),read(DrivingInput),read(RenderTime),write(Map01ArtPreview),write(VehiclePreview)],
  run(ctx,{owners,crashes,routes}){
    // The live route presenter is child74. This Map1-only adapter must never
    // project destination SIM data through its fixed Map1 geometry.
    if(routes.count!==0)return;
    if(crashes.count>1||crashes.count>owners.count)throw new Error('Crash presentation requires one matching terrain owner');
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
        let crashFrame:CrashVehicleSample|null=null;
        if(crashes.count===1)for(const recovery of crashes.chunks())for(let row=0;row<recovery.length;row++){
          if(recovery.entity(row)!==chunk.entity(i))throw new Error('Crash presentation owner must match terrain');
          const crash=recovery.col(CrashDriver);
          if(crash.mapId[row]!==driver.mapId[i])throw new Error('Crash presentation owner maps must match');
          crashFrame=crashVehicleSample({phase:crash.phase[row]!,variant:crash.variant[row]!,
            advances:crash.advances[row]!,reactionTick:crash.reactionTick[row]!});
        }
        const sample=crashFrame?.sample??Math.floor(ticks*ctx.dt/VISUAL_FRAME_SECONDS);
        const row=data.segments[Math.min(data.totalCount-1,driver.segment[i]!)]!;
        // A completed crash may receive no redraw before pause. Release only
        // this live owner's inherited spin/reaction pose; keep ordinary pause
        // behavior and standalone authored review poses unchanged.
        const inheritedCrash=crashes.count===1&&crashFrame===null&&vehicle.pose[0]!>=18&&vehicle.pose[0]!<=21;
        const ordinaryPose=playing||first||reset||inheritedCrash
          ?terrainVehiclePose(driving.steering[0]!,row.y1-row.y0,((input.keyboard[0]!|input.ui[0]!)&2)!==0):vehicle.pose[0]!;
        const pose=crashFrame?.pose??ordinaryPose,hidden=crashFrame?.hidden??recentering;
        ctx.set(Map01ArtPreview,{
          followDriving:true,playing,cameraOriginZ:current,previousCameraOriginZ:previous,
          lateral:driving.previousLateral[0]!+(driving.lateral[0]!-driving.previousLateral[0]!)*alpha,
          backOffset:terrainParallaxOffset(data,current,0,MAP01_ART.backgrounds.back.sourceSizePx[0]),
          previousBackOffset:terrainParallaxOffset(data,previous,0,MAP01_ART.backgrounds.back.sourceSizePx[0]),
          frontOffset:terrainParallaxOffset(data,current,1,MAP01_ART.backgrounds.front.sourceSizePx[0]),
          previousFrontOffset:terrainParallaxOffset(data,previous,1,MAP01_ART.backgrounds.front.sourceSizePx[0]),
        });
        ctx.set(VehiclePreview,{
          autoplay:false,useWheelEffects:true,pose,sample,hidden,
          leftEffect:driving.legacySpeed[0]!>0&&!hidden?driver.leftEffect[i]!:0,
          rightEffect:driving.legacySpeed[0]!>0&&!hidden?driver.rightEffect[i]!:0,
        });
      }
    }
  },
});
