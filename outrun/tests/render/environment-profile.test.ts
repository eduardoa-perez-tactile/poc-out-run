import {renderTest,expect,type WorldTestContext} from '@gameengine/test';
import {assets,meshes,textures,EnterScene,RenderStatus} from '@gameengine/runtime';
import {DrivingState,RoadProofState,EnvironmentReview,EnvironmentReviewSlot,EnvironmentResidency} from '../../src/schema.gen.ts';
import {destinationEnvironment,destinationDataGroup,DESTINATION_ENVIRONMENT_IDS} from '../../src/content/environments/destination-environments.ts';
import {environmentPresentationStats} from '../../src/render/environment-presentation.ts';
import {environmentCatalogSamples} from '../../src/render/environment-catalog.ts';

const WIDTH=1280,HEIGHT=720;
const OWNED=['environment-road','environment-composite','environment-back','environment-front','environment-sky'];
const BOOT=['biome-catalog-data','biome-map01-data'];

renderTest('environment.profile canonical recorded destination art workload',async ctx=>{
  // Configured default startup. Every scene/view/key is real recorded input;
  // no world.setResource, authored pool or invisible simulation command.
  expect(ctx.world.count(EnvironmentReviewSlot)).toBe(0);
  ctx.input.view(WIDTH,HEIGHT,1);
  ctx.input.emit(EnterScene,{scene:'scenes/destination-environment.scene.json',release:''});await ctx.step(2);
  const driving=ctx.world.resource(DrivingState),road=ctx.world.resource(RoadProofState);
  const phases:unknown[]=[],transitions:unknown[]=[];
  let previousUploads=environmentPresentationStats.uploads,previousBytes=environmentPresentationStats.submittedBytes;
  let previousFrame=ctx.world.resource(RenderStatus).frame,peakDraws=0,peakMeshCPUBytes=0,peakGlobalTextureBytes=0;
  let transitionKey='';
  function simulationUnchanged(){expect(ctx.world.resource(DrivingState)).toEqual(driving);expect(ctx.world.resource(RoadProofState)).toEqual(road);}
  function residency(label:string){
    const state=ctx.world.resource(EnvironmentResidency),config=ctx.world.resource(EnvironmentReview),stats=assets.stats();
    const activeName=state.active?destinationEnvironment(state.active).assetId:'',incomingName=state.incoming?destinationEnvironment(state.incoming).assetId:'';
    const key=JSON.stringify([config.mapId,config.mode,state.active,state.incoming,state.ownsActive,state.ownsIncoming,state.ioReady,state.renderSettled,state.failed,
      activeName?stats.groups[activeName]!.status:'',incomingName?stats.groups[incomingName]!.status:'']);
    peakGlobalTextureBytes=Math.max(peakGlobalTextureBytes,stats.resident.textures);
    if(key!==transitionKey){
      transitions.push({label,state,selectedMap:config.mapId,mode:config.mode,class:stats.class,global:stats.resident,budget:stats.budget,overBudget:stats.overBudget,
        groups:Object.fromEntries(Object.entries(stats.groups).map(([name,g])=>[name,{status:g.status,members:g.members,progress:g.progress,failed:g.failed,resident:g.resident,cookedBytes:g.cookedBytes}]))});
      transitionKey=key;
    }
  }
  async function key(code:Parameters<WorldTestContext['input']['key']>[0]){ctx.input.key(code,true);await ctx.step(1);ctx.input.key(code,false);await ctx.step(1);}
  async function ready(mapId:number,mode:number,label:string){
    for(let tick=0;tick<240&&!ctx.world.resource(EnvironmentResidency).renderSettled;tick++){
      residency(label+' loading');simulationUnchanged();await ctx.step(1);
    }
    const state=ctx.world.resource(EnvironmentResidency),config=ctx.world.resource(EnvironmentReview),manifest=destinationEnvironment(mapId),stats=assets.stats();
    expect(config.mapId).toBe(mapId);expect(config.mode).toBe(mode);
    expect(state.failed).toBe(false);expect(state.ioReady).toBe(true);expect(state.renderSettled).toBe(true);expect(state.active).toBe(mapId);
    expect(stats.class).toBe('phone-low');
    const expected=[...BOOT,manifest.assetId,destinationDataGroup(mapId),'environment-review-shared'].sort();
    expect(Object.entries(stats.groups).filter(([,group])=>group.status==='loaded').map(([name])=>name).sort()).toEqual(expected);
    for(const name of expected){const group=stats.groups[name]!;expect(group.progress).toBe(1);expect(group.failed).toEqual([]);}
    residency(label+' ready');simulationUnchanged();
  }
  function observe(label:string){
    const stats=ctx.render.stats({width:WIDTH,height:HEIGHT});expect(stats.drawCalls).toBeGreaterThan(0);
    expect('validationErrors' in stats).toBe(true);if('validationErrors' in stats)expect(stats.validationErrors).toEqual([]);
    const native=OWNED.map(name=>meshes.info(name)),ownedBytes=native.reduce((sum,m)=>sum+(m?.bytes??0),0);
    peakDraws=Math.max(peakDraws,stats.drawCalls);peakMeshCPUBytes=Math.max(peakMeshCPUBytes,ownedBytes);
    const frame=ctx.world.resource(RenderStatus).frame;
    phases.push({label,mapId:ctx.world.resource(EnvironmentReview).mapId,mode:ctx.world.resource(EnvironmentReview).mode,
      render:stats,renderFrame:frame,renderFrameDelta:frame-previousFrame,
      uploadsSinceObservation:environmentPresentationStats.uploads-previousUploads,rawBytesSinceObservation:environmentPresentationStats.submittedBytes-previousBytes,
      cumulativeUploads:environmentPresentationStats.uploads,cumulativeSubmittedBytes:environmentPresentationStats.submittedBytes,nativeOwnedMeshes:native,nativeOwnedCPUBytes:ownedBytes,
      geometry:{...environmentPresentationStats.geometry},ledger:ctx.world.resource(EnvironmentResidency),assets:assets.stats()});
    previousFrame=frame;previousUploads=environmentPresentationStats.uploads;previousBytes=environmentPresentationStats.submittedBytes;
    residency(label);simulationUnchanged();
  }
  async function projection(mapId:number,label:string){
    await ready(mapId,0,label);const uploads=environmentPresentationStats.uploads;
    for(let tick=0;tick<16;tick++){await ctx.step(1);simulationUnchanged();residency(label+' hold');}
    expect(environmentPresentationStats.uploads-uploads>=16*5).toBe(true);
    for(const name of OWNED)expect(meshes.info(name)!==null).toBe(true);
    const probe=ctx.render.probe({width:WIDTH,height:HEIGHT,points:[[640,60],[640,650]]}).points;
    expect(probe.some(p=>p.rgba[0]!+p.rgba[1]!+p.rgba[2]!>0)).toBe(true);
    if(mapId===4){const geometry=environmentPresentationStats.geometry;expect(geometry.queriedWindow).toBe(1000);expect(geometry.sourceEligible).toBe(980);expect(geometry.trafficSelected).toBe(32);expect(geometry.trafficVisible).toBe(32);expect(geometry.trafficHidden).toBe(0);expect(geometry.props).toBeGreaterThan(0);}
    observe(label);
  }
  async function catalog(mapId:number,mode:1|2,label:string){
    await key(mode===1?'KeyC':'KeyV');await ready(mapId,mode,label);await ctx.step(12);
    const count=environmentCatalogSamples.count;expect(count).toBeGreaterThan(0);
    if(mode===2)expect(count).toBe(2);
    const points:[number,number][]=[];
    for(let i=0;i<count;i++)points.push([environmentCatalogSamples.probeX[i]!,environmentCatalogSamples.probeY[i]!]);
    for(let i=0;i<count;i++)points.push([environmentCatalogSamples.controlX[i]!,environmentCatalogSamples.controlY[i]!]);
    const actual=ctx.render.probe({width:WIDTH,height:HEIGHT,points}).points;
    for(let i=0;i<count;i++){expect(actual[i]!.rgba).toEqual(actual[i+count]!.rgba);expect(actual[i]!.rgba[3]).toBe(255);}
    observe(label);
  }
  for(const [mapId,selector] of [[2,'Digit2'],[3,'Digit3'],[4,'Digit4'],[10,'Digit0'],[16,'KeyG']] as const){
    await key(selector);await projection(mapId,`map${mapId} projection`);
    await catalog(mapId,1,`map${mapId} catalog`);await catalog(mapId,2,`map${mapId} panorama controls`);
    await key('KeyR');await projection(mapId,`map${mapId} restored projection`);
  }
  await key('Digit2');await projection(2,'return Map2');simulationUnchanged();
  ctx.input.emit(EnterScene,{scene:'scenes/road-proof.scene.json',release:''});await ctx.step(2);
  const exited=ctx.world.resource(EnvironmentResidency),final=assets.stats();
  expect(exited.ownsActive).toBe(false);expect(exited.ownsIncoming).toBe(false);expect(exited.ownsTraffic).toBe(false);
  expect(Object.entries(final.groups).filter(([,g])=>g.status==='loaded').map(([name])=>name).sort()).toEqual(BOOT);
  for(const name of OWNED)expect(meshes.info(name)).toBe(null);
  expect(textures.info('environment-source-controls')).toBe(null);
  console.log('ENVIRONMENT_CANONICAL_PROFILE',{phases,transitions,peakDraws,peakOwnedMeshCPUBytes:peakMeshCPUBytes,peakGlobalTextureBytes,finalAssets:final,
    accounting:'Recorded art-review workload only. Raw submitted arrays are JS-to-native payloads, mesh.info bytes are native CPU storage, asset groups distinguish active pins/released cache. These are not GPU bandwidth, JS heap, phone hardware memory or FPS measurements; no new cap is asserted.'});
},{memory:'phone-low'});


// Deliberately noncanonical: absolute presentation-only selection proves a full
// residency cohort. Never register this world.setResource case as a budget tape.
renderTest('environment.residency all15 destination families return to Map2 without retaining pins',async ctx=>{
  ctx.input.view(WIDTH,HEIGHT,1);
  ctx.input.emit(EnterScene,{scene:'scenes/destination-environment.scene.json',release:''});await ctx.step(2);
  const driving=ctx.world.resource(DrivingState),road=ctx.world.resource(RoadProofState);
  const allArtNames=DESTINATION_ENVIRONMENT_IDS.map(id=>destinationEnvironment(id).assetId);
  const observations:unknown[]=[],inflight:unknown[]=[];
  let previousMap=0,peakTextures=0,peakData=0,lastSignature='';
  function isolated(){expect(ctx.world.resource(DrivingState)).toEqual(driving);expect(ctx.world.resource(RoadProofState)).toEqual(road);}
  function capture(target:number,label:string){
    const state=ctx.world.resource(EnvironmentResidency),stats=assets.stats();
    const loaded=allArtNames.filter(name=>stats.groups[name]!.status==='loaded');
    expect(loaded.length).toBeLessThanOrEqual(2);
    peakTextures=Math.max(peakTextures,stats.resident.textures);peakData=Math.max(peakData,stats.resident.data??0);
    const pairs=DESTINATION_ENVIRONMENT_IDS.map(id=>{
      const art=stats.groups[destinationEnvironment(id).assetId]!,data=stats.groups[destinationDataGroup(id)]!;
      expect(art.failed).toEqual([]);expect(data.failed).toEqual([]);
      return {id,art:{status:art.status,progress:art.progress,members:art.members,resident:art.resident,failed:art.failed},
        data:{status:data.status,progress:data.progress,members:data.members,resident:data.resident,failed:data.failed}};
    });
    const signature=JSON.stringify([target,state.active,state.incoming,state.ownsActive,state.ownsIncoming,state.ioReady,state.renderSettled,
      ...pairs.map(p=>[p.id,p.art.status,p.data.status,p.art.progress,p.data.progress])]);
    if(signature!==lastSignature){inflight.push({target,label,state,loadedArt:loaded,global:stats.resident,class:stats.class,budget:stats.budget,overBudget:stats.overBudget,pairs});lastSignature=signature;}
    return stats;
  }
  for(const mapId of [...DESTINATION_ENVIRONMENT_IDS,2] as const){
    ctx.world.setResource(EnvironmentReview,{enabled:true,mapId,mode:0,batch:0,cameraOriginZ:0,lateral:0,trafficCount:0,backOffset:1000,frontOffset:1000});
    await ctx.step(1);capture(mapId,'requested');isolated();let waited=0;
    while(waited<240&&!ctx.world.resource(EnvironmentResidency).renderSettled){await ctx.step(1);waited++;capture(mapId,'inflight');isolated();}
    const state=ctx.world.resource(EnvironmentResidency),manifest=destinationEnvironment(mapId);
    expect(state.failed).toBe(false);expect(state.ioReady).toBe(true);expect(state.renderSettled).toBe(true);expect(state.active).toBe(mapId);
    const uploads=environmentPresentationStats.uploads;
    for(let tick=0;tick<12;tick++){await ctx.step(1);capture(mapId,'ready projection');isolated();}
    expect(environmentPresentationStats.uploads-uploads>=12*5).toBe(true);
    const stats=capture(mapId,'settled');
    const expected=[...BOOT,manifest.assetId,destinationDataGroup(mapId),'environment-review-shared'].sort();
    expect(Object.entries(stats.groups).filter(([,g])=>g.status==='loaded').map(([name])=>name).sort()).toEqual(expected);
    expect(stats.class).toBe('phone-low');expect(stats.overBudget).toBe(null);
    expect(stats.budget.textures!==null&&stats.budget.total!==null).toBe(true);
    expect(stats.resident.textures).toBeLessThanOrEqual(stats.budget.textures!);expect(stats.resident.total).toBeLessThanOrEqual(stats.budget.total!);
    for(const name of expected){expect(stats.groups[name]!.progress).toBe(1);expect(stats.groups[name]!.failed).toEqual([]);}
    if(previousMap&&previousMap!==mapId){
      const old=stats.groups[destinationEnvironment(previousMap).assetId]!;
      expect(old.status==='released'||old.status==='unloaded').toBe(true);
      expect(stats.groups[destinationDataGroup(previousMap)]!.status).toBe('unloaded');
    }
    const render=ctx.render.stats({width:WIDTH,height:HEIGHT});expect(render.drawCalls).toBeGreaterThan(0);
    expect('validationErrors' in render).toBe(true);if('validationErrors' in render)expect(render.validationErrors).toEqual([]);
    const pixels=ctx.render.probe({width:WIDTH,height:HEIGHT,points:[[640,60],[640,650]]}).points;
    expect(pixels.some(p=>p.rgba[0]!+p.rgba[1]!+p.rgba[2]!>0)).toBe(true);
    const native=OWNED.map(name=>meshes.info(name));expect(native.every(m=>m!==null)).toBe(true);
    const released=Object.entries(stats.groups).filter(([,g])=>g.status==='released').map(([name,g])=>({name,resident:g.resident}));
    observations.push({mapId,waited,state,global:stats.resident,budget:stats.budget,selectedArt:stats.groups[manifest.assetId],selectedData:stats.groups[destinationDataGroup(mapId)],releasedCache:released,
      actualDraws:render.drawCalls,pipelines:render.pipelines,pipelinesCreatedThisFrame:render.pipelinesCreatedThisFrame,
      uploadsDuring12Steps:environmentPresentationStats.uploads-uploads,nativeOwnedCPUBytes:native.reduce((sum,m)=>sum+(m?.bytes??0),0),nativeMeshes:native});
    previousMap=mapId;
  }
  expect(observations.length).toBe(16);isolated();
  ctx.input.emit(EnterScene,{scene:'scenes/road-proof.scene.json',release:''});await ctx.step(2);
  const exited=ctx.world.resource(EnvironmentResidency),final=assets.stats();
  expect(exited.ownsActive).toBe(false);expect(exited.ownsIncoming).toBe(false);expect(exited.ownsTraffic).toBe(false);
  expect(Object.entries(final.groups).filter(([,g])=>g.status==='loaded').map(([name])=>name).sort()).toEqual(BOOT);
  for(const name of OWNED)expect(meshes.info(name)).toBe(null);expect(textures.info('environment-source-controls')).toBe(null);
  console.log('ENVIRONMENT_FULL_RESIDENCY',{observations,inflight,peakTextures,peakRawDataCounter:peakData,finalAssets:final,
    map15PageSizeArithmetic:destinationEnvironment(15).pages.map(p=>({sizePx:p.sizePx,baseRGBABytes:p.sizePx[0]*p.sizePx[1]*4})),
    accounting:'Single-session art-only cohort, not a canonical replay. Loaded groups are active pins; released groups may retain cache. Public native asset/CPU mesh counters do not measure JS heap, GPU bandwidth or phone RSS. A zero native T1 raw-data counter does not establish zero retained raw data or JS heap; separate native protocol observations are required. Page dimensions are arithmetic, actual charges are logged separately; no new structural cap is invented.'});
},{memory:'phone-low'});
