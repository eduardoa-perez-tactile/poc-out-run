import {worldTest,expect} from '@gameengine/test';
import {crashVehicleSample} from '../../src/render/crash-presentation-math.ts';
import {frameForPose,WHEEL_ANCHORS_PX} from '../../src/content/vehicles/vehicle-poses.ts';
import {FERRARI1} from '../../src/content/vehicles/ferrari1.manifest.ts';
import {PLAYER_COLLIDER} from '../../src/sim/collision-metadata.ts';

worldTest('collision.presentation.mapping idle releases override including retained completion counters',()=>{
  expect(crashVehicleSample({phase:0,variant:0,advances:0,reactionTick:0})).toBe(null);
  expect(crashVehicleSample({phase:0,variant:1,advances:32,reactionTick:105})).toBe(null);
});
worldTest('collision.presentation.mapping every spin advance loops the exact eight source frames for both variants',()=>{
  for(const [variant,pose,sourceFrames] of [
    [0,18,[121,122,123,124,125,126,127,128]],
    [1,20,[134,135,136,137,138,139,140,141]],
  ] as const){
    for(let lap=0;lap<4;lap++)for(let frame=0;frame<8;frame++){
      const input=Object.freeze({phase:1,variant,advances:lap*8+frame,reactionTick:0}),before=JSON.stringify(input);
      const actual=crashVehicleSample(input)!;
      expect(actual).toEqual({pose,sample:frame,hidden:false});
      expect(frameForPose(actual.pose,actual.sample)).toBe(sourceFrames[frame]);
      expect(JSON.stringify(input)).toBe(before);
    }
  }
});
worldTest('collision.presentation.mapping all105 reaction ticks hold five literal source frames for three cycles',()=>{
  for(const [variant,pose,sourceFrames] of [[0,19,[129,130,131,132,133]],[1,21,[142,143,144,145,146]]] as const){
    let checked=0;
    for(let cycle=0;cycle<3;cycle++)for(let frame=0;frame<5;frame++)for(let held=0;held<7;held++){
      const actual=crashVehicleSample({phase:2,variant,advances:32,reactionTick:cycle*35+frame*7+held})!;
      expect(actual).toEqual({pose,sample:frame,hidden:false});
      expect(frameForPose(actual.pose,actual.sample)).toBe(sourceFrames[frame]);checked++;
    }
    expect(checked).toBe(105);
    // Zero-speed impacts have no spin advances but use the same reaction family.
    expect(crashVehicleSample({phase:2,variant,advances:0,reactionTick:0})).toEqual({pose,sample:0,hidden:false});
  }
});
worldTest('collision.presentation.mapping recenter hides at deterministic last reaction sample without advancing caller state',()=>{
  for(const [variant,pose,sourceFrame] of [[0,19,133],[1,21,146]] as const){
    const input=Object.freeze({phase:3,variant,advances:8,reactionTick:105}),before=JSON.stringify(input);
    const first=crashVehicleSample(input)!;
    expect(first).toEqual({pose,sample:4,hidden:true});expect(frameForPose(first.pose,first.sample)).toBe(sourceFrame);
    first.sample=0;
    expect(crashVehicleSample(input)).toEqual({pose,sample:4,hidden:true});expect(JSON.stringify(input)).toBe(before);
  }
});
worldTest('collision.presentation.mapping crash source canvases retain full width and ground anchors independent of the physical hull',()=>{
  const hullBefore=JSON.stringify(PLAYER_COLLIDER);
  for(const sourceFrame of [121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146]){
    const frame=FERRARI1.body[sourceFrame-1]!;
    expect(frame.sourceFrame).toBe(sourceFrame);expect(frame.sourceSizePx).toEqual([171,46]);
    expect(frame.groundAnchorPx).toEqual([85.5,46]);expect(frame.trimPx).toEqual([0,0,171,46]);
    expect(frame.atlasRectPx[2]).toBe(171);expect(frame.atlasRectPx[3]).toBe(46);
  }
  expect(WHEEL_ANCHORS_PX).toEqual([[-32,-3],[32,-3]]);
  expect(PLAYER_COLLIDER).toEqual({halfWidth:234.06068420410156,halfLength:75});expect(JSON.stringify(PLAYER_COLLIDER)).toBe(hullBefore);
  expect(FERRARI1.sourceCommit).toBe('6882721c99bc79365f815f68d389bf5078129e68');
});
worldTest('collision.presentation.mapping rejects malformed phase variant and impossible live counter states',()=>{
  const valid={phase:1,variant:0,advances:0,reactionTick:0};
  for(const input of [
    {...valid,phase:-1},{...valid,phase:4},{...valid,phase:.5},
    {...valid,variant:2},{...valid,variant:-1},{...valid,variant:.5},
    {...valid,advances:-1},{...valid,advances:32},{...valid,advances:33},{...valid,advances:NaN},{...valid,advances:.5},
    {...valid,reactionTick:1},{...valid,reactionTick:Infinity},{...valid,reactionTick:-1},
    {...valid,phase:2,reactionTick:105},{...valid,phase:2,reactionTick:106},{...valid,phase:2,reactionTick:.5},
    {...valid,phase:3,reactionTick:104},
  ]){
    let failed=false;try{crashVehicleSample(input);}catch{failed=true;}expect(failed).toBe(true);
  }
});
