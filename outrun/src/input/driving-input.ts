import { defineSystem, write, read, query, math, KeyEvent, Keys } from '@gameengine/runtime';
import { DrivingState, DrivingInput, DrivingControlChanged, DrivingControlsCancelled, DrivingResetRequested, DrivingPauseRequested, TerrainDriver } from '../schema.gen.ts';

import {loadMap01} from '../content/biome.ts';

export const CaptureDrivingInput = defineSystem({
  name: 'CaptureDrivingInput',
  query:query(read(TerrainDriver)),
  events: [KeyEvent, DrivingControlChanged, DrivingControlsCancelled, DrivingResetRequested, DrivingPauseRequested],
  resources: [write(DrivingState), write(DrivingInput)],
  run(ctx,sourceDrivers) {
    const state = ctx.resource(DrivingState);
    if (!state.active[0]) return;
    const held = ctx.resource(DrivingInput);
    const setPaused = (paused: boolean) => {
      ctx.setField(DrivingState, 'playing', !paused);
      ctx.set(DrivingInput, { keyboard: 0, ui: 0, shiftUp: false, shiftDown: false });
    };
    ctx.set(DrivingInput, { shiftUp: false, shiftDown: false });
    for (const reset of ctx.events.read(DrivingResetRequested)) {
      let distance:number,lateral:number;
      if(sourceDrivers.count===1){
        const data=loadMap01();
        distance=math.fround(Math.max(0,Math.min(data.lastLine*data.segmentLength,reset.distance)));
        const segment=Math.floor(math.fround(distance+data.playerOffsetZ)/data.segmentLength);
        const right=math.fround(1.5+math.fround(data.segments[segment]!.gap/1600));
        lateral=math.fround(Math.max(-1.5,Math.min(right,reset.lateral)));
      }else{
        distance = ((reset.distance % 180000) + 180000) % 180000;
        lateral = Math.max(-1.5, Math.min(1.5, reset.lateral));
      }
      ctx.set(DrivingState, {
        manual: reset.manual, legacySpeed: Math.max(0, Math.min(200, reset.legacySpeed)),
        gear: reset.legacySpeed >= 100 ? 1 : 0, steering: 0,
        distance, previousDistance: distance, lateral, previousLateral: lateral, playing: true,
      });
      ctx.set(DrivingInput, { keyboard: 0, ui: 0, shiftUp: false, shiftDown: false, upHeld: false, downHeld: false, pauseHeld: false, modeHeld: false });
    }
    for (const key of ctx.events.read(KeyEvent)) {
      if (key.code === Keys.Space) {
        if (key.down && !held.pauseHeld[0]) {
          setPaused(state.playing[0] !== 0);
        }
        ctx.setField(DrivingInput, 'pauseHeld', key.down);
      } else if (key.code === Keys.KeyM) {
        if (key.down && !held.modeHeld[0]) ctx.setField(DrivingState, 'manual', !state.manual[0]);
        ctx.setField(DrivingInput, 'modeHeld', key.down);
      } else if (key.code === Keys.KeyE || key.code === Keys.KeyQ) {
        const up = key.code === Keys.KeyE;
        const wasHeld = up ? held.upHeld[0] : held.downHeld[0];
        if (key.down && !wasHeld && state.playing[0]) ctx.setField(DrivingInput, up ? 'shiftUp' : 'shiftDown', true);
        ctx.setField(DrivingInput, up ? 'upHeld' : 'downHeld', key.down);
      } else {
        const control = key.code === Keys.ArrowUp ? 0 : key.code === Keys.ArrowDown ? 1 : key.code === Keys.ArrowLeft ? 2 : key.code === Keys.ArrowRight ? 3 : -1;
        if (control >= 0) {
          const bit = 1 << control;
          ctx.setField(DrivingInput, 'keyboard', key.down && state.playing[0] ? held.keyboard[0]! | bit : held.keyboard[0]! & ~bit);
        }
      }
    }
    for (const input of ctx.events.read(DrivingControlChanged)) {
      if (input.control > 3 || input.source > 1) continue;
      const field = input.source === 0 ? 'keyboard' : 'ui';
      const bits = input.source === 0 ? held.keyboard[0]! : held.ui[0]!;
      const bit = 1 << input.control;
      ctx.setField(DrivingInput, field, input.down && state.playing[0] ? bits | bit : bits & ~bit);
    }
    // Explicit pause/resume runs after controls: a modal always releases prior holds.
    for (const request of ctx.events.read(DrivingPauseRequested)) setPaused(request.paused);
    // Cancellation wins within this input frame, regardless of device event ordering.
    for (const _ of ctx.events.read(DrivingControlsCancelled)) {
      ctx.set(DrivingInput, { keyboard: 0, ui: 0, shiftUp: false, shiftDown: false, upHeld: false, downHeld: false });
    }
  },
});
