import {worldTest,expect} from '@gameengine/test';
import {EnterScene} from '@gameengine/runtime';
import {RaceOwner,RaceState,RouteDriver,DrivingState,DrivingInput} from '../../src/schema.gen.ts';
import {COUNTDOWN_TICKS,RacePhase} from '../../src/sim/race-flow-math.ts';

worldTest('race.lifecycle leaving paused race clears HUD authority and restores proof controls before fresh race reentry',async({world,input,step})=>{
  input.emit(EnterScene,{scene:'scenes/original-race.scene.json',release:''});
  await step(COUNTDOWN_TICKS+1);
  expect(world.resource(RaceState).phase).toBe(RacePhase.Racing);
  input.key('Space',true);await step(1);
  expect(world.resource(RaceState).phase).toBe(RacePhase.Paused);
  expect(world.resource(DrivingState).playing).toBe(false);
  input.key('Space',false);
  input.emit(EnterScene,{scene:'scenes/original-route-live.scene.json',release:''});await step(2);
  // Both HUD/results visibility and the controls' race pause guard use this
  // explicit authority flag; the stored phase can remain as an inactive snapshot.
  expect(world.resource(RaceState).initialized).toBe(false);
  expect(world.entities(RaceOwner).length).toBe(0);
  expect(world.resource(DrivingState).active).toBe(true);
  expect(world.resource(DrivingState).playing).toBe(true);
  expect(world.resource(DrivingInput).keyboard).toBe(0);
  const actor=world.entities(RouteDriver)[0]!,camera=world.get(actor,RouteDriver).camera;
  input.key('ArrowUp',true);await step(30);
  expect(world.get(actor,RouteDriver).camera>camera).toBe(true);
  input.key('ArrowUp',false);
  input.emit(EnterScene,{scene:'scenes/original-race.scene.json',release:''});await step(2);
  const fresh=world.resource(RaceState);
  expect(fresh.initialized).toBe(true);expect(fresh.phase).toBe(RacePhase.Countdown);
  expect(fresh.raceEpoch>0).toBe(true);expect(fresh.score).toBe(0);
  expect(fresh.remainingTicks).toBe(160*60);expect(world.entities(RaceOwner).length).toBe(1);
  expect(world.resource(DrivingState).playing).toBe(false);
});
