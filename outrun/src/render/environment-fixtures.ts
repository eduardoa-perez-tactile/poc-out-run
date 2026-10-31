import type {ReadonlySourceBiomeData} from '../schema.gen.ts';
import type {EnvironmentTrafficSnapshot} from './environment-buffers.ts';
import {VISIBLE_SEGMENTS} from './road-projection.ts';

type MutableSnapshot={slot:number;modelId:number;z:number;offset:number;side:number;motionTicks:number};
/** Controlled immutable-content ART review only, never a TrafficPool or race.
 * The returned array/objects are fixed scratch and are overwritten by sample().
 * No simulation, RNG, event, input or render-clock state is read or written. */
export function createEnvironmentTrafficFixture(){
  const pool:MutableSnapshot[]=Array.from({length:32},(_,slot)=>({slot,modelId:slot+1,z:0,offset:(slot%3-1)*.5,side:slot%2,motionTicks:slot%6}));
  const output:EnvironmentTrafficSnapshot[]=[];
  return {sample(data:ReadonlySourceBiomeData,cameraOriginZ:number,count:number):readonly EnvironmentTrafficSnapshot[]{
    if(!Number.isInteger(count)||count<0||count>32)throw new Error('Environment art traffic count must be integer0..32');
    if(!Number.isFinite(cameraOriginZ))throw new Error('Environment art traffic camera must be finite');
    if(!Number.isInteger(data.id)||data.id<2||data.id>16||data.segmentLength!==150||!Number.isInteger(data.totalCount)||data.totalCount<VISIBLE_SEGMENTS||data.segments.length!==data.totalCount)throw new Error('Environment art traffic requires valid destination source geometry');
    // Identical camera clamp to buildSourceRoad; no extra end-of-map wrapping.
    const camera=Math.max(0,Math.min((data.totalCount-VISIBLE_SEGMENTS)*data.segmentLength,cameraOriginZ));
    output.length=count;
    for(let slot=0;slot<count;slot++){
      const pose=pool[slot]!;
      pose.z=camera+(20+slot*3+.5)*data.segmentLength;
      output[slot]=pose;
    }
    return output;
  }};
}
