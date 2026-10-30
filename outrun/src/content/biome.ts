import { loadData } from '@gameengine/runtime';
import { SourceBiome,type ReadonlySourceBiomeData } from '../schema.gen.ts';
export const MAP01_KEY='data/biomes/map01.json';
export const SOURCE_PLAYER_OFFSET_Z=702;
export const SOURCE_SEGMENT_LENGTH=150;
export function loadMap01():ReadonlySourceBiomeData{return loadData(SourceBiome,MAP01_KEY);}
export function trackHeight(data:ReadonlySourceBiomeData,z:number):number {
  const distance=Math.max(0,Math.min(data.totalCount*data.segmentLength-.001,z));
  const index=Math.floor(distance/data.segmentLength),fraction=(distance-index*data.segmentLength)/data.segmentLength;
  const row=data.segments[index]!;
  return Math.fround(row.y0+Math.fround((row.y1-row.y0)*fraction));
}
export function sourcePlayerSample(data:ReadonlySourceBiomeData,cameraOriginZ:number) {
  const playerZ=cameraOriginZ+data.playerOffsetZ;
  const index=Math.max(0,Math.min(data.totalCount-1,Math.floor(playerZ/data.segmentLength)));
  const height=trackHeight(data,playerZ);
  // Map.cpp583/810 casts the interpolated player Y to int before projection.
  // Preserve fractional terrain sampling separately for future wheel contact.
  return {playerZ,index,height,cameraY:data.cameraHeight+Math.trunc(height),gap:data.segments[index]!.gap};
}
