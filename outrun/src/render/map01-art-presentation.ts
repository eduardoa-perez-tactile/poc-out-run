import {defineSystem,read,write,query,meshes,assets,ViewInfo,RenderTime,KeyEvent,Keys,type MeshArrays} from '@gameengine/runtime';
import {Map01ArtPreview,Map01ArtSlot,TrafficPool,TrafficArtResidency,TrafficArtPreview,DrivingState,TerrainDriver,TrafficPassed,type TrafficPoolValue,type TrafficPassedValue} from '../schema.gen.ts';
import {loadMap01,sourcePlayerSample} from '../content/biome.ts';
import {MAP01_ART} from '../content/environments/map01.manifest.ts';
import {buildSourceRoad,sourceProjectionStats} from './source-projection.ts';
import {VISIBLE_SEGMENTS} from './road-projection.ts';
import {buildTrafficComposite,trafficCompositeStats,trafficCompositeSamples} from './traffic-buffers.ts';
import {trafficDiagnosticsEnabled,publishTrafficDiagnostics,clearTrafficDiagnostics} from './traffic-diagnostics.ts';
import {buildTrafficCatalog} from './traffic-catalog.ts';
import {makeTrafficArtFixture} from './traffic-art-fixtures.ts';
import {buildMap01ArtProps,map01AtlasLookup,map01ArtStats} from './map01-art-buffers.ts';
import {buildMap01Panorama,advanceMap01Parallax,wrapMap01Texels} from './map01-art-backgrounds.ts';

const GROUP='map01-environment';
const TRAFFIC_GROUP='traffic-source';
const CATALOG_GROUP='traffic-catalog';
const names=['map01-art-road','map01-art-props','map01-art-back','map01-art-front'] as const;
const atlas={sizePx:MAP01_ART.atlas.sizePx,byObjectId:map01AtlasLookup(MAP01_ART.images)};
function upload(name:string,arrays:MeshArrays){
  if(meshes.info(name)===null)meshes.create(name,arrays);else meshes.update(name,arrays);
  const bytes=arrays.positions.byteLength+(arrays.normals?.byteLength??0)+(arrays.tangents?.byteLength??0)+(arrays.uvs?.byteLength??0)+(arrays.uvs1?.byteLength??0)+(arrays.colors?.byteLength??0)+(arrays.indices?.byteLength??0);
  map01ArtStats.uploads++;map01ArtStats.submittedBytes+=bytes;
  map01ArtStats.frameUploadCalls++;map01ArtStats.frameSubmittedBytes+=bytes;
}
function interpolateOffset(previous:number,current:number,alpha:number,width:number){
  const delta=wrapMap01Texels(current-previous+width/2,width)-width/2;
  return wrapMap01Texels(previous+delta*alpha,width);
}

export const Map01ArtPresentation=defineSystem({
  name:'Map01ArtPresentation',stage:'LateUpdate',after:['Map01Presentation'],
  events:[KeyEvent,TrafficPassed],queries:{owners:query(read(Map01ArtSlot)),traffic:query(read(TrafficPool)),terrain:query(read(TerrainDriver))},
  resources:[write(Map01ArtPreview),write(TrafficArtResidency),read(TrafficArtPreview),read(DrivingState),read(ViewInfo),read(RenderTime)],
  run(ctx,{owners,traffic,terrain}){
    const frame=ctx.resource(RenderTime).frame[0]!;
    if(map01ArtStats.renderFrame!==frame){map01ArtStats.renderFrame=frame;map01ArtStats.frameUploadCalls=0;map01ArtStats.frameSubmittedBytes=0;}
    if(ctx.step===0)return;
    const preview=ctx.resource(Map01ArtPreview),inactive=owners.count!==1||preview.enabled[0]===0;
    if(traffic.count>1)throw new Error('Map1 renderer requires at most one TrafficPool');
    const art=ctx.resource(TrafficArtPreview),residency=ctx.resource(TrafficArtResidency);
    if(art.mode[0]!>2)throw new Error('Unknown traffic art preview mode');
    const diagnostics=trafficDiagnosticsEnabled();
    if(!diagnostics||inactive||traffic.count!==1||art.mode[0]!==0)clearTrafficDiagnostics();
    const needsTraffic=!inactive&&(traffic.count===1||art.mode[0]!==0);
    const needsCatalog=!inactive&&art.mode[0]===1;
    let releaseCatalog=residency.catalogLoaded[0]!==0;
    if(residency.catalogReconciled[0]===0){
      if(!needsCatalog&&assets.stats().groups[CATALOG_GROUP]?.status==='loaded')releaseCatalog=true;
      ctx.setField(TrafficArtResidency,'catalogReconciled',true);
    }
    if(!needsCatalog&&releaseCatalog){assets.release(CATALOG_GROUP);ctx.setField(TrafficArtResidency,'catalogLoaded',false);}
    else if(needsCatalog&&residency.catalogLoaded[0]===0){assets.load(CATALOG_GROUP);ctx.setField(TrafficArtResidency,'catalogLoaded',true);}
    let releaseTraffic=residency.loaded[0]!==0;
    if(residency.reconciled[0]===0){
      if(!needsTraffic&&assets.stats().groups[TRAFFIC_GROUP]?.status==='loaded')releaseTraffic=true;
      ctx.setField(TrafficArtResidency,'reconciled',true);
    }
    if(!needsTraffic&&releaseTraffic){assets.release(TRAFFIC_GROUP);ctx.setField(TrafficArtResidency,'loaded',false);}
    else if(needsTraffic&&residency.loaded[0]===0){assets.load(TRAFFIC_GROUP);ctx.setField(TrafficArtResidency,'loaded',true);}
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
      map01ArtStats.ready=false;map01ArtStats.drawn=0;map01ArtStats.roadQuads=0;map01ArtStats.uploads=0;map01ArtStats.submittedBytes=0;
      return;
    }
    if(preview.loaded[0]===0){assets.load(GROUP);ctx.setField(Map01ArtPreview,'loaded',true);}
    const ready=assets.progress(GROUP)>=1&&(!needsTraffic||assets.progress(TRAFFIC_GROUP)>=1)&&(!needsCatalog||assets.progress(CATALOG_GROUP)>=1);map01ArtStats.ready=ready;
    const data=loadMap01(),maxZ=(data.totalCount-VISIBLE_SEGMENTS)*data.segmentLength;
    if(art.mode[0]===1){
      // A presentation-only source catalog shares this uploader and both group
      // pins; it never creates or edits an authoritative traffic owner.
      for(const name of [names[0],names[2],names[3]])if(meshes.info(name)!==null)meshes.destroy(name);
      if(ready){const view=ctx.resource(ViewInfo);upload(names[1],buildTrafficCatalog(view.width[0]!,view.height[0]!,art.frame[0]!));}
      else if(meshes.info(names[1])!==null)meshes.destroy(names[1]);
      map01ArtStats.roadQuads=0;map01ArtStats.drawn=0;ctx.setField(Map01ArtPreview,'lastStep',ctx.step);
      return;
    }
    // The source-driving adapter supplies current/previous simulation samples.
    // None of the art review's keys, teleport detection or transport may compete.
    if(preview.followDriving[0]===0){
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
    }
    const playing=preview.playing[0]!==0;
    const alpha=playing?Math.max(0,Math.min(1,ctx.resource(RenderTime).alpha[0]!)):1;
    const current=Math.max(0,Math.min(maxZ,preview.cameraOriginZ[0]!));
    const previous=preview.previousCameraOriginZ[0]!;
    let distance=playing?previous+(current-previous)*alpha:current;
    const view=ctx.resource(ViewInfo),aspect=Math.fround(view.width[0]!/Math.max(1,view.height[0]!));
    let renderData=data,lateral=preview.lateral[0]!,pool:TrafficPoolValue|undefined;
    if(art.mode[0]===2){
      const fixture=makeTrafficArtFixture(data,art.caseId[0]!);
      renderData=fixture.data;pool=fixture.pool;distance=fixture.cameraOriginZ;lateral=fixture.lateral;
    }else for(const chunk of traffic.chunks())for(let row=0;row<chunk.length;row++)pool=chunk.get(TrafficPool,row);
    const road=buildSourceRoad(renderData,distance,lateral,aspect);
    map01ArtStats.roadQuads=sourceProjectionStats.visibleRoadSegments*9;
    upload(names[0],road);
    if(ready){
      upload(names[1],pool?buildTrafficComposite(renderData,view.width[0]!,aspect,atlas,pool,alpha,playing):buildMap01ArtProps(data,view.width[0]!,aspect,atlas));
      const back=interpolateOffset(preview.previousBackOffset[0]!,preview.backOffset[0]!,alpha,MAP01_ART.backgrounds.back.sourceSizePx[0]);
      const front=interpolateOffset(preview.previousFrontOffset[0]!,preview.frontOffset[0]!,alpha,MAP01_ART.backgrounds.front.sourceSizePx[0]);
      upload(names[2],buildMap01Panorama(0,aspect,sourceProjectionStats.horizonY,back,MAP01_ART.backgrounds.back.sourceSizePx));
      upload(names[3],buildMap01Panorama(1,aspect,sourceProjectionStats.horizonY,front,MAP01_ART.backgrounds.front.sourceSizePx));
    }else{
      for(const name of [names[1],names[2],names[3]])if(meshes.info(name)!==null)meshes.destroy(name);
      map01ArtStats.drawn=0;
    }
    // Explicit read-only project probe for browser QA; no native/release DTO
    // construction, and authored art fixtures never claim live simulation data.
    if(diagnostics&&art.mode[0]===0&&pool&&terrain.count===1){
      let roadSide=0;
      for(const chunk of terrain.chunks())for(let row=0;row<chunk.length;row++)roadSide=chunk.get(TerrainDriver,row).roadSide;
      const driving=ctx.resource(DrivingState),distance=driving.distance[0]!;
      const passes:TrafficPassedValue[]=[];
      for(const pass of ctx.events.read(TrafficPassed))passes.push({epoch:pass.epoch,slot:pass.slot,generation:pass.generation,points:pass.points});
      publishTrafficDiagnostics({step:ctx.step,frame,viewport:{width:view.width[0]!,height:view.height[0]!},ready,
        driver:{distance,lateral:driving.lateral[0]!,legacySpeed:driving.legacySpeed[0]!,playing:driving.playing[0]!==0,
          playerZ:sourcePlayerSample(data,distance).playerZ,roadSide},pool,stats:trafficCompositeStats,samples:trafficCompositeSamples,passes});
    }else if(diagnostics)clearTrafficDiagnostics();
    ctx.setField(Map01ArtPreview,'lastCameraOriginZ',current);
  },
});
