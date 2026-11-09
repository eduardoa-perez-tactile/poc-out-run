import {worldTest,expect} from '@gameengine/test';
import {EnterScene} from '@gameengine/runtime';
import {originalRouteSources} from '../../src/content/route-boot.ts';
import {routeVehiclePreview} from '../../src/render/route-render-math.ts';
import {frameForPose} from '../../src/content/vehicles/vehicle-poses.ts';
import {RacePhase} from '../../src/sim/race-flow-math.ts';
import {RouteDriver,RouteTrafficCoordinates,TerrainDriver,TrafficPool,CrashDriver,DrivingState,DrivingInput,DrivingControlChanged,TrafficArtPreview,RaceState} from '../../src/schema.gen.ts';

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

worldTest('routes.presentation goal autopilot owns brake drift stopped frames while crash recovery stays authoritative',async({world,step})=>{
  await step(1);
  const actor=world.entities(RouteDriver)[0]!,data=originalRouteSources().get(16,0);
  const terrain={...world.get(actor,TerrainDriver),mapId:16,segment:0,leftEffect:0,rightEffect:0};
  const crash={...world.get(actor,CrashDriver),mapId:16};
  const driving={...world.resource(DrivingState),playing:true,steering:1};
  const race={...world.resource(RaceState),initialized:true,phase:RacePhase.EndingBrake,phaseTicks:0};
  // ArrowUp remains held: the ending autopilot must still select braking and
  // smoke. Source thresholds choose explicit one-based imported body files.
  for(const [speed,frame]of [[200,61],[100,61],[99,65],[60,72],[59,147],[40,147],[39,148],[1,148],[0,122]]as const){
    const preview=routeVehiclePreview(data,terrain,crash,{...driving,legacySpeed:speed},1,600,0,false,1/60,race);
    expect(frameForPose(preview.pose,preview.sample)).toBe(frame);
    expect(preview.leftEffect).toBe(speed>0?1:0);expect(preview.rightEffect).toBe(speed>0?1:0);
    expect(preview.hidden).toBe(false);
  }
  for(const phase of [RacePhase.Bonus,RacePhase.Results]){
    const preview=routeVehiclePreview(data,terrain,crash,{...driving,playing:false,legacySpeed:0},2,600,9,false,1/60,{...race,phase});
    expect(frameForPose(preview.pose,preview.sample)).toBe(122);expect(preview.leftEffect).toBe(0);
  }
  const rolling=routeVehiclePreview(data,terrain,crash,{...driving,legacySpeed:200},2,600,9,false,1/60,{...race,phase:RacePhase.EndingRoll});
  expect(rolling.pose).toBe(0);expect(rolling.leftEffect).toBe(0);expect(rolling.rightEffect).toBe(0);
  const paused=routeVehiclePreview(data,terrain,crash,{...driving,playing:false,legacySpeed:39},1,600,22,false,1/60,
    {...race,phase:RacePhase.Paused,resumePhase:RacePhase.EndingBrake});
  expect(frameForPose(paused.pose,paused.sample)).toBe(148);
  const recovering=routeVehiclePreview(data,terrain,{...crash,phase:1,variant:0,advances:3,reactionTick:0},driving,1,600,22,false,1/60,race);
  expect(recovering.pose).toBe(18);expect(recovering.sample).toBe(3);
  const ordinary=routeVehiclePreview(data,terrain,crash,driving,1,600,0,false);
  expect(ordinary.pose).toBe(2);
},{scene:'scenes/original-race.scene.json'});
