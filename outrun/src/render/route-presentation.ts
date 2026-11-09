// Sole live route renderer; physical route state never depends on art readiness.
import {defineSystem,query,read,write,meshes,assets,MaterialOverrides,MeshRenderer,ViewInfo,RenderTime,RenderStatus,
  entityIndex,entityGen,type MeshArrays} from '@gameengine/runtime';
import {RouteDriver,RouteTrafficCoordinates,TerrainDriver,TrafficPool,CrashDriver,DrivingState,DrivingInput,
  RouteLiveSlot,RouteLiveVisual,VehiclePreview,RaceState} from '../schema.gen.ts';
import {originalRouteSources} from '../content/route-boot.ts';
import type {SourceBiomeId} from '../content/biome.ts';
import {buildSourceRoad,sourceProjectionStats} from './source-projection.ts';
import {buildTrafficComposite} from './traffic-buffers.ts';
import {map01AtlasLookup} from './map01-art-buffers.ts';
import {MAP01_ART} from '../content/environments/map01.manifest.ts';
import {createEnvironmentBuffers} from './environment-buffers.ts';
import {buildMap01Panorama} from './map01-art-backgrounds.ts';
import {ProjectionBuffers} from './projection-buffers.ts';
import {createEnvironmentReadiness,resetEnvironmentReadiness,submitEnvironmentReadiness,observeEnvironmentReadiness} from './environment-readiness.ts';
import {resolveRouteEnvironment,createRouteTrafficAdapter,interpolateRouteView,routeVehiclePreview,
  copyRoutePalette,advanceRoutePalette,advanceRouteSlide,routeParallaxOffset} from './route-render-math.ts';

const names=['route-live-road','route-live-composite','route-live-back','route-live-front','route-live-sky','route-live-incoming-back','route-live-incoming-front'] as const;
const SHARED='route-live-shared',MAP1='route-live-map01';
const source=originalRouteSources(),buffers=createEnvironmentBuffers(),traffic=createRouteTrafficAdapter();
const atlas={sizePx:MAP01_ART.atlas.sizePx,byObjectId:map01AtlasLookup(MAP01_ART.images)};
const sky=new ProjectionBuffers(1),white=new Uint8Array([255,255,255]),targetPalette=new Array<number>(33).fill(0);
const readiness=createEnvironmentReadiness();let readinessInitialized=false;
export const routePresentationStats={mapId:0,backgroundMapId:0,incomingMapId:0,ready:false,failed:false,error:'',
  uploads:0,submittedBytes:0,frameUploadCalls:0,frameSubmittedBytes:0,geometry:buffers.stats};
const group=(mapId:number)=>mapId===1?MAP1:'route-live-'+resolveRouteEnvironment(mapId).group;
const privateGroups=Object.freeze([SHARED,...Array.from({length:16},(_,index)=>group(index+1))]);
const remove=(slot:number)=>{const name=names[slot]!;if(meshes.info(name)!==null)meshes.destroy(name);};
const clear=()=>{for(let slot=0;slot<names.length;slot++)remove(slot);};
function upload(slot:number,arrays:MeshArrays){
  const name=names[slot]!;if(meshes.info(name)===null)meshes.create(name,arrays);else meshes.update(name,arrays);
  const bytes=arrays.positions.byteLength+(arrays.normals?.byteLength??0)+(arrays.tangents?.byteLength??0)+
    (arrays.uvs?.byteLength??0)+(arrays.uvs1?.byteLength??0)+(arrays.colors?.byteLength??0)+(arrays.indices?.byteLength??0);
  routePresentationStats.uploads++;routePresentationStats.submittedBytes+=bytes;
  routePresentationStats.frameUploadCalls++;routePresentationStats.frameSubmittedBytes+=bytes;
}
function panorama(slot:number,layer:number,aspect:number,offset:number,size:readonly number[],shift:number){
  const arrays=buildMap01Panorama(layer,aspect,sourceProjectionStats.horizonY,offset,size);
  // One shifted source strip, clipped by the viewport. Both source texture
  // families retain their own original size, crop and repeating U coordinates.
  for(let vertex=0;vertex<arrays.positions.length;vertex+=3)arrays.positions[vertex]!+=shift;
  upload(slot,arrays);
}

export const RoutePresentation=defineSystem({
  name:'RoutePresentation',stage:'LateUpdate',before:['VehiclePresentation'],
  // Default resources exist before scheduling. Run once on each fresh world to
  // reconcile native private pins, then keep ownerless proof frames native-only.
  // Partial slot/actor loss and retained leases still enter the cleanup path.
  runIf:{any:[
    {query:query(read(RouteDriver),read(RouteTrafficCoordinates),read(TerrainDriver),read(TrafficPool),read(CrashDriver))},
    {query:query(read(RouteLiveSlot))},
    {resource:RouteLiveVisual,field:'reconciled',value:false},
    {resource:RouteLiveVisual,field:'ownerValid'},
    {resource:RouteLiveVisual,field:'ownsActive'},
    {resource:RouteLiveVisual,field:'ownsIncoming'},
    {resource:RouteLiveVisual,field:'ownsShared'},
  ]},
  queries:{actors:query(read(RouteDriver),read(RouteTrafficCoordinates),read(TerrainDriver),read(TrafficPool),read(CrashDriver)),
    slots:query(read(RouteLiveSlot),write(MeshRenderer),write(MaterialOverrides))},
  resources:[write(RouteLiveVisual),write(VehiclePreview),read(DrivingState),read(DrivingInput),read(RaceState),read(ViewInfo),read(RenderTime),read(RenderStatus)],
  run(ctx,{actors,slots}){
    // Validate authored slots even when their actor is absent. An inactive
    // optional presenter must still report malformed/duplicate slot ownership.
    let slotMask=0;
    if(slots.count!==0)for(const chunk of slots.chunks())for(let row=0;row<chunk.length;row++){
      const slot=chunk.col(RouteLiveSlot).slot[row]!;
      if(slot>6||(slotMask&(1<<slot)))throw new Error('Duplicate or invalid live route mesh slot');slotMask|=1<<slot;
    }
    const inactive=actors.count!==1||slots.count!==7||slotMask!==127;
    const ledger=ctx.resource(RouteLiveVisual);
    // Native scalar columns avoid copying the palette and rewriting a complete
    // resource every rendered frame in legacy proof scenes. A fresh world must
    // still reconcile its private native pins; owner loss must still clean once.
    if(actors.count===0&&slots.count===0&&ledger.reconciled[0]!==0&&ledger.ownerValid[0]===0&&
      ledger.ownsActive[0]===0&&ledger.ownsIncoming[0]===0&&ledger.ownsShared[0]===0){
      readinessInitialized=false;routePresentationStats.ready=false;return;
    }
    const state=ctx.get(RouteLiveVisual);
    if(!state.reconciled){
      // A world/replay rebuild resets this ledger while native group pins can
      // survive. Reconcile only this presenter's private namespace. Tracked
      // leases remain valid across an ordinary code reload.
      const native=assets.stats().groups;
      for(const name of privateGroups){
        const tracked=(state.ownsShared&&name===SHARED)||(state.ownsActive&&name===group(state.active))||(state.ownsIncoming&&name===group(state.incoming));
        const status=native[name]?.status;
        if(!tracked&&status&&status!=='unloaded'&&status!=='released')assets.release(name);
      }
      state.reconciled=true;
      ctx.setField(RouteLiveVisual,'reconciled',true);
    }
    const releaseAll=()=>{
      if(state.ownsIncoming)assets.release(group(state.incoming));
      if(state.ownsActive)assets.release(group(state.active));
      if(state.ownsShared)assets.release(SHARED);
      state.active=state.incoming=0;state.ownsActive=state.ownsIncoming=state.ownsShared=false;
    };
    if(inactive){
      clear();releaseAll();
      if(state.ownerValid)ctx.set(VehiclePreview,{enabled:false,useWheelEffects:false,hidden:false});
      state.ownerValid=false;state.ioReady=state.renderSettled=state.failed=false;state.swapping=false;
      ctx.set(RouteLiveVisual,state);readinessInitialized=false;routePresentationStats.ready=false;return;
    }
    if(ctx.step===0)return;
    const time=ctx.get(RenderTime),view=ctx.get(ViewInfo),render=ctx.get(RenderStatus);
    for(const chunk of actors.chunks())for(let row=0;row<chunk.length;row++){
      const route=chunk.get(RouteDriver,row),pool=chunk.get(TrafficPool,row),coordinates=chunk.get(RouteTrafficCoordinates,row),
        terrain=chunk.get(TerrainDriver,row),crash=chunk.get(CrashDriver,row),entity=chunk.entity(row);
      if(!route.initialized||route.pending)return;
      if(pool.mapId!==route.mapId||terrain.mapId!==route.mapId||crash.mapId!==route.mapId||coordinates.mapEpoch!==route.mapEpoch||coordinates.routeEpoch!==route.routeEpoch)
        throw new Error('Live route actor transaction incomplete');
      const driving=ctx.get(DrivingState),held=ctx.get(DrivingInput),oldStep=state.lastStep;
      const reset=!state.ownerValid||state.ownerIndex!==entityIndex(entity)||state.ownerGeneration!==entityGen(entity)||state.routeEpoch!==route.routeEpoch;
      const handoff=reset||state.mapEpoch!==route.mapEpoch;
      const data=source.get(route.mapId as SourceBiomeId,route.gradient as -1|0|1),environment=resolveRouteEnvironment(route.mapId);
      if(reset){
        clear();releaseAll();state.ownerValid=true;state.ownerIndex=entityIndex(entity);state.ownerGeneration=entityGen(entity);
        state.routeEpoch=route.routeEpoch;state.animationTicks=0;state.transitionTarget=0;state.transitionComplete=false;
        state.swapping=false;state.slidePx=state.nominalRemainder=0;state.backOffset=state.frontOffset=1000;
        state.parallaxBaseBack=state.parallaxBaseFront=1000;state.parallaxAnchorCamera=route.camera;
        state.lastFrame=time.frame;state.lastStep=ctx.step;
      }
      if(handoff){
        // Transfer exactly the acquired prefetch lease. An unobserved choice
        // cannot leave a third family pinned when the physical map changes.
        if(state.ownsActive&&state.active!==route.mapId){assets.release(group(state.active));state.ownsActive=false;}
        if(state.ownsIncoming){
          if(state.incoming===route.mapId){state.active=state.incoming;state.ownsActive=true;}
          else assets.release(group(state.incoming));
          state.ownsIncoming=false;state.incoming=0;
        }
        if(!state.ownsActive){assets.load(group(route.mapId));state.active=route.mapId;state.ownsActive=true;}
        if(!state.ownsShared){assets.load(SHARED);state.ownsShared=true;}
        const completed=state.transitionComplete&&state.backgroundMapId===route.mapId;
        if(!completed)state.backOffset=state.frontOffset=1000;
        state.parallaxBaseBack=state.backOffset;state.parallaxBaseFront=state.frontOffset;state.parallaxAnchorCamera=route.camera;
        state.mapId=route.mapId;state.mapEpoch=route.mapEpoch;state.backgroundMapId=route.mapId;
        state.transitionTarget=0;state.transitionComplete=false;state.swapping=false;state.slidePx=state.nominalRemainder=0;
        copyRoutePalette(data,state.palette);state.epoch++;state.ioReady=state.renderSettled=state.failed=false;
        resetEnvironmentReadiness(readiness,state.epoch);readinessInitialized=true;
      }
      if(!readinessInitialized){resetEnvironmentReadiness(readiness,state.epoch);state.renderSettled=false;readinessInitialized=true;}
      if(route.choiceLatched&&route.nextMapId!==0&&state.transitionTarget!==route.nextMapId){
        if(state.ownsIncoming)assets.release(group(state.incoming));
        state.incoming=route.nextMapId;assets.load(group(state.incoming));state.ownsIncoming=true;
        state.transitionTarget=route.nextMapId;state.swapping=true;state.transitionComplete=false;
        state.slidePx=state.nominalRemainder=0;
      }
      // A released failed group can be requested again through the public API on
      // a new fixed step; no readiness callback is allowed to touch race state.
      if(state.failed&&ctx.step!==oldStep){
        if(!state.ownsShared){assets.load(SHARED);state.ownsShared=true;}
        if(!state.ownsActive){assets.load(group(route.mapId));state.active=route.mapId;state.ownsActive=true;}
        if(state.transitionTarget&&!state.ownsIncoming){state.incoming=state.transitionTarget;assets.load(group(state.incoming));state.ownsIncoming=true;}
        state.failed=false;state.epoch++;resetEnvironmentReadiness(readiness,state.epoch);
      }
      const width=Math.max(1,view.width),aspect=Math.fround(width/Math.max(1,view.height));
      const currentView=interpolateRouteView(route,driving,time.alpha),newFrame=time.frame!==state.lastFrame;
      const ticks=newFrame&&driving.playing?Math.floor(state.nominalRemainder+Math.max(0,time.realDelta)*60):0;
      if(newFrame){
        state.nominalRemainder=driving.playing?state.nominalRemainder+Math.max(0,time.realDelta)*60-ticks:state.nominalRemainder;
        state.lastFrame=time.frame;routePresentationStats.frameUploadCalls=routePresentationStats.frameSubmittedBytes=0;
      }
      if(state.swapping){
        copyRoutePalette(source.get(state.transitionTarget as SourceBiomeId,0),targetPalette);
        state.slidePx=advanceRouteSlide(state.slidePx,ticks,width);
        const colorDone=advanceRoutePalette(state.palette,targetPalette,ticks,state.palette);
        if(state.slidePx>=width&&colorDone){
          state.swapping=false;state.transitionComplete=true;state.backgroundMapId=state.transitionTarget;
          state.backOffset=state.frontOffset=1000;state.parallaxBaseBack=state.parallaxBaseFront=1000;state.parallaxAnchorCamera=currentView.cameraOriginZ;
        }
      }else{
        const background=resolveRouteEnvironment(state.backgroundMapId);
        state.backOffset=routeParallaxOffset(data,currentView.cameraOriginZ,state.parallaxAnchorCamera,state.parallaxBaseBack,0,background.backSize[0]!);
        state.frontOffset=routeParallaxOffset(data,currentView.cameraOriginZ,state.parallaxAnchorCamera,state.parallaxBaseFront,1,background.frontSize[0]!);
      }
      if(driving.playing&&!terrain.recentering&&!reset&&ctx.step>oldStep)state.animationTicks+=ctx.step-oldStep;
      const vehicle=ctx.get(VehiclePreview);
      ctx.set(VehiclePreview,{...routeVehiclePreview(data,terrain,crash,driving,held.keyboard|held.ui,state.animationTicks,vehicle.pose,reset,ctx.dt,ctx.get(RaceState))});
      const trafficSamples=traffic.sample(data,pool,coordinates,time.alpha,driving.playing);
      let composite:MeshArrays;
      if(environment.kind==='map1'){
        // Root-owned optional palette override preserves the old default API.
        upload(0,buildSourceRoad(data,currentView.cameraOriginZ,currentView.lateral,aspect,state.palette));
        composite=buildTrafficComposite(data,width,aspect,atlas,traffic.map01Pool,1,false);
      }else{
        composite=buffers.build(data,{...currentView,viewWidth:width,aspect},environment.manifest,trafficSamples,state.palette);
        upload(0,buffers.road);
      }
      const stats=assets.stats(),required=[group(route.mapId),SHARED];
      if(state.transitionTarget)required.push(group(state.transitionTarget));
      const failed=required.filter(name=>(stats.groups[name]?.failed.length??0)>0);
      state.ioReady=required.every(name=>stats.groups[name]?.status==='loaded'&&stats.groups[name]?.progress===1&&stats.groups[name]?.failed.length===0);
      if(failed.length){
        state.failed=true;state.ioReady=state.renderSettled=false;routePresentationStats.error=failed.flatMap(name=>stats.groups[name]?.failed??[]).join(';');
        // Source road/player continue. Art is explicitly absent while current
        // physical SIM map truth is retained, never stale-labelled as incoming.
        if(state.ownsIncoming&&failed.includes(group(state.incoming))){assets.release(group(state.incoming));state.ownsIncoming=false;}
        if(state.ownsActive&&failed.includes(group(state.active))){assets.release(group(state.active));state.ownsActive=false;}
        if(failed.includes(SHARED)&&state.ownsShared){assets.release(SHARED);state.ownsShared=false;}
      }
      const groupReady=(name:string)=>stats.groups[name]?.status==='loaded'&&stats.groups[name]?.progress===1&&stats.groups[name]?.failed.length===0;
      const currentArtReady=state.ownsActive&&state.ownsShared&&groupReady(group(route.mapId))&&groupReady(SHARED);
      const targetArtReady=!state.transitionTarget||(state.ownsIncoming&&groupReady(group(state.transitionTarget)));
      // Keep the current family's ordinary uploads running during cold prefetch.
      // A missing target delays only its visible panoramas, never physical SIM.
      const showingTransition=state.swapping&&targetArtReady;
      const background=resolveRouteEnvironment(targetArtReady?state.backgroundMapId:route.mapId),incoming=showingTransition?resolveRouteEnvironment(state.transitionTarget):null;
      for(const meshChunk of slots.chunks())for(let meshRow=0;meshRow<meshChunk.length;meshRow++){
        const slot=meshChunk.col(RouteLiveSlot).slot[meshRow]!;let material='',values='';
        if(slot===1){
          material=environment.kind==='map1'?'materials/traffic-composite.material.ts':'materials/environment-composite.material.ts';
          if(environment.kind==='map1')values=`propsAtlas=${MAP01_ART.atlas.image};trafficAtlas=textures/traffic-source.png;propsSize=${MAP01_ART.atlas.sizePx.join(' ')};trafficSize=1024 1280`;
          else{const page0=environment.manifest.pages[0]!,page1=environment.manifest.pages[1]??page0;values=`page0=${page0.image};page1=${page1.image};traffic=textures/traffic-source.png;trafficSize=1024 1280`;}
        }else if(slot===2||slot===3||slot===5||slot===6){
          material='materials/map01-panorama.material.ts';const family=slot>=5?(incoming??background):background,front=slot===3||slot===6;
          values=`image=${front?family.frontImage:family.backImage};imageSize=${(front?family.frontSize:family.backSize).join(' ')}`;
        }else if(slot===4){material='materials/environment-sky.material.ts';values='sky=#'+state.palette.slice(0,3).map(channel=>channel.toString(16).padStart(2,'0')).join('');}
        if(material&&!meshChunk.is(MeshRenderer,meshRow,'material',material))meshChunk.setField(MeshRenderer,meshRow,'material',material);
        if(!meshChunk.is(MaterialOverrides,meshRow,'values',values))meshChunk.setField(MaterialOverrides,meshRow,'values',values);
      }
      sky.reset();sky.strip(-aspect,aspect,-1,-aspect,aspect,1,-.3,white);upload(4,sky.arrays);
      if(currentArtReady){
        upload(1,composite);
        const shift=showingTransition?2*aspect*state.slidePx/width:0;
        panorama(2,0,aspect,state.backOffset,background.backSize,-shift);panorama(3,1,aspect,state.frontOffset,background.frontSize,-shift);
        if(incoming){panorama(5,0,aspect,1000,incoming.backSize,2*aspect-shift);panorama(6,1,aspect,1000,incoming.frontSize,2*aspect-shift);}
        else{remove(5);remove(6);}
        submitEnvironmentReadiness(readiness,state.epoch,render.frame);
        state.renderSettled=observeEnvironmentReadiness(readiness,state.epoch,render.frame,render.pendingAssets,render.pendingPipelines,state.ioReady);
      }else{
        // The physical current family itself is cold/failed: explicit clear art
        // while recurring source road/player continue without pausing SIM.
        for(const slot of [1,2,3,5,6])remove(slot);
        state.renderSettled=false;resetEnvironmentReadiness(readiness,state.epoch);
      }
      state.lastStep=ctx.step;ctx.set(RouteLiveVisual,state);
      routePresentationStats.mapId=route.mapId;routePresentationStats.backgroundMapId=state.backgroundMapId;
      routePresentationStats.incomingMapId=state.incoming;routePresentationStats.ready=state.renderSettled;routePresentationStats.failed=state.failed;
      if(!state.failed)routePresentationStats.error='';
    }
  },
});
