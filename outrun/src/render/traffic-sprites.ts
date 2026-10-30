import type {ReadonlySourceBiomeData} from '../schema.gen.ts';
import {sourceProjectionBuffers,sourceProjectionStats} from './source-projection.ts';
import {ROAD_HALF_WIDTH,VISIBLE_SEGMENTS} from './road-projection.ts';
import {map01ClippedQuad} from './map01-art-buffers.ts';

// Source enum perspective, not steering velocity. Phase is authoritative
// movement age (0..5), so skipped renders and pending textures lose no history.
export function trafficSourceFrame(data:ReadonlySourceBiomeData,z:number,offset:number,side:number,playerZ:number,playerLateral:number,motionTicks:number){
  const segment=Math.floor(z/data.segmentLength),row=data.segments[segment];
  if(!row)throw new Error('Traffic pose is outside source map');
  const carX=offset*ROAD_HALF_WIDTH+(side?row.gap:0),playerX=playerLateral*ROAD_HALF_WIDTH;
  const left=carX>playerX;
  const close=Math.abs(carX-playerX)<=2000&&Math.abs(segment-Math.floor(playerZ/data.segmentLength))<=20;
  const y0=Math.trunc(row.y0),y1=Math.trunc(row.y1);
  const first=y1>y0?(left?7:5):y1<y0?(left?11:9):close?(left?3:1):(left?15:13);
  return first+Math.floor(motionTicks/3)%2;
}

export interface TrafficProjectionImage {readonly sourceSizePx:readonly number[];readonly atlasRectPx:readonly number[];}
// Reused output: consume before another projection call; never retains SIM data.
const projected={segment:0,left:0,right:0,bottom:0,top:0,u0:0,u1:0,v0:0,v1:0,fraction:0,width:0,height:0,depth:0};
export function trafficProjection(data:ReadonlySourceBiomeData,z:number,offset:number,side:number,image:TrafficProjectionImage,modelScale:number,aspect:number,atlasSize:readonly number[]){
  const base=Math.floor(sourceProjectionStats.cameraOriginZ/data.segmentLength),segment=Math.floor(z/data.segmentLength),n=segment-base;
  if(z<sourceProjectionStats.playerSampleZ||n<0||n>=VISIBLE_SEGMENTS||segment>=data.totalCount)return null;
  const {scale,left,right,ground,clip,farScale,farLeft,farRight,farGround}=sourceProjectionBuffers;
  if(farScale.length<=n||farLeft.length<=n||farRight.length<=n||farGround.length<=n)throw new Error('Traffic projection requires the valid source far endpoint');
  const s0=scale[n]!,s1=farScale[n]!;
  if(!(s0>0&&s1>0))return null;
  const fraction=z/data.segmentLength-segment,s=s0+(s1-s0)*fraction;
  const arm=side?right:left,farArm=side?farRight:farLeft;
  const center=arm[n]!+(farArm[n]!-arm[n]!)*fraction+offset*ROAD_HALF_WIDTH*aspect*s;
  const anchor=ground[n]!+(farGround[n]!-ground[n]!)*fraction;
  const unit=s*aspect*(.3/170*ROAD_HALF_WIDTH)*modelScale;
  const width=image.sourceSizePx[0]!*unit*3.2,height=image.sourceSizePx[1]!*unit*3.43;
  const cropped=map01ClippedQuad(center-width/2,anchor,width,height,clip[n]!,image.atlasRectPx,atlasSize);
  if(cropped.fraction===0||cropped.right<=-aspect||cropped.left>=aspect||cropped.top<=-1||cropped.bottom>=1)return null;
  projected.segment=segment;projected.left=cropped.left;projected.right=cropped.right;
  projected.bottom=cropped.bottom;projected.top=cropped.top;projected.u0=cropped.u0;projected.u1=cropped.u1;
  projected.v0=cropped.v0;projected.v1=cropped.v1;projected.fraction=cropped.fraction;
  projected.width=width;projected.height=height;projected.depth=.02+(VISIBLE_SEGMENTS-n)*.0001;
  return projected;
}
