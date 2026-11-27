import {dataAsset,p} from '@gameengine/schema';
const pair=p.arr(p.num());

/** Offline-interned exact source rows. Dictionary records are the final frozen runtime rows. */
export const SourceRouteCohort=dataAsset('SourceRouteCohort',{
  format:p.literal('sourceCompatibility-original-row-dictionary-v1'),
  sourceCommit:p.str(),sourceHashes:p.record(p.str()),
  rows:p.arr(p.obj({y0:p.num(),y1:p.num(),curve:p.num(),gap:p.num(),mirror:p.bool(),light:p.int()})),
  entries:p.arr(p.obj({
    base:p.obj({
      id:p.int(),sourceCommit:p.str(),inputSha256:p.str(),sourceHashes:p.record(p.str()),
      profile:p.literal('sourceCompatibility-original'),forkGradient:p.int(),segmentLength:p.int(),playerOffsetZ:p.int(),cameraHeight:p.int(),referenceWidth:p.int(),
      authoredCount:p.int(),totalCount:p.int(),swapLine:p.int(),lastLine:p.int(),checkpointLine:p.int(),timeSeconds:p.int(),terrain:p.int(),roadTerrain:p.int(),
      links:p.obj({left:p.int(),right:p.int(),sequential:p.int()}),palette:p.arr(p.arr(p.int())),
      commands:p.arr(p.obj({sourceLine:p.int(),command:p.str(),arguments:p.arr(p.num()),firstSegment:p.int(),count:p.int(),effective:p.arr(p.int())})),
      objects:p.arr(p.obj({id:p.int(),sourcePath:p.str(),sha256:p.str(),propertiesSha256:p.str(),hasProperties:p.bool(),sourceSizePx:pair,
        collision:p.bool(),scale:p.num(),collisionWidthSourcePx:p.num(),showTerrain:p.int(),pivotLeft:pair,pivotRight:pair,collisionPivotLeft:pair,collisionPivotRight:pair})),
      definitions:p.arr(p.obj({id:p.int(),kind:p.oneOf(['start','authored','goal']),sourceLine:p.int(),objectId:p.int(),offsetX:p.num(),offsetY:p.num(),side:p.bool(),viewportYFactor:p.num()})),
      placements:p.arr(p.obj({id:p.int(),segment:p.int(),slot:p.int(),definition:p.int()})),
      overwritten:p.arr(p.obj({segment:p.int(),slot:p.int(),previousDefinition:p.int(),definition:p.int()})),
      candidatePlacements:p.int(),maxWindowProps:p.int(),objectOffsets:p.arr(p.int()),
    }),
    baseAssetSha256:p.str(),baseRows:p.arr(p.int()),
    profiles:p.arr(p.obj({gradient:p.int(),tailRows:p.arr(p.int())})),
  })),
},{doc:'All16 ORIGINAL map metadata plus a bit-exact shared dictionary for48 source profiles. Compiled offline without changing legacy biome/catalog/tail assets; composed once before simulation.'});
