import {dataAsset,p} from '@gameengine/schema';

/** Immutable source graph; availability does not activate a route or load its art. */
export const SourceBiomeCatalog=dataAsset('SourceBiomeCatalog',{
  sourceCommit:p.str(),sourceHashes:p.record(p.str()),
  profile:p.literal('sourceCompatibility-original'),forkGradient:p.int(),
  goalPolicy:p.obj({
    randomProfile:p.literal('goal-offsets-sha256-u24-v1'),seed:p.int(),
    terrainProfile:p.literal('goal-terrain-defaults-v1'),terrain:p.int(),roadTerrain:p.int(),
  }),
  entries:p.arr(p.obj({
    id:p.int(),kind:p.oneOf(['ordinary','goal']),stage:p.int(),position:p.int(),
    dataKey:p.ref('SourceBiome'),terminal:p.bool(),hasCheckpoint:p.bool(),checkpointLine:p.int(),
    links:p.obj({left:p.int(),right:p.int(),sequential:p.int()}),
  })),
},{doc:'All fifteen ordinary source nodes and the genuine goal, ORIGINAL gradient0 realization. Goal randomness and uninitialized terrain are named deterministic port adaptations; other profiles and runtime handoff remain separate.'});
