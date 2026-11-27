import {ProjectionBuffers} from './projection-buffers.ts';
const layers=[new ProjectionBuffers(1),new ProjectionBuffers(1)];
const white=new Uint8Array([255,255,255]);
export const MAP01_PANORAMA_HEIGHT_PX=253;
export const MAP01_PANORAMA_REFERENCE_HEIGHT=720;
export const map01BackgroundStats={backPhase:0,frontPhase:0,bottom:0,top:0};
export function wrapMap01Texels(offset:number,width:number):number{return offset-Math.floor(offset/width)*width;}
export function advanceMap01Parallax(offset:number,curve:number,deltaZ:number,segmentLength:number,layer:number,mirror:boolean,playing:boolean):number{
  return playing&&!mirror?offset+curve*deltaZ/segmentLength*(layer===0?2:2.5):offset;
}
// Adapt the source's253-pixel strip to a720-high design reference. Its pixel
// density is uniform in X/Y; resized viewports reveal more/less of a repeat.
// The strip's contact follows the actual final projected road crest.
export function buildMap01Panorama(layer:number,aspect:number,crest:number,offset:number,size:readonly number[]){
  const mesh=layers[layer]!;mesh.reset();
  const unit=2/MAP01_PANORAMA_REFERENCE_HEIGHT,fullHeight=MAP01_PANORAMA_HEIGHT_PX*unit;
  const bottom=Math.max(-1,crest),top=Math.min(1,crest+fullHeight);
  map01BackgroundStats.bottom=bottom;map01BackgroundStats.top=top;
  const phase=wrapMap01Texels(offset,size[0]!)/size[0]!;
  if(layer===0)map01BackgroundStats.backPhase=phase;else map01BackgroundStats.frontPhase=phase;
  if(top<=bottom)return mesh.arrays;
  mesh.strip(-aspect,aspect,bottom,-aspect,aspect,top,layer===0?-.2:-.1,white);
  const u0=phase,u1=u0+2*aspect/unit/size[0]!;
  const v0=(crest+fullHeight-top)/unit/size[1]!,v1=(crest+fullHeight-bottom)/unit/size[1]!;
  mesh.uvs[0]=u0;mesh.uvs[1]=v1;mesh.uvs[2]=u1;mesh.uvs[3]=v1;
  mesh.uvs[4]=u1;mesh.uvs[5]=v0;mesh.uvs[6]=u0;mesh.uvs[7]=v0;
  return mesh.arrays;
}
