import type { ReadonlySourceBiomeData } from '../schema.gen.ts';
import { sourcePlayerSample } from '../content/biome.ts';
import { ProjectionBuffers } from './projection-buffers.ts';
import { CAMERA_D,HORIZON_Y,ROAD_HALF_WIDTH,VISIBLE_SEGMENTS } from './road-projection.ts';
import { visibleFraction } from './hill-objects.ts';
const road=new ProjectionBuffers(VISIBLE_SEGMENTS*9);
const props=new ProjectionBuffers(256);
const left=new Float32Array(VISIBLE_SEGMENTS),right=new Float32Array(VISIBLE_SEGMENTS);
const ground=new Float32Array(VISIBLE_SEGMENTS),scale=new Float32Array(VISIBLE_SEGMENTS),clip=new Float32Array(VISIBLE_SEGMENTS);
const palette=Array.from({length:11},()=>new Uint8Array(3));
let paletteData:ReadonlySourceBiomeData|null=null;
const linear=(v:number)=>Math.round(255*(v/255<=.04045?v/255/12.92:((v/255+.055)/1.055)**2.4));
const collidableMarker=new Uint8Array([linear(255),linear(192),linear(32)]);
const decorativeMarker=new Uint8Array([linear(16),linear(235),linear(235)]);
export const sourceProjectionStats={cameraOriginZ:0,playerSampleZ:0,playerHeight:0,cameraY:0,playerGap:0,visibleRoadSegments:0,visitedProps:0,drawnProps:0,partialProps:0};
export const sourceProjectionBuffers={left,right,ground,scale,clip};
// Full course data stays immutable; only this fixed 200-segment view is projected.
// Canonical geometry has no viewport input. This adapter is presentation only.
export function buildSourceRoad(data:ReadonlySourceBiomeData,cameraOriginZ:number,lateral:number,aspect:number){
  road.reset();scale.fill(0);clip.fill(-1000);left.fill(0);right.fill(0);ground.fill(0);
  if(data!==paletteData){for(let i=0;i<11;i++)for(let channel=0;channel<3;channel++)palette[i]![channel]=linear(data.palette[i]![channel]!);paletteData=data;}
  const distance=Math.max(0,Math.min((data.totalCount-VISIBLE_SEGMENTS)*data.segmentLength,cameraOriginZ));
  const player=sourcePlayerSample(data,distance);
  sourceProjectionStats.cameraOriginZ=distance;sourceProjectionStats.playerSampleZ=player.playerZ;
  sourceProjectionStats.playerHeight=player.height;sourceProjectionStats.cameraY=player.cameraY;sourceProjectionStats.playerGap=player.gap;
  sourceProjectionStats.visibleRoadSegments=0;
  const base=Math.floor(distance/data.segmentLength),fraction=distance/data.segmentLength-base;
  let x=0,dx=-data.segments[base]!.curve*fraction;
  const playerRow=data.segments[player.index]!,playerDepth=player.index*data.segmentLength-distance;
  let crest=HORIZON_Y+(playerRow.y0-player.cameraY)*CAMERA_D/playerDepth;
  const cameraX=lateral*ROAD_HALF_WIDTH;
  for(let n=0;n<VISIBLE_SEGMENTS;n++) {
    const row=data.segments[base+n]!,nearZ=(n-fraction)*data.segmentLength,farZ=nearZ+data.segmentLength;
    const nearX=x,farX=x+dx;x+=dx;dx+=row.curve;
    if(nearZ<=CAMERA_D)continue;
    const s0=CAMERA_D/nearZ,s1=CAMERA_D/farZ;
    const y0=HORIZON_Y+(row.y0-player.cameraY)*s0,y1=HORIZON_Y+(row.y1-player.cameraY)*s1;
    left[n]=(nearX-cameraX)*aspect*s0;
    // Source Map.cpp944-960: all upper-road projections use the PLAYER gap
    // (mapDistance), while each line's mirror flag changes its curve sign.
    right[n]=(player.gap+(row.mirror?-nearX:nearX)-cameraX)*aspect*s0;
    ground[n]=y0;scale[n]=s0;clip[n]=crest;
    if(y1<=crest)continue;
    const t=y0<crest?(crest-y0)/(y1-y0):0,bottom=Math.max(y0,crest);crest=y1;
    // Source light=true chooses palette1, false palette2; old proofs untouched.
    const shade=row.light?0:1,surface=palette[3+shade]!;
    road.strip(-aspect,aspect,bottom,-aspect,aspect,y1,0,palette[1+shade]!);
    // Same shared strip primitive/order as the synthetic fork proof: both rumbles,
    // both asphalt arms, then lane marks, keeping overlap asphalt at gap zero.
    for(let layer=0;layer<4;layer++)for(let arm=0;arm<2;arm++) {
      const c0=arm===0?left[n]!:right[n]!;
      const c1=(arm===0?farX:player.gap+(row.mirror?-farX:farX))-cameraX;
      const end=c1*aspect*s1,center=c0+(end-c0)*t;
      const w1=ROAD_HALF_WIDTH*aspect*s1,w0=ROAD_HALF_WIDTH*aspect*s0,width=w0+(w1-w0)*t;
      if(layer===0)road.strip(center-width*1.08,center+width*1.08,bottom,end-w1*1.08,end+w1*1.08,y1,.001,palette[5+shade]!);
      else if(layer===1)road.strip(center-width,center+width,bottom,end-w1,end+w1,y1,.002,surface);
      else {const offset=layer===2?-1/3:1/3;road.strip(center+width*(offset-.015),center+width*(offset+.015),bottom,end+w1*(offset-.015),end+w1*(offset+.015),y1,.003,palette[7+shade]!);}
    }
    sourceProjectionStats.visibleRoadSegments++;
  }
  return road.arrays;
}
// No full-placement scan/sort in play: compiled prefix indices select each line's
// existing slot order, visiting at most138 records on the canonical200-line view.
export function buildSourceProps(data:ReadonlySourceBiomeData,viewWidth:number,aspect:number){
  props.reset();sourceProjectionStats.visitedProps=0;sourceProjectionStats.drawnProps=0;sourceProjectionStats.partialProps=0;
  const base=Math.floor(sourceProjectionStats.cameraOriginZ/data.segmentLength);
  const playerLine=Math.floor(sourceProjectionStats.playerSampleZ/data.segmentLength);
  for(let segment=base+VISIBLE_SEGMENTS-1;segment>=Math.max(base+1,playerLine);segment--) {
    const n=segment-base;if(scale[n]===0)continue;
    for(let i=data.objectOffsets[segment]!;i<data.objectOffsets[segment+1]!;i++) {
      const placement=data.placements[i]!,definition=data.definitions[placement.definition]!,object=data.objects[definition.objectId-1]!;
      sourceProjectionStats.visitedProps++;
      const pivot=definition.offsetX>=0?object.pivotRight:object.pivotLeft;
      const point=definition.side?right[n]!:left[n]!;
      const center=point+definition.offsetX*ROAD_HALF_WIDTH*aspect*scale[n]!;
      const offsetY=definition.viewportYFactor!==0?definition.viewportYFactor*viewWidth/data.referenceWidth:definition.offsetY;
      const anchor=ground[n]!-offsetY*scale[n]!*1000;
      const unit=scale[n]!*aspect*(.3/170*ROAD_HALF_WIDTH)*object.scale;
      // Child39 diagnoses source contact anchors, not alpha silhouettes. Never
      // turn an untrimmed1000px source canvas into an opaque wall. Child40 will
      // use the full immutable image sizes/pivots for its actual textured quad.
      const perPixel=2*aspect/Math.max(1,viewWidth);
      const width=Math.min(object.sourceSizePx[0]!*unit*3.2,8*perPixel);
      const height=Math.min(object.sourceSizePx[1]!*unit*3.43,40*perPixel);
      const top=anchor+pivot[1]!*height,bottom=top-height;
      const visible=visibleFraction(bottom,top,clip[n]!);
      if(visible===0)continue;
      const x=center-pivot[0]!*width,y=top-height*visible;
      const color=object.collision?collidableMarker:decorativeMarker;
      props.strip(x,x+width,y,x,x+width,top,.02+(VISIBLE_SEGMENTS-n)*.0001,color);
      if(visible<1)sourceProjectionStats.partialProps++;
      sourceProjectionStats.drawnProps++;
    }
  }
  return props.arrays;
}
