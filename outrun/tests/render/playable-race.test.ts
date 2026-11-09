import {renderTest,expect} from '@gameengine/test';
import {RaceState,RouteDriver,DrivingState} from '../../src/schema.gen.ts';
import {RacePhase} from '../../src/sim/race-flow-math.ts';

renderTest('race.playable real countdown draws source car and road without a false pause modal',async({input,step,world,render,ui})=>{
  const size={width:1280,height:720};
  input.view(size.width,size.height,1);await step(1);
  const owners=world.entities(RouteDriver);expect(owners.length).toBe(1);
  const initial=world.resource(RaceState),route=world.get(owners[0]!,RouteDriver),hash=world.hash();
  expect(initial.initialized).toBe(true);expect(initial.phase).toBe(RacePhase.Countdown);
  expect(initial.countdownTicks).toBeGreaterThan(0);expect(route.camera).toBe(45000);
  expect(world.resource(DrivingState).legacySpeed).toBe(0);

  render.waitForAssets({...size,timeoutMs:15000});
  const frame=render.stats(size);
  // Actual world submissions, not a SIM-only blue frame or an opaque UI cover.
  expect(frame.drawCalls).toBeGreaterThanOrEqual(6);expect(frame.worldOccluded).toBe(false);
  expect('validationErrors' in frame).toBe(true);
  if('validationErrors' in frame)expect(frame.validationErrors).toEqual([]);
  const pixels=render.probe({...size,points:[[560,630],[800,650]]}).points;
  const player=pixels[0]!.rgba,road=pixels[1]!.rgba;
  // Reviewed first-frame source pixels: opaque red body and neutral asphalt.
  // Broad chroma/range checks retain meaning without pinning a new golden.
  expect(player[3]).toBe(255);expect(player[0]!).toBeGreaterThan(100);
  expect(player[0]!-player[1]!).toBeGreaterThan(40);expect(player[0]!-player[2]!).toBeGreaterThan(40);
  expect(road[3]).toBe(255);expect(road[0]!).toBeGreaterThan(100);expect(road[0]!).toBeLessThan(200);
  expect(Math.abs(road[0]!-road[1]!)).toBeLessThan(5);expect(Math.abs(road[1]!-road[2]!)).toBeLessThan(5);
  const actions=ui.interactables();
  expect(actions.some(action=>action.label.trim()==='PAUSE')).toBe(true);
  expect(actions.some(action=>/resume/i.test(action.label)||action.id?.includes('driving-pause')===true)).toBe(false);
  // Asset settling, UI layout and extra actual draws cannot consume countdown
  // ticks or move the co-owned route actor before another fixed step is admitted.
  render.stats(size);
  expect(world.hash()).toBe(hash);expect(world.resource(RaceState)).toEqual(initial);
  expect(world.get(owners[0]!,RouteDriver)).toEqual(route);
},{scene:'scenes/original-race.scene.json',memory:'phone-low'});
