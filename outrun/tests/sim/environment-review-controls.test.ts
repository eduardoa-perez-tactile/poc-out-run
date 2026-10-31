import {worldTest,expect} from '@gameengine/test';
import {DrivingState,RoadProofState,RoadFixtureRequested,EnvironmentReview} from '../../src/schema.gen.ts';

worldTest('environment.reviewKeys recorded selectors change only immutable art review transport',async({input,world,step})=>{
  await step(1);const before=world.resource(DrivingState),road=world.resource(RoadProofState);
  for(const [key,mapId] of [['Digit2',2],['Digit3',3],['Digit4',4],['Digit0',10],['KeyG',16]] as const){
    input.key(key,true);await step(1);
    const state=world.resource(EnvironmentReview);
    expect(state.mapId).toBe(mapId);expect(state.mode).toBe(0);expect(state.batch).toBe(0);
    expect(state.cameraOriginZ).toBe(mapId===4?30450:45000);expect(state.trafficCount).toBe(mapId===4?32:0);
    expect(world.resource(DrivingState)).toEqual(before);
    expect(world.resource(RoadProofState)).toEqual(road);
    input.key(key,false);await step(1);
  }
  for(const [key,mode] of [['KeyC',1],['KeyV',2],['KeyR',0]] as const){
    input.key(key,true);await step(1);expect(world.resource(EnvironmentReview).mode).toBe(mode);
    expect(world.resource(EnvironmentReview).mapId).toBe(16);expect(world.resource(DrivingState)).toEqual(before);
    input.key(key,false);await step(1);
  }
},{scene:'scenes/destination-environment.scene.json'});

worldTest('environment.reviewIsolation idle steps and legacy fixture requests cannot run the old proof',async({input,world,step})=>{
  await step(1);const road=world.resource(RoadProofState),driver=world.resource(DrivingState);
  input.emit(RoadFixtureRequested,{fixtureId:3,distance:90000,speed:12000,lateral:1,playing:true});
  await step(5);expect(world.resource(RoadProofState)).toEqual(road);expect(world.resource(DrivingState)).toEqual(driver);
},{scene:'scenes/destination-environment.scene.json'});

worldTest('environment.reviewKeys held keys do not replay selection every render or following step',async({input,world,step})=>{
  input.key('Digit4',true);await step(1);expect(world.resource(EnvironmentReview).mapId).toBe(4);
  world.setResource(EnvironmentReview,{mapId:3});await step(2);expect(world.resource(EnvironmentReview).mapId).toBe(3);
  input.key('Digit4',false);await step(1);input.key('Digit4',true);await step(1);
  expect(world.resource(EnvironmentReview).mapId).toBe(4);
},{scene:'scenes/destination-environment.scene.json'});
