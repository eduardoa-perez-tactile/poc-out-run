import { resource, event, f32, u32, bool } from '@gameengine/schema';

// Legacy speed is distance per nominal source update, NOT road world units/second.
export const DrivingState = resource('DrivingState', {
  active: bool(), playing: bool({ default: true }), manual: bool(),
  legacySpeed: f32(), gear: u32(), steering: f32(),
  distance: f32({ default: 45000 }), previousDistance: f32({ default: 45000 }),
  lateral: f32(), previousLateral: f32(),
}, { sim: true });
export const DrivingInput = resource('DrivingInput', {
  keyboard: u32(), ui: u32(), shiftUp: bool(), shiftDown: bool(),
  upHeld: bool(), downHeld: bool(), pauseHeld: bool(), modeHeld: bool(),
}, { sim: true });
// control: 0 throttle, 1 brake, 2 left, 3 right; source: 0 keyboard, 1 UI.
export const DrivingControlChanged = event('DrivingControlChanged', {
  control: u32(), source: u32(), down: bool(),
}, { sim: true });
export const DrivingControlsCancelled = event('DrivingControlsCancelled', {}, { sim: true });
// Recorded reset/configuration, used by the proof and deterministic fixtures.
export const DrivingResetRequested = event('DrivingResetRequested', {
  manual: bool(), legacySpeed: f32(), distance: f32({ default: 45000 }), lateral: f32(),
}, { sim: true });
// Explicit UI pause/resume intent; keyboard Space shares its authoritative reducer.
export const DrivingPauseRequested = event('DrivingPauseRequested', { paused: bool() }, { sim: true });
