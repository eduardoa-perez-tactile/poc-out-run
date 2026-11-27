import type { MeshArrays } from '@gameengine/runtime';
import { FERRARI1 } from '../content/vehicles/ferrari1.manifest.ts';
import { previewFrame, effectFrame, WHEEL_ANCHORS_PX, VISUAL_POOL_CAPACITY } from '../content/vehicles/vehicle-poses.ts';
// Three slots forever: body + left/right shared effects. All streams overwritten.
const positions=new Float32Array(VISUAL_POOL_CAPACITY*12);
const normals=new Float32Array(VISUAL_POOL_CAPACITY*12);
const tangents=new Float32Array(VISUAL_POOL_CAPACITY*16);
const uvs=new Float32Array(VISUAL_POOL_CAPACITY*8);
const colors=new Uint8Array(VISUAL_POOL_CAPACITY*16);
const indices=new Uint16Array(VISUAL_POOL_CAPACITY*6);
const buffers:MeshArrays={positions,normals,tangents,uvs,colors,indices};
export const vehicleBufferStats={visible:0,vertices:12,indices:18};
export function buildVehicleBuffers(pose:number,sample:number,effect:number,scale:number,placeholder=false,wheelEffects?:readonly [number,number],hidden=false):MeshArrays {
  positions.fill(0);normals.fill(0);tangents.fill(0);uvs.fill(0);indices.fill(0);colors.fill(255);
  vehicleBufferStats.visible=0;
  // Keep the fixed pool and its asset pin alive. Alpha0 is the opaque loading
  // placeholder's control channel, so hiding uses degenerate geometry instead.
  if(hidden)return buffers;
  const unit=2*Math.max(.5,Math.min(6,scale))/720;
  const body=previewFrame(placeholder?0:pose,placeholder?0:sample);
  const sharedEffectId=placeholder?null:effectFrame(effect,sample);
  for(let slot=0;slot<VISUAL_POOL_CAPACITY;slot++) {
    const effectId=slot>0&&wheelEffects&&!placeholder?effectFrame(wheelEffects[slot-1]!,sample):sharedEffectId;
    if(slot>0 && effectId===null)continue;
    const frame=slot===0?body:FERRARI1.effects[effectId!-1]!;
    const [w,h]=frame.sourceSizePx;const [ax,ay]=frame.groundAnchorPx;
    const anchorX=slot===0?0:WHEEL_ANCHORS_PX[slot-1]![0]*unit;
    const anchorY=-.9-(slot===0?0:WHEEL_ANCHORS_PX[slot-1]![1]*unit);
    const left=anchorX-ax*unit,right=left+w*unit;
    const top=anchorY+ay*unit,bottom=top-h*unit;
    const z=slot===0?.15:.14+slot*.001,p=slot*12;
    positions[p]=left;positions[p+1]=bottom;positions[p+2]=z;
    positions[p+3]=right;positions[p+4]=bottom;positions[p+5]=z;
    positions[p+6]=right;positions[p+7]=top;positions[p+8]=z;
    positions[p+9]=left;positions[p+10]=top;positions[p+11]=z;
    const [x,y,rw,rh]=frame.atlasRectPx;
    const u0=x/FERRARI1.atlas.sizePx[0],u1=(x+rw)/FERRARI1.atlas.sizePx[0];
    const v0=y/FERRARI1.atlas.sizePx[1],v1=(y+rh)/FERRARI1.atlas.sizePx[1],u=slot*8;
    uvs[u]=u0;uvs[u+1]=v1;uvs[u+2]=u1;uvs[u+3]=v1;
    uvs[u+4]=u1;uvs[u+5]=v0;uvs[u+6]=u0;uvs[u+7]=v0;
    const vertex=slot*4,k=slot*6;
    indices[k]=vertex;indices[k+1]=vertex+1;indices[k+2]=vertex+2;
    indices[k+3]=vertex;indices[k+4]=vertex+2;indices[k+5]=vertex+3;
    for(let n=0;n<4;n++){normals[(vertex+n)*3+2]=1;tangents[(vertex+n)*4]=1;tangents[(vertex+n)*4+3]=1;}
    if(placeholder){for(let n=0;n<4;n++){const at=(vertex+n)*4;colors[at]=180;colors[at+1]=8;colors[at+2]=12;colors[at+3]=0;}}
    vehicleBufferStats.visible++;
  }
  return buffers;
}
