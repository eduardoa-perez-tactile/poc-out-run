import { defineSystem, read, write, query, meshes, ViewInfo, RenderTime } from '@gameengine/runtime';
import { RoadProofState, RoadProofVisualCache, ForkPreviewState, ForkVisualCache, TerrainDriver } from '../schema.gen.ts';
import { buildRoadBuffers } from './road-projection.ts';
import { buildObjectBuffers } from './hill-objects.ts';
import { buildBackdropBuffers } from './hill-backdrop.ts';
import { buildForkBuffers } from './fork-projection.ts';
import { buildForkBackgrounds } from './fork-backgrounds.ts';
import { EMPTY_MESH } from './projection-buffers.ts';

const MESH_NAME = 'road-proof';
const TRACK_LENGTH = 180000;

export const RoadPresentation = defineSystem({
  name: 'RoadPresentation',
  stage: 'LateUpdate',
  query: query(read(TerrainDriver)),
  resources: [read(RoadProofState), read(ViewInfo), read(RenderTime), write(RoadProofVisualCache), read(ForkPreviewState), write(ForkVisualCache)],
  run(ctx,sourceDrivers) {
    // The source scene owns its road mesh; do not rebuild unused synthetic meshes.
    if(sourceDrivers.count!==0)return;
    // Native can present before its first fixed step. The host's initial viewport
    // is queued recorded input, so ViewInfo still holds schema defaults then.
    // Wait for that input instead of projecting a guessed or stale aspect ratio.
    if (ctx.step === 0) return;
    const state = ctx.resource(RoadProofState);
    const view = ctx.resource(ViewInfo);
    const cache = ctx.resource(RoadProofVisualCache);
    const alpha = state.playing[0] !== 0 ? Math.max(0, Math.min(1, ctx.resource(RenderTime).alpha[0]!)) : 1;
    let advance = state.distance[0]! - state.previousDistance[0]!;
    if (advance < 0) advance += TRACK_LENGTH;
    const distance = Math.fround((state.previousDistance[0]! + advance * alpha) % TRACK_LENGTH);
    const aspect = Math.fround(view.width[0]! / Math.max(1, view.height[0]!));
    const fixture = state.fixtureId[0]!;
    const lateral = state.lateral[0]!;
    const fork=ctx.resource(ForkPreviewState);const forkCache=ctx.resource(ForkVisualCache);
    const forkActive=fork.active[0]!==0;const side=forkActive?fork.side[0]!:0;
    const progress=forkActive?Math.fround(Math.max(0,Math.min(1,(fork.previousTick[0]!+(fork.tick[0]!-fork.previousTick[0]!)*alpha)/Math.max(1,fork.durationTicks[0]!)))):-1;
    const mesh = meshes.info(MESH_NAME);
    const objectMesh = meshes.info('hill-objects');
    const backdropMesh = meshes.info('hill-backdrop');
    const forkBackgroundMesh=meshes.info('fork-backgrounds');
    if (mesh !== null && objectMesh !== null && backdropMesh !== null && forkBackgroundMesh !== null && (forkCache.active[0]!==0)===forkActive && forkCache.side[0]===side && forkCache.progress[0]===progress && cache.fixtureId[0] === fixture && cache.distance[0] === distance && cache.lateral[0] === lateral && cache.aspect[0] === aspect) return;
    const data = forkActive?buildForkBuffers(distance,lateral,aspect,side,progress):buildRoadBuffers(fixture, distance, lateral, aspect);
    if (mesh === null) meshes.create(MESH_NAME, data);
    else meshes.update(MESH_NAME, data);
    if (objectMesh === null || fixture === 3 || cache.fixtureId[0] === 3) {
      const objects = buildObjectBuffers(fixture, distance);
      if (objectMesh === null) meshes.create('hill-objects', objects);
      else meshes.update('hill-objects', objects);
    }
    // Backdrop has no distance-dependent data. Flat fixtures upload no objects;
    // switching away from hills clears them once rather than once per frame.
    if (backdropMesh === null || (forkCache.active[0]!==0)!==forkActive || (fixture === 3) !== (cache.fixtureId[0] === 3) || cache.aspect[0] !== aspect) {
      const backdrop = forkActive?EMPTY_MESH:buildBackdropBuffers(fixture, aspect);
      if (backdropMesh === null) meshes.create('hill-backdrop', backdrop);
      else meshes.update('hill-backdrop', backdrop);
    }
    if(forkBackgroundMesh===null||forkActive||forkCache.active[0]!==0){
      const background=buildForkBackgrounds(forkActive,distance,aspect,side,progress);
      if(forkBackgroundMesh===null)meshes.create('fork-backgrounds',background);
      else meshes.update('fork-backgrounds',background);
    }
    ctx.set(ForkVisualCache,{active:forkActive,side,progress});
    ctx.setField(RoadProofVisualCache, 'fixtureId', fixture);
    ctx.setField(RoadProofVisualCache, 'distance', distance);
    ctx.setField(RoadProofVisualCache, 'lateral', lateral);
    ctx.setField(RoadProofVisualCache, 'aspect', aspect);
  },
});
