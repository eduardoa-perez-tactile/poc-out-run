import type {ReadonlySourceBiomeData} from '../schema.gen.ts';
import {ProjectionBuffers} from './projection-buffers.ts';
import {sourceProjectionBuffers,sourceProjectionStats} from './source-projection.ts';
import {ROAD_HALF_WIDTH,VISIBLE_SEGMENTS} from './road-projection.ts';
import {visibleFraction} from './hill-objects.ts';

export const MAP01_PROP_CAPACITY=256;
export interface Map01AtlasImage {readonly objectId:number;readonly atlasRectPx:readonly number[];readonly sourceSizePx:readonly number[];}
export interface Map01Atlas {readonly sizePx:readonly number[];readonly byObjectId:readonly (Map01AtlasImage|undefined)[];}
const props=new ProjectionBuffers(MAP01_PROP_CAPACITY);
const white=new Uint8Array([255,255,255]);
// Per-quad diagnostics retain painter order without allocating per frame.
export const map01PropSamples={
  placementId:new Int32Array(MAP01_PROP_CAPACITY),objectId:new Uint8Array(MAP01_PROP_CAPACITY),
  fullHeight:new Float32Array(MAP01_PROP_CAPACITY),fraction:new Float32Array(MAP01_PROP_CAPACITY),
};
export const map01ArtStats={
  visited:0,drawn:0,partial:0,hidden:0,outside:0,ready:false,roadQuads:0,
  // Cumulative mesh API submissions during this active ownership period.
  uploads:0,submittedBytes:0,
  // Actual RenderTime.frame, with calls/raw typed-array bytes submitted in that
  // frame. These count JS→native copies, not measured hardware GPU bandwidth.
  renderFrame:-1,frameUploadCalls:0,frameSubmittedBytes:0,
};

export function map01AtlasLookup(images:readonly Map01AtlasImage[]):readonly (Map01AtlasImage|undefined)[]{
  const byId:(Map01AtlasImage|undefined)[]=new Array(72);
  for(const image of images){
    if(!Number.isInteger(image.objectId)||image.objectId<1||image.objectId>71||byId[image.objectId])throw new Error('Map1 atlas object ID invalid or duplicated');
    byId[image.objectId]=image;
  }
  return Object.freeze(byId);
}

// Geometry and UVs share the visible fraction: the top keeps its original
// texels while a crest removes the lower image, including transparent padding.
const clipped={left:0,right:0,bottom:0,top:0,fraction:0,u0:0,u1:0,v0:0,v1:0};
// Reused scratch: callers consume this result before the next quad.
export function map01ClippedQuad(left:number,bottom:number,width:number,height:number,crest:number,rect:readonly number[],atlasSize:readonly number[]){
  const top=bottom+height,fraction=visibleFraction(bottom,top,crest);
  clipped.left=left;clipped.right=left+width;clipped.bottom=Math.max(bottom,crest);clipped.top=top;clipped.fraction=fraction;
  clipped.u0=rect[0]!/atlasSize[0]!;clipped.u1=(rect[0]!+rect[2]!)/atlasSize[0]!;
  clipped.v0=rect[1]!/atlasSize[1]!;clipped.v1=(rect[1]!+rect[3]!*fraction)/atlasSize[1]!;
  return clipped;
}

// Consumes the immediately preceding buildSourceRoad sample. The compiled
// prefix table bounds work to the visible200 lines; never scans all1475 props.
export function buildMap01ArtProps(data:ReadonlySourceBiomeData,viewWidth:number,aspect:number,atlas:Map01Atlas){
  props.reset();map01PropSamples.placementId.fill(-1);map01PropSamples.objectId.fill(0);
  map01PropSamples.fullHeight.fill(0);map01PropSamples.fraction.fill(0);
  map01ArtStats.visited=0;map01ArtStats.drawn=0;map01ArtStats.partial=0;map01ArtStats.hidden=0;map01ArtStats.outside=0;
  const {scale,left,right,ground,clip}=sourceProjectionBuffers;
  const base=Math.floor(sourceProjectionStats.cameraOriginZ/data.segmentLength),playerLine=Math.floor(sourceProjectionStats.playerSampleZ/data.segmentLength);
  for(let segment=base+VISIBLE_SEGMENTS-1;segment>=Math.max(base+1,playerLine);segment--){
    const n=segment-base,s=scale[n]!;if(s===0)continue;
    for(let i=data.objectOffsets[segment]!;i<data.objectOffsets[segment+1]!;i++){
      map01ArtStats.visited++;
      const placement=data.placements[i]!,definition=data.definitions[placement.definition]!,object=data.objects[definition.objectId-1]!;
      const image=atlas.byObjectId[object.id];if(!image)throw new Error(`Map1 object${object.id} is missing imported art`);
      if(image.sourceSizePx[0]!==object.sourceSizePx[0]||image.sourceSizePx[1]!==object.sourceSizePx[1])throw new Error(`Map1 object${object.id} source dimensions disagree`);
      // Offset sign, independently of selected road arm, selects the visual pivot.
      const pivot=definition.offsetX>=0?object.pivotRight:object.pivotLeft;
      const center=(definition.side?right[n]!:left[n]!)+definition.offsetX*ROAD_HALF_WIDTH*aspect*s;
      const offsetY=definition.viewportYFactor!==0?definition.viewportYFactor*viewWidth/data.referenceWidth:definition.offsetY;
      const anchor=ground[n]!-offsetY*s*1000;
      const unit=s*aspect*(.3/170*ROAD_HALF_WIDTH)*object.scale;
      const width=object.sourceSizePx[0]!*unit*3.2,height=object.sourceSizePx[1]!*unit*3.43;
      const top=anchor+pivot[1]!*height,bottom=top-height,x=center-pivot[0]!*width;
      const clipped=map01ClippedQuad(x,bottom,width,height,clip[n]!,image.atlasRectPx,atlas.sizePx),fraction=clipped.fraction;
      if(fraction===0){map01ArtStats.hidden++;continue;}
      if(x+width<=-aspect||x>=aspect||top<=-1||bottom>=1){map01ArtStats.outside++;continue;}
      const q=props.count;
      props.strip(clipped.left,clipped.right,clipped.bottom,clipped.left,clipped.right,clipped.top,.02+(VISIBLE_SEGMENTS-n)*.0001,white);
      const u=q*8;
      props.uvs[u]=clipped.u0;props.uvs[u+1]=clipped.v1;props.uvs[u+2]=clipped.u1;props.uvs[u+3]=clipped.v1;
      props.uvs[u+4]=clipped.u1;props.uvs[u+5]=clipped.v0;props.uvs[u+6]=clipped.u0;props.uvs[u+7]=clipped.v0;
      map01PropSamples.placementId[q]=placement.id;map01PropSamples.objectId[q]=object.id;
      map01PropSamples.fullHeight[q]=height;map01PropSamples.fraction[q]=fraction;
      if(fraction<1)map01ArtStats.partial++;
      map01ArtStats.drawn++;
    }
  }
  return props.arrays;
}
