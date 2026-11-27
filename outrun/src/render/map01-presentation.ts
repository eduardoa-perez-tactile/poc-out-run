import {defineSystem,read,write,query,meshes,ViewInfo,KeyEvent,Keys} from '@gameengine/runtime';
import {Map01Preview,Map01VisualCache,Map01VisualSlot} from '../schema.gen.ts';
import {loadMap01} from '../content/biome.ts';
import {buildSourceRoad,buildSourceProps,sourceProjectionStats} from './source-projection.ts';
export const Map01Presentation=defineSystem({
  name:'Map01Presentation',stage:'LateUpdate',events:[KeyEvent],resources:[write(Map01Preview),read(ViewInfo),write(Map01VisualCache)],
  query:query(read(Map01VisualSlot)),
  run(ctx,slots){
    if(ctx.step===0)return;
    const state=ctx.resource(Map01Preview);
    // Scene resources survive EnterScene; the scene-owned marker does not.
    // Require exactly one owner before accepting controls or creating meshes.
    if(slots.count!==1||state.enabled[0]===0){
      if(meshes.info('map01-road')!==null)meshes.destroy('map01-road');
      if(meshes.info('map01-props')!==null)meshes.destroy('map01-props');
      sourceProjectionStats.visibleRoadSegments=0;sourceProjectionStats.drawnProps=0;
      if(slots.count!==1&&state.enabled[0]!==0)ctx.setField(Map01Preview,'enabled',false);
      return;
    }
    // Diagnostic-only viewport samples; these recorded keys never write driving/race state.
    for(const key of ctx.events.read(KeyEvent))if(key.down){
      const sample=key.code===Keys.Digit7?45000:key.code===Keys.Digit8?54000:key.code===Keys.Digit9?1930*150:key.code===Keys.Digit0?4284*150:-1;
      if(sample>=0)ctx.setField(Map01Preview,'cameraOriginZ',sample);
    }
    const view=ctx.resource(ViewInfo),aspect=Math.fround(view.width[0]!/Math.max(1,view.height[0]!));
    const distance=state.cameraOriginZ[0]!,lateral=state.lateral[0]!;
    // Re-read the content version and physical view width: floating source flags
    // scale with width, even when a resize preserves the aspect ratio.
    const data=loadMap01();
    const road=buildSourceRoad(data,distance,lateral,aspect),props=buildSourceProps(data,view.width[0]!,aspect);
    if(meshes.info('map01-road')===null)meshes.create('map01-road',road);else meshes.update('map01-road',road);
    if(meshes.info('map01-props')===null)meshes.create('map01-props',props);else meshes.update('map01-props',props);
    ctx.set(Map01VisualCache,{cameraOriginZ:distance,lateral,aspect});
  },
});
