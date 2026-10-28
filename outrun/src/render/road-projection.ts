// Pure projection into an XY mesh; no host calls or authoritative state.
import type { MeshArrays } from '@gameengine/runtime';

export const SEGMENT_LENGTH = 150;
export const ROAD_HALF_WIDTH = 1600; // source ROAD_WIDTH is used as a half-width
export const VISIBLE_SEGMENTS = 200;
export const CAMERA_HEIGHT = 800;
export const CAMERA_D = 0.5773502691896257;
export const HORIZON_Y = -260 / 720; // proposed fixed design offset, from source +130px
const QUADS_PER_SEGMENT = 5;
const QUADS = VISIBLE_SEGMENTS * QUADS_PER_SEGMENT;
const VERTICES = QUADS * 4;
const positions = new Float32Array(VERTICES * 3);
const normals = new Float32Array(VERTICES * 3);
const uvs = new Float32Array(VERTICES * 2);
const tangents = new Float32Array(VERTICES * 4);
const colors = new Uint8Array(VERTICES * 4);
const indices = new Uint16Array(QUADS * 6);
const arrays: MeshArrays = { positions, normals, uvs, tangents, colors, indices };

export interface Segment { readonly curve: number; }
const STRAIGHT: readonly Segment[] = Object.freeze(Array.from({ length: 1200 }, () => Object.freeze({ curve: 0 })));
const CURVES: readonly Segment[] = Object.freeze(Array.from({ length: 1200 }, (_, i) => {
  const sign = i < 600 ? 1 : -1;
  const local = i % 600;
  const curve = local < 200 ? 0 : local < 300 ? (local - 200) * 0.015 : local < 500 ? 1.5 : (600 - local) * 0.015;
  return Object.freeze({ curve: sign * curve });
}));
const linearByte = (v: number) => Math.round(255 * (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
const rgb = (r: number, g: number, b: number) => Object.freeze([linearByte(r), linearByte(g), linearByte(b)]);
const terrain = Object.freeze([rgb(230,214,197), rgb(239,222,206)]);
const road = Object.freeze([rgb(148,148,148), rgb(156,156,156)]);
const white = rgb(247,247,247);
const rumble = Object.freeze([rgb(148,148,148), white]);

// Streams are fixed-capacity scratch, fully overwritten on every call.
// No buffer or module variable carries authoritative gameplay state.
export function buildRoadBuffers(fixtureId: number, distance: number, lateral: number, aspect: number): MeshArrays {
  positions.fill(0); normals.fill(0); uvs.fill(0); tangents.fill(0); colors.fill(0); indices.fill(0);
  for (let v = 0; v < VERTICES; v++) {
    normals[v * 3 + 2] = 1;
    tangents[v * 4] = 1; tangents[v * 4 + 3] = 1;
  }
  const track = fixtureId === 0 ? STRAIGHT : CURVES;
  const direction = fixtureId === 2 ? -1 : 1;
  const rawBase = Math.floor(distance / SEGMENT_LENGTH);
  const fraction = distance / SEGMENT_LENGTH - rawBase;
  const base = ((rawBase % track.length) + track.length) % track.length;
  let dx = -track[base]!.curve * direction * fraction;
  let x = 0;
  let quad = 0;
  for (let n = 0; n < VISIBLE_SEGMENTS; n++) {
    const segment = track[(base + n) % track.length]!;
    const nearZ = (n - fraction) * SEGMENT_LENGTH;
    const farZ = nearZ + SEGMENT_LENGTH;
    const nearX = x - lateral * ROAD_HALF_WIDTH;
    const farX = x + dx - lateral * ROAD_HALF_WIDTH;
    x += dx; dx += segment.curve * direction;
    // Check BEFORE division. Source skips the crossing segment too.
    if (nearZ <= CAMERA_D) continue;
    const nearScale = CAMERA_D / nearZ;
    const farScale = CAMERA_D / farZ;
    const nearY = HORIZON_Y - CAMERA_HEIGHT * nearScale;
    const farY = HORIZON_Y - CAMERA_HEIGHT * farScale;
    const nearCenter = aspect * nearX * nearScale;
    const farCenter = aspect * farX * farScale;
    const nearWidth = aspect * ROAD_HALF_WIDTH * nearScale;
    const farWidth = aspect * ROAD_HALF_WIDTH * farScale;
    const shade = Math.floor((base + n) / 3) % 2;
    // +Z is closer to the authored camera. Distinct overlay depths avoid ties.
    quad = emit(quad, -aspect, aspect, nearY, -aspect, aspect, farY, 0, terrain[shade]!);
    quad = emit(quad, nearCenter - nearWidth * 1.08, nearCenter + nearWidth * 1.08, nearY,
      farCenter - farWidth * 1.08, farCenter + farWidth * 1.08, farY, 0.001, rumble[shade]!);
    quad = emit(quad, nearCenter - nearWidth, nearCenter + nearWidth, nearY,
      farCenter - farWidth, farCenter + farWidth, farY, 0.002, road[shade]!);
    const laneColor = shade === 0 ? road[shade]! : white;
    quad = emit(quad, nearCenter + nearWidth * (-1/3 - 0.015), nearCenter + nearWidth * (-1/3 + 0.015), nearY,
      farCenter + farWidth * (-1/3 - 0.015), farCenter + farWidth * (-1/3 + 0.015), farY, 0.003, laneColor);
    quad = emit(quad, nearCenter + nearWidth * (1/3 - 0.015), nearCenter + nearWidth * (1/3 + 0.015), nearY,
      farCenter + farWidth * (1/3 - 0.015), farCenter + farWidth * (1/3 + 0.015), farY, 0.003, laneColor);
  }
  return arrays;
}

function emit(q: number, left0: number, right0: number, y0: number, left1: number, right1: number, y1: number,
  z: number, color: readonly number[]): number {
  const v = q * 4;
  const p = v * 3;
  positions[p] = left0; positions[p+1] = y0; positions[p+2] = z;
  positions[p+3] = right0; positions[p+4] = y0; positions[p+5] = z;
  positions[p+6] = right1; positions[p+7] = y1; positions[p+8] = z;
  positions[p+9] = left1; positions[p+10] = y1; positions[p+11] = z;
  const k = q * 6;
  indices[k] = v; indices[k+1] = v+1; indices[k+2] = v+2;
  indices[k+3] = v; indices[k+4] = v+2; indices[k+5] = v+3;
  for (let i = 0; i < 4; i++) {
    const c = (v + i) * 4;
    colors[c] = color[0]!; colors[c+1] = color[1]!; colors[c+2] = color[2]!; colors[c+3] = 255;
  }
  return q + 1;
}
