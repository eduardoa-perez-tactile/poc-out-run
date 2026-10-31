import {worldTest,expect} from '@gameengine/test';
import {EnterScene} from '@gameengine/runtime';
import {DrivingState,DrivingInput,DrivingControlChanged,RouteDriver,RouteTrafficCoordinates,TrafficArtPreview} from '../../src/schema.gen.ts';

const scene='scenes/original-route-sim.scene.json';
worldTest('routes.entry dirty manual and held UI controls reset on real same-scene entry without reset input',async({world,step,input})=>{
  await step(1);
  input.key('KeyM',true);input.key('KeyE',true);input.key('ArrowUp',true);input.key('ArrowLeft',true);
  input.emit(DrivingControlChanged,{control:3,source:1,down:true});await step(1);
  expect(world.resource(DrivingState).manual).toBe(true);expect(world.resource(DrivingInput).keyboard).toBe(5);
  expect(world.resource(DrivingInput).ui).toBe(8);
  input.emit(EnterScene,{scene,release:''});await step(2);
  expect(world.resource(DrivingState)).toEqual({active:true,playing:true,manual:false,legacySpeed:0,gear:0,steering:0,
    distance:45000,previousDistance:45000,lateral:0,previousLateral:0});
  expect(world.resource(DrivingInput)).toEqual({keyboard:0,ui:0,shiftUp:false,shiftDown:false,upHeld:false,downHeld:false,pauseHeld:false,modeHeld:false});
  const owner=world.entities(RouteDriver)[0]!;
  expect(world.get(owner,RouteDriver).routeEpoch).toBe(1);expect(world.get(owner,RouteDriver).rangeCalls).toBe(1);
  expect(world.get(owner,RouteTrafficCoordinates).routeEpoch).toBe(1);
},{scene});
worldTest('routes.entry catalog mode cannot leak into new route or last winning same-frame entry',async({world,step,input})=>{
  await step(1);input.emit(EnterScene,{scene:'scenes/traffic-catalog.scene.json',release:''});await step(2);
  expect(world.resource(TrafficArtPreview).mode).toBe(1);
  input.emit(EnterScene,{scene,release:''});await step(2);
  expect(world.resource(TrafficArtPreview)).toEqual({mode:0,frame:1,caseId:0});
  expect(world.resource(DrivingState).manual).toBe(false);expect(world.resource(DrivingState).active).toBe(true);
  input.emit(EnterScene,{scene:'scenes/traffic-catalog.scene.json',release:''});input.emit(EnterScene,{scene,release:''});await step(2);
  expect(world.resource(TrafficArtPreview)).toEqual({mode:0,frame:1,caseId:0});
  expect(world.entities(RouteDriver).length).toBe(1);
},{scene});
