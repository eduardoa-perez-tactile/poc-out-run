import type {MeshArrays} from '@gameengine/runtime';
import {TRAFFIC_SOURCE} from '../content/vehicles/traffic-source.manifest.ts';
import {ProjectionBuffers} from './projection-buffers.ts';

const catalog=new ProjectionBuffers(64),uvs1=new Float32Array(64*8);
const arrays:MeshArrays={...catalog.arrays,uvs1};
const white=new Uint8Array([255,255,255]);
// Fixed presentation scratch, completely overwritten by each build. Coordinates
// are native framebuffer pixels with a top-left origin, matching render.probe.
export const catalogSamples={
  count:0,columns:8,rows:4,width:0,height:0,scale:0,frame:0,
  model:new Uint8Array(32),sourceFrame:new Uint8Array(32),
  left:new Int32Array(32),top:new Int32Array(32),bottom:new Int32Array(32),
  probeX:new Int32Array(32),probeY:new Int32Array(32),controlX:new Int32Array(32),controlY:new Int32Array(32),rgba:new Uint8Array(32*4),
};

// Explicit art fixture: one full source canvas per model, no live TrafficPool,
// projection/physics inputs or gameplay decisions. Source SCALE is deliberately
// not applied to this native-pixel catalog, which compares original canvases.
export function buildTrafficCatalog(width:number,height:number,frame:number):MeshArrays {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0)throw new Error('Traffic catalog requires positive pixel dimensions');
  if(!Number.isInteger(frame)||frame<1||frame>16)throw new Error('Traffic catalog requires source frame1..16');
  const cellW=width/8,cellH=height/4;
  const scale=Math.max(1,Math.floor(Math.min(cellW/(66+8),cellH/(55+16))));
  catalog.reset();uvs1.fill(0);
  catalogSamples.count=32;catalogSamples.width=width;catalogSamples.height=height;catalogSamples.scale=scale;catalogSamples.frame=frame;
  for(let slot=0;slot<32;slot++){
    const model=TRAFFIC_SOURCE.models[slot],image=model?.frames[frame-1];
    if(!model||model.id!==slot+1||!image||image.sourceFrame!==frame)throw new Error('Traffic catalog source order differs');
    const [w,h]=image.sourceSizePx,col=slot%8,row=Math.floor(slot/8);
    const bottom=Math.floor(row*cellH+(cellH+55*scale)/2);
    const left=Math.floor(col*cellW+cellW/2-image.groundAnchorPx[0]*scale),top=bottom-image.groundAnchorPx[1]*scale;
    const x0=(left-width/2)*2/height,x1=(left+w*scale-width/2)*2/height;
    const y0=(height/2-bottom)*2/height,y1=(height/2-top)*2/height;
    catalog.strip(x0,x1,y0,x0,x1,y1,0,white);
    const [x,y,rw,rh]=image.atlasRectPx,[aw,ah]=TRAFFIC_SOURCE.atlas.sizePx,u=slot*8;
    catalog.uvs[u]=x/aw;catalog.uvs[u+1]=(y+rh)/ah;
    catalog.uvs[u+2]=(x+rw)/aw;catalog.uvs[u+3]=(y+rh)/ah;
    catalog.uvs[u+4]=(x+rw)/aw;catalog.uvs[u+5]=y/ah;
    catalog.uvs[u+6]=x/aw;catalog.uvs[u+7]=y/ah;
    for(let vertex=0;vertex<4;vertex++)uvs1[u+vertex*2]=1;
    catalogSamples.model[slot]=model.id;catalogSamples.sourceFrame[slot]=frame;
    catalogSamples.left[slot]=left;catalogSamples.top[slot]=top;catalogSamples.bottom[slot]=bottom;
    catalogSamples.probeX[slot]=left+image.opaqueProbePx[0]*scale+Math.floor(scale/2);
    catalogSamples.probeY[slot]=top+image.opaqueProbePx[1]*scale+Math.floor(scale/2);
    catalogSamples.rgba.set(image.opaqueProbeRgba,slot*4);
  }
  // Independent source-color controls use the same shader/pass and opaque
  // texel-center sampling. GPU transfer/quantization is therefore shared.
  for(let slot=0;slot<32;slot++){
    const left=Math.floor((slot%8)*cellW)+4,top=Math.floor(Math.floor(slot/8)*cellH)+4;
    const x0=(left-width/2)*2/height,x1=(left+4-width/2)*2/height;
    const y0=(height/2-top-4)*2/height,y1=(height/2-top)*2/height;
    catalog.strip(x0,x1,y0,x0,x1,y1,0,white);
    const u=(32+slot)*8,cx=(slot+.5)/32,cy=(frame-.5)/16;
    for(let vertex=0;vertex<4;vertex++){catalog.uvs[u+vertex*2]=cx;catalog.uvs[u+vertex*2+1]=cy;}
    catalogSamples.controlX[slot]=left+2;catalogSamples.controlY[slot]=top+2;
  }
  return arrays;
}
