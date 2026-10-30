import { component, resource, u32, f32, bool } from '@gameengine/schema';
// Art review controls only. No crash outcomes, collisions, race clock or recorded input.
export const VehiclePreview = resource('VehiclePreview', {
  enabled: bool(), pose: u32(), sample: u32(), effect: u32(), scale: f32({ default: 3.2 }),
  placeholder: bool(), autoplay: bool(), loaded: bool(), reconciled: bool(),
  useWheelEffects: bool(), leftEffect: u32(), rightEffect: u32(), hidden: bool(),
}, { sim: false });
export const VehicleVisualSlot = component('VehicleVisualSlot', {
  slot: u32(),
}, { sim: false });
