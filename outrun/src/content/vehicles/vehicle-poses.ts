import { FERRARI1 } from './ferrari1.manifest.ts';
// Pure presentation catalog: one-based source filenames, not mixed C++ vector offsets.
export const DRIVING_POSES = [
  'drive_flat_straight','drive_flat_left','drive_flat_right',
  'drive_up_straight','drive_up_left','drive_up_right',
  'drive_down_straight','drive_down_left','drive_down_right',
  'brake_flat_straight','brake_flat_left','brake_flat_right',
  'brake_up_straight','brake_up_left','brake_up_right',
  'brake_down_straight','brake_down_left','brake_down_right',
] as const;
export const POSE_NAMES = [...DRIVING_POSES,'spin_right','reaction_right','spin_left','reaction_left','arrival'] as const;
export const EFFECT_NAMES = ['none','smoke','sand','grass','snow','mud'] as const;
export const VISUAL_POOL_CAPACITY = 3;
// Proposed review cadence (20 fps). The source's draw counters vary with speed;
// this is presentation timing only and cannot control crash/recovery duration.
export const VISUAL_FRAME_SECONDS = .05;
export const WHEEL_ANCHORS_PX = [[-32,-3],[32,-3]] as const; // x right/y down from body's ground anchor.
export function poseRange(pose: number): { first: number; last: number; heldFirst: number; loop: boolean } {
  if (pose >= 0 && pose < 18) {
    const group = Math.floor(pose / 3), direction = pose % 3;
    const first = group * 20 + (direction === 0 ? 1 : direction === 1 ? 5 : 13);
    const last = first + (direction === 0 ? 3 : 7);
    return { first, last, heldFirst: direction === 0 ? first : last - 3, loop: true };
  }
  const ranges = [[121,128],[129,133],[134,141],[142,146],[147,148]] as const;
  const range = ranges[pose - 18] ?? [1,4];
  return { first: range[0], last: range[1], heldFirst: range[0], loop: false };
}
export function frameForPose(pose: number, sample: number): number {
  const range = poseRange(pose);
  const elapsed = Math.max(0, Math.floor(sample));
  const length = range.last - range.first + 1;
  if (elapsed < length) return range.first + elapsed;
  return range.loop ? range.heldFirst + (elapsed - length) % (range.last - range.heldFirst + 1) : range.last;
}
export function effectFrame(effect: number, sample: number): number | null {
  if (effect < 1 || effect > 5) return null;
  const first = effect === 1 ? 1 : 5 + (effect - 2) * 6;
  return first + Math.max(0,Math.floor(sample)) % (effect === 1 ? 4 : 6);
}
export function previewFrame(pose: number, sample: number) {
  return FERRARI1.body[frameForPose(pose,sample)-1]!;
}
