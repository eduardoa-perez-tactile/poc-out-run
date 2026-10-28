import { resource, event, u32, bool, f32 } from '@gameengine/schema';
// Inactive defaults are untouched by old fixtures and omitted from engine hashes.
// This is a visual proof, not campaign route/checkpoint state.
export const ForkPreviewState = resource('ForkPreviewState', {
  active: bool(), side: u32(), previousTick: u32(), tick: u32(), durationTicks: u32({default:180}),
}, {sim:true});
export const ForkPreviewRequested = event('ForkPreviewRequested', {
  side: u32(), distance: f32({default:33000}), tick: u32(), configurePlayback: bool(), playing: bool({default:true}),
}, {sim:true});
export const ForkVisualCache = resource('ForkVisualCache', {
  active: bool(), side: u32(), progress: f32({default:-1}),
}, {sim:false});
