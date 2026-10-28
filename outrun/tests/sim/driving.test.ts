import { worldTest, expect } from '@gameengine/test';
import { DrivingState, DrivingInput, RoadProofState, DrivingControlChanged, DrivingControlsCancelled, DrivingResetRequested } from '../../src/schema.gen.ts';

const SCENE = { scene: 'scenes/driving-proof.scene.json' };

worldTest('driving.acceleration matches nominal source speed and publishes world units once', async ({ world, input, step }) => {
  input.key('ArrowUp', true);
  await step(1);
  expect(world.resource(DrivingState).legacySpeed).toBeCloseTo(0.256410271, 5);
  await step(59);
  expect(Math.abs(world.resource(DrivingState).legacySpeed - 15.3846235) < 0.002).toBe(true);
  await step(60);
  const car = world.resource(DrivingState);
  expect(Math.abs(car.legacySpeed - 30.7692585) < 0.002).toBe(true);
  expect(car.distance > 45000).toBe(true);
  expect(world.resource(RoadProofState).speed).toBeCloseTo(car.legacySpeed * 60, 2);
  expect(world.resource(RoadProofState).distance).toBe(car.distance);
}, SCENE);

worldTest('driving.automatic shifts at low cap and never exceeds high cap', async ({ world, input, step }) => {
  input.key('ArrowUp', true);
  await step(389);
  expect(world.resource(DrivingState).gear).toBe(0);
  await step(3);
  expect(world.resource(DrivingState).gear).toBe(1);
  expect(world.resource(DrivingState).legacySpeed >= 100).toBe(true);
  await step(410);
  expect(world.resource(DrivingState).legacySpeed).toBe(200);
  await step(10);
  expect(world.resource(DrivingState).legacySpeed).toBe(200);
}, SCENE);

worldTest('driving.brakes win both pedals at rest and stop without negative speed', async ({ world, input, step }) => {
  input.key('ArrowUp', true);
  input.key('ArrowDown', true);
  await step(3);
  expect(world.resource(DrivingState).legacySpeed).toBe(0);
  input.emit(DrivingResetRequested, { manual: true, legacySpeed: 100, distance: 45000, lateral: 0 });
  input.key('ArrowDown', true);
  await step(121);
  expect(world.resource(DrivingState).legacySpeed).toBe(0);
  expect(world.resource(DrivingState).gear).toBe(0);
  await step(5);
  expect(world.resource(DrivingState).legacySpeed).toBe(0);
}, SCENE);

worldTest('driving.coast is gentler than braking and clamps to rest', async ({ world, input, step }) => {
  input.emit(DrivingResetRequested, { manual: false, legacySpeed: 15, distance: 45000, lateral: 0 });
  await step(60);
  const speed = world.resource(DrivingState).legacySpeed;
  expect(speed > 3 && speed < 4).toBe(true);
  await step(60);
  expect(world.resource(DrivingState).legacySpeed).toBe(0);
}, SCENE);

worldTest('driving.manual low cap shift eligibility and edge suppression', async ({ world, input, step }) => {
  input.key('KeyM', true);
  input.key('ArrowUp', true);
  await step(410);
  expect(world.resource(DrivingState).manual).toBe(true);
  expect(world.resource(DrivingState).legacySpeed).toBe(100);
  expect(world.resource(DrivingState).gear).toBe(0);
  input.key('ArrowUp', false);
  input.key('KeyE', true);
  await step(1);
  expect(world.resource(DrivingState).gear).toBe(0);
  input.key('ArrowUp', true);
  input.key('KeyE', true);
  await step(1);
  expect(world.resource(DrivingState).gear).toBe(0);
  input.key('KeyE', false);
  await step(1);
  input.key('KeyE', true);
  input.key('KeyQ', true);
  await step(2);
  expect(world.resource(DrivingState).gear).toBe(1);
  expect(world.resource(DrivingState).legacySpeed > 100).toBe(true);
  input.key('ArrowUp', false);
  await step(10);
  expect(world.resource(DrivingState).gear).toBe(0);
}, SCENE);

worldTest('driving.steering left priority bounded reversal and exact return', async ({ world, input, step }) => {
  input.key('ArrowUp', true);
  await step(240);
  input.key('ArrowLeft', true);
  input.key('ArrowRight', true);
  await step(4);
  expect(world.resource(DrivingState).steering < 0).toBe(true);
  input.key('ArrowLeft', false);
  await step(12);
  expect(world.resource(DrivingState).steering > 0).toBe(true);
  input.key('ArrowRight', false);
  await step(40);
  expect(world.resource(DrivingState).steering).toBe(0);
  const lateral = world.resource(DrivingState).lateral;
  await step(5);
  expect(world.resource(DrivingState).lateral).toBe(lateral);
}, SCENE);

worldTest('driving.held input sources release independently and cancellation wins', async ({ world, input, step }) => {
  input.key('ArrowUp', true);
  input.emit(DrivingControlChanged, { control: 0, source: 1, down: true });
  await step(2);
  input.emit(DrivingControlChanged, { control: 0, source: 1, down: false });
  await step(1);
  expect(world.resource(DrivingInput).keyboard).toBe(1);
  expect(world.resource(DrivingInput).ui).toBe(0);
  const before = world.resource(DrivingState).legacySpeed;
  input.emit(DrivingControlsCancelled, {});
  input.emit(DrivingControlChanged, { control: 0, source: 1, down: true });
  await step(1);
  expect(world.resource(DrivingInput).keyboard).toBe(0);
  expect(world.resource(DrivingInput).ui).toBe(0);
  expect(world.resource(DrivingState).legacySpeed < before).toBe(true);
}, SCENE);

worldTest('driving.pause clears held input and freezes distance without repeated toggles', async ({ world, input, step }) => {
  input.key('ArrowUp', true);
  await step(20);
  input.key('Space', true);
  await step(1);
  const paused = world.resource(DrivingState).distance;
  input.key('Space', true);
  await step(5);
  expect(world.resource(DrivingState).distance).toBe(paused);
  expect(world.resource(DrivingInput).keyboard).toBe(0);
  expect(world.resource(DrivingState).previousDistance).toBe(paused);
  input.key('Space', false);
  input.key('ArrowUp', false);
  await step(1);
  input.key('Space', true);
  await step(1);
  expect(world.resource(DrivingState).playing).toBe(true);
  expect(world.resource(DrivingState).distance > paused).toBe(true);
}, SCENE);

worldTest('driving.recorded controls give the same progression after viewport changes', async ({ world, input, step }) => {
  input.key('ArrowUp', true);
  input.view(882, 344, 1);
  await step(60);
  const firstSpeed = world.resource(DrivingState).legacySpeed;
  const firstDistance = world.resource(DrivingState).distance;
  input.emit(DrivingResetRequested, { manual: false, legacySpeed: 0, distance: 45000, lateral: 0 });
  input.key('ArrowUp', true);
  input.view(1080, 810, 1);
  await step(60);
  expect(world.resource(DrivingState).legacySpeed).toBe(firstSpeed);
  expect(world.resource(DrivingState).distance).toBe(firstDistance);
}, SCENE);
