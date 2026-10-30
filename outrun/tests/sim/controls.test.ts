import { worldTest, expect } from '@gameengine/test';
import { DrivingState, DrivingInput, DrivingControlChanged, DrivingControlsCancelled, DrivingPauseRequested, DrivingResetRequested } from '../../src/schema.gen.ts';
const SCENE = { scene: 'scenes/driving-proof.scene.json' };

worldTest('controls.keyboard and recorded UI actions produce equivalent driving outcomes', async ({ world, input, step }) => {
  input.key('ArrowUp', true); input.key('ArrowLeft', true);
  await step(60);
  const keyboard = world.resource(DrivingState);
  input.key('ArrowUp', false); input.key('ArrowLeft', false);
  input.emit(DrivingResetRequested, { manual: false, legacySpeed: 0, distance: 45000, lateral: 0 });
  input.emit(DrivingControlChanged, { control: 0, source: 1, down: true });
  input.emit(DrivingControlChanged, { control: 2, source: 1, down: true });
  await step(60);
  expect(world.resource(DrivingState)).toEqual(keyboard);
}, SCENE);

worldTest('controls.pause clears both sources and blocks held commands until resumed', async ({ world, input, step }) => {
  input.key('ArrowUp', true);
  input.emit(DrivingControlChanged, { control: 2, source: 1, down: true });
  await step(4);
  input.emit(DrivingPauseRequested, { paused: true });
  await step(2);
  const distance = world.resource(DrivingState).distance;
  expect(world.resource(DrivingInput).keyboard).toBe(0);
  expect(world.resource(DrivingInput).ui).toBe(0);
  input.emit(DrivingControlChanged, { control: 0, source: 1, down: true });
  await step(2);
  expect(world.resource(DrivingInput).ui).toBe(0);
  expect(world.resource(DrivingState).distance).toBe(distance);
  input.emit(DrivingPauseRequested, { paused: false });
  await step(2);
  expect(world.resource(DrivingState).playing).toBe(true);
  expect(world.resource(DrivingInput).keyboard).toBe(0);
  expect(world.resource(DrivingInput).ui).toBe(0);
}, SCENE);

worldTest('controls.background cancellation clears keyboard and UI without restoring holds', async ({ world, input, step, app }) => {
  await step(2);
  input.key('ArrowUp', true);
  input.emit(DrivingControlChanged, { control: 2, source: 1, down: true });
  await step(3);
  app.background(); app.foreground();
  await step(3);
  expect(world.resource(DrivingInput).keyboard).toBe(0);
  expect(world.resource(DrivingInput).ui).toBe(0);
  input.emit(DrivingControlsCancelled, {});
  await step(2);
  expect(world.resource(DrivingInput).ui).toBe(0);
}, SCENE);
