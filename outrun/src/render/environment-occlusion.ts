import type {MeshArrays} from '@gameengine/runtime';
import type {EnvironmentArtManifest,EnvironmentAtlasImage} from '../content/environments/environment-art.ts';
import {TRAFFIC_SOURCE,type TrafficFrame} from '../content/vehicles/traffic-source.manifest.ts';
import {ProjectionBuffers} from './projection-buffers.ts';

export interface EnvironmentOcclusionOutput {
  readonly composite:MeshArrays;readonly controls:MeshArrays;readonly rgba:Uint8Array;
  readonly probes:{readonly count:number;readonly probeX:Int32Array;readonly probeY:Int32Array;readonly controlX:Int32Array;readonly controlY:Int32Array};
  readonly witnesses:readonly {readonly kind:number;readonly objectId:number;readonly modelId:number;readonly frame:number;readonly sourcePath:string;readonly sha256:string;readonly sourcePixelPx:Int32Array;readonly rgba:Uint8Array}[];
}

/** Imported opaque texels, not synthetic RGB: controlled order witness only.
 * Fixed CPU scratch; caller owns all mesh/material/texture lifecycle operations. */
export function createEnvironmentOcclusionFixture(){
  const compositeBuffer=new ProjectionBuffers(9),controlBuffer=new ProjectionBuffers(3);
  const compositeUv1=new Float32Array(9*8),controlUv1=new Float32Array(3*8);
  const composite={...compositeBuffer.arrays,uvs1:compositeUv1},controls={...controlBuffer.arrays,uvs1:controlUv1};
  const rgba=new Uint8Array(128),white=new Uint8Array([255,255,255]);
  const probes={count:9,probeX:new Int32Array(9),probeY:new Int32Array(9),controlX:new Int32Array(9),controlY:new Int32Array(9)};
  const witnesses=Array.from({length:3},(_,kind)=>({kind,objectId:0,modelId:0,frame:0,sourcePath:'',sha256:'',sourcePixelPx:new Int32Array(2),rgba:new Uint8Array(4)}));
  const sampleU=new Float64Array(3),sampleV=new Float64Array(3);
  const expectedKinds=new Uint8Array([0,1,2,1,2,0,0,2,1]);
  const probeDesignX=new Int32Array([150,300,450,610,635,665,810,835,865]);
  let selected:EnvironmentArtManifest|null=null;
  function positive(color:readonly number[]){return color[3]===255&&Math.max(color[0]!,color[1]!,color[2]!)>=48;}
  function contrast(a:readonly number[],b:readonly number[]){return Math.abs(a[0]!-b[0]!)+Math.abs(a[1]!-b[1]!)+Math.abs(a[2]!-b[2]!)>=96;}
  function choose(manifest:EnvironmentArtManifest){
    if(manifest.mapId!==10||manifest.sourceCommit!==TRAFFIC_SOURCE.sourceCommit||manifest.pages.length!==2)throw new Error('Imported occlusion requires actual pinned two-page Map10');
    let first:EnvironmentAtlasImage|undefined,second:EnvironmentAtlasImage|undefined,traffic:TrafficFrame|undefined,modelId=0;
    search:for(const a of manifest.images){
      if(a.page!==0||a.sourceProbe.kind!=='opaque'||!positive(a.sourceProbe.rgba))continue;
      for(const b of manifest.images){
        if(b.page!==1||b.sourceProbe.kind!=='opaque'||!positive(b.sourceProbe.rgba)||!contrast(a.sourceProbe.rgba,b.sourceProbe.rgba))continue;
        for(const model of TRAFFIC_SOURCE.models)for(const frame of model.frames){
          if(positive(frame.opaqueProbeRgba)&&contrast(frame.opaqueProbeRgba,a.sourceProbe.rgba)&&contrast(frame.opaqueProbeRgba,b.sourceProbe.rgba)){
            first=a;second=b;traffic=frame;modelId=model.id;break search;
          }
        }
      }
    }
    if(!first||!second||!traffic)throw new Error('No distinct nonblack imported opaque occlusion witnesses');
    rgba.fill(0);
    for(let kind=0;kind<3;kind++){
      const image=kind===0?first:second,source=kind===2?traffic:undefined;
      const pixel=source?source.opaqueProbePx:image.sourceProbe.pixelPx;
      const color=source?source.opaqueProbeRgba:image.sourceProbe.rgba;
      const rect=source?source.atlasRectPx:image.atlasRectPx;
      const size=source?TRAFFIC_SOURCE.atlas.sizePx:manifest.pages[kind]!.sizePx;
      const witness=witnesses[kind]!;
      witness.objectId=source?0:image.objectId;witness.modelId=source?modelId:0;witness.frame=source?source.sourceFrame:0;
      witness.sourcePath=source?source.sourcePath:image.sourcePath;witness.sha256=source?source.sha256:image.sha256;
      witness.sourcePixelPx[0]=pixel[0];witness.sourcePixelPx[1]=pixel[1];witness.rgba.set(color);
      rgba.set(color,kind*4);sampleU[kind]=(rect[0]+pixel[0]+.5)/size[0];sampleV[kind]=(rect[1]+pixel[1]+.5)/size[1];
    }
    selected=manifest;
  }
  function rect(buffer:ProjectionBuffers,uv1:Float32Array,left:number,right:number,top:number,bottom:number,u:number,v:number,kind:number,width:number,height:number){
    const q=buffer.count,sx=width/1280,sy=height/720;
    const x0=(left*sx-width/2)*2/height,x1=(right*sx-width/2)*2/height,y0=(height/2-bottom*sy)*2/height,y1=(height/2-top*sy)*2/height;
    buffer.strip(x0,x1,y0,x0,x1,y1,.02+q*.001,white);
    for(let vertex=0;vertex<4;vertex++){buffer.uvs[q*8+vertex*2]=u;buffer.uvs[q*8+vertex*2+1]=v;uv1[q*8+vertex*2]=kind;}
  }
  const result={composite,controls,rgba,probes,witnesses,build(manifest:EnvironmentArtManifest,width:number,height:number):EnvironmentOcclusionOutput{
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<320||height<180)throw new Error('Occlusion viewport must be finite landscape-sized');
    if(manifest!==selected)choose(manifest);
    compositeBuffer.reset();controlBuffer.reset();compositeUv1.fill(0);controlUv1.fill(0);
    // Three single-texture witnesses, then both genuine triple painter orders.
    rect(compositeBuffer,compositeUv1,100,200,100,200,sampleU[0]!,sampleV[0]!,0,width,height);
    rect(compositeBuffer,compositeUv1,250,350,100,200,sampleU[1]!,sampleV[1]!,1,width,height);
    rect(compositeBuffer,compositeUv1,400,500,100,200,sampleU[2]!,sampleV[2]!,2,width,height);
    rect(compositeBuffer,compositeUv1,600,700,100,200,sampleU[1]!,sampleV[1]!,1,width,height);
    rect(compositeBuffer,compositeUv1,625,675,100,200,sampleU[2]!,sampleV[2]!,2,width,height);
    rect(compositeBuffer,compositeUv1,650,725,100,200,sampleU[0]!,sampleV[0]!,0,width,height);
    rect(compositeBuffer,compositeUv1,800,900,100,200,sampleU[0]!,sampleV[0]!,0,width,height);
    rect(compositeBuffer,compositeUv1,825,875,100,200,sampleU[2]!,sampleV[2]!,2,width,height);
    rect(compositeBuffer,compositeUv1,850,925,100,200,sampleU[1]!,sampleV[1]!,1,width,height);
    for(let kind=0;kind<3;kind++)rect(controlBuffer,controlUv1,120+kind*60,160+kind*60,300,340,(kind+.5)/32,.5,0,width,height);
    for(let i=0;i<9;i++){
      probes.probeX[i]=Math.floor(probeDesignX[i]!*width/1280);probes.probeY[i]=Math.floor(150*height/720);
      probes.controlX[i]=Math.floor((140+expectedKinds[i]!*60)*width/1280);probes.controlY[i]=Math.floor(320*height/720);
    }
    return result;
  }};
  return result;
}
