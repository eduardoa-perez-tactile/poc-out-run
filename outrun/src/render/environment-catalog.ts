import type {MeshArrays} from '@gameengine/runtime';
import type {EnvironmentArtManifest} from '../content/environments/environment-art.ts';
import {ProjectionBuffers} from './projection-buffers.ts';

const buffer=new ProjectionBuffers(64),uvs1=new Float32Array(64*8);
const arrays:MeshArrays={...buffer.arrays,uvs1};
const white=new Uint8Array([255,255,255]);
export const environmentCatalogSamples={count:0,batch:0,objectId:new Uint16Array(32),page:new Uint8Array(32),
  probeX:new Int32Array(32),probeY:new Int32Array(32),controlX:new Int32Array(32),controlY:new Int32Array(32),rgba:new Uint8Array(128)};
/** Point witnesses exercise packed page/rect/UV/shader mapping. Whole original
 * canvases and extrusion are checked independently by the stdlib importer. */
export function buildEnvironmentCatalog(manifest:EnvironmentArtManifest,batch:number,width:number,height:number,panoramas=false):MeshArrays {
  const total=panoramas?2:manifest.images.length;
  if(!Number.isInteger(batch)||batch<0||batch*32>=total)throw new Error('Environment catalog batch out of bounds');
  buffer.reset();uvs1.fill(0);environmentCatalogSamples.rgba.fill(0);environmentCatalogSamples.objectId.fill(0);
  const count=Math.min(32,total-batch*32),cellW=width/8,cellH=height/4;
  function swatch(left:number,top:number,u:number,v:number,kind:number){
    const q=buffer.count;
    buffer.strip((left-width/2)*2/height,(left+12-width/2)*2/height,(height/2-top-12)*2/height,
      (left-width/2)*2/height,(left+12-width/2)*2/height,(height/2-top)*2/height,0,white);
    for(let vertex=0;vertex<4;vertex++){buffer.uvs[q*8+vertex*2]=u;buffer.uvs[q*8+vertex*2+1]=v;uvs1[q*8+vertex*2]=kind;}
  }
  for(let slot=0;slot<count;slot++){
    const index=batch*32+slot,image=panoramas?null:manifest.images[index]!;
    const panorama=index===0?manifest.back:manifest.front;
    const page=image?.page??index,size=image?manifest.pages[image.page]!.sizePx:panorama.sizePx;
    const probe=image?image.sourceProbe:panorama.sourceProbe;
    if(probe.kind!=='opaque'||probe.rgba[3]!==255)throw new Error('Environment opaque catalog requires a reviewed opaque source witness');
    const left=Math.floor((slot%8)*cellW+cellW/2-20),top=Math.floor(Math.floor(slot/8)*cellH+cellH/2);
    const u=((image?.atlasRectPx[0]??0)+probe.pixelPx[0]+.5)/size[0],v=((image?.atlasRectPx[1]??0)+probe.pixelPx[1]+.5)/size[1];
    swatch(left,top,u,v,page);swatch(left+24,top,(slot+.5)/32,.5,2);
    environmentCatalogSamples.objectId[slot]=image?.objectId??0;environmentCatalogSamples.page[slot]=page;
    environmentCatalogSamples.probeX[slot]=left+6;environmentCatalogSamples.probeY[slot]=top+6;
    environmentCatalogSamples.controlX[slot]=left+30;environmentCatalogSamples.controlY[slot]=top+6;
    environmentCatalogSamples.rgba.set(probe.rgba,slot*4);
  }
  environmentCatalogSamples.count=count;environmentCatalogSamples.batch=batch;
  return arrays;
}
