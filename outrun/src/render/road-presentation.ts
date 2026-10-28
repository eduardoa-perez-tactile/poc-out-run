import { defineSystem, read, write, meshes, ViewInfo, RenderTime } from '@gameengine/runtime';
import { RoadProofState, RoadProofVisualCache } from '../schema.gen.ts';
import { buildRoadBuffers } from './road-projection.ts';

const MESH_NAME = 'road-proof';
const TRACK_LENGTH = 180000;

export const RoadPresentation = defineSystem({
  name: 'RoadPresentation',
  stage: 'LateUpdate',
  resources: [read(RoadProofState), read(ViewInfo), read(RenderTime), write(RoadProofVisualCache)],
  run(ctx) {
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
    const mesh = meshes.info(MESH_NAME);
    if (mesh !== null && cache.fixtureId[0] === fixture && cache.distance[0] === distance && cache.lateral[0] === lateral && cache.aspect[0] === aspect) return;
    const data = buildRoadBuffers(fixture, distance, lateral, aspect);
    if (mesh === null) meshes.create(MESH_NAME, data);
    else meshes.update(MESH_NAME, data);
    ctx.setField(RoadProofVisualCache, 'fixtureId', fixture);
    ctx.setField(RoadProofVisualCache, 'distance', distance);
    ctx.setField(RoadProofVisualCache, 'lateral', lateral);
    ctx.setField(RoadProofVisualCache, 'aspect', aspect);
  },
});
