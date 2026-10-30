import { math } from '@gameengine/runtime';

const f = math.fround;
export const DRIVING_ACCELERATION = f(100 / 6.5);
export const DRIVING_BRAKING = 50;
export const LEGACY_UPDATES_PER_SECOND = 60;

export interface DrivingSample { legacySpeed: number; gear: number; steering: number; lateral: number }
export interface DrivingControls { throttle: boolean; brake: boolean; left: boolean; right: boolean; up: boolean; down: boolean }

/** Nominal 60 Hz calibration; inputs and all authoritative outputs are recorded/f32. */
export function advanceDriving(sample: DrivingSample, input: DrivingControls, manual: boolean, dt: number, clampLateral = true): DrivingSample {
  let { legacySpeed: speed, gear, steering, lateral } = sample;
  const delta = f(DRIVING_ACCELERATION * dt);
  const cap = gear === 0 ? 100 : 200;
  if (input.brake) {
    speed = f(Math.max(0, f(speed - f(DRIVING_BRAKING * dt))));
    if (speed < 100) gear = 0;
  } else if (input.throttle && speed <= cap) {
    speed = f(Math.min(cap, f(speed + delta)));
    if (!manual) {
      if (gear === 0 && speed === cap) gear = 1;
    } else if (input.up) {
      gear = 1;
    } else if (input.down) {
      gear = 0;
      if (speed > 100) speed = f(speed - delta);
    }
  } else {
    speed = f(Math.max(0, f(speed - f(delta * 0.75))));
    if (speed < 100) gear = 0;
  }
  if (input.left || input.right) {
    const target = f(f(speed * dt) * (input.left ? -1 : 1));
    steering = f(steering + Math.max(-0.3, Math.min(0.3, target - steering)));
  } else {
    steering = f(steering - f(steering * 0.1));
    if (steering > -0.1 && steering < 0.1) steering = 0;
  }
  // The default branch preserves the legacy proof's exact arithmetic. Source
  // terrain driving applies its gap-dependent bounds after drift instead.
  if (clampLateral) lateral = f(Math.max(-1.5, Math.min(1.5, f(lateral + f(steering * dt)))));
  else lateral = f(lateral + f(steering * dt));
  return { legacySpeed: speed, gear, steering, lateral };
}
