import { worldTest, expect } from '@gameengine/test';
import { FERRARI1 } from '../../src/content/vehicles/ferrari1.manifest.ts';
import { DRIVING_POSES, frameForPose, effectFrame, poseRange, VISUAL_POOL_CAPACITY } from '../../src/content/vehicles/vehicle-poses.ts';
import { PLAYER_COLLISION } from '../../src/sim/vehicle-config.ts';
import { RoadProofState,RoadFixtureRequested,VehiclePreview } from '../../src/schema.gen.ts';
const SCENE={scene:'scenes/vehicle-preview.scene.json'};
worldTest('vehicle.manifest preserves every source frame and explicit ground anchor',()=>{
  expect(FERRARI1.body.length).toBe(148);expect(FERRARI1.effects.length).toBe(28);
  for(const group of [FERRARI1.body,FERRARI1.effects]) {
    for(let i=0;i<group.length;i++) {
      const frame=group[i]!;
      expect(frame.sourceFrame).toBe(i+1);expect(frame.sha256.length).toBe(64);
      expect(frame.groundAnchorPx[0]).toBe(frame.sourceSizePx[0]/2);
      expect(frame.groundAnchorPx[1]).toBe(frame.sourceSizePx[1]);
    }
  }
  expect(FERRARI1.body[0]!.sourceSizePx).toEqual([94,44]);
  expect(FERRARI1.body[120]!.sourceSizePx).toEqual([171,46]);
},SCENE);
worldTest('vehicle.pose covers every driving entry and holds only the final four frames',()=>{
  expect(DRIVING_POSES.length).toBe(18);
  for(let pose=0;pose<18;pose++) {
    const r=poseRange(pose);
    expect(frameForPose(pose,0)).toBe(r.first);
    expect(frameForPose(pose,r.last-r.first)).toBe(r.last);
    for(let sample=8;sample<40;sample++) {
      const frame=frameForPose(pose,sample);
      expect(frame).toBeGreaterThanOrEqual(r.heldFirst);expect(frame).toBeLessThanOrEqual(r.last);
    }
  }
  expect(frameForPose(1,8)).toBe(9);expect(frameForPose(2,8)).toBe(17);
  expect(frameForPose(9,0)).toBe(61);expect(frameForPose(17,0)).toBe(113);
},SCENE);
worldTest('vehicle.crash preview holds the last spin reaction and arrival images',()=>{
  for(const [pose,first,last] of [[18,121,128],[19,129,133],[20,134,141],[21,142,146],[22,147,148]]) {
    expect(frameForPose(pose!,0)).toBe(first);
    expect(frameForPose(pose!,1000)).toBe(last);
  }
},SCENE);
worldTest('vehicle.effects reference only their own shared wheel families',()=>{
  expect(effectFrame(0,0)).toBe(null);
  for(const [effect,first,length] of [[1,1,4],[2,5,6],[3,11,6],[4,17,6],[5,23,6]]) {
    expect(effectFrame(effect!,0)).toBe(first);
    expect(effectFrame(effect!,length!)).toBe(first);
    expect(effectFrame(effect!,length!-1)).toBe(first!+length!-1);
  }
},SCENE);
worldTest('vehicle.collision configuration and road state ignore preview frame scale and placeholder',async({world,input,step})=>{
  input.emit(RoadFixtureRequested,{fixtureId:3,distance:33000,speed:7200,lateral:0,playing:false});
  await step(2);
  const before=world.resource(RoadProofState),collision={...PLAYER_COLLISION};
  for(const [pose,scale,placeholder] of [[0,1,false],[18,6,false],[21,3.2,true]] as const) {
    world.setResource(VehiclePreview,{pose,sample:100,scale,placeholder});
    await step(2);
    expect(world.resource(RoadProofState)).toEqual(before);
    expect(PLAYER_COLLISION).toEqual(collision);
  }
  expect(VISUAL_POOL_CAPACITY).toBe(3);
},SCENE);
