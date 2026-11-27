import type {ReadonlySourceBiomeData} from '../schema.gen.ts';
import type {SourceBiomeId} from './biome.ts';
import {immutable,type RouteContent,type OriginalRouteGradient} from './route-profiles.ts';

const RELIEF_ROWS=600;
const TAIL_ROWS=RELIEF_ROWS*2;
function require(value:unknown,message:string):asserts value {if(!value)throw new Error('Continuous profiles: '+message);}

/** Compose at bootstrap only. Map.cpp's CONTINUOUS_MODE appends two flat,
 * unmirrored addBiome(200,200,200,0,0,...) reliefs, including for the goal.
 * SourceBiome's profile/provenance describes the shared authored source; only
 * its mode-dependent tail and boundaries change here. Lookup never builds data.
 */
export function createContinuousRouteSources(original:RouteContent):RouteContent {
  require(original.catalog.entries.length===16&&original.catalog.profile==='sourceCompatibility-original'&&
    original.catalog.forkGradient===0,'expected the complete original source catalog');
  const seen=new WeakSet<object>();immutable(original.catalog,seen);
  const records:ReadonlySourceBiomeData[]=[];
  for(let id=1;id<=16;id++){
    const base=original.get(id as SourceBiomeId,0);
    immutable(base,seen);
    require(base.id===id&&base.profile==='sourceCompatibility-original'&&base.forkGradient===0,'expected original gradient zero');
    require(Number.isInteger(base.authoredCount)&&base.authoredCount>0&&base.totalCount===base.segments.length&&
      base.totalCount-base.authoredCount===1960,'invalid original row bounds');
    require(base.objectOffsets.length===base.totalCount+1&&base.placements.every(prop=>prop.segment<base.authoredCount),
      'props must belong to authored geometry');
    const segments=base.segments.slice(0,base.authoredCount),totalCount=base.authoredCount+TAIL_ROWS;
    let gap=segments[segments.length-1]!.gap;
    const height=segments[segments.length-1]!.y1;
    // Biome.cpp increments distance by (int)distPerc before adding each row.
    // In this source cohort the final authored gaps are below600, so this
    // truncation deliberately retains them instead of snapping to zero.
    for(let relief=0;relief<2;relief++){
      const increment=Math.trunc(Math.fround(Math.fround(0-gap)/RELIEF_ROWS));
      for(let n=0;n<RELIEF_ROWS;n++){
        gap=Math.fround(gap+increment);
        segments.push(Object.freeze({y0:height,y1:height,curve:0,gap,mirror:false,light:Math.floor(segments.length/3)%2}));
      }
    }
    // forceSwap triggers after adding hold row100 of the first relief.
    const swapLine=base.swapLine>0&&base.swapLine<=base.authoredCount?base.swapLine:base.authoredCount+301;
    records.push(Object.freeze({...base,totalCount,swapLine,lastLine:totalCount-200,
      segments:Object.freeze(segments),objectOffsets:Object.freeze(base.objectOffsets.slice(0,totalCount+1))}));
  }
  Object.freeze(records);
  return Object.freeze({catalog:original.catalog,get(mapId:SourceBiomeId,gradient:OriginalRouteGradient):ReadonlySourceBiomeData {
    require(Number.isInteger(mapId)&&mapId>=1&&mapId<=16&&gradient===0,'invalid map or nonzero Continuous gradient');
    return records[mapId-1]!;
  }});
}
