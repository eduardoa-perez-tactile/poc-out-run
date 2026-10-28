import type { MeshArrays } from '@gameengine/runtime';
const positions = new Float32Array(12);
const normals = new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1]);
const tangents = new Float32Array([1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1]);
const uvs = new Float32Array([.75,1,1,1,1,0,.75,0]);
const colors = new Uint8Array(16).fill(255);
const indices = new Uint16Array([0,1,2,0,2,3]);
const arrays: MeshArrays = {positions,normals,tangents,uvs,colors,indices};
const empty: MeshArrays = {positions:new Float32Array(0),indices:new Uint16Array(0)};
export function buildBackdropBuffers(fixture: number, aspect: number): MeshArrays {
  const left=-aspect;const right=aspect;
  positions[0]=left;positions[1]=-.50;positions[2]=-.1;
  positions[3]=right;positions[4]=-.50;positions[5]=-.1;
  positions[6]=right;positions[7]=-.05;positions[8]=-.1;
  positions[9]=left;positions[10]=-.05;positions[11]=-.1;
  return fixture===3?arrays:empty;
}
