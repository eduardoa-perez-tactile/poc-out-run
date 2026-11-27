import {worldTest,expect} from '@gameengine/test';
import {RouteDriver,RouteTrafficCoordinates,TerrainDriver,TrafficPool,CollisionDriver,CrashDriver,DrivingState,
  RouteResetRequested,DrivingPauseRequested,RouteBiomeEntered} from '../../src/schema.gen.ts';

const SCENE={scene:'scenes/original-route-sim.scene.json'};
worldTest('routes.native authentic recorded startup owns one actor with integer authority before controls',async({world,step})=>{
  await step(1);const actors=world.entities(RouteDriver);expect(actors.length).toBe(1);const e=actors[0]!;
  const route=world.get(e,RouteDriver),state=world.resource(DrivingState),coords=world.get(e,RouteTrafficCoordinates);
  expect(route.initialized).toBe(true);expect(route.mapId).toBe(1);expect(route.camera).toBe(45000);
  expect(route.routeEpoch).toBe(1);expect(route.mapEpoch).toBe(1);expect(route.rangeCalls).toBe(1);expect(route.pending).toBe(false);
  expect(state.distance).toBe(45000);expect(state.legacySpeed).toBe(0);expect(state.lateral).toBe(0);expect(state.gear).toBe(0);
  expect(coords.initialized).toBe(true);expect(coords.routeEpoch).toBe(1);expect(coords.mapEpoch).toBe(1);
  for(const component of [TerrainDriver,TrafficPool,CollisionDriver,CrashDriver])expect(world.entities(component)[0]).toBe(e);
  expect(world.events(RouteBiomeEntered).length).toBe(1);
},SCENE);
worldTest('routes.native recorded throttle uses source integer assignments without fractional carry',async({world,step,input})=>{
  await step(1);const e=world.entities(RouteDriver)[0]!;input.key('ArrowUp',true);
  for(const camera of [45000,45000,45000,45001]){await step(1);expect(world.get(e,RouteDriver).camera).toBe(camera);expect(world.resource(DrivingState).distance).toBe(camera);}
  input.key('ArrowUp',false);await step(1);expect(world.get(e,RouteDriver).rangeCalls).toBe(1);
},SCENE);
worldTest('routes.native pause freezes actors and a recorded full reset applies while remaining paused',async({world,step,input})=>{
  await step(1);const e=world.entities(RouteDriver)[0]!;
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  const before={route:world.get(e,RouteDriver),pool:world.get(e,TrafficPool),coordinates:world.get(e,RouteTrafficCoordinates),
    crash:world.get(e,CrashDriver),collision:world.get(e,CollisionDriver)};
  await step(20);
  expect(world.get(e,RouteDriver)).toEqual(before.route);expect(world.get(e,TrafficPool)).toEqual(before.pool);
  expect(world.get(e,RouteTrafficCoordinates)).toEqual(before.coordinates);expect(world.get(e,CrashDriver)).toEqual(before.crash);
  expect(world.get(e,CollisionDriver)).toEqual(before.collision);
  input.emit(RouteResetRequested,{seedLo:9,seedHi:2596069104,population:9,manual:true});await step(1);
  expect(world.entities(RouteDriver)[0]).toBe(e);expect(world.get(e,RouteDriver).routeEpoch).toBe(2);
  expect(world.get(e,RouteDriver).gradient).toBe(-1);expect(world.get(e,RouteDriver).rangeCalls).toBe(1);
  expect(world.get(e,TrafficPool).population).toBe(9);expect(world.get(e,RouteTrafficCoordinates).routeEpoch).toBe(2);
  expect(world.resource(DrivingState).playing).toBe(false);expect(world.resource(DrivingState).manual).toBe(true);
},SCENE);
