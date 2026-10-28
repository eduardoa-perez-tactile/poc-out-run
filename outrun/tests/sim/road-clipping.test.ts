import { worldTest, expect } from '@gameengine/test';
import { RoadProofState } from '../../src/schema.gen.ts';
import { hillHeight, OBJECT_CAPACITY } from '../../src/render/hill-fixture.ts';
import { buildRoadBuffers, projected } from '../../src/render/road-projection.ts';
import { buildObjectBuffers, visibleFraction, objectProofStats, objectFullHeights, objectVisibility } from '../../src/render/hill-objects.ts';

worldTest('road.clipping crop preserves top texels and hides fully occluded objects', async () => {
  expect(visibleFraction(0, 2, -1)).toBe(1);
  expect(visibleFraction(0, 2, 1)).toBe(0.5);
  expect(visibleFraction(0, 2, 2)).toBe(0);
  expect(visibleFraction(0, 2, 3)).toBe(0);
  expect(visibleFraction(1, 1, 1)).toBe(0);
});
worldTest('road.clipping hills join at loop and camera samples remain finite', async () => {
  expect(hillHeight(0)).toBe(0);
  expect(hillHeight(180000)).toBe(0);
  expect(hillHeight(30000)).toBe(0);
  expect(hillHeight(48000)).toBe(4200);
  expect(hillHeight(66000)).toBe(0);
  expect(hillHeight(126000)).toBe(-3000);
  expect(hillHeight(144000)).toBe(0);
  for (const distance of [0,149.999,30000,36000,42000,48000,54000,60000,114000,126000,138000,179999.99]) {
    const road=buildRoadBuffers(3,distance,0,16/9);
    const objects=buildObjectBuffers(3,distance);
    expect(road.positions.every(Number.isFinite)).toBe(true);
    expect(objects.positions.every(Number.isFinite)).toBe(true);
    expect(objects.positions.length).toBe((OBJECT_CAPACITY+1)*12);
    let last=-1;
    for (const clip of projected.clip) { expect(clip).toBeGreaterThanOrEqual(last);last=clip; }
  }
});
worldTest('road.clipping mesh UV cropping and painter depths remain bounded across motion', async () => {
  let partial=0;let hidden=0;let reappeared=false;
  const wasHidden = new Uint8Array(OBJECT_CAPACITY);
  let first: Float32Array | undefined;
  for(let distance=30000;distance<=60000;distance+=600) {
    buildRoadBuffers(3,distance,0,16/9);
    const data=buildObjectBuffers(3,distance);
    if(first) expect(first===data.positions).toBe(true);else first=data.positions;
    partial+=objectProofStats.partial; hidden+=objectProofStats.hidden;
    for(let id=0;id<OBJECT_CAPACITY;id++) {
      if(objectVisibility[id]===0) wasHidden[id]=1;
      if(wasHidden[id] && (objectVisibility[id]===1 || objectVisibility[id]===2)) reappeared=true;
    }
    let depth=0;
    for(let q=0;q<objectProofStats.visible;q++) {
      const p=q*12;const u=q*8;
      expect(data.positions[p+2]!).toBeGreaterThanOrEqual(depth);depth=data.positions[p+2]!;
      expect(data.positions[p+7]!).toBeGreaterThan(data.positions[p+1]!);
      expect(data.uvs![u+5]).toBe(0);
      expect((data.positions[p+7]! - data.positions[p+1]!) / objectFullHeights[q]!).toBeCloseTo(data.uvs![u+1]!, 5);
      expect(data.uvs![u+1]!).toBeGreaterThan(0);
      expect(data.uvs![u+1]!).toBeLessThanOrEqual(1);
    }
  }
  expect(partial).toBeGreaterThan(0);expect(hidden).toBeGreaterThan(0);expect(reappeared).toBe(true);
});

worldTest('road.clipping dense preview advances across the crest', async({world,step})=>{
  expect(world.resource(RoadProofState).fixtureId).toBe(3);
  expect(world.resource(RoadProofState).playing).toBe(true);
  await step(180);
  expect(world.resource(RoadProofState).distance).toBeCloseTo(54600,1);
},{scene:'scenes/hill-proof.scene.json'});
