import type {MeshArrays} from '@gameengine/runtime';
import type {ReadonlySourceBiomeData,TrafficPoolValue} from '../schema.gen.ts';
import {TRAFFIC_SOURCE} from '../content/vehicles/traffic-source.manifest.ts';
import {ProjectionBuffers} from './projection-buffers.ts';
import {buildMap01ArtProps,map01ArtStats,map01PropSamples,type Map01Atlas} from './map01-art-buffers.ts';
import {sourceProjectionStats} from './source-projection.ts';
import {VISIBLE_SEGMENTS} from './road-projection.ts';
import {trafficProjection,trafficSourceFrame} from './traffic-sprites.ts';

export const TRAFFIC_COMPOSITE_CAPACITY=288;
export const TRAFFIC_COMPOSITE_BYTES=72576;
const composite=new ProjectionBuffers(TRAFFIC_COMPOSITE_CAPACITY),cars=new ProjectionBuffers(32);
const uvs1=new Float32Array(TRAFFIC_COMPOSITE_CAPACITY*8);
const arrays:MeshArrays={...composite.arrays,uvs1};
const heads=new Int16Array(VISIBLE_SEGMENTS),tails=new Int16Array(VISIBLE_SEGMENTS),links=new Int16Array(32),quadBySlot=new Int16Array(32);
const white=new Uint8Array([255,255,255]);
export const trafficCompositeStats={capacity:TRAFFIC_COMPOSITE_CAPACITY,selected:0,candidates:0,visible:0,props:0,total:0,partial:0,hidden:0,
  // Full fixed typed-array API payload, not measured GPU upload bandwidth.
  submittedBytes:TRAFFIC_COMPOSITE_BYTES};
export const trafficCompositeSamples={
  kind:new Uint8Array(TRAFFIC_COMPOSITE_CAPACITY),segment:new Int32Array(TRAFFIC_COMPOSITE_CAPACITY),slot:new Int16Array(TRAFFIC_COMPOSITE_CAPACITY),
  frame:new Uint8Array(32),fraction:new Float32Array(32),left:new Float32Array(32),right:new Float32Array(32),bottom:new Float32Array(32),top:new Float32Array(32),
};
function appendQuad(source:MeshArrays,q:number,kind:number,segment:number,slot:number){
  const dest=composite.count++;if(dest>=TRAFFIC_COMPOSITE_CAPACITY)throw new Error('Traffic composite capacity exceeded');
  // Direct copies avoid creating per-quad subarray views in the render loop.
  for(let lane=0;lane<12;lane++){
    composite.positions[dest*12+lane]=source.positions[q*12+lane]!;
    composite.normals[dest*12+lane]=source.normals![q*12+lane]!;
  }
  for(let lane=0;lane<16;lane++){
    composite.tangents[dest*16+lane]=source.tangents![q*16+lane]!;
    composite.colors[dest*16+lane]=source.colors![q*16+lane]!;
  }
  for(let lane=0;lane<8;lane++)composite.uvs[dest*8+lane]=source.uvs![q*8+lane]!;
  const v=dest*4,k=dest*6;
  composite.indices[k]=v;composite.indices[k+1]=v+1;composite.indices[k+2]=v+2;
  composite.indices[k+3]=v;composite.indices[k+4]=v+2;composite.indices[k+5]=v+3;
  for(let vertex=0;vertex<4;vertex++)uvs1[dest*8+vertex*2]=kind;
  trafficCompositeSamples.kind[dest]=kind;trafficCompositeSamples.segment[dest]=segment;trafficCompositeSamples.slot[dest]=slot;
}

// The sole Map1 presenter calls this immediately after buildSourceRoad. All
// storage is fixed presentation scratch; no supplied SIM array is mutated/kept.
export function buildTrafficComposite(data:ReadonlySourceBiomeData,viewWidth:number,aspect:number,propAtlas:Map01Atlas,pool:TrafficPoolValue,alpha:number,playing:boolean):MeshArrays{
  if(pool.mapId!==1||!pool.initialized||![9,20,32].includes(pool.population))throw new Error('Traffic compositor requires initialized Map1 pool');
  const props=buildMap01ArtProps(data,viewWidth,aspect,propAtlas),propCount=map01ArtStats.drawn;
  composite.reset();cars.reset();uvs1.fill(0);heads.fill(-1);tails.fill(-1);links.fill(-1);quadBySlot.fill(-1);
  trafficCompositeSamples.kind.fill(0);trafficCompositeSamples.segment.fill(-1);trafficCompositeSamples.slot.fill(-1);
  trafficCompositeSamples.frame.fill(0);trafficCompositeSamples.fraction.fill(0);
  trafficCompositeSamples.left.fill(0);trafficCompositeSamples.right.fill(0);trafficCompositeSamples.bottom.fill(0);trafficCompositeSamples.top.fill(0);
  trafficCompositeStats.selected=pool.population;trafficCompositeStats.candidates=0;trafficCompositeStats.visible=0;
  trafficCompositeStats.props=propCount;trafficCompositeStats.total=0;trafficCompositeStats.partial=0;trafficCompositeStats.hidden=0;
  const t=playing?Math.max(0,Math.min(1,alpha)):1;
  const base=Math.floor(sourceProjectionStats.cameraOriginZ/data.segmentLength),playerZ=sourceProjectionStats.playerSampleZ;
  // The source projection publishes the exact player lateral passed to buildSourceRoad.
  // Logical pose comparisons use it, never screen coordinates or image widths.
  const playerLateral=sourceProjectionStats.lateral;
  for(let slot=0;slot<pool.population;slot++){
    if(pool.parked[slot]||!pool.active[slot])continue;
    trafficCompositeStats.candidates++;
    const z=pool.previousZ[slot]!+(pool.z[slot]!-pool.previousZ[slot]!)*t;
    const offset=pool.previousOffset[slot]!+(pool.offset[slot]!-pool.previousOffset[slot]!)*t;
    const row=Math.floor(z/data.segmentLength);
    if(row<0||row>=data.totalCount){trafficCompositeStats.hidden++;continue;}
    const model=TRAFFIC_SOURCE.models[slot];if(!model||model.id!==slot+1)throw new Error('Traffic model catalog order differs from stable slot');
    const frame=trafficSourceFrame(data,z,offset,pool.side[slot]!,playerZ,playerLateral,pool.motionTicks[slot]!);
    const image=model.frames[frame-1];if(!image||image.sourceFrame!==frame)throw new Error('Traffic source frame is missing');
    trafficCompositeSamples.frame[slot]=frame;
    const p=trafficProjection(data,z,offset,pool.side[slot]!,image,model.scale,aspect,TRAFFIC_SOURCE.atlas.sizePx);
    if(!p){trafficCompositeStats.hidden++;continue;}
    const q=cars.count;
    cars.strip(p.left,p.right,p.bottom,p.left,p.right,p.top,p.depth,white);
    const u=q*8;
    cars.uvs[u]=p.u0;cars.uvs[u+1]=p.v1;cars.uvs[u+2]=p.u1;cars.uvs[u+3]=p.v1;
    cars.uvs[u+4]=p.u1;cars.uvs[u+5]=p.v0;cars.uvs[u+6]=p.u0;cars.uvs[u+7]=p.v0;
    trafficCompositeSamples.fraction[slot]=p.fraction;trafficCompositeSamples.left[slot]=p.left;trafficCompositeSamples.right[slot]=p.right;
    trafficCompositeSamples.bottom[slot]=p.bottom;trafficCompositeSamples.top[slot]=p.top;
    if(p.fraction<1)trafficCompositeStats.partial++;
    const n=p.segment-base,tail=tails[n]!;
    if(tail<0)heads[n]=slot;else links[tail]=slot;
    tails[n]=slot;quadBySlot[slot]=q;trafficCompositeStats.visible++;
  }
  let prop=0;
  for(let n=VISIBLE_SEGMENTS-1;n>=0;n--){
    const segment=base+n;
    while(prop<propCount){
      const propSegment=map01PropSamples.segment[prop]!;
      if(propSegment!==segment)break;
      appendQuad(props,prop,0,segment,-1);prop++;
    }
    for(let slot=heads[n]!;slot>=0;slot=links[slot]!)appendQuad(cars.arrays,quadBySlot[slot]!,1,segment,slot);
  }
  if(prop!==propCount)throw new Error('Traffic composite did not consume ordered Map1 props');
  trafficCompositeStats.total=composite.count;
  return arrays;
}
