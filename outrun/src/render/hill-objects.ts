import type { MeshArrays } from '@gameengine/runtime';
import { HILL_OBJECTS, OBJECT_CAPACITY } from './hill-fixture.ts';
import { projected, SEGMENT_LENGTH, VISIBLE_SEGMENTS } from './road-projection.ts';
const positions = new Float32Array((OBJECT_CAPACITY + 1) * 12);
const normals = new Float32Array((OBJECT_CAPACITY + 1) * 12);
const tangents = new Float32Array((OBJECT_CAPACITY + 1) * 16);
const uvs = new Float32Array((OBJECT_CAPACITY + 1) * 8);
const colors = new Uint8Array((OBJECT_CAPACITY + 1) * 16);
const indices = new Uint16Array((OBJECT_CAPACITY + 1) * 6);
const arrays: MeshArrays = { positions, normals, tangents, uvs, colors, indices };
const empty: MeshArrays = { positions: new Float32Array(0), indices: new Uint16Array(0) };
export const objectFullHeights = new Float32Array(OBJECT_CAPACITY);
// Diagnostics follow immutable object IDs: 0 hidden, 1 full, 2 cropped, 3 outside view.
export const objectVisibility = new Uint8Array(OBJECT_CAPACITY);
export const objectProofStats = { visible: 0, partial: 0, hidden: 0, nearRejected: 0 };
// Clip bottom in Y-up coordinates while preserving the top and its texels.
export function visibleFraction(bottom: number, top: number, crest: number): number {
  return top <= bottom ? 0 : Math.max(0, Math.min(1, (top - Math.max(bottom, crest)) / (top - bottom)));
}
// Follows buildRoadBuffers for this sample. One atlas, fixed far→near order.
export function buildObjectBuffers(fixtureId: number, distance: number): MeshArrays {
  positions.fill(0); normals.fill(0); tangents.fill(0); uvs.fill(0); indices.fill(0); colors.fill(255);
  objectVisibility.fill(3); objectFullHeights.fill(0);
  objectProofStats.visible = 0; objectProofStats.partial = 0; objectProofStats.hidden = 0; objectProofStats.nearRejected = 0;
  for (let v = 0; v < (OBJECT_CAPACITY + 1) * 4; v++) {
    normals[v * 3 + 2] = 1; tangents[v * 4] = 1; tangents[v * 4 + 3] = 1;
  }
  if (fixtureId !== 3) return empty;
  let quad = 0;
  for (let i = HILL_OBJECTS.length - 1; i >= 0; --i) {
    const object = HILL_OBJECTS[i]!;
    const relative = object.distance - projected.base * SEGMENT_LENGTH;
    const n = Math.floor(relative / SEGMENT_LENGTH);
    if (n < 1 || n >= VISIBLE_SEGMENTS || object.distance <= distance || projected.scale[n] === 0) {
      objectProofStats.nearRejected++; continue;
    }
    const f = relative / SEGMENT_LENGTH - n;
    const scale = projected.scale[n]! + (projected.scale[n + 1]! - projected.scale[n]!) * f;
    const ground = projected.y[n]! + (projected.y[n + 1]! - projected.y[n]!) * f;
    const center = projected.center[n]! + (projected.center[n + 1]! - projected.center[n]!) * f + object.lateral * 1600 * projected.aspect * scale;
    const width = object.width * projected.aspect * scale;
    const height = object.height * scale;
    const top = ground + object.pivotY * height;
    const bottom = ground - (1 - object.pivotY) * height;
    const fraction = visibleFraction(bottom, top, projected.clip[n]!);
    if (fraction === 0) { objectVisibility[i] = 0; objectProofStats.hidden++; continue; }
    objectVisibility[i] = fraction < 1 ? 2 : 1;
    if (fraction < 1) objectProofStats.partial++;
    objectProofStats.visible++;
    objectFullHeights[quad] = height;
    const clippedBottom = top - height * fraction;
    const left = center - width * object.pivotX;
    const right = left + width;
    const p = quad * 12;
    const z = 0.02 + (VISIBLE_SEGMENTS - n) * 0.0001;
    // Scalar writes avoid per-quad temporary arrays on active frames.
    positions[p]=left; positions[p+1]=clippedBottom; positions[p+2]=z;
    positions[p+3]=right; positions[p+4]=clippedBottom; positions[p+5]=z;
    positions[p+6]=right; positions[p+7]=top; positions[p+8]=z;
    positions[p+9]=left; positions[p+10]=top; positions[p+11]=z;
    const u0=object.cell/4; const u1=(object.cell+1)/4; const u=quad*8;
    uvs[u]=u0;uvs[u+1]=fraction;uvs[u+2]=u1;uvs[u+3]=fraction;
    uvs[u+4]=u1;uvs[u+5]=0;uvs[u+6]=u0;uvs[u+7]=0;
    const v=quad*4; const k=quad*6;
    indices[k]=v;indices[k+1]=v+1;indices[k+2]=v+2;indices[k+3]=v;indices[k+4]=v+2;indices[k+5]=v+3;
    quad++;
  }
  // Fixed screen-space player diagnostic, above projected objects. This tests
  // the future player composition plane without adding car simulation.
  const p = OBJECT_CAPACITY * 12; const u = OBJECT_CAPACITY * 8; const k = OBJECT_CAPACITY * 6; const v = OBJECT_CAPACITY * 4;
  positions[p]=-.24;positions[p+1]=-.94;positions[p+2]=.1;
  positions[p+3]=.24;positions[p+4]=-.94;positions[p+5]=.1;
  positions[p+6]=.24;positions[p+7]=-.48;positions[p+8]=.1;
  positions[p+9]=-.24;positions[p+10]=-.48;positions[p+11]=.1;
  uvs[u]=.25;uvs[u+1]=1;uvs[u+2]=.5;uvs[u+3]=1;uvs[u+4]=.5;uvs[u+5]=0;uvs[u+6]=.25;uvs[u+7]=0;
  indices[k]=v;indices[k+1]=v+1;indices[k+2]=v+2;indices[k+3]=v;indices[k+4]=v+2;indices[k+5]=v+3;
  return arrays;
}
