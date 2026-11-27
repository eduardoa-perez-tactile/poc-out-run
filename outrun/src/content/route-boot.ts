import {loadData} from '@gameengine/runtime';
import {SourceRouteCohort} from '../schema.gen.ts';
import {loadSourceBiomeCatalog} from './biome.ts';
import {createRouteCohortSourceAccessor} from './route-cohort.ts';
import {createContinuousRouteSources} from './continuous-profiles.ts';

// All synchronous content reads finish during module evaluation, before any
// fixed step, including direct replay startup. These reads acquire no group
// leases: mounted cooked data is available independently of art residency.
const cohort=loadData(SourceRouteCohort,'data/routes/original-route-cohort.json');
const sources=createRouteCohortSourceAccessor(cohort,loadSourceBiomeCatalog());

/** Immutable lookup only: no first-use IO, parsing, geometry generation or RNG. */
const continuous=createContinuousRouteSources(sources);
export function originalRouteSources(mode=0){
  if(mode!==0&&mode!==1)throw new Error("Unsupported route mode");
  return mode===1?continuous:sources;
}
