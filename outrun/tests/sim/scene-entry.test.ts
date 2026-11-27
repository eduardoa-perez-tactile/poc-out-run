import {worldTest,expect} from '@gameengine/test';
import {EnterScene} from '@gameengine/runtime';
import {DrivingState,DrivingInput,RoadProofState,Map01Preview} from '../../src/schema.gen.ts';

const drivingStart={active:true,playing:true,manual:false,legacySpeed:0,gear:0,steering:0,
  distance:45000,previousDistance:45000,lateral:0,previousLateral:0};
const roadStart={fixtureId:1,distance:45000,previousDistance:45000,lateral:0,speed:0,playing:true,spaceHeld:false};
const emptyInput={keyboard:0,ui:0,shiftUp:false,shiftDown:false,upHeld:false,downHeld:false,pauseHeld:false,modeHeld:false};

worldTest('scene.entry driving Map1 driving resets match from nondefault proof state',async({world,input,step})=>{
  world.setResource(DrivingState,{active:false,playing:false,manual:true,legacySpeed:140,gear:1,steering:-1,
    distance:23456,previousDistance:22222,lateral:.75,previousLateral:.5});
  world.setResource(RoadProofState,{fixtureId:3,distance:1337,previousDistance:1000,lateral:.5,speed:9000,playing:false,spaceHeld:true});
  input.emit(EnterScene,{scene:'scenes/driving-proof.scene.json',release:''});await step(1);
  expect(world.resource(DrivingState)).toEqual(drivingStart);
  expect(world.resource(RoadProofState)).toEqual(roadStart);

  world.setResource(DrivingState,{playing:false,manual:true,legacySpeed:123,gear:1,steering:-.5,
    distance:55555,previousDistance:54444,lateral:-.5,previousLateral:-.25});
  const parkedDriving={...world.resource(DrivingState),active:false};
  world.setResource(DrivingInput,{keyboard:5,ui:10,shiftUp:true,shiftDown:true,upHeld:true,downHeld:true,pauseHeld:true,modeHeld:true});
  world.setResource(RoadProofState,{fixtureId:3,distance:43210,previousDistance:42000,lateral:-1,speed:9600,playing:true,spaceHeld:true});
  world.setResource(Map01Preview,{enabled:false,cameraOriginZ:1234,lateral:1.25});
  input.emit(EnterScene,{scene:'scenes/map01-data.scene.json',release:''});await step(1);
  // The inactive car snapshot is preserved; Map1 owns a paused road proof.
  expect(world.resource(DrivingState)).toEqual(parkedDriving);
  expect(world.resource(DrivingInput)).toEqual(emptyInput);
  expect(world.resource(RoadProofState)).toEqual({...roadStart,speed:7200,playing:false});
  expect(world.resource(Map01Preview)).toEqual({enabled:true,cameraOriginZ:45000,lateral:0});

  // The immediately following destination wins over any preceding entry input.
  input.emit(EnterScene,{scene:'scenes/driving-proof.scene.json',release:''});await step(1);
  expect(world.resource(DrivingState)).toEqual(drivingStart);
  expect(world.resource(DrivingInput)).toEqual(emptyInput);
  expect(world.resource(RoadProofState)).toEqual(roadStart);
  input.key('ArrowUp',true);await step(3);input.key('ArrowUp',false);await step(1);
  expect(world.resource(DrivingState).active).toBe(true);
  expect(world.resource(DrivingState).legacySpeed).toBeGreaterThan(0);
},{scene:'scenes/road-proof.scene.json'});
