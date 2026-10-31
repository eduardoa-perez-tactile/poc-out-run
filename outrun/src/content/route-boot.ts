import {loadData} from '@gameengine/runtime';
import {SourceBiomeTailProfiles} from '../schema.gen.ts';
import {loadSourceBiome,loadSourceBiomeCatalog,type SourceBiomeId} from './biome.ts';
import {createRuntimeProfileSourceAccessor} from './route-profiles.ts';

// All synchronous content reads finish during module evaluation, before any
// fixed step, including direct replay startup. These reads acquire no group
// leases: mounted cooked data is available independently of art residency.
const bases=Object.freeze(Array.from({length:16},(_,index)=>loadSourceBiome((index+1) as SourceBiomeId)));
const tails=loadData(SourceBiomeTailProfiles,'data/routes/original-tail-profiles.json');
const sources=createRuntimeProfileSourceAccessor(bases,tails,loadSourceBiomeCatalog());

/** Immutable lookup only: no first-use IO, parsing, geometry generation or RNG. */
export function originalRouteSources(){return sources;}
