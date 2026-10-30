import { dataAsset,p,resource,component,bool,f32,u32 } from '@gameengine/schema';
const pair=p.arr(p.num());
export const SourceBiome=dataAsset('SourceBiome',{
  id:p.int(),sourceCommit:p.str(),inputSha256:p.str(),sourceHashes:p.record(p.str()),
  profile:p.literal('sourceCompatibility-original'),forkGradient:p.int(),segmentLength:p.int(),playerOffsetZ:p.int(),cameraHeight:p.int(),referenceWidth:p.int(),
  authoredCount:p.int(),totalCount:p.int(),swapLine:p.int(),lastLine:p.int(),checkpointLine:p.int(),timeSeconds:p.int(),terrain:p.int(),roadTerrain:p.int(),
  links:p.obj({left:p.int(),right:p.int(),sequential:p.int()}),palette:p.arr(p.arr(p.int())),
  commands:p.arr(p.obj({sourceLine:p.int(),command:p.str(),arguments:p.arr(p.num()),firstSegment:p.int(),count:p.int(),effective:p.arr(p.int())})),
  objects:p.arr(p.obj({id:p.int(),sourcePath:p.str(),sha256:p.str(),propertiesSha256:p.str(),hasProperties:p.bool(),sourceSizePx:pair,
    collision:p.bool(),scale:p.num(),collisionWidthSourcePx:p.num(),showTerrain:p.int(),pivotLeft:pair,pivotRight:pair,collisionPivotLeft:pair,collisionPivotRight:pair})),
  definitions:p.arr(p.obj({id:p.int(),kind:p.oneOf(['start','authored']),sourceLine:p.int(),objectId:p.int(),offsetX:p.num(),offsetY:p.num(),side:p.bool(),viewportYFactor:p.num()})),
  placements:p.arr(p.obj({id:p.int(),segment:p.int(),slot:p.int(),definition:p.int()})),
  overwritten:p.arr(p.obj({segment:p.int(),slot:p.int(),previousDefinition:p.int(),definition:p.int()})),
  candidatePlacements:p.int(),maxWindowProps:p.int(),objectOffsets:p.arr(p.int()),
  segments:p.arr(p.obj({y0:p.num(),y1:p.num(),curve:p.num(),gap:p.num(),mirror:p.bool(),light:p.int()})),
},{doc:'Immutable source-compatible Map1 geometry/provenance. Source PNG paths are provenance, not runtime art references (child40).'});
// Static data review controls only. Driving still uses its existing synthetic loop.
export const Map01Preview=resource('Map01Preview',{
  enabled:bool(),cameraOriginZ:f32({default:45000}),lateral:f32(),
},{sim:false});
export const Map01VisualCache=resource('Map01VisualCache',{
  cameraOriginZ:f32({default:-1}),lateral:f32(),aspect:f32({default:-1}),
},{sim:false});
// Scene ownership disappears on EnterScene even though resources persist.
export const Map01VisualSlot=component('Map01VisualSlot',{
  slot:u32(),
},{sim:false});
