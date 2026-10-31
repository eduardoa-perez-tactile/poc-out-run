import type {ReadonlySourceBiomeData,ReadonlySourceBiomeCatalogData,ReadonlySourceBiomeTailProfilesData} from '../schema.gen.ts';
import type {SourceBiomeId} from './biome.ts';

export type OriginalRouteGradient=-1|0|1;
export interface RuntimeProfileSourceAccessor {
  readonly catalog:ReadonlySourceBiomeCatalogData;
  get(mapId:SourceBiomeId,gradient:OriginalRouteGradient):ReadonlySourceBiomeData;
}
export type RouteContent=RuntimeProfileSourceAccessor;
const PIN='6882721c99bc79365f815f68d389bf5078129e68';
const FORMAT='sourceCompatibility-original-tail-y1-f32bits-v1';
const TAIL_ROWS=1960;
function require(value:unknown,message:string):asserts value {if(!value)throw new Error('Route profiles: '+message);}
function integer(value:number,min:number,max:number):boolean {return Number.isInteger(value)&&value>=min&&value<=max;}
function digest(value:string):boolean {return typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);}
function immutable(value:unknown,seen:WeakSet<object>):void {
  if(value===null||typeof value!=='object'||seen.has(value))return;
  require(Object.isFrozen(value),'inputs must already be immutable');seen.add(value);
  // Match Object.values' own enumerable string properties without materializing
  // a temporary values array for every immutable row and placement at bootstrap.
  for(const key in value)if(Object.prototype.hasOwnProperty.call(value,key)){
    immutable((value as Record<string,unknown>)[key],seen);
  }
}

function sameHashes(actual:Readonly<Record<string,string>>,expected:Readonly<Record<string,string>>):boolean {
  const keys=Object.keys(expected);return Object.keys(actual).length===keys.length&&keys.every(key=>digest(actual[key]!)&&actual[key]===expected[key]);
}
/** Source catalog policy from build-catalog.py / Game.cpp45–210, never inferred
 * from a corrupt node (especially a Map1/goal checkpoint or false Map2 flag). */
function validateCatalog(bases:readonly ReadonlySourceBiomeData[],tails:ReadonlySourceBiomeTailProfilesData,catalog:ReadonlySourceBiomeCatalogData):void {
  require(sameHashes(catalog.sourceHashes,tails.sourceHashes)&&sameHashes(catalog.sourceHashes,bases[15]!.sourceHashes),'catalog source provenance mismatch');
  const policy=catalog.goalPolicy;
  require(Object.keys(policy).length===5&&policy.randomProfile==='goal-offsets-sha256-u24-v1'&&policy.seed===0&&
    policy.terrainProfile==='goal-terrain-defaults-v1'&&policy.terrain===1&&policy.roadTerrain===0,'goal policy mismatch');
  const goal=bases[15]!;
  require(goal.id===16&&goal.terrain===policy.terrain&&goal.roadTerrain===policy.roadTerrain&&goal.authoredCount===1050&&goal.totalCount===3010,'goal source metadata mismatch');
  let stage=1,start=1;
  for(let i=0;i<16;i++){
    const mapId=i+1,base=bases[i]!,node=catalog.entries[i]!,terminal=mapId===16;
    if(!terminal&&mapId>=start+stage){start+=stage;stage++;}
    const nodeStage=terminal?6:stage,position=terminal?0:mapId-start;
    const checkpoint=mapId===1||terminal?-1:[2,3,14,15].includes(mapId)?203:202;
    const key=terminal?'data/biomes/goal.json':`data/biomes/map${String(mapId).padStart(2,'0')}.json`;
    const left=terminal?-1:stage===5?16:start+stage+position,right=terminal?-1:stage===5?16:left+1,sequential=terminal?-1:mapId+1;
    require(node.id===mapId&&node.kind===(terminal?'goal':'ordinary')&&node.terminal===terminal,'catalog semantic identity mismatch');
    require(node.stage===nodeStage&&node.position===position&&node.dataKey===key,'catalog stage/position/data key mismatch');
    require(node.checkpointLine===checkpoint&&base.checkpointLine===checkpoint&&node.hasCheckpoint===(mapId!==1&&!terminal),'catalog checkpoint policy mismatch');
    require(node.links.left===left&&node.links.right===right&&node.links.sequential===sequential&&
      base.links.left===left&&base.links.right===right&&base.links.sequential===sequential,'catalog graph policy mismatch');
  }
}

/** Compose only at bootstrap. Authored rows and all metadata stay shared; get is
 * a pure lookup with no host calls, IO, first-use construction, clocks or RNG. */
export function createRuntimeProfileSourceAccessor(
  bases:readonly ReadonlySourceBiomeData[],tails:ReadonlySourceBiomeTailProfilesData,catalog:ReadonlySourceBiomeCatalogData,
):RuntimeProfileSourceAccessor {
  require(bases.length===16&&tails.entries.length===16&&catalog.entries.length===16,'exactly16 maps are required');
  require(tails.format===FORMAT&&tails.sourceCommit===PIN&&catalog.sourceCommit===PIN,'source/format mismatch');
  require(catalog.profile==='sourceCompatibility-original'&&catalog.forkGradient===0,'catalog must retain original gradient0');
  validateCatalog(bases,tails,catalog);
  const seen=new WeakSet<object>();immutable(bases,seen);immutable(tails,seen);immutable(catalog,seen);
  const words=new Uint32Array(1),floats=new Float32Array(words.buffer);
  for(const hash of Object.values(tails.sourceHashes))require(digest(hash),'invalid implementation digest');
  const records:(readonly ReadonlySourceBiomeData[])[]=[];
  for(let i=0;i<16;i++){
    const base=bases[i]!,entry=tails.entries[i]!,node=catalog.entries[i]!,mapId=i+1;
    require(base.id===mapId&&entry.mapId===mapId&&node.id===mapId,'map membership/order mismatch');
    require(base.sourceCommit===PIN&&base.profile==='sourceCompatibility-original'&&base.forkGradient===0,'base profile/source mismatch');
    // Exact serialized-byte SHA is checked by the offline builder/tests. Runtime
    // has decoded records: compare source input identity and validate SHA syntax.
    require(digest(entry.baseInputSha256)&&entry.baseInputSha256===base.inputSha256&&digest(entry.baseAssetSha256),'base provenance mismatch');
    for(const [path,hash]of Object.entries(base.sourceHashes))if(path.startsWith('src/'))require(tails.sourceHashes[path]===hash,'implementation source mismatch');
    require(base.segmentLength===150&&entry.segmentLength===150&&base.playerOffsetZ===702,'source units mismatch');
    require(integer(base.authoredCount,1,20000)&&base.totalCount===base.segments.length&&base.totalCount-base.authoredCount===TAIL_ROWS,'source row bounds mismatch');
    require(entry.authoredCount===base.authoredCount&&entry.totalCount===base.totalCount,'tail metadata mismatch');
    require(base.checkpointLine===node.checkpointLine&&base.links.left===node.links.left&&base.links.right===node.links.right&&base.links.sequential===node.links.sequential,'catalog metadata mismatch');
    require(entry.profiles.length===2,'only two nonzero tails are stored');
    const variants:ReadonlySourceBiomeData[]=[];
    for(let p=0;p<2;p++){
      const profile=entry.profiles[p]!,gradient=p===0?-1:1;
      require(profile.gradient===gradient,'nonzero gradient membership/order mismatch');
      require(integer(profile.swapLine,0,base.totalCount-1)&&profile.swapLine===base.swapLine,'source swap boundary changed');
      require(profile.lastLine===base.totalCount-200&&profile.lastLine===base.lastLine,'source last boundary changed');
      require(profile.y1Bits.length===TAIL_ROWS,'tail height count mismatch');
      const segments=base.segments.slice();let previous=base.segments[base.authoredCount-1]!.y1;
      for(let row=0;row<TAIL_ROWS;row++){
        const bits=profile.y1Bits[row]!;require(integer(bits,0,0xffffffff),'height bits must be unsigned32 integers');
        words[0]=bits;const y1=floats[0]!;require(Number.isFinite(y1),'height bits must decode to finite f32');
        const index=base.authoredCount+row,original=base.segments[index]!;
        require(Number.isFinite(previous),'nonfinite authored boundary');
        segments[index]=Object.freeze({...original,y0:previous,y1});previous=y1;
      }
      variants.push(Object.freeze({...base,forkGradient:gradient,swapLine:profile.swapLine,lastLine:profile.lastLine,segments:Object.freeze(segments)}));
    }
    records.push(Object.freeze([variants[0]!,base,variants[1]!]));
  }
  Object.freeze(records);
  return Object.freeze({catalog,get(mapId:SourceBiomeId,gradient:OriginalRouteGradient):ReadonlySourceBiomeData {
    require(integer(mapId,1,16)&&integer(gradient,-1,1),'invalid map/gradient');
    return records[mapId-1]![gradient+1]!;
  }});
}
