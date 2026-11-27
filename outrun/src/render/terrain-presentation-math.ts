import type {ReadonlySourceBiomeData} from '../schema.gen.ts';
import {wrapMap01Texels} from './map01-art-backgrounds.ts';

let prefixData:ReadonlySourceBiomeData|null=null;
let curvePrefix=new Float64Array(0);
function integral(data:ReadonlySourceBiomeData,playerZ:number):number{
  if(prefixData!==data){
    curvePrefix=new Float64Array(data.totalCount+1);
    for(let i=0;i<data.totalCount;i++)curvePrefix[i+1]=curvePrefix[i]!+(data.segments[i]!.mirror?0:data.segments[i]!.curve);
    prefixData=data;
  }
  const line=Math.max(0,Math.min(data.totalCount,playerZ/data.segmentLength));
  const index=Math.floor(line);
  if(index===data.totalCount)return curvePrefix[index]!;
  const row=data.segments[index]!;
  return curvePrefix[index]!+(row.mirror?0:row.curve)*(line-index);
}
// Path integral of the source's curve*deltaZ/segmentLength, excluding mirrored
// rows. O(1) per sample after one immutable-content prefix build; no frame count.
export function terrainParallaxOffset(data:ReadonlySourceBiomeData,cameraOriginZ:number,layer:number,width:number):number{
  const sum=integral(data,cameraOriginZ+data.playerOffsetZ)-integral(data,45000+data.playerOffsetZ);
  return wrapMap01Texels(1000+sum*(layer===0?2:2.5),width);
}
export function terrainVehiclePose(steering:number,grade:number,braking:boolean):number{
  const direction=steering<0?1:steering>0?2:0;
  const elevation=grade>0?1:grade<0?2:0;
  return (braking?9:0)+elevation*3+direction;
}
