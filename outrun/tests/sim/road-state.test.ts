import { worldTest, expect } from '@gameengine/test';
import { WorldView } from '@gameengine/runtime';
import { RoadFixtureRequested, RoadProofState } from '../../src/schema.gen.ts';

const SCENE = { scene: 'scenes/road-proof.scene.json' };

worldTest('road.state advances in documented units at a fixed step', async ({ world, input, step }) => {
  input.emit(RoadFixtureRequested, { fixtureId: 0, distance: 45000, lateral: 0, speed: 7200, playing: true });
  await step(60);
  expect(world.resource(RoadProofState).distance).toBeCloseTo(52200, 1);
  expect(world.resource(RoadProofState).previousDistance).toBeCloseTo(52080, 1);
}, SCENE);

worldTest('road.state fixture input pauses without stale interpolation history', async ({ world, input, step }) => {
  input.emit(RoadFixtureRequested, { fixtureId: 2, distance: 45000, lateral: 0.25, speed: 7200, playing: false });
  await step(60);
  const state = world.resource(RoadProofState);
  expect(state.fixtureId).toBe(2);
  expect(state.distance).toBe(45000);
  expect(state.previousDistance).toBe(45000);
  expect(state.lateral).toBe(0.25);
}, SCENE);

worldTest('road.state wraps the loop while retaining the prior sample', async ({ world, input, step }) => {
  input.emit(RoadFixtureRequested, { fixtureId: 1, distance: 179940, lateral: 0, speed: 7200, playing: true });
  await step(1);
  expect(world.resource(RoadProofState).distance).toBeCloseTo(60, 1);
  expect(world.resource(RoadProofState).previousDistance).toBe(179940);
}, SCENE);

worldTest('road.state rejects unknown fixtures and bounds requested values', async ({ world, input, step }) => {
  input.emit(RoadFixtureRequested, { fixtureId: 99, distance: -150, lateral: 10, speed: -1, playing: false });
  await step(1);
  const state = world.resource(RoadProofState);
  expect(state.fixtureId).toBe(0);
  expect(state.distance).toBe(179850);
  expect(state.lateral).toBe(1.5);
  expect(state.speed).toBe(0);
}, SCENE);

worldTest('road.state viewport changes do not affect road progression', async ({ world, input, step }) => {
  input.emit(RoadFixtureRequested, { fixtureId: 1, distance: 45000, lateral: 0, speed: 7200, playing: true });
  input.view(882, 344, 1);
  await step(10);
  input.view(1080, 810, 1);
  await step(10);
  expect(world.resource(RoadProofState).distance).toBeCloseTo(47400, 1);
  expect(world.resource(WorldView).orthoSize).toBe(1);
  expect(world.resource(WorldView).fit).toBe('Height');
}, SCENE);

worldTest('road.state keyboard chooses fixtures and pauses the proof', async ({ world, input, step }) => {
  input.key('Digit3', true);
  await step(1);
  input.key('Digit3', false);
  input.key('Space', true);
  await step(1);
  input.key('Space', false);
  const pausedAt = world.resource(RoadProofState).distance;
  await step(15);
  expect(world.resource(RoadProofState).fixtureId).toBe(2);
  expect(world.resource(RoadProofState).playing).toBe(false);
  expect(world.resource(RoadProofState).distance).toBe(pausedAt);
}, SCENE);

for (const order of [['Digit3', 'Space'], ['Space', 'Digit3']] as const) {
  worldTest(`road.state simultaneous ${order.join(' then ')} preserves pause on following ticks`, async ({ world, input, step }) => {
    for (const key of order) input.key(key, true);
    await step(1);
    expect(world.resource(RoadProofState).playing).toBe(false);
    for (const key of order) input.key(key, false);
    await step(1);
    const paused = world.resource(RoadProofState);
    expect(paused.fixtureId).toBe(2);
    expect(paused.playing).toBe(false);
    expect(paused.distance).toBe(45000);
    expect(paused.previousDistance).toBe(45000);
    await step(3);
    expect(world.resource(RoadProofState).playing).toBe(false);
    expect(world.resource(RoadProofState).distance).toBe(45000);
  }, SCENE);
}

worldTest('road.state Digit4 selects the hill fixture through recorded input', async ({world,input,step}) => {
  input.key('Digit4',true);
  await step(2);
  expect(world.resource(RoadProofState).fixtureId).toBe(3);
  expect(world.resource(RoadProofState).playing).toBe(true);
},SCENE);
