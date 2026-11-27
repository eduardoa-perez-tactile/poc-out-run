import {dataAsset,p} from '@gameengine/schema';

/** Compact, source-compiled ORIGINAL tails; authored geometry stays in SourceBiome. */
export const SourceBiomeTailProfiles=dataAsset('SourceBiomeTailProfiles',{
  format:p.literal('sourceCompatibility-original-tail-y1-f32bits-v1'),
  sourceCommit:p.str(),sourceHashes:p.record(p.str()),
  entries:p.arr(p.obj({
    mapId:p.int(),baseInputSha256:p.str(),baseAssetSha256:p.str(),
    authoredCount:p.int(),totalCount:p.int(),segmentLength:p.int(),
    profiles:p.arr(p.obj({
      gradient:p.int(),swapLine:p.int(),lastLine:p.int(),y1Bits:p.arr(p.int()),
    })),
  })),
},{doc:'Offline source-compiled minus/plus-one gradient tail heights as unsigned binary32 bit integers. Gradient zero retains the original SourceBiome record. Runtime composition validates all maps before route activation.'});
