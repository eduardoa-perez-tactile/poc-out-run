import { defineSystem, read, write, math } from '@gameengine/runtime';
import { DrivingState, DrivingInput, RoadProofState } from '../schema.gen.ts';
import { advanceDriving, LEGACY_UPDATES_PER_SECOND } from './driving-math.ts';

export const AdvanceDriving = defineSystem({
  name: 'AdvanceDriving',
  after: ['CaptureDrivingInput', 'AdvanceRoadProof'],
  resources: [write(DrivingState), read(DrivingInput), write(RoadProofState)],
  run(ctx) {
    const state = ctx.resource(DrivingState);
    if (!state.active[0]) return;
    const distance = state.distance[0]!;
    const lateral = state.lateral[0]!;
    ctx.set(DrivingState, { previousDistance: distance, previousLateral: lateral });
    if (state.playing[0]) {
      const held = ctx.resource(DrivingInput);
      const bits = held.keyboard[0]! | held.ui[0]!;
      const next = advanceDriving({ legacySpeed: state.legacySpeed[0]!, gear: state.gear[0]!, steering: state.steering[0]!, lateral }, {
        throttle: (bits & 1) !== 0, brake: (bits & 2) !== 0, left: (bits & 4) !== 0, right: (bits & 8) !== 0,
        up: held.shiftUp[0] !== 0, down: held.shiftDown[0] !== 0,
      }, state.manual[0] !== 0, ctx.dt);
      ctx.set(DrivingState, { ...next, distance: math.fround(distance + math.fround(next.legacySpeed * LEGACY_UPDATES_PER_SECOND * ctx.dt)) % 180000 });
    }
    ctx.set(RoadProofState, {
      distance: state.distance[0]!, previousDistance: state.previousDistance[0]!, lateral: state.lateral[0]!,
      speed: math.fround(state.legacySpeed[0]! * LEGACY_UPDATES_PER_SECOND), playing: state.playing[0] !== 0,
    });
  },
});
