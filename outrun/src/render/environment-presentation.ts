import {defineSystem,read,write,query,meshes,textures,assets,MaterialOverrides,ViewInfo,RenderStatus,entityString,KeyEvent,Keys,type MeshArrays,type SystemContext} from '@gameengine/runtime';
import {EnvironmentReview,EnvironmentResidency,EnvironmentReviewSlot} from '../schema.gen.ts';
import {loadSourceBiome,type SourceBiomeId} from '../content/biome.ts';
import {destinationEnvironment,destinationDataGroup} from '../content/environments/destination-environments.ts';
import {createEnvironmentBuffers} from './environment-buffers.ts';
import {createEnvironmentTrafficFixture} from './environment-fixtures.ts';
import {buildMap01Panorama} from './map01-art-backgrounds.ts';
import {sourceProjectionStats} from './source-projection.ts';
import {buildEnvironmentCatalog,environmentCatalogSamples} from './environment-catalog.ts';
import {createEnvironmentReadiness,resetEnvironmentReadiness,submitEnvironmentReadiness,observeEnvironmentReadiness} from './environment-readiness.ts';
import {ProjectionBuffers} from './projection-buffers.ts';
import {environmentDiagnosticsEnabled,publishEnvironmentDiagnostics} from './environment-diagnostics.ts';

const SHARED='environment-review-shared';
const names=['environment-road','environment-composite','environment-back','environment-front','environment-sky'];
const buffers=createEnvironmentBuffers(),sky=new ProjectionBuffers(1),white=new Uint8Array([255,255,255]);
const controlledTraffic=createEnvironmentTrafficFixture();
const readiness=createEnvironmentReadiness();
let initialized=false,selectionKey='',controlKey='';
let reviewHeld=0,lastInputStep=-1;
export const environmentPresentationStats={uploads:0,submittedBytes:0,dataReads:0,mapId:0,mode:0,ready:false,failure:'',geometry:buffers.stats,samples:buffers.samples};
function clear(){for(const name of names)if(meshes.info(name)!==null)meshes.destroy(name);}
function upload(name:string,arrays:MeshArrays){
  if(meshes.info(name)===null)meshes.create(name,arrays);else meshes.update(name,arrays);
  environmentPresentationStats.uploads++;
  environmentPresentationStats.submittedBytes+=arrays.positions.byteLength+(arrays.normals?.byteLength??0)+(arrays.tangents?.byteLength??0)+(arrays.uvs?.byteLength??0)+(arrays.uvs1?.byteLength??0)+(arrays.colors?.byteLength??0)+(arrays.indices?.byteLength??0);
}
function releasePair(mapId:number){assets.release([destinationEnvironment(mapId).assetId,destinationDataGroup(mapId)]);}
function publish(ctx:SystemContext){
  if(!environmentDiagnosticsEnabled())return;
  const config=ctx.get(EnvironmentReview),state=ctx.get(EnvironmentResidency),view=ctx.get(ViewInfo),status=ctx.get(RenderStatus);
  const current=environmentPresentationStats.mapId===config.mapId&&environmentPresentationStats.mode===config.mode;
  const count=current&&state.ioReady&&config.mode!==0?environmentCatalogSamples.count:0;
  const samples=environmentCatalogSamples;
  publishEnvironmentDiagnostics({scope:'environment-art-review',enabled:config.enabled,mapId:config.mapId,mode:config.mode,batch:config.batch,
    step:ctx.step,frame:status.frame,viewport:{width:view.width,height:view.height},ioReady:state.ioReady,renderSettled:state.renderSettled,
    failed:state.failed,error:environmentPresentationStats.failure,
    geometry:current?{...buffers.stats}:{queriedWindow:0,sourceEligible:0,visited:0,props:0,total:0,trafficSelected:0,trafficVisible:0},
    probes:{count,probeX:Array.from(samples.probeX),probeY:Array.from(samples.probeY),controlX:Array.from(samples.controlX),controlY:Array.from(samples.controlY),rgba:Array.from(samples.rgba)}});
}

export const EnvironmentPresentation=defineSystem({
  name:'EnvironmentPresentation',stage:'LateUpdate',after:['Map01ArtPresentation'],
  events:[KeyEvent],
  query:query(read(EnvironmentReviewSlot),write(MaterialOverrides)),
  resources:[write(EnvironmentReview),write(EnvironmentResidency),read(ViewInfo),read(RenderStatus)],
  run(ctx,owners){
    const config=ctx.resource(EnvironmentReview),ledgerView=ctx.resource(EnvironmentResidency);
    // Binding witness slot99 is deliberately excluded, even with stale enabled config.
    let slots=0,ownerKey='';
    for(const chunk of owners.chunks())for(let row=0;row<chunk.length;row++){
      const slot=chunk.col(EnvironmentReviewSlot).slot[row]!;
      if(slot<5){const bit=1<<slot;if(slots&bit)throw new Error('Duplicate environment presentation slot');slots|=bit;ownerKey+=`${slot}:${entityString(chunk.entity(row))}/`;}
    }
    const enabled=config.enabled[0]!==0&&slots===31&&owners.count===5;
    if(!enabled){
      clear();
      if(ledgerView.ownsIncoming[0]!==0)releasePair(ledgerView.incoming[0]!);
      if(ledgerView.ownsActive[0]!==0)releasePair(ledgerView.active[0]!);
      if(ledgerView.ownsTraffic[0]!==0)assets.release(SHARED);
      if(textures.info('environment-source-controls')!==null)textures.destroy('environment-source-controls');
      ctx.set(EnvironmentResidency,{incoming:0,active:0,ownsIncoming:false,ownsActive:false,ownsTraffic:false,ioReady:false,renderSettled:false,failed:false});
      resetEnvironmentReadiness(readiness,ledgerView.epoch[0]!);initialized=false;selectionKey='';controlKey='';
      reviewHeld=0;lastInputStep=-1;environmentPresentationStats.ready=false;environmentPresentationStats.mapId=0;publish(ctx);return;
    }
    if(lastInputStep!==ctx.step){
      for(const key of ctx.events.read(KeyEvent)){
        const bit=key.code===Keys.Digit2?1:key.code===Keys.Digit3?2:key.code===Keys.Digit4?4:key.code===Keys.Digit0?8:key.code===Keys.KeyG?16:key.code===Keys.KeyC?32:key.code===Keys.KeyV?64:key.code===Keys.KeyR?128:0;
        if(bit===0)continue;
        const rising=key.down&&(reviewHeld&bit)===0;reviewHeld=key.down?reviewHeld|bit:reviewHeld&~bit;
        if(!rising)continue;
        if(bit<32){
          const mapId=bit===1?2:bit===2?3:bit===4?4:bit===8?10:16;
          ctx.set(EnvironmentReview,{mapId,mode:0,batch:0,cameraOriginZ:mapId===4?30450:45000,lateral:0,trafficCount:mapId===4?32:0});
        }else ctx.set(EnvironmentReview,{mode:bit===32?1:bit===64?2:0,batch:0});
      }
      lastInputStep=ctx.step;
    }
    const state=ctx.get(EnvironmentResidency),mapId=config.mapId[0]!,mode=config.mode[0]!,batch=config.batch[0]!;
    const key=`${mapId}/${mode}/${batch}/${ownerKey}`;
    if(state.failed&&selectionKey===key){publish(ctx);return;}
    try{
    const manifest=destinationEnvironment(mapId);
    if(mode>2)throw new Error('Unknown destination environment review mode');
    if(!initialized||selectionKey!==key){
      clear();state.epoch++;state.ioReady=false;state.renderSettled=false;state.failed=false;
      if(state.ownsIncoming&&state.incoming!==mapId){releasePair(state.incoming);state.ownsIncoming=false;state.incoming=0;}
      if(state.active!==mapId&&!state.ownsIncoming){
        assets.load([manifest.assetId,destinationDataGroup(mapId)]);state.incoming=mapId;state.ownsIncoming=true;
      }
      if(!state.ownsTraffic){assets.load(SHARED);state.ownsTraffic=true;}
      ctx.set(EnvironmentResidency,state);resetEnvironmentReadiness(readiness,state.epoch);
      selectionKey=key;initialized=true;controlKey='';environmentPresentationStats.failure='';environmentPresentationStats.mapId=0;
    }
    if(state.failed){publish(ctx);return;}
    const stats=assets.stats(),groups=[destinationDataGroup(mapId),manifest.assetId,SHARED];
    const failed=groups.some(name=>(stats.groups[name]?.failed.length??0)>0);
    if(failed){
      clear();if(state.ownsIncoming)releasePair(state.incoming);if(state.ownsActive)releasePair(state.active);
      if(state.ownsTraffic)assets.release(SHARED);
      if(textures.info('environment-source-controls')!==null)textures.destroy('environment-source-controls');
      ctx.set(EnvironmentResidency,{incoming:mapId,active:0,ownsIncoming:false,ownsActive:false,ownsTraffic:false,ioReady:false,renderSettled:false,failed:true});
      resetEnvironmentReadiness(readiness,state.epoch);environmentPresentationStats.ready=false;
      environmentPresentationStats.failure=groups.flatMap(name=>stats.groups[name]?.failed??[]).join(';');publish(ctx);return;
    }
    const dataReady=stats.groups[groups[0]!]!.progress===1&&stats.groups[groups[0]!]!.failed.length===0;
    const ioReady=groups.every(name=>stats.groups[name]?.status==='loaded'&&stats.groups[name]?.progress===1&&stats.groups[name]?.failed.length===0);
    ctx.setField(EnvironmentResidency,'ioReady',ioReady);
    if(!dataReady){clear();environmentPresentationStats.ready=false;publish(ctx);return;}
    // The explicit data group has completed IO: this read is outside SIM and
    // never intentionally falls through to unprimed synchronous frame IO.
    const data=loadSourceBiome(mapId as SourceBiomeId);environmentPresentationStats.dataReads++;
    const view=ctx.resource(ViewInfo),width=view.width[0]!,height=Math.max(1,view.height[0]!),aspect=Math.fround(width/height);
    const page0=manifest.pages[0]!,page1=manifest.pages[1]??page0;
    const catalog=mode!==0;
    const composite=buffers.build(data,{cameraOriginZ:config.cameraOriginZ[0]!,lateral:config.lateral[0]!,viewWidth:width,aspect},manifest,
      controlledTraffic.sample(data,config.cameraOriginZ[0]!,config.trafficCount[0]!));
    const skyColor='#'+data.palette[0]!.slice(0,3).map(channel=>channel.toString(16).padStart(2,'0')).join('');
    for(const chunk of owners.chunks())for(let row=0;row<chunk.length;row++){
      const slot=chunk.col(EnvironmentReviewSlot).slot[row]!;
      let values='';
      if(slot===1)values=`page0=${mode===2?manifest.back.image:page0.image};page1=${mode===2?manifest.front.image:page1.image};traffic=${catalog?'dynamic:environment-source-controls':'textures/traffic-source.png'};trafficSize=${catalog?'32 1':'1024 1280'}`;
      else if(slot===2)values=`image=${manifest.back.image};imageSize=${manifest.back.sizePx.join(' ')}`;
      else if(slot===3)values=`image=${manifest.front.image};imageSize=${manifest.front.sizePx.join(' ')}`;
      else if(slot===4)values=`sky=${skyColor}`;
      if(!chunk.is(MaterialOverrides,row,'values',values))chunk.setField(MaterialOverrides,row,'values',values);
    }
    // Recurring road/composite/background submissions continue during arrival;
    // the global upload budget is never suspended or increased for this proof.
    if(catalog){
      upload(names[1]!,buildEnvironmentCatalog(manifest,batch,width,height,mode===2));
      const nextControl=`${mapId}/${mode}/${batch}`;
      if(controlKey!==nextControl||textures.info('environment-source-controls')===null){
        textures.create('environment-source-controls',{width:32,height:1,srgb:true});
        textures.write('environment-source-controls',environmentCatalogSamples.rgba);controlKey=nextControl;
      }
      for(const slot of [0,2,3,4])if(meshes.info(names[slot]!)!==null)meshes.destroy(names[slot]!);
    }else{
      upload(names[0]!,buffers.road);upload(names[1]!,composite);
      upload(names[2]!,buildMap01Panorama(0,aspect,sourceProjectionStats.horizonY,config.backOffset[0]!,manifest.back.sizePx));
      upload(names[3]!,buildMap01Panorama(1,aspect,sourceProjectionStats.horizonY,config.frontOffset[0]!,manifest.front.sizePx));
      sky.reset();sky.strip(-aspect,aspect,-1,-aspect,aspect,1,-.3,white);upload(names[4]!,sky.arrays);
    }
    const status=ctx.resource(RenderStatus),frame=status.frame[0]!;
    submitEnvironmentReadiness(readiness,state.epoch,frame);
    const settled=observeEnvironmentReadiness(readiness,state.epoch,frame,status.pendingAssets[0]!,status.pendingPipelines[0]!,ioReady);
    ctx.setField(EnvironmentResidency,'renderSettled',settled);
    if(settled&&state.ownsIncoming){
      if(state.ownsActive&&state.active!==mapId)releasePair(state.active);
      ctx.set(EnvironmentResidency,{active:mapId,ownsActive:true,incoming:0,ownsIncoming:false});
    }
    environmentPresentationStats.mapId=mapId;environmentPresentationStats.mode=mode;environmentPresentationStats.ready=settled;
    publish(ctx);
    }catch(error){
      // Invalid selection/import/batch cannot leave an old ready image visible.
      clear();if(state.ownsIncoming)releasePair(state.incoming);if(state.ownsActive)releasePair(state.active);
      if(state.ownsTraffic)assets.release(SHARED);
      if(textures.info('environment-source-controls')!==null)textures.destroy('environment-source-controls');
      ctx.set(EnvironmentResidency,{incoming:0,active:0,ownsIncoming:false,ownsActive:false,ownsTraffic:false,ioReady:false,renderSettled:false,failed:true});
      resetEnvironmentReadiness(readiness,state.epoch);selectionKey=key;initialized=true;controlKey='';
      environmentPresentationStats.ready=false;environmentPresentationStats.failure=String(error);
      environmentPresentationStats.mapId=0;publish(ctx);
    }
  },
});
