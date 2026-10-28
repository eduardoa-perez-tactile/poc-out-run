import { defineSystem, write, read, math, WorldView, KeyEvent, Keys } from '@gameengine/runtime';
import { RoadProofState, RoadFixtureRequested, DrivingState } from '../schema.gen.ts';

// Proof units: segment length 150 legacy world units; speed is world units/second,
// not the source's per-update/HUD speed. This is a camera-road demo, not car handling.
export const ROAD_PROOF_TRACK_LENGTH = 180000;
const DESIGN_ASPECT = math.fround(16 / 9);

export const RoadViewSetup = defineSystem({
  name: 'RoadViewSetup',
  resources: [write(WorldView)],
  skipUnchanged: true,
  run(ctx) {
    const v = ctx.resource(WorldView);
    if (v.orthoSize[0] !== 1 || v.designAspect[0] !== DESIGN_ASPECT || !ctx.is(WorldView, 'fit', 'Height') || v.center[0] !== 0 || v.center[1] !== 0) {
      // Height fitting is intentional for a road extending beyond the viewport;
      // this is not the future HUD/control safe-area layout.
      ctx.set(WorldView, { orthoSize: 1, center: [0, 0], fit: 'Height', designAspect: DESIGN_ASPECT });
    }
  },
});

export const RoadProofInput = defineSystem({
  name: 'RoadProofInput',
  after: ['SelectRoadFixture'],
  resources: [write(RoadProofState), read(DrivingState)],
  runOn: [KeyEvent],
  run(ctx) {
    if (ctx.resource(DrivingState).active[0]) return;
    let selectedFixture: number | undefined;
    for (const key of ctx.events.read(KeyEvent)) {
      const state = ctx.resource(RoadProofState);
      if (key.code === Keys.Space) {
        const wasHeld = state.spaceHeld[0] !== 0;
        ctx.setField(RoadProofState, 'spaceHeld', key.down);
        if (key.down && !wasHeld) {
          ctx.setField(RoadProofState, 'playing', state.playing[0] === 0);
          ctx.setField(RoadProofState, 'previousDistance', state.distance[0]!);
        }
      } else if (key.down && (key.code === Keys.Digit1 || key.code === Keys.Digit2 || key.code === Keys.Digit3 || key.code === Keys.Digit4)) {
        selectedFixture = key.code - Keys.Digit1;
      }
    }
    // Requests are consumed on the following tick. Capture the final pause state
    // after the entire input frame, regardless of Digit/Space event ordering.
    if (selectedFixture !== undefined) {
      ctx.events.emit(RoadFixtureRequested, {
        fixtureId: selectedFixture, distance: 45000, speed: 7200, lateral: 0,
        playing: ctx.resource(RoadProofState).playing[0] !== 0,
      });
    }
  },
});

export const SelectRoadFixture = defineSystem({
  name: 'SelectRoadFixture',
  resources: [write(RoadProofState), read(DrivingState)],
  runOn: [RoadFixtureRequested],
  run(ctx) {
    if (ctx.resource(DrivingState).active[0]) return;
    for (const request of ctx.events.read(RoadFixtureRequested)) {
      const distance = ((request.distance % ROAD_PROOF_TRACK_LENGTH) + ROAD_PROOF_TRACK_LENGTH) % ROAD_PROOF_TRACK_LENGTH;
      ctx.set(RoadProofState, {
        fixtureId: request.fixtureId <= 3 ? request.fixtureId : 0,
        distance, previousDistance: distance,
        lateral: Math.max(-1.5, Math.min(1.5, request.lateral)),
        speed: Math.max(0, Math.min(12000, request.speed)), playing: request.playing,
      });
    }
  },
});

export const AdvanceRoadProof = defineSystem({
  name: 'AdvanceRoadProof',
  after: ['RoadProofInput'],
  resources: [write(RoadProofState), read(DrivingState)],
  runIf: { resource: RoadProofState, field: 'playing' },
  run(ctx) {
    if (ctx.resource(DrivingState).active[0]) return;
    const state = ctx.resource(RoadProofState);
    const distance = state.distance[0]!;
    const next = (distance + state.speed[0]! * ctx.dt) % ROAD_PROOF_TRACK_LENGTH;
    ctx.setField(RoadProofState, 'previousDistance', distance);
    ctx.setField(RoadProofState, 'distance', next);
  },
});
