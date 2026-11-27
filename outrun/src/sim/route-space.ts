import {math} from '@gameengine/runtime';
import type {ReadonlySourceBiomeData} from '../schema.gen.ts';

export interface RouteZSample {
  readonly rawZ:number;
  readonly absoluteRow:number;
  readonly row:number;
  readonly lap:number;
  /** Exact integer source units within the row,0..149. */
  readonly offsetZ:number;
  /** Only this geometry-interpolation value rounds to f32, AFTER integer modulo/division. */
  readonly fraction:number;
  readonly canonicalZ:number;
}

/** Source int32 position aliases sample the whole biome, including its full tail.
 * Never fround raw/history before modulo: odd integers above2^24 must survive.
 * No proof lastLine/parking cap, position rewrite, asset lookup or RNG. */
export function sampleRouteZ(data:ReadonlySourceBiomeData,rawZ:number):RouteZSample {
  if(typeof rawZ!=='number'||!Number.isInteger(rawZ)||rawZ<0||rawZ>0x7fffffff)throw new Error('Route space requires nonnegative source int32 Z');
  const length=data.segmentLength,count=data.totalCount;
  if(length!==150||!Number.isInteger(count)||count<=0||count!==data.segments.length)throw new Error('Route space requires valid full source rows');
  const absoluteRow=Math.floor(rawZ/length),offsetZ=rawZ%length,row=absoluteRow%count,lap=Math.floor(absoluteRow/count);
  return {rawZ,absoluteRow,row,lap,offsetZ,fraction:math.fround(offsetZ/length),canonicalZ:row*length+offsetZ};
}
