import {worldTest,expect} from '@gameengine/test';
import {forkCenter,forkSeparation,sourceGapEndpoint,FORK_MAX_SEPARATION} from '../../src/render/fork-fixture.ts';
import {buildForkBuffers,forkRoadStats} from '../../src/render/fork-projection.ts';
import {buildForkBackgrounds,backgroundHeight,backgroundPhase,forkBackgroundStats} from '../../src/render/fork-backgrounds.ts';

worldTest('road.fork shared approach and mirrored arms join continuously',async()=>{
  expect(forkSeparation(0)).toBe(0);expect(forkSeparation(36000)).toBe(0);
  expect(forkSeparation(60000)).toBe(FORK_MAX_SEPARATION);
  expect(forkSeparation(180000)).toBe(0);
  for(const distance of [36000,36000.01,42000,54000,59999.99,60000]) {
    expect(forkCenter(distance,0)).toBeCloseTo(-forkCenter(distance,1),6);
    expect(Math.abs(forkSeparation(distance+.01)-forkSeparation(distance))).toBeLessThan(.02);
  }
  const data=buildForkBuffers(0,0,16/9,0,0);
  // In the flat shared approach, adjacent asphalt trapezoids share both endpoints.
  for(let q=3;q<(forkRoadStats.visibleSegments-1)*9;q+=9){
    const p=q*12;const next=p+9*12;
    expect(data.positions[p+9]).toBe(data.positions[next]);
    expect(data.positions[p+10]).toBe(data.positions[next+1]);
    expect(data.positions[p+6]).toBe(data.positions[next+3]);
    expect(data.positions[p+7]).toBe(data.positions[next+4]);
  }
});
worldTest('road.fork preserves explicit source gap quantization compatibility',async()=>{
  expect(sourceGapEndpoint(0,1036,300)).toBe(900);
  expect(sourceGapEndpoint(1036,0,300)).toBe(136);
});
worldTest('road.fork near plane slopes and buffers stay bounded',async()=>{
  let first:Float32Array|undefined;let hidden=0;
  for(const distance of [0,149.999,33000,45000,54000,60000,179999.9,180000])for(const side of [0,1]) {
    const data=buildForkBuffers(distance,0,882/344,side,.5);
    if(first)expect(data.positions===first).toBe(true);else first=data.positions;
    expect(data.positions.every(Number.isFinite)).toBe(true);
    expect(data.positions.length).toBe(200*9*12);
    hidden+=forkRoadStats.hiddenSegments;
    for(let i=0;i<data.indices!.length;i+=3) {
      const a=data.indices![i]!*3;const b=data.indices![i+1]!*3;const c=data.indices![i+2]!*3;
      const area=(data.positions[b]!-data.positions[a]!)*(data.positions[c+1]!-data.positions[a+1]!)-(data.positions[b+1]!-data.positions[a+1]!)*(data.positions[c]!-data.positions[a]!);
      expect(area).toBeGreaterThanOrEqual(0);
    }
  }
  expect(hidden).toBeGreaterThan(0);
});
worldTest('road.fork background layers wrap and retain bounded current successor geometry',async()=>{
  for(let profile=0;profile<3;profile++)expect(backgroundHeight(profile,0)).toBe(backgroundHeight(profile,12));
  expect(backgroundPhase(0,0)).toBe(backgroundPhase(180000,0));
  expect(backgroundPhase(0,1)).toBe(backgroundPhase(180000,1));
  expect(backgroundPhase(33000,0)===backgroundPhase(33000,1)).toBe(false);
  let first:Float32Array|undefined;
  for(const side of [0,1])for(const p of [0,.01,.5,.99,1])for(const distance of [0,33000,179999.9]) {
    const data=buildForkBackgrounds(true,distance,16/9,side,p);
    if(first)expect(data.positions===first).toBe(true);else first=data.positions;
    expect(data.positions.every(Number.isFinite)).toBe(true);
    expect(forkBackgroundStats.quads).toBeLessThanOrEqual(64);
  }
});
