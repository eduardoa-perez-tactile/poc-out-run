import {defineSystem,read,query,ViewInfo,RenderTime,assets} from '@gameengine/runtime';
import {CrashDriver,CollisionDriver,TerrainDriver,DrivingState,VehiclePreview,ContactAccepted} from '../schema.gen.ts';
import {frameForPose} from '../content/vehicles/vehicle-poses.ts';
import {crashDiagnosticsEnabled,publishCrashDiagnostics,clearCrashDiagnostics,crashPlayerArtReady} from './crash-diagnostics.ts';

export const CrashDiagnosticsPresentation=defineSystem({
  name:'CrashDiagnosticsPresentation',stage:'LateUpdate',after:['TerrainPresentation','VehiclePresentation','Map01ArtPresentation'],
  query:query(read(CrashDriver),read(CollisionDriver),read(TerrainDriver)),events:[ContactAccepted],
  resources:[read(DrivingState),read(VehiclePreview),read(ViewInfo),read(RenderTime)],
  run(ctx,owners){
    if(ctx.step===0){clearCrashDiagnostics();return;}
    if(!crashDiagnosticsEnabled()||owners.count===0){clearCrashDiagnostics();return;}
    if(owners.count!==1)throw new Error('Crash diagnostics require one matching owner');
    const state=ctx.resource(DrivingState),visual=ctx.resource(VehiclePreview),view=ctx.resource(ViewInfo);
    const progress=assets.progress('player-ferrari1'),group=assets.stats().groups['player-ferrari1'];
    for(const chunk of owners.chunks())for(let row=0;row<chunk.length;row++){
      const crash=chunk.get(CrashDriver,row),collision=chunk.col(CollisionDriver);
      if(crash.mapId!==collision.mapId[row]||crash.mapId!==chunk.col(TerrainDriver).mapId[row])throw new Error('Crash diagnostics owner maps must match');
      publishCrashDiagnostics({step:ctx.step,frame:ctx.resource(RenderTime).frame[0]!,
        ready:group!==undefined&&crashPlayerArtReady(visual.enabled[0]!==0,visual.loaded[0]!==0,visual.placeholder[0]!==0,progress,group.failed),
        placeholder:visual.placeholder[0]!==0||progress<1,
        viewport:{width:view.width[0]!,height:view.height[0]!},
        driver:{distance:state.distance[0]!,previousDistance:state.previousDistance[0]!,lateral:state.lateral[0]!,
          previousLateral:state.previousLateral[0]!,legacySpeed:state.legacySpeed[0]!,playing:state.playing[0]!==0},
        crash,collision:{acceptedCount:collision.acceptedCount[row]!,locked:collision.locked[row]!==0,ledgerCount:collision.ledgerCount[row]!},
        visual:{pose:visual.pose[0]!,sample:visual.sample[0]!,sourceFrame:frameForPose(visual.pose[0]!,visual.sample[0]!),
          hidden:visual.hidden[0]!==0,leftEffect:visual.leftEffect[0]!,rightEffect:visual.rightEffect[0]!},
        contacts:ctx.events.read(ContactAccepted),
      });
    }
  },
});
