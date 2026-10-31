import {worldTest,expect} from '@gameengine/test';
import {loadData} from '@gameengine/runtime';
import {SourceBiomeTailProfiles,type SourceBiomeTailProfilesData,type SourceBiomeCatalogData,type SourceBiomeData} from '../../src/schema.gen.ts';
import {loadSourceBiome,loadSourceBiomeCatalog,type SourceBiomeId} from '../../src/content/biome.ts';
import {createRuntimeProfileSourceAccessor,type OriginalRouteGradient} from '../../src/content/route-profiles.ts';

function inputs(){
  return {bases:Object.freeze(Array.from({length:16},(_,i)=>loadSourceBiome((i+1)as SourceBiomeId))),
    tails:loadData(SourceBiomeTailProfiles,'data/routes/original-tail-profiles.json'),catalog:loadSourceBiomeCatalog()};
}
function frozen<T>(value:T):T {
  if(value!==null&&typeof value==='object'){for(const item of Object.values(value))frozen(item);Object.freeze(value);}
  return value;
}

worldTest('routes.profiles all16 zero views retain exact original identity and nonzero views share authored data',()=>{
  const {bases,tails,catalog}=inputs(),cache=createRuntimeProfileSourceAccessor(bases,tails,catalog);
  expect(cache.catalog===catalog).toBe(true);expect(Object.isFrozen(cache)).toBe(true);
  const shared=['objects','definitions','placements','objectOffsets','palette','commands','sourceHashes','links','overwritten']as const;
  let tailRows=0;
  for(let i=0;i<16;i++){
    const id=(i+1)as SourceBiomeId,base=bases[i]!;
    expect(cache.get(id,0)===base).toBe(true);
    for(const gradient of [-1,1]as const){
      const view=cache.get(id,gradient);expect(cache.get(id,gradient)===view).toBe(true);
      expect(view!==base).toBe(true);expect(view.forkGradient).toBe(gradient);
      expect(view.segments.length).toBe(base.totalCount);expect(view.swapLine).toBe(base.swapLine);expect(view.lastLine).toBe(base.lastLine);
      for(const key of shared)expect(view[key]===base[key]).toBe(true);
      expect(view.segments.slice(0,base.authoredCount).every((row,n)=>row===base.segments[n])).toBe(true);
      expect(Object.isFrozen(view)&&Object.isFrozen(view.segments)).toBe(true);
      let previous=base.segments[base.authoredCount-1]!.y1;
      for(let row=base.authoredCount;row<base.totalCount;row++){
        const next=view.segments[row]!,old=base.segments[row]!;
        if(!Object.isFrozen(next)||next===old||next.y0!==previous||next.curve!==old.curve||next.gap!==old.gap||next.mirror!==old.mirror||next.light!==old.light)throw new Error('Tail sharing/continuity contract broken');
        previous=next.y1;tailRows++;
      }
    }
  }
  expect(tailRows).toBe(62720);
});

worldTest('routes.profiles literal source goal and ordinary tail samples preserve exact float bits and actual bounds',()=>{
  const {bases,tails,catalog}=inputs(),cache=createRuntimeProfileSourceAccessor(bases,tails,catalog);
  for(const [mapId,gradient,first,middle,last]of [
    [1,-1,17998.01171875,11998.01171875,5998.240234375],
    [1,1,17998.01171875,23998.01171875,29997.783203125],
    [3,-1,8999.4453125,2999.4453125,-3000.326171875],
    [16,-1,0,-6000,-11999.771484375],[16,1,0,6000,11999.771484375],
  ]as const){
    const view=cache.get(mapId,gradient),start=view.authoredCount;
    expect(view.segments[start]!.y1).toBe(first);expect(view.segments[start+180]!.y1).toBe(middle);expect(view.segments[view.totalCount-1]!.y1).toBe(last);
  }
  expect(cache.get(13,0).lastLine).toBe(5830);expect(cache.get(15,0).lastLine).toBe(6130);
  expect(cache.get(16,1).totalCount).toBe(3010);expect(cache.get(16,1).checkpointLine).toBe(-1);
});

worldTest('routes.profiles facade rejects invalid lookup enums without first-use IO construction or input mutation',()=>{
  const {bases,tails,catalog}=inputs(),before=tails.entries[0]!.profiles[0]!.y1Bits[0],cache=createRuntimeProfileSourceAccessor(bases,tails,catalog);
  for(const id of [0,17,1.5,NaN,Infinity,true])expect(()=>cache.get(id as SourceBiomeId,0)).toThrow();
  for(const gradient of [-2,2,.5,NaN,Infinity,true])expect(()=>cache.get(1,gradient as OriginalRouteGradient)).toThrow();
  const selected=cache.get(1,1),zero=cache.get(1,0);
  expect(()=>{(selected.segments as unknown as unknown[]).pop();}).toThrow();
  expect(Object.isFrozen(selected)).toBe(true);
  expect(Reflect.set(selected,'lastLine',0)).toBe(false);
  const tailRow=selected.segments[selected.authoredCount]!,height=tailRow.y1;
  expect(Object.isFrozen(tailRow)).toBe(true);expect(Reflect.set(tailRow,'y1',0)).toBe(false);
  expect(selected.lastLine).toBe(zero.lastLine);expect(tailRow.y1).toBe(height);
  expect(tails.entries[0]!.profiles[0]!.y1Bits[0]).toBe(before);expect(cache.get(1,0)===zero).toBe(true);expect(cache.get(1,1)===selected).toBe(true);
});

worldTest('routes.profiles malformed membership provenance boundaries and unsigned finite height data fail visibly',()=>{
  const {bases,tails,catalog}=inputs();
  const corruptions:((value:SourceBiomeTailProfilesData)=>void)[]=[
    value=>{value.entries.pop();},value=>{value.entries[0]!.mapId=2;},
    value=>{value.sourceCommit='0'.repeat(40);},value=>{value.entries[0]!.baseInputSha256='0'.repeat(64);},
    value=>{value.entries[0]!.baseAssetSha256='bad';},value=>{value.entries[0]!.authoredCount++;},
    value=>{value.entries[0]!.profiles[0]!.gradient=0;},value=>{value.entries[0]!.profiles[0]!.swapLine--;},
    value=>{value.entries[0]!.profiles[0]!.lastLine--;},value=>{value.entries[0]!.profiles[0]!.y1Bits.pop();},
    value=>{value.entries[0]!.profiles[0]!.y1Bits[0]=-1;},value=>{value.entries[0]!.profiles[0]!.y1Bits[0]=4294967296;},
    value=>{value.entries[0]!.profiles[0]!.y1Bits[0]=1.5;},value=>{value.entries[0]!.profiles[0]!.y1Bits[0]=0x7f800000;},
    value=>{value.entries[0]!.profiles[0]!.y1Bits[0]=0x7fc00000;},
  ];
  for(const corrupt of corruptions){const bad=JSON.parse(JSON.stringify(tails))as SourceBiomeTailProfilesData;corrupt(bad);expect(()=>createRuntimeProfileSourceAccessor(bases,frozen(bad),catalog)).toThrow();}
  // Sharing only accepts already immutable typed data; the factory must not freeze a caller's mutable records as a side effect.
  const mutable=JSON.parse(JSON.stringify(tails))as SourceBiomeTailProfilesData;
  expect(()=>createRuntimeProfileSourceAccessor(bases,mutable,catalog)).toThrow();expect(Object.isFrozen(mutable)).toBe(false);
});

worldTest('routes.profiles corrupted route catalog cannot suppress checkpoints or invent stages goals graph and source policy',()=>{
  const {bases,tails,catalog}=inputs();
  const corruptions:((value:SourceBiomeCatalogData)=>void)[]=[
    value=>{value.entries[1]!.hasCheckpoint=false;},value=>{value.entries[0]!.hasCheckpoint=true;},
    value=>{value.entries[15]!.hasCheckpoint=true;},value=>{value.entries[1]!.kind='goal';},
    value=>{value.entries[1]!.terminal=true;},value=>{value.entries[15]!.terminal=false;},
    value=>{value.entries[1]!.stage=3;},value=>{value.entries[2]!.position=0;},
    value=>{value.entries[1]!.dataKey='data/biomes/map03.json';},value=>{value.entries[1]!.checkpointLine=202;},
    value=>{value.entries[1]!.links.left=6;},value=>{value.entries[15]!.links.sequential=1;},
    value=>{value.goalPolicy.seed=1;},value=>{value.goalPolicy.terrain=2;},value=>{value.goalPolicy.roadTerrain=1;},
    value=>{Reflect.set(value.goalPolicy,'randomProfile','unknown');},value=>{Reflect.set(value.goalPolicy,'terrainProfile','unknown');},
    value=>{value.sourceCommit='0'.repeat(40);},value=>{value.forkGradient=1;},
    value=>{value.sourceHashes['src/Scene/Map/Map.cpp']='0'.repeat(64);},value=>{delete value.sourceHashes['src/Random/Random.cpp'];},
  ];
  for(const corrupt of corruptions){const bad=JSON.parse(JSON.stringify(catalog))as SourceBiomeCatalogData;corrupt(bad);expect(()=>createRuntimeProfileSourceAccessor(bases,tails,frozen(bad))).toThrow();}
  // Even mutually consistent base/node checkpoint corruption cannot manufacture
  // a Map1 checkpoint: start/goal exclusion is source policy, not >=0 inference.
  const badBase=JSON.parse(JSON.stringify(bases[0]))as SourceBiomeData,badCatalog=JSON.parse(JSON.stringify(catalog))as SourceBiomeCatalogData;
  badBase.checkpointLine=203;badCatalog.entries[0]!.checkpointLine=203;badCatalog.entries[0]!.hasCheckpoint=true;
  expect(()=>createRuntimeProfileSourceAccessor(Object.freeze([frozen(badBase),...bases.slice(1)]),tails,frozen(badCatalog))).toThrow();
  expect(catalog.entries[1]!.hasCheckpoint).toBe(true);expect(catalog.entries[0]!.hasCheckpoint).toBe(false);expect(catalog.entries[15]!.terminal).toBe(true);
});
