import {worldTest,expect} from '@gameengine/test';
import {loadMap01} from '../../src/content/biome.ts';
import {terrainParallaxOffset,terrainVehiclePose} from '../../src/render/terrain-presentation-math.ts';
import {buildVehicleBuffers,vehicleBufferStats} from '../../src/render/vehicle-buffers.ts';
import {FERRARI1} from '../../src/content/vehicles/ferrari1.manifest.ts';
import {effectFrame} from '../../src/content/vehicles/vehicle-poses.ts';

worldTest('terrain.view normal and braking poses use the existing grade and steering families',()=>{
  for(const [steering,grade,brake,expected] of [[0,0,false,0],[-1,0,false,1],[1,0,false,2],[0,1,false,3],[0,-1,false,6],[-1,1,true,13],[1,-1,true,17],[0,0,true,9]] as const){
    expect(terrainVehiclePose(steering,grade,brake)).toBe(expected);
  }
});
worldTest('terrain.view independent wheels route the intended atlas family without growing the pool',()=>{
  let buffers=buildVehicleBuffers(0,2,0,3.2,false,[2,0]);
  expect(vehicleBufferStats.visible).toBe(2);
  expect(buffers.indices!.slice(6,12).some(value=>value!==0)).toBe(true);
  expect(buffers.indices!.slice(12,18).every(value=>value===0)).toBe(true);
  buffers=buildVehicleBuffers(0,2,0,3.2,false,[0,3]);
  expect(vehicleBufferStats.visible).toBe(2);
  expect(buffers.indices!.slice(6,12).every(value=>value===0)).toBe(true);
  expect(buffers.indices!.slice(12,18).some(value=>value!==0)).toBe(true);
  buffers=buildVehicleBuffers(0,2,0,3.2,false,[2,3]);
  const sand=FERRARI1.effects[effectFrame(2,2)!-1]!,grass=FERRARI1.effects[effectFrame(3,2)!-1]!;
  expect(buffers.uvs![8]).toBeCloseTo(sand.atlasRectPx[0]/1024,7);
  expect(buffers.uvs![16]).toBeCloseTo(grass.atlasRectPx[0]/1024,7);
  expect(vehicleBufferStats.visible).toBe(3);
  expect(buffers.positions.length).toBe(36);expect(buffers.indices!.length).toBe(18);
});
worldTest('terrain.view hidden car degenerates every slot and restores the same buffer allocation',()=>{
  const buffers=buildVehicleBuffers(1,3,0,3.2,false,[2,1]);
  const expected=Array.from(buffers.indices!);const positions=buffers.positions;
  const hidden=buildVehicleBuffers(1,3,0,3.2,false,[2,1],true);
  expect(hidden.positions===positions).toBe(true);
  expect(hidden.indices!.every(value=>value===0)).toBe(true);
  expect(vehicleBufferStats.visible).toBe(0);expect(hidden.positions.length).toBe(36);
  const restored=buildVehicleBuffers(1,3,0,3.2,false,[2,1]);
  expect(restored.positions===positions).toBe(true);expect(Array.from(restored.indices!)).toEqual(expected);
  expect(vehicleBufferStats.visible).toBe(3);
});
worldTest('terrain.view old shared-effect calls keep exactly the same geometry as an equal wheel pair',()=>{
  const shared=buildVehicleBuffers(8,7,3,3.2);
  const positions=Array.from(shared.positions),uvs=Array.from(shared.uvs!),indices=Array.from(shared.indices!);
  const pair=buildVehicleBuffers(8,7,0,3.2,false,[3,3]);
  expect(Array.from(pair.positions)).toEqual(positions);expect(Array.from(pair.uvs!)).toEqual(uvs);expect(Array.from(pair.indices!)).toEqual(indices);
});
worldTest('terrain.view parallax integrates course position and excludes mirrored curve independently of sample history',()=>{
  const data=loadMap01();
  expect(terrainParallaxOffset(data,45000,0,1536)).toBe(1000);
  expect(terrainParallaxOffset(data,45000,1,2048)).toBe(1000);
  // Source Map1's player sample remains in a -3 curve over these two lines.
  const start=terrainParallaxOffset(data,300000,0,1536);
  terrainParallaxOffset(data,500000,0,1536);terrainParallaxOffset(data,90000,0,1536);
  const expected=((start-12)%1536+1536)%1536;
  expect(terrainParallaxOffset(data,300300,0,1536)).toBeCloseTo(expected,7);
  const mirror=data.segments.findIndex(row=>row.mirror);
  expect(mirror>0).toBe(true);
  const camera=mirror*data.segmentLength-data.playerOffsetZ+20;
  expect(terrainParallaxOffset(data,camera,1,2048)).toBe(terrainParallaxOffset(data,camera+50,1,2048));
  const direct=terrainParallaxOffset(data,310000,1,2048);
  for(let z=300000;z<310000;z+=37)terrainParallaxOffset(data,z,1,2048);
  expect(terrainParallaxOffset(data,310000,1,2048)).toBe(direct);
});
