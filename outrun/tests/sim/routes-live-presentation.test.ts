import {worldTest,expect} from '@gameengine/test';
import {EnterScene} from '@gameengine/runtime';
import {RouteDriver,RouteTrafficCoordinates,TerrainDriver,TrafficPool,CrashDriver,DrivingState,DrivingInput,DrivingControlChanged,TrafficArtPreview} from '../../src/schema.gen.ts';

worldTest('routes.presentation live scene preserves one actor through throttle pause and resumed keyboard driving',async({world,step,input})=>{
  input.view(1280,720,1);await step(1);
  const owners=world.entities(RouteDriver);expect(owners.length).toBe(1);const owner=owners[0]!;
  const initial=world.get(owner,RouteDriver);
  expect(initial.initialized).toBe(true);expect(initial.camera).toBe(45000);expect(initial.mapId).toBe(1);
  for(const component of [TerrainDriver,TrafficPool,RouteTrafficCoordinates,CrashDriver]){
    const entities=world.entities(component);expect(entities.length).toBe(1);expect(entities[0]).toBe(owner);
  }

  input.key('ArrowUp',true);await step(120);
  const driven=world.get(owner,RouteDriver),driving=world.resource(DrivingState);
  expect(driven.camera>45000).toBe(true);expect(driving.legacySpeed>0).toBe(true);expect(driving.distance).toBe(driven.camera);
  expect(world.get(owner,TerrainDriver).mapId).toBe(driven.mapId);
  expect(world.get(owner,TrafficPool).mapId).toBe(driven.mapId);
  expect(world.get(owner,CrashDriver).mapId).toBe(driven.mapId);
  const coordinates=world.get(owner,RouteTrafficCoordinates);
  expect(coordinates.routeEpoch).toBe(driven.routeEpoch);expect(coordinates.mapEpoch).toBe(driven.mapEpoch);

  // Space follows the real pause binding and releases the held throttle.
  input.key('Space',true);await step(1);
  expect(world.resource(DrivingState).playing).toBe(false);expect(world.resource(DrivingInput).keyboard).toBe(0);
  const pausedCamera=world.get(owner,RouteDriver).camera,pausedDriving=world.resource(DrivingState);
  input.key('ArrowUp',false);input.key('Space',false);await step(24);
  expect(world.get(owner,RouteDriver).camera).toBe(pausedCamera);
  expect(world.resource(DrivingState)).toEqual(pausedDriving);

  input.key('Space',true);await step(1);
  expect(world.resource(DrivingState).playing).toBe(true);
  input.key('Space',false);input.key('ArrowUp',true);await step(120);
  expect(world.entities(RouteDriver).length).toBe(1);expect(world.entities(RouteDriver)[0]).toBe(owner);
  expect(world.get(owner,RouteDriver).camera>pausedCamera).toBe(true);
  expect(world.resource(DrivingState).legacySpeed>pausedDriving.legacySpeed).toBe(true);
  input.key('ArrowUp',false);await step(1);
},{scene:'scenes/original-route-live.scene.json'});

worldTest('routes.presentation entering live route from catalog clears review mode and held controls',async({world,step,input})=>{
  await step(1);
  expect(world.resource(TrafficArtPreview).mode).toBe(1);
  expect(world.resource(DrivingState).active).toBe(false);
  input.key('ArrowUp',true);
  input.emit(DrivingControlChanged,{control:3,source:1,down:true});await step(1);
  input.emit(EnterScene,{scene:'scenes/original-route-live.scene.json',release:''});await step(2);
  expect(world.resource(DrivingState).active).toBe(true);
  expect(world.resource(DrivingInput).keyboard).toBe(0);expect(world.resource(DrivingInput).ui).toBe(0);
  expect(world.resource(TrafficArtPreview).mode).toBe(0);
  expect(world.entities(RouteDriver).length).toBe(1);
  input.key('ArrowUp',false);await step(1);
},{scene:'scenes/traffic-catalog.scene.json'});
