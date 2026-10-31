import type {MeshArrays} from '@gameengine/runtime';
import type {ReadonlySourceBiomeData} from '../schema.gen.ts';
import type {EnvironmentArtManifest,EnvironmentAtlasImage} from '../content/environments/environment-art.ts';
import {TRAFFIC_SOURCE} from '../content/vehicles/traffic-source.manifest.ts';
import {ProjectionBuffers,EMPTY_MESH} from './projection-buffers.ts';
import {buildSourceRoad,sourceProjectionBuffers,sourceProjectionStats} from './source-projection.ts';
import {ROAD_HALF_WIDTH,VISIBLE_SEGMENTS} from './road-projection.ts';
import {map01ClippedQuad} from './map01-art-buffers.ts';
import {trafficProjection,trafficSourceFrame} from './traffic-sprites.ts';

export interface EnvironmentTrafficSnapshot {
  readonly slot:number;readonly modelId:number;readonly z:number;readonly offset:number;
  readonly side:number;readonly motionTicks:number;
}
export interface EnvironmentView {readonly cameraOriginZ:number;readonly lateral:number;readonly viewWidth:number;readonly aspect:number;}
export const ENVIRONMENT_CAPACITY=1032;
export const ENVIRONMENT_BYTES=260064;
const PIN='6882721c99bc79365f815f68d389bf5078129e68';
const white=new Uint8Array([255,255,255]);
function require(condition:boolean,message:string):asserts condition{if(!condition)throw new Error(message);}

/** Fixed storage per presenter; source road/far-endpoint scratch is shared and
 * must be consumed immediately by the sole presentation owner. Never reads SIM. */
export function createEnvironmentBuffers(){
  const composite=new ProjectionBuffers(ENVIRONMENT_CAPACITY),uvs1=new Float32Array(ENVIRONMENT_CAPACITY*8);
  const arrays:MeshArrays={...composite.arrays,uvs1};
  const byId:(EnvironmentAtlasImage|undefined)[]=new Array(256);
  const inputBySlot=new Int16Array(32),carRows=new Int32Array(32),carFrames=new Uint8Array(32);
  const carValues=new Float64Array(32*12);
  const samples={kind:new Uint8Array(ENVIRONMENT_CAPACITY),segment:new Int32Array(ENVIRONMENT_CAPACITY),
    slot:new Int16Array(ENVIRONMENT_CAPACITY),placementId:new Int32Array(ENVIRONMENT_CAPACITY),objectId:new Uint16Array(ENVIRONMENT_CAPACITY),
    frame:new Uint8Array(ENVIRONMENT_CAPACITY),fraction:new Float32Array(ENVIRONMENT_CAPACITY),fullHeight:new Float32Array(ENVIRONMENT_CAPACITY)};
  const stats={capacity:ENVIRONMENT_CAPACITY,submittedBytes:ENVIRONMENT_BYTES,queriedWindow:0,sourceEligible:0,
    visited:0,props:0,emitted:0,hidden:0,outside:0,partial:0,trafficSelected:0,trafficVisible:0,trafficHidden:0,total:0,roadQuads:0};
  let previousData:ReadonlySourceBiomeData|null=null,previousManifest:EnvironmentArtManifest|null=null;
  function validate(data:ReadonlySourceBiomeData,manifest:EnvironmentArtManifest){
    require(Number.isInteger(data.id)&&data.id>=2&&data.id<=16,'Environment requires destination map2..16');
    require(manifest.mapId===data.id&&manifest.sourceCommit===PIN&&data.sourceCommit===PIN,'Environment map/source provenance mismatch');
    require(data.segmentLength===150&&data.totalCount===data.segments.length&&data.totalCount>=VISIBLE_SEGMENTS,'Environment source geometry invalid');
    require(data.objects.length>0&&data.objects.length<256&&manifest.images.length===data.objects.length,'Environment object catalog bound/membership mismatch');
    require(manifest.pages.length>=1&&manifest.pages.length<=2,'Environment requires one or two pages');
    for(let p=0;p<manifest.pages.length;p++){
      const page=manifest.pages[p]!;
      require(page.extrudePx===2&&Number.isInteger(page.sizePx[0])&&Number.isInteger(page.sizePx[1])&&page.sizePx[0]>0&&page.sizePx[0]<=1024&&page.sizePx[1]>0&&page.sizePx[1]<=1280,'Environment page bounds invalid');
    }
    byId.fill(undefined);
    for(let i=0;i<manifest.images.length;i++){
      const image=manifest.images[i]!,id=image.objectId;
      require(Number.isInteger(id)&&id>0&&id<256&&!byId[id],'Environment object ID invalid/duplicated');
      const object=data.objects[id-1];
      require(!!object&&object.id===id&&image.sourcePath===object.sourcePath&&image.sha256===object.sha256,'Environment object source provenance mismatch');
      require(image.sourceSizePx[0]===object.sourceSizePx[0]&&image.sourceSizePx[1]===object.sourceSizePx[1],'Environment source dimensions mismatch');
      require(image.page===0||image.page===1,'Environment page selector invalid');
      const page=manifest.pages[image.page];require(!!page,'Environment image page missing');
      const rect=image.atlasRectPx;
      require(Number.isInteger(rect[0])&&Number.isInteger(rect[1])&&rect[0]>=2&&rect[1]>=2&&rect[2]===object.sourceSizePx[0]&&rect[3]===object.sourceSizePx[1]&&rect[0]+rect[2]+2<=page.sizePx[0]&&rect[1]+rect[3]+2<=page.sizePx[1],'Environment source rect/extrusion bounds invalid');
      byId[id]=image;
    }
    for(let i=0;i<data.objects.length;i++)require(data.objects[i]!.id===i+1&&!!byId[i+1],'Environment object lookup incomplete');
    require(data.objectOffsets.length===data.totalCount+1&&data.objectOffsets[0]===0&&data.objectOffsets[data.totalCount]===data.placements.length,'Environment prefix bounds invalid');
    let cursor=0;
    for(let row=0;row<data.totalCount;row++){
      const end=data.objectOffsets[row+1]!;
      require(Number.isInteger(end)&&end>=cursor&&end<=data.placements.length,'Environment prefix ordering invalid');
      let lastSlot=-1;
      for(;cursor<end;cursor++){
        const p=data.placements[cursor]!;
        require(p.segment===row&&Number.isInteger(p.slot)&&p.slot>lastSlot&&p.slot<5&&p.id===row*5+p.slot,'Environment placement identity/order invalid');
        require(Number.isInteger(p.definition)&&p.definition>=0&&p.definition<data.definitions.length,'Environment placement definition invalid');
        const definition=data.definitions[p.definition]!;
        require(!!byId[definition.objectId],'Environment definition object missing');lastSlot=p.slot;
      }
    }
    previousData=data;previousManifest=manifest;
  }
  function emit(left:number,right:number,bottom:number,top:number,depth:number,u0:number,u1:number,v0:number,v1:number,kind:number,segment:number,slot:number,placementId:number,objectId:number,frame:number,fraction:number,height:number){
    const q=composite.count;
    composite.strip(left,right,bottom,left,right,top,depth,white);
    const uv=q*8;
    composite.uvs[uv]=u0;composite.uvs[uv+1]=v1;composite.uvs[uv+2]=u1;composite.uvs[uv+3]=v1;
    composite.uvs[uv+4]=u1;composite.uvs[uv+5]=v0;composite.uvs[uv+6]=u0;composite.uvs[uv+7]=v0;
    for(let v=0;v<4;v++)uvs1[uv+v*2]=kind;
    samples.kind[q]=kind;samples.segment[q]=segment;samples.slot[q]=slot;samples.placementId[q]=placementId;
    samples.objectId[q]=objectId;samples.frame[q]=frame;samples.fraction[q]=fraction;samples.fullHeight[q]=height;
  }
  const result={arrays,stats,samples,road:EMPTY_MESH as MeshArrays,
    build(data:ReadonlySourceBiomeData,view:EnvironmentView,manifest:EnvironmentArtManifest,traffic:readonly EnvironmentTrafficSnapshot[]):MeshArrays{
      if(data!==previousData||manifest!==previousManifest)validate(data,manifest);
      require(Number.isFinite(view.cameraOriginZ)&&view.cameraOriginZ>=0&&Number.isFinite(view.lateral)&&Number.isFinite(view.viewWidth)&&view.viewWidth>0&&Number.isFinite(view.aspect)&&view.aspect>0,'Environment view invalid');
      require(traffic.length<=32,'Environment traffic exceeds32 slots');
      inputBySlot.fill(-1);carRows.fill(-1);carFrames.fill(0);
      for(let i=0;i<traffic.length;i++){
        const t=traffic[i]!;
        require(Number.isInteger(t.slot)&&t.slot>=0&&t.slot<32&&inputBySlot[t.slot]===-1,'Environment traffic slot invalid/duplicated');
        require(Number.isInteger(t.modelId)&&t.modelId>=1&&t.modelId<=32&&(t.side===0||t.side===1)&&Number.isFinite(t.z)&&t.z>=0&&t.z<data.totalCount*data.segmentLength&&Number.isFinite(t.offset)&&Number.isInteger(t.motionTicks)&&t.motionTicks>=0,'Environment traffic pose/model invalid');
        inputBySlot[t.slot]=i;
      }
      result.road=buildSourceRoad(data,view.cameraOriginZ,view.lateral,view.aspect);
      composite.reset();uvs1.fill(0);samples.kind.fill(0);samples.segment.fill(-1);samples.slot.fill(-1);samples.placementId.fill(-1);samples.objectId.fill(0);samples.frame.fill(0);samples.fraction.fill(0);samples.fullHeight.fill(0);
      stats.visited=stats.props=stats.emitted=stats.hidden=stats.outside=stats.partial=stats.trafficVisible=stats.trafficHidden=stats.total=0;
      stats.trafficSelected=traffic.length;stats.roadQuads=sourceProjectionStats.visibleRoadSegments*9;
      const base=Math.floor(sourceProjectionStats.cameraOriginZ/data.segmentLength),end=base+VISIBLE_SEGMENTS;
      const first=Math.max(base+1,Math.floor(sourceProjectionStats.playerSampleZ/data.segmentLength));
      stats.queriedWindow=data.objectOffsets[end]!-data.objectOffsets[base]!;
      stats.sourceEligible=data.objectOffsets[end]!-data.objectOffsets[first]!;
      require(stats.queriedWindow<=1000,'Environment source window exceeds1000');
      // Preproject at most32 controlled snapshots. Their stable slots, not input
      // array order, decide painter order. No pool/lifetime or SIM state is read.
      for(let slot=0;slot<32;slot++){
        const index=inputBySlot[slot]!;if(index<0)continue;
        const t=traffic[index]!,model=TRAFFIC_SOURCE.models[t.modelId-1]!;
        const frame=trafficSourceFrame(data,t.z,t.offset,t.side,sourceProjectionStats.playerSampleZ,view.lateral,t.motionTicks);
        const image=model.frames[frame-1]!;
        const p=trafficProjection(data,t.z,t.offset,t.side,image,model.scale,view.aspect,TRAFFIC_SOURCE.atlas.sizePx);
        if(!p){stats.trafficHidden++;continue;}
        carRows[slot]=p.segment;carFrames[slot]=frame;const k=slot*12;
        carValues[k]=p.left;carValues[k+1]=p.right;carValues[k+2]=p.bottom;carValues[k+3]=p.top;carValues[k+4]=p.depth;
        carValues[k+5]=p.u0;carValues[k+6]=p.u1;carValues[k+7]=p.v0;carValues[k+8]=p.v1;carValues[k+9]=p.fraction;carValues[k+10]=p.height;
      }
      const b=sourceProjectionBuffers;
      for(let segment=end-1;segment>=base;segment--){
        const n=segment-base,s=b.scale[n]!;
        if(segment>=first&&s>0){
          for(let i=data.objectOffsets[segment]!;i<data.objectOffsets[segment+1]!;i++){
            stats.visited++;const placement=data.placements[i]!,definition=data.definitions[placement.definition]!,object=data.objects[definition.objectId-1]!,image=byId[object.id]!,page=manifest.pages[image.page]!;
            const pivot=definition.offsetX>=0?object.pivotRight:object.pivotLeft;
            const center=(definition.side?b.right[n]!:b.left[n]!)+definition.offsetX*ROAD_HALF_WIDTH*view.aspect*s;
            const offsetY=definition.viewportYFactor!==0?definition.viewportYFactor*view.viewWidth/data.referenceWidth:definition.offsetY;
            const anchor=b.ground[n]!-offsetY*s*1000,unit=s*view.aspect*(.3/170*ROAD_HALF_WIDTH)*object.scale;
            const width=object.sourceSizePx[0]!*unit*3.2,height=object.sourceSizePx[1]!*unit*3.43;
            const top=anchor+pivot[1]!*height,bottom=top-height,x=center-pivot[0]!*width;
            const clipped=map01ClippedQuad(x,bottom,width,height,b.clip[n]!,image.atlasRectPx,page.sizePx);
            if(clipped.fraction===0){stats.hidden++;continue;}
            if(x+width<=-view.aspect||x>=view.aspect||top<=-1||bottom>=1){stats.outside++;continue;}
            emit(clipped.left,clipped.right,clipped.bottom,clipped.top,.02+(VISIBLE_SEGMENTS-n)*.0001,clipped.u0,clipped.u1,clipped.v0,clipped.v1,image.page,segment,-1,placement.id,object.id,0,clipped.fraction,height);
            stats.props++;if(clipped.fraction<1)stats.partial++;
          }
        }
        for(let slot=0;slot<32;slot++)if(carRows[slot]===segment){
          const k=slot*12,t=traffic[inputBySlot[slot]!]!;
          emit(carValues[k]!,carValues[k+1]!,carValues[k+2]!,carValues[k+3]!,carValues[k+4]!,carValues[k+5]!,carValues[k+6]!,carValues[k+7]!,carValues[k+8]!,2,segment,slot,-1,t.modelId,carFrames[slot]!,carValues[k+9]!,carValues[k+10]!);
          stats.trafficVisible++;
        }
      }
      stats.total=composite.count;stats.emitted=stats.total;return arrays;
    }};
  return result;
}
