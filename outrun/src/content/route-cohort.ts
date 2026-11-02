import type {ReadonlySourceBiomeData,ReadonlySourceBiomeCatalogData,ReadonlySourceRouteCohortData} from '../schema.gen.ts';
import type {SourceBiomeId} from './biome.ts';
import {immutable,validateCatalog,type RuntimeProfileSourceAccessor,type OriginalRouteGradient} from './route-profiles.ts';

const PIN='6882721c99bc79365f815f68d389bf5078129e68';
const FORMAT='sourceCompatibility-original-row-dictionary-v1';
const TAIL_ROWS=1960;
type Row=ReadonlySourceBiomeData['segments'][number];
function require(value:unknown,message:string):asserts value {if(!value)throw new Error('Route cohort: '+message);}
function integer(value:number,min:number,max:number):boolean {return Number.isInteger(value)&&value>=min&&value<=max;}
function digest(value:string):boolean {return typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);}
function sourceFloat(value:number):boolean {return Number.isFinite(value)&&Math.fround(value)===value;}

/** The dictionary's frozen objects are the final runtime rows. Only reference
 * arrays are composed here, once before any fixed step; no decoded legacy maps
 * or temporary full row objects are retained by the data cache. */
export function createRouteCohortSourceAccessor(
  cohort:ReadonlySourceRouteCohortData,catalog:ReadonlySourceBiomeCatalogData,
):RuntimeProfileSourceAccessor {
  require(cohort.format===FORMAT&&cohort.sourceCommit===PIN&&catalog.sourceCommit===PIN,'source/format mismatch');
  require(cohort.entries.length===16&&catalog.entries.length===16,'exactly16 maps are required');
  require(catalog.profile==='sourceCompatibility-original'&&catalog.forkGradient===0,'catalog must retain original gradient0');
  const seen=new WeakSet<object>();immutable(cohort,seen);immutable(catalog,seen);
  for(const hash of Object.values(cohort.sourceHashes))require(digest(hash),'invalid implementation digest');
  require(cohort.rows.length>0,'empty row dictionary');
  for(const row of cohort.rows){
    let fields=0;
    for(const key in row)if(Object.prototype.hasOwnProperty.call(row,key)){
      require(key==='y0'||key==='y1'||key==='curve'||key==='gap'||key==='mirror'||key==='light','unexpected source row field');fields++;
    }
    require(fields===6&&sourceFloat(row.y0)&&sourceFloat(row.y1)&&sourceFloat(row.curve)&&sourceFloat(row.gap)&&
      typeof row.mirror==='boolean'&&integer(row.light,0,1),'invalid source row');
  }
  function rowAt(index:number):Row {
    require(integer(index,0,cohort.rows.length-1),'row dictionary index out of bounds');
    return cohort.rows[index]!;
  }
  const bases:ReadonlySourceBiomeData[]=[],records:(readonly ReadonlySourceBiomeData[])[]=[];
  for(let i=0;i<16;i++){
    const entry=cohort.entries[i]!,metadata=entry.base,mapId=i+1;
    require(metadata.id===mapId,'map membership/order mismatch');
    require(metadata.sourceCommit===PIN&&metadata.profile==='sourceCompatibility-original'&&metadata.forkGradient===0,'base profile/source mismatch');
    require(digest(metadata.inputSha256)&&digest(entry.baseAssetSha256),'base provenance mismatch');
    for(const [path,hash]of Object.entries(metadata.sourceHashes))if(path.startsWith('src/'))require(digest(hash)&&cohort.sourceHashes[path]===hash,'implementation source mismatch');
    require(metadata.segmentLength===150&&metadata.playerOffsetZ===702,'source units mismatch');
    require(integer(metadata.authoredCount,1,20000)&&metadata.totalCount===entry.baseRows.length&&metadata.totalCount-metadata.authoredCount===TAIL_ROWS,'source row bounds mismatch');
    require(integer(metadata.swapLine,0,metadata.totalCount-1)&&metadata.lastLine===metadata.totalCount-200,'source boundaries mismatch');
    const segments:Row[]=[];
    for(const index of entry.baseRows)segments.push(rowAt(index));
    const base=Object.freeze({$type:'SourceBiome',...metadata,segments:Object.freeze(segments)});
    bases.push(base);
    require(entry.profiles.length===2,'only two nonzero tails are stored');
    const variants:ReadonlySourceBiomeData[]=[];
    for(let p=0;p<2;p++){
      const profile=entry.profiles[p]!,gradient=p===0?-1:1;
      require(profile.gradient===gradient,'nonzero gradient membership/order mismatch');
      require(profile.tailRows.length===TAIL_ROWS,'tail row count mismatch');
      const selected=segments.slice();let previous=segments[metadata.authoredCount-1]!.y1;
      for(let n=0;n<TAIL_ROWS;n++){
        const row=rowAt(profile.tailRows[n]!),index=metadata.authoredCount+n,original=segments[index]!;
        require(row.y0===previous,'tail height continuity mismatch');
        require(row.curve===original.curve&&row.gap===original.gap&&row.mirror===original.mirror&&row.light===original.light,'unsupported changed tail geometry');
        selected[index]=row;previous=row.y1;
      }
      variants.push(Object.freeze({...base,forkGradient:gradient,segments:Object.freeze(selected)}));
    }
    records.push(Object.freeze([variants[0]!,base,variants[1]!]));
  }
  validateCatalog(bases,cohort,catalog);
  Object.freeze(records);
  return Object.freeze({catalog,get(mapId:SourceBiomeId,gradient:OriginalRouteGradient):ReadonlySourceBiomeData {
    require(integer(mapId,1,16)&&integer(gradient,-1,1),'invalid map/gradient');
    return records[mapId-1]![gradient+1]!;
  }});
}
