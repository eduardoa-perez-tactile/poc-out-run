import { loadData } from '@gameengine/runtime';
import { SourceBiome,SourceBiomeCatalog,type ReadonlySourceBiomeData,type ReadonlySourceBiomeCatalogData } from '../schema.gen.ts';
export const MAP01_KEY='data/biomes/map01.json';
export const SOURCE_PLAYER_OFFSET_Z=702;
export const SOURCE_SEGMENT_LENGTH=150;
export function loadMap01():ReadonlySourceBiomeData{return loadData(SourceBiome,MAP01_KEY);}
export type SourceBiomeId=1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16;
const sourceBiomeKeys:Readonly<Record<SourceBiomeId,string>>={
  1:MAP01_KEY,2:'data/biomes/map02.json',3:'data/biomes/map03.json',
  4:'data/biomes/map04.json',5:'data/biomes/map05.json',6:'data/biomes/map06.json',
  7:'data/biomes/map07.json',8:'data/biomes/map08.json',9:'data/biomes/map09.json',
  10:'data/biomes/map10.json',11:'data/biomes/map11.json',12:'data/biomes/map12.json',
  13:'data/biomes/map13.json',14:'data/biomes/map14.json',15:'data/biomes/map15.json',
  16:'data/biomes/goal.json',
};
export const SOURCE_BIOME_CATALOG_KEY='data/biome-catalog.json';
export function loadSourceBiomeCatalog():ReadonlySourceBiomeCatalogData{return loadData(SourceBiomeCatalog,SOURCE_BIOME_CATALOG_KEY);}
/** Explicit data access; importing this module does not load another biome. */
export function loadSourceBiome(mapId:SourceBiomeId):ReadonlySourceBiomeData{
  if(typeof mapId!=='number'||!Number.isInteger(mapId)||mapId<1||mapId>16)throw new Error(`Unsupported source biome ${mapId}`);
  return loadData(SourceBiome,sourceBiomeKeys[mapId]);
}
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
