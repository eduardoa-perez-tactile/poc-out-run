// Presentation adapters for the delivered immutable route cohort and live actors.
import type {
  ReadonlySourceBiomeData,RouteDriverValue,RouteTrafficCoordinatesValue,TrafficPoolValue,
  DrivingStateValue,TerrainDriverValue,CrashDriverValue,VehiclePreviewValue,RaceStateValue,
} from '../schema.gen.ts';
import type {DestinationEnvironmentId,EnvironmentArtManifest} from '../content/environments/environment-art.ts';
import {MAP01_ART} from '../content/environments/map01.manifest.ts';
import {destinationEnvironment} from '../content/environments/destination-environments.ts';
import type {EnvironmentTrafficSnapshot} from './environment-buffers.ts';
import {sampleRouteZ} from '../sim/route-space.ts';
import {createEmptyTrafficPool} from '../sim/traffic-math.ts';
import {terrainVehiclePose,terrainParallaxOffset} from './terrain-presentation-math.ts';
import {crashVehicleSample} from './crash-presentation-math.ts';
import {wrapMap01Texels} from './map01-art-backgrounds.ts';
import {VISUAL_FRAME_SECONDS} from '../content/vehicles/vehicle-poses.ts';
import {RacePhase,ENDING_ACCELERATION} from '../sim/race-flow-math.ts';

interface RouteEnvironmentCommon {
  readonly group:string;
  readonly backImage:string;readonly frontImage:string;
  readonly backSize:readonly number[];readonly frontSize:readonly number[];
}
export type RouteEnvironment=
  |(RouteEnvironmentCommon&{readonly kind:'map1';readonly mapId:1;readonly manifest:typeof MAP01_ART})
  |(RouteEnvironmentCommon&{readonly kind:'destination';readonly mapId:DestinationEnvironmentId;readonly manifest:EnvironmentArtManifest});

/** Map1 keeps its original two-texture shader/288-quad compositor. Never relax
 * destinationEnvironment's map2..16 guard to make the original atlas fit it. */
export function resolveRouteEnvironment(mapId:number):RouteEnvironment {
  if(mapId===1)return {kind:'map1',mapId:1,manifest:MAP01_ART,group:MAP01_ART.assetId,
    backImage:MAP01_ART.backgrounds.back.image,frontImage:MAP01_ART.backgrounds.front.image,
    backSize:MAP01_ART.backgrounds.back.sourceSizePx,frontSize:MAP01_ART.backgrounds.front.sourceSizePx};
  const manifest=destinationEnvironment(mapId);
  return {kind:'destination',mapId:manifest.mapId,manifest,group:manifest.assetId,
    backImage:manifest.back.image,frontImage:manifest.front.image,backSize:manifest.back.sizePx,frontSize:manifest.front.sizePx};
}

function alphaFor(alpha:number,playing:boolean):number {
  if(!Number.isFinite(alpha))throw new Error('Route render alpha must be finite');
  return playing?Math.max(0,Math.min(1,alpha)):1;
}
export function interpolateRouteView(
  route:Readonly<RouteDriverValue>,driving:Readonly<DrivingStateValue>,alpha:number,
):{cameraOriginZ:number;lateral:number;playing:boolean} {
  const t=alphaFor(alpha,driving.playing);
  // SIM synchronizes previous/current camera at a biome handoff. Interpolate
  // only those integer operands; never outgoing-map Z into destination zero.
  return {cameraOriginZ:route.previousCamera+(route.camera-route.previousCamera)*t,
    lateral:driving.previousLateral+(driving.lateral-driving.previousLateral)*t,playing:driving.playing};
}

type MutableSnapshot={slot:number;modelId:number;z:number;offset:number;side:number;motionTicks:number};
const POOL_ARRAYS=['z','previousZ','offset','previousOffset','speed','target','side','ai','active','generation','passed','moving','cooldown','parked','motionTicks']as const;
/** Interpolate exact source raw aliases before canonicalizing. sampleRouteZ
 * accepts integers; retain the render fraction separately rather than frounding
 * an odd raw coordinate above2^24 or mixing canonical positions across a lap. */
function canonicalRenderZ(data:ReadonlySourceBiomeData,previous:number,current:number,t:number):number {
  // Validate both recorded operands, including a synchronized recycled life.
  sampleRouteZ(data,previous);sampleRouteZ(data,current);
  const raw=previous+(current-previous)*t,integer=Math.floor(raw);
  return sampleRouteZ(data,integer).canonicalZ+(raw-integer);
}

/** Scratch is local to the sole presenter. Source arrays are copied/read only;
 * the Map1 pool is a projection DTO, never written back to SIM. Pass alpha1 to
 * buildTrafficComposite: interpolation has already happened from raw integers. */
export function createRouteTrafficAdapter(){
  const poses:MutableSnapshot[]=Array.from({length:32},(_,slot)=>({slot,modelId:slot+1,z:0,offset:0,side:0,motionTicks:0}));
  const snapshots:EnvironmentTrafficSnapshot[]=[],map01Pool=createEmptyTrafficPool();
  return {snapshots,map01Pool,
    sample(data:ReadonlySourceBiomeData,pool:Readonly<TrafficPoolValue>,coordinates:Readonly<RouteTrafficCoordinatesValue>,alpha:number,playing:boolean):readonly EnvironmentTrafficSnapshot[]{
      if(!pool.initialized||!coordinates.initialized||pool.mapId!==data.id||![9,20,32].includes(pool.population))throw new Error('Route traffic render owner/map is invalid');
      const t=alphaFor(alpha,playing);
      // Preserve real stable-slot metadata. Only positions/lateral interpolation
      // are replaced in this independent DTO consumed by the legacy Map1 API.
      map01Pool.mapId=pool.mapId;map01Pool.initialized=pool.initialized;map01Pool.population=pool.population;
      map01Pool.seedLo=pool.seedLo;map01Pool.seedHi=pool.seedHi;map01Pool.originZ=pool.originZ;map01Pool.aiCursor=pool.aiCursor;map01Pool.epoch=pool.epoch;
      for(const field of POOL_ARRAYS)for(let slot=0;slot<32;slot++)map01Pool[field][slot]=pool[field][slot]!;
      snapshots.length=0;
      for(let slot=0;slot<pool.population;slot++){
        if(data.id===16){map01Pool.active[slot]=0;continue;}
        if(pool.parked[slot]||!pool.active[slot])continue;
        const z=canonicalRenderZ(data,coordinates.previousRawZ[slot]!,coordinates.rawZ[slot]!,t);
        const offset=pool.previousOffset[slot]!+(pool.offset[slot]!-pool.previousOffset[slot]!)*t;
        map01Pool.z[slot]=z;map01Pool.previousZ[slot]=z;map01Pool.offset[slot]=offset;map01Pool.previousOffset[slot]=offset;
        const pose=poses[slot]!;
        pose.z=z;pose.offset=offset;pose.side=pool.side[slot]!;pose.motionTicks=pool.motionTicks[slot]!;
        snapshots.push(pose);
      }
      return snapshots;
    }};
}

export type RouteVehiclePatch=Pick<VehiclePreviewValue,'enabled'|'autoplay'|'useWheelEffects'|'pose'|'sample'|'hidden'|'leftEffect'|'rightEffect'>;
/** Ordinary, terrain and crash frames come from the same existing helpers as
 * the delivered Map1 adapter. Goal entry hides NPCs, never this player/recovery. */
export function routeVehiclePreview(
  data:ReadonlySourceBiomeData,terrain:Readonly<TerrainDriverValue>,crash:Readonly<CrashDriverValue>,
  driving:Readonly<DrivingStateValue>,heldBits:number,animationTicks:number,previousPose:number,refreshOrdinary:boolean,dt=1/60,
  race?:Readonly<Pick<RaceStateValue,'initialized'|'phase'|'resumePhase'|'phaseTicks'>>,
):RouteVehiclePatch {
  if(terrain.mapId!==data.id||crash.mapId!==data.id)throw new Error('Route vehicle owner maps must agree');
  const row=data.segments[terrain.segment];if(!row)throw new Error('Route vehicle source row is missing');
  const recovery=crashVehicleSample(crash),inheritedCrash=!recovery&&previousPose>=18&&previousPose<=21;
  // Pinned PlayerCar.cpp1554–1688 drawEndDriftRound owns the goal body:
  // zero-based textures146/147/121 are one-based files147/148/122.
  // Recovery still wins. Ending autopilot ignores held accelerator/brake keys.
  const phase=race?.phase===RacePhase.Paused?race.resumePhase:race?.phase;
  if(!recovery&&data.id===16&&race?.initialized&&
    (phase===RacePhase.EndingRoll||phase===RacePhase.EndingBrake||phase===RacePhase.Bonus||phase===RacePhase.Results)){
    let pose=0,sample=Math.floor(animationTicks*dt/VISUAL_FRAME_SECONDS)%3;
    if(phase===RacePhase.Bonus||phase===RacePhase.Results||(phase===RacePhase.EndingBrake&&driving.legacySpeed<=0)){pose=18;sample=1;}
    else if(phase===RacePhase.EndingBrake){
      if(driving.legacySpeed>=100){pose=9;sample=Math.floor(race.phaseTicks*dt/VISUAL_FRAME_SECONDS)%3;}
      else if(driving.legacySpeed>=60){
        // Source brake-left textures64..71 advance once then hold71. Reuse
        // the existing20fps presentation cadence, anchored at the100 threshold
        // via the source constant deceleration, independently of rendered frames.
        pose=10;sample=Math.min(7,Math.floor((100-driving.legacySpeed)/(ENDING_ACCELERATION*3)/VISUAL_FRAME_SECONDS));
      }else {pose=22;sample=driving.legacySpeed>=40?0:1;}
    }
    const smoke=phase===RacePhase.EndingBrake&&driving.legacySpeed>0?1:0;
    return {enabled:true,autoplay:false,useWheelEffects:true,pose,sample,hidden:false,leftEffect:smoke,rightEffect:smoke};
  }
  const ordinary=driving.playing||refreshOrdinary||inheritedCrash?terrainVehiclePose(driving.steering,row.y1-row.y0,(heldBits&2)!==0):previousPose;
  const hidden=recovery?.hidden??terrain.recentering;
  return {enabled:true,autoplay:false,useWheelEffects:true,pose:recovery?.pose??ordinary,
    sample:recovery?.sample??Math.floor(animationTicks*dt/VISUAL_FRAME_SECONDS),hidden,
    leftEffect:driving.legacySpeed>0&&!hidden?terrain.leftEffect:0,rightEffect:driving.legacySpeed>0&&!hidden?terrain.rightEffect:0};
}

/** Source Map.cpp166–203:11RGB roles advance one byte/channel per nominal
 * source60Hz presentation tick. Alpha remains255 and never enters simulation. */
export function copyRoutePalette(data:ReadonlySourceBiomeData,out:number[]):void {
  for(let role=0;role<11;role++)for(let channel=0;channel<3;channel++)out[role*3+channel]=data.palette[role]![channel]!;
}
export function advanceRoutePalette(current:readonly number[],target:readonly number[],ticks:number,out:number[]):boolean {
  const count=Math.max(0,Math.floor(ticks));let complete=true;
  for(let i=0;i<33;i++){
    const from=current[i]!,to=target[i]!,next=from+Math.sign(to-from)*Math.min(Math.abs(to-from),count);
    out[i]=next;if(next!==to)complete=false;
  }
  return complete;
}
export function writeRoutePaletteRows(rgb:readonly number[],rows:number[][]):void {
  for(let role=0;role<11;role++){
    const row=rows[role]!;
    row[0]=rgb[role*3]!;row[1]=rgb[role*3+1]!;row[2]=rgb[role*3+2]!;row[3]=255;
  }
}
export function advanceRouteSlide(slide:number,ticks:number,width:number):number {
  return Math.min(width,slide+5*Math.max(0,Math.floor(ticks)));
}
/** Reuse the delivered curve integral, changing only its anchor. The caller
 * freezes offsets during a slide and resets1000 when source transition ends. */
export function routeParallaxOffset(data:ReadonlySourceBiomeData,camera:number,anchorCamera:number,anchorOffset:number,layer:number,width:number):number {
  return wrapMap01Texels(anchorOffset+terrainParallaxOffset(data,camera,layer,width)-terrainParallaxOffset(data,anchorCamera,layer,width),width);
}
