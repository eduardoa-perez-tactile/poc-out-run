import {worldTest,expect} from '@gameengine/test';
import {EnterScene,math} from '@gameengine/runtime';
import {DrivingState,DrivingInput,DrivingResetRequested,RoadProofState,TerrainDriver} from '../../src/schema.gen.ts';
import {loadMap01} from '../../src/content/biome.ts';

worldTest('terrain.lifecycle recorded mode changes clear holds remove the owner and restore each reset domain',async({world,input,step})=>{
  input.key('ArrowUp',true);input.key('ArrowLeft',true);await step(2);
  expect(world.resource(DrivingInput).keyboard).toBe(5);
  expect(world.count(TerrainDriver)).toBe(1);
  input.emit(EnterScene,{scene:'scenes/vehicle-preview.scene.json',release:''});await step(2);
  expect(world.count(TerrainDriver)).toBe(0);expect(world.resource(DrivingState).active).toBe(false);
  expect(world.resource(DrivingInput)).toEqual({keyboard:0,ui:0,shiftUp:false,shiftDown:false,upHeld:false,downHeld:false,pauseHeld:false,modeHeld:false});
  expect(world.resource(RoadProofState)).toEqual({fixtureId:3,distance:33000,previousDistance:33000,lateral:0,speed:7200,playing:false,spaceHeld:false});
  input.emit(EnterScene,{scene:'scenes/driving-proof.scene.json',release:''});await step(1);
  expect(world.count(TerrainDriver)).toBe(0);expect(world.resource(DrivingState).active).toBe(true);
  input.emit(DrivingResetRequested,{manual:false,legacySpeed:0,distance:642600,lateral:7});await step(1);
  expect(world.resource(DrivingState).distance).toBe(102600);expect(world.resource(DrivingState).lateral).toBe(1.5);
  input.emit(EnterScene,{scene:'scenes/driving-terrain.scene.json',release:''});await step(2);
  const data=loadMap01(),distance=642600;
  const segment=Math.floor((distance+data.playerOffsetZ)/data.segmentLength),center=math.fround(data.segments[segment]!.gap/1600);
  input.emit(DrivingResetRequested,{manual:false,legacySpeed:0,distance,lateral:center});await step(1);
  const driver=world.get(world.entities(TerrainDriver)[0]!,TerrainDriver);
  expect(world.resource(DrivingState).distance).toBe(distance);expect(math.fround(world.resource(DrivingState).lateral)).toBe(center);
  expect(driver.segment).toBe(segment);expect(driver.roadSide).toBe(1);
  expect(driver.leftOutside).toBe(false);expect(driver.rightOutside).toBe(false);expect(driver.recentering).toBe(false);
  // Same-step mode requests still honor the engine's final destination.
  input.emit(EnterScene,{scene:'scenes/driving-terrain.scene.json',release:''});
  input.emit(EnterScene,{scene:'scenes/driving-proof.scene.json',release:''});await step(2);
  expect(world.count(TerrainDriver)).toBe(0);expect(world.resource(DrivingState).active).toBe(true);
  expect(world.resource(DrivingState).distance).toBe(45000);expect(world.resource(DrivingInput).keyboard).toBe(0);
},{scene:'scenes/driving-terrain.scene.json'});
