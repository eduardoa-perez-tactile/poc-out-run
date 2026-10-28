// Road proof only: distance/speed use legacy world units and world units per second.
import { resource, event, f32, u32, bool } from '@gameengine/schema';
export const RoadProofState = resource('RoadProofState', {
  fixtureId: u32({ default: 1 }),
  distance: f32({ default: 45000 }),
  previousDistance: f32({ default: 45000 }),
  lateral: f32({ default: 0 }),
  speed: f32({ default: 7200 }),
  playing: bool({ default: true }),
  spaceHeld: bool(),
}, { sim: true });
export const RoadFixtureRequested = event('RoadFixtureRequested', {
  fixtureId: u32(), distance: f32({ default: 45000 }), speed: f32({ default: 7200 }), lateral: f32(), playing: bool(),
}, { sim: true });

// Presentation cache is reset with each world and never participates in race hashes.
export const RoadProofVisualCache = resource('RoadProofVisualCache', {
  fixtureId: u32({ default: 4294967295 }), distance: f32({ default: -1 }), lateral: f32(), aspect: f32(),
}, { sim: false });
