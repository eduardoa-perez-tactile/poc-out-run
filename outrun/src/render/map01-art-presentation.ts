import {defineSystem,read,write,query,meshes,assets,ViewInfo,RenderTime,KeyEvent,Keys,type MeshArrays} from '@gameengine/runtime';
import {Map01ArtPreview,Map01ArtSlot} from '../schema.gen.ts';
import {loadMap01,sourcePlayerSample} from '../content/biome.ts';
import {MAP01_ART} from '../content/environments/map01.manifest.ts';
import {buildSourceRoad,sourceProjectionStats} from './source-projection.ts';
import {VISIBLE_SEGMENTS} from './road-projection.ts';
import {buildMap01ArtProps,map01AtlasLookup,map01ArtStats} from './map01-art-buffers.ts';
import {buildMap01Panorama,advanceMap01Parallax,wrapMap01Texels} from './map01-art-backgrounds.ts';

const GROUP='map01-environment';
const names=['map01-art-road','map01-art-props','map01-art-back','map01-art-front'] as const;
const atlas={sizePx:MAP01_ART.atlas.sizePx,byObjectId:map01AtlasLookup(MAP01_ART.images)};
function upload(name:string,arrays:MeshArrays){
  if(meshes.info(name)===null)meshes.create(name,arrays);else meshes.update(name,arrays);
  map01ArtStats.uploads++;
}
function interpolateOffset(previous:number,current:number,alpha:number,width:number){
  const delta=wrapMap01Texels(current-previous+width/2,width)-width/2;
  return wrapMap01Texels(previous+delta*alpha,width);
}

export const Map01ArtPresentation=defineSystem({
  name:'Map01ArtPresentation',stage:'LateUpdate',after:['Map01Presentation'],
  events:[KeyEvent],query:query(read(Map01ArtSlot)),
  resources:[write(Map01ArtPreview),read(ViewInfo),read(RenderTime)],
  run(ctx,owners){
    if(ctx.step===0)return;
    const preview=ctx.resource(Map01ArtPreview),inactive=owners.count!==1||preview.enabled[0]===0;
    let release=preview.loaded[0]!==0;
    if(preview.reconciled[0]===0){
      // Rebuild can reset JS resources while the native asset book survives.
      if(inactive&&assets.stats().groups[GROUP]?.status==='loaded')release=true;
      ctx.setField(Map01ArtPreview,'reconciled',true);
    }
    if(inactive){
      for(const name of names)if(meshes.info(name)!==null)meshes.destroy(name);
      if(release){assets.release(GROUP);ctx.setField(Map01ArtPreview,'loaded',false);}
      if(owners.count!==1&&preview.enabled[0]!==0)ctx.setField(Map01ArtPreview,'enabled',false);
      ctx.set(Map01ArtPreview,{lastStep:0,controlHeld:0});
      map01ArtStats.ready=false;map01ArtStats.drawn=0;map01ArtStats.roadQuads=0;map01ArtStats.uploads=0;
      return;
    }
    if(preview.loaded[0]===0){assets.load(GROUP);ctx.setField(Map01ArtPreview,'loaded',true);}
    const ready=assets.progress(GROUP)>=1;map01ArtStats.ready=ready;
    const data=loadMap01(),maxZ=(data.totalCount-VISIBLE_SEGMENTS)*data.segmentLength;
    const first=preview.lastStep[0]===0;
    const clamped=Math.max(0,Math.min(maxZ,preview.cameraOriginZ[0]!));
    const teleported=preview.cameraOriginZ[0]!==preview.lastCameraOriginZ[0]||clamped!==preview.cameraOriginZ[0];
    if(teleported)ctx.set(Map01ArtPreview,{cameraOriginZ:clamped,previousCameraOriginZ:clamped,previousBackOffset:preview.backOffset[0]!,previousFrontOffset:preview.frontOffset[0]!});
    const newStep=preview.lastStep[0]!==ctx.step;
    if(newStep){
      let selected=-1,playing=preview.playing[0]!==0,held=preview.controlHeld[0]!;
      for(const key of ctx.events.read(KeyEvent)){
        const bit=key.code===Keys.KeyP?1:key.code===Keys.Digit7?2:key.code===Keys.Digit8?4:key.code===Keys.Digit9?8:key.code===Keys.Digit0?16:0;
        if(bit===0)continue;
        const rising=key.down&&(held&bit)===0;
        held=key.down?held|bit:held&~bit;
        if(!rising)continue;
        if(key.code===Keys.KeyP)playing=!playing;
        else selected=key.code===Keys.Digit7?45000:key.code===Keys.Digit8?54000:key.code===Keys.Digit9?1930*150:4284*150;
      }
      ctx.setField(Map01ArtPreview,'controlHeld',held);
      if(selected>=0){
        ctx.set(Map01ArtPreview,{cameraOriginZ:selected,previousCameraOriginZ:selected,backOffset:1000,frontOffset:1000,previousBackOffset:1000,previousFrontOffset:1000});
        playing=false;
      }
      ctx.setField(Map01ArtPreview,'playing',playing);
      // Transport advances only on newly observed fixed steps, never once per
      // render callback. A late initial frame or pending IO does not catch up.
      const steps=first||!ready||selected>=0||teleported?0:Math.max(0,ctx.step-preview.lastStep[0]!);
      if(playing)for(let tick=0;tick<steps;tick++){
        const previous=preview.cameraOriginZ[0]!,next=Math.max(0,Math.min(maxZ,Math.fround(previous+preview.speed[0]!*ctx.dt)));
        const player=sourcePlayerSample(data,next),row=data.segments[player.index]!;
        const back=preview.backOffset[0]!,front=preview.frontOffset[0]!;
        ctx.set(Map01ArtPreview,{
          previousCameraOriginZ:previous,cameraOriginZ:next,previousBackOffset:back,previousFrontOffset:front,
          backOffset:wrapMap01Texels(advanceMap01Parallax(back,row.curve,next-previous,data.segmentLength,0,row.mirror,true),MAP01_ART.backgrounds.back.sourceSizePx[0]),
          frontOffset:wrapMap01Texels(advanceMap01Parallax(front,row.curve,next-previous,data.segmentLength,1,row.mirror,true),MAP01_ART.backgrounds.front.sourceSizePx[0]),
        });
        if(next===previous){ctx.setField(Map01ArtPreview,'playing',false);break;}
      }
      ctx.setField(Map01ArtPreview,'lastStep',ctx.step);
    }
    const playing=preview.playing[0]!==0;
    const alpha=playing?Math.max(0,Math.min(1,ctx.resource(RenderTime).alpha[0]!)):1;
    const current=Math.max(0,Math.min(maxZ,preview.cameraOriginZ[0]!));
    const previous=preview.previousCameraOriginZ[0]!;
    const distance=playing?previous+(current-previous)*alpha:current;
    const view=ctx.resource(ViewInfo),aspect=Math.fround(view.width[0]!/Math.max(1,view.height[0]!));
    const road=buildSourceRoad(data,distance,preview.lateral[0]!,aspect);
    map01ArtStats.roadQuads=sourceProjectionStats.visibleRoadSegments*9;
    upload(names[0],road);
    if(ready){
      upload(names[1],buildMap01ArtProps(data,view.width[0]!,aspect,atlas));
      const back=interpolateOffset(preview.previousBackOffset[0]!,preview.backOffset[0]!,alpha,MAP01_ART.backgrounds.back.sourceSizePx[0]);
      const front=interpolateOffset(preview.previousFrontOffset[0]!,preview.frontOffset[0]!,alpha,MAP01_ART.backgrounds.front.sourceSizePx[0]);
      upload(names[2],buildMap01Panorama(0,aspect,sourceProjectionStats.horizonY,back,MAP01_ART.backgrounds.back.sourceSizePx));
      upload(names[3],buildMap01Panorama(1,aspect,sourceProjectionStats.horizonY,front,MAP01_ART.backgrounds.front.sourceSizePx));
    }else{
      for(const name of [names[1],names[2],names[3]])if(meshes.info(name)!==null)meshes.destroy(name);
      map01ArtStats.drawn=0;
    }
    ctx.setField(Map01ArtPreview,'lastCameraOriginZ',current);
  },
});
