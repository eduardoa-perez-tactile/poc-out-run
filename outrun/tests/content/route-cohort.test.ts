import {worldTest,expect} from '@gameengine/test';
import {loadData} from '@gameengine/runtime';
import {SourceRouteCohort,SourceBiomeTailProfiles,type ReadonlySourceRouteCohortData,type ReadonlySourceBiomeCatalogData} from '../../src/schema.gen.ts';
import {loadSourceBiome,loadSourceBiomeCatalog,type SourceBiomeId} from '../../src/content/biome.ts';
import {createRuntimeProfileSourceAccessor,type OriginalRouteGradient} from '../../src/content/route-profiles.ts';
import {createRouteCohortSourceAccessor} from '../../src/content/route-cohort.ts';

type Cohort=ReadonlySourceRouteCohortData;
type Entry=Cohort['entries'][number];
function inputs(){return {cohort:loadData(SourceRouteCohort,'data/routes/original-route-cohort.json'),catalog:loadSourceBiomeCatalog()};}
function entryChange(cohort:Cohort,change:(entry:Entry)=>Entry,index=0):Cohort {
  const entries=cohort.entries.slice();entries[index]=change(entries[index]!);
  return Object.freeze({...cohort,entries:Object.freeze(entries)});
}
function indexChange(indices:readonly number[],index:number,value:number):readonly number[] {
  const copy=indices.slice();copy[index]=value;return Object.freeze(copy);
}
function tailChange(entry:Entry,change:(profile:Entry['profiles'][number])=>Entry['profiles'][number]):Entry {
  return Object.freeze({...entry,profiles:Object.freeze([change(entry.profiles[0]!),entry.profiles[1]!])});
}

worldTest('routes.cohort all48 profiles equal source views with final dictionary rows and shared immutable metadata',()=>{
  const {cohort,catalog}=inputs(),cache=createRouteCohortSourceAccessor(cohort,catalog);
  // The expanded legacy assets are loaded here solely as an independent test
  // reference. Production route boot reads the compact cohort instead.
  const bases=Object.freeze(Array.from({length:16},(_,i)=>loadSourceBiome((i+1)as SourceBiomeId)));
  const reference=createRuntimeProfileSourceAccessor(bases,loadData(SourceBiomeTailProfiles,'data/routes/original-tail-profiles.json'),catalog);
  const dictionary=new Set(cohort.rows),used=new Set<object>();let references=0;
  expect(cohort.rows.length).toBe(90136);expect(dictionary.size).toBe(90136);
  expect(cache.catalog===catalog&&Object.isFrozen(cache)).toBe(true);
  const shared=['objects','definitions','placements','objectOffsets','palette','commands','sourceHashes','links','overwritten']as const;
  for(let i=0;i<16;i++){
    const id=(i+1)as SourceBiomeId,zero=cache.get(id,0),entry=cohort.entries[i]!;
    // Every metadata field, including provenance and the data type marker, must
    // retain the expanded source value. Compare once per map, outside SIM.
    for(const key of Object.keys(bases[i]!)as (keyof typeof zero)[]){
      if(key!=='segments')expect(JSON.stringify(zero[key])).toBe(JSON.stringify(bases[i]![key]));
    }
    for(const gradient of [-1,0,1]as const){
      const view=cache.get(id,gradient),old=reference.get(id,gradient);
      expect(cache.get(id,gradient)===view).toBe(true);
      expect(Object.isFrozen(view)&&Object.isFrozen(view.segments)).toBe(true);
      expect(view.forkGradient).toBe(gradient);expect(view.segments.length).toBe(old.segments.length);
      for(const key of shared)expect(view[key]===entry.base[key]&&view[key]===zero[key]).toBe(true);
      for(let n=0;n<view.segments.length;n++){
        const row=view.segments[n]!,expected=old.segments[n]!;
        if(!dictionary.has(row)||!Object.isFrozen(row)||
          !Object.is(row.y0,expected.y0)||!Object.is(row.y1,expected.y1)||
          !Object.is(row.curve,expected.curve)||!Object.is(row.gap,expected.gap)||row.mirror!==expected.mirror||row.light!==expected.light){
          throw new Error(`Compact source row differs at map${id}/gradient${gradient}/row${n}`);
        }
        if(n<zero.authoredCount&&row!==zero.segments[n])throw new Error('Authored rows must be shared across gradients');
        used.add(row);references++;
      }
    }
  }
  expect(references).toBe(292164);expect(used.size).toBe(90136);
});

worldTest('routes.cohort facade is immutable stable lookup and rejects invalid enum values',()=>{
  const {cohort,catalog}=inputs(),cache=createRouteCohortSourceAccessor(cohort,catalog),selected=cache.get(16,1);
  for(const id of [0,17,1.5,NaN,Infinity,true])expect(()=>cache.get(id as SourceBiomeId,0)).toThrow();
  for(const gradient of [-2,2,.5,NaN,Infinity,true])expect(()=>cache.get(1,gradient as OriginalRouteGradient)).toThrow();
  expect(Reflect.set(selected,'lastLine',0)).toBe(false);
  expect(()=>{(selected.segments as unknown as unknown[]).pop();}).toThrow();
  const row=selected.segments[selected.authoredCount]!,height=row.y1;
  expect(Reflect.set(row,'y1',0)).toBe(false);expect(row.y1).toBe(height);
  expect(cache.get(16,1)===selected).toBe(true);
});

worldTest('routes.cohort malformed membership source identity metadata and profile ordering fail before use',()=>{
  const {cohort,catalog}=inputs();
  const corruptions:((value:Cohort)=>Cohort)[]=[
    value=>Object.freeze({...value,entries:Object.freeze(value.entries.slice(1))}),
    value=>Object.freeze({...value,sourceCommit:'0'.repeat(40)}),
    value=>Object.freeze({...value,sourceHashes:Object.freeze({...value.sourceHashes,'src/Random/Random.cpp':'bad'})}),
    value=>entryChange(value,entry=>Object.freeze({...entry,baseAssetSha256:'bad'})),
    value=>entryChange(value,entry=>Object.freeze({...entry,base:Object.freeze({...entry.base,id:2})})),
    value=>entryChange(value,entry=>Object.freeze({...entry,base:Object.freeze({...entry.base,inputSha256:'bad'})})),
    value=>entryChange(value,entry=>Object.freeze({...entry,base:Object.freeze({...entry.base,authoredCount:entry.base.authoredCount+1})})),
    value=>entryChange(value,entry=>Object.freeze({...entry,base:Object.freeze({...entry.base,segmentLength:151})})),
    value=>entryChange(value,entry=>Object.freeze({...entry,base:Object.freeze({...entry.base,swapLine:entry.base.totalCount})})),
    value=>entryChange(value,entry=>Object.freeze({...entry,base:Object.freeze({...entry.base,lastLine:entry.base.lastLine-1})})),
    value=>entryChange(value,entry=>Object.freeze({...entry,profiles:Object.freeze(entry.profiles.slice(1))})),
    value=>entryChange(value,entry=>tailChange(entry,profile=>Object.freeze({...profile,gradient:0}))),
    value=>entryChange(value,entry=>tailChange(entry,profile=>Object.freeze({...profile,tailRows:Object.freeze(profile.tailRows.slice(1))}))),
  ];
  for(const corrupt of corruptions)expect(()=>createRouteCohortSourceAccessor(corrupt(cohort),catalog)).toThrow();
  expect(cohort.entries[0]!.base.id).toBe(1);expect(cohort.entries[0]!.profiles[0]!.gradient).toBe(-1);
});

worldTest('routes.cohort dictionary references reject negative fractional missing and out of range indices',()=>{
  const {cohort,catalog}=inputs();
  for(const index of [-1,cohort.rows.length,.5,NaN,Infinity]){
    const badBase=entryChange(cohort,entry=>Object.freeze({...entry,baseRows:indexChange(entry.baseRows,0,index)}));
    const badTail=entryChange(cohort,entry=>tailChange(entry,profile=>Object.freeze({...profile,tailRows:indexChange(profile.tailRows,0,index)})));
    expect(()=>createRouteCohortSourceAccessor(badBase,catalog)).toThrow();
    expect(()=>createRouteCohortSourceAccessor(badTail,catalog)).toThrow();
  }
});

worldTest('routes.cohort dictionary source numbers and actual nonzero tail geometry fail closed on corruption',()=>{
  const {cohort,catalog}=inputs();
  // Clone only the changed dictionary slot and its reference array. The large
  // immutable metadata cohort remains shared and unmodified in these cases.
  const rowIndex=cohort.entries[0]!.profiles[0]!.tailRows[0]!,original=cohort.rows[rowIndex]!;
  const badRows=[
    {...original,y1:Infinity},{...original,y1:NaN},{...original,y1:.1},
    {...original,mirror:1},{...original,light:2},
  ];
  for(const bad of badRows){
    const rows=cohort.rows.slice();rows[rowIndex]=Object.freeze(bad)as typeof original;
    expect(()=>createRouteCohortSourceAccessor(Object.freeze({...cohort,rows:Object.freeze(rows)}),catalog)).toThrow();
  }
  // The valid dictionary deliberately shares the first tail row with the base.
  // Isolate each geometry defect to the selected nonzero tail: changing that
  // shared row globally would change both sides of the consistency comparison.
  for(const bad of [
    {...original,y0:original.y0+1},{...original,curve:original.curve+1},{...original,gap:original.gap+1},
  ]){
    const rows=Object.freeze([...cohort.rows,Object.freeze(bad)]),newIndex=rows.length-1;
    const changed=entryChange(Object.freeze({...cohort,rows}),entry=>tailChange(entry,profile=>Object.freeze({...profile,tailRows:indexChange(profile.tailRows,0,newIndex)})));
    expect(()=>createRouteCohortSourceAccessor(changed,catalog)).toThrow();
  }
  expect(cohort.rows[rowIndex]===original).toBe(true);
});

worldTest('routes.cohort rejects mutable owned descendants without freezing inputs and retains catalog policy checks',()=>{
  const {cohort,catalog}=inputs();
  const mutable={marker:true},invalid=Object.freeze({...cohort,validationMetadata:Object.freeze({mutable})});
  expect(()=>createRouteCohortSourceAccessor(invalid,catalog)).toThrow();expect(Object.isFrozen(mutable)).toBe(false);
  const badCatalogs:ReadonlySourceBiomeCatalogData[]=[
    Object.freeze({...catalog,goalPolicy:Object.freeze({...catalog.goalPolicy,seed:1})}),
    Object.freeze({...catalog,sourceCommit:'0'.repeat(40)}),
    Object.freeze({...catalog,entries:Object.freeze(catalog.entries.map((entry,i)=>i===0?Object.freeze({...entry,hasCheckpoint:true}):entry))}),
    Object.freeze({...catalog,entries:Object.freeze(catalog.entries.map((entry,i)=>i===1?Object.freeze({...entry,links:Object.freeze({...entry.links,left:6})}):entry))}),
  ];
  for(const bad of badCatalogs)expect(()=>createRouteCohortSourceAccessor(cohort,bad)).toThrow();
  expect(catalog.entries[0]!.hasCheckpoint).toBe(false);
});
