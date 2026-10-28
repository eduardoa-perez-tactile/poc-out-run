// @generated — do not edit. Regenerate with `pnpm gen` (tools/bindgen).
import { typeToken, registerSchema, type EntityId } from '@gameengine/runtime';

export type { EntityId };

/** Project schema IR, registered with the engine when the bundle boots. */
export const schemaIr = {
  "version": 1,
  "package": "OutRun",
  "enums": [],
  "types": [
    {
      "name": "DrivingControlChanged",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "control",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "source",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "down",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "DrivingControlsCancelled",
      "kind": "event",
      "sim": true,
      "fields": [],
      "package": "OutRun"
    },
    {
      "name": "DrivingInput",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "keyboard",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "ui",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "shiftUp",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "shiftDown",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "upHeld",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "downHeld",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "pauseHeld",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "modeHeld",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "DrivingPauseRequested",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "paused",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "DrivingResetRequested",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "manual",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "legacySpeed",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "distance",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 45000
        },
        {
          "name": "lateral",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "DrivingState",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "active",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "playing",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1,
          "default": true
        },
        {
          "name": "manual",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "legacySpeed",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "gear",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "steering",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "distance",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 45000
        },
        {
          "name": "previousDistance",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 45000
        },
        {
          "name": "lateral",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "previousLateral",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "ForkPreviewRequested",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "side",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "distance",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 33000
        },
        {
          "name": "tick",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "configurePlayback",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "playing",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1,
          "default": true
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "ForkPreviewState",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "active",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "side",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "previousTick",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "tick",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "durationTicks",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "default": 180
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "ForkVisualCache",
      "kind": "resource",
      "sim": false,
      "fields": [
        {
          "name": "active",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "side",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "progress",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": -1
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "RoadFixtureRequested",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "fixtureId",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "distance",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 45000
        },
        {
          "name": "speed",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 7200
        },
        {
          "name": "lateral",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "playing",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "RoadProofState",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "fixtureId",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "default": 1
        },
        {
          "name": "distance",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 45000
        },
        {
          "name": "previousDistance",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 45000
        },
        {
          "name": "lateral",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 0
        },
        {
          "name": "speed",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 7200
        },
        {
          "name": "playing",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1,
          "default": true
        },
        {
          "name": "spaceHeld",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "RoadProofVisualCache",
      "kind": "resource",
      "sim": false,
      "fields": [
        {
          "name": "fixtureId",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "default": 4294967295
        },
        {
          "name": "distance",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": -1
        },
        {
          "name": "lateral",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "aspect",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        }
      ],
      "package": "OutRun"
    }
  ],
  "commands": [],
  "protocol": [],
  "services": []
} as const;
registerSchema(schemaIr);

export interface DrivingControlChangedViews {
  control: Uint32Array;
  source: Uint32Array;
  down: Uint8Array;
}
export interface DrivingControlChangedValue {
  control: number;
  source: number;
  down: boolean;
}
/** DrivingControlChanged (event, sim) */
export const DrivingControlChanged = typeToken<DrivingControlChangedViews, DrivingControlChangedValue>('DrivingControlChanged', 'event', { sig: 'control:u32:1,source:u32:1,down:bool:1', read: (v: DrivingControlChangedViews, i: number, o: Record<string, unknown>) => { o.control = v.control[i]; o.source = v.source[i]; o.down = v.down[i] !== 0; return o; } });

export type DrivingControlsCancelledViews = Record<string, never>;
export type DrivingControlsCancelledValue = Record<string, never>;
/** DrivingControlsCancelled (event, sim) */
export const DrivingControlsCancelled = typeToken<DrivingControlsCancelledViews, DrivingControlsCancelledValue>('DrivingControlsCancelled', 'event');

export interface DrivingInputViews {
  keyboard: Uint32Array;
  ui: Uint32Array;
  shiftUp: Uint8Array;
  shiftDown: Uint8Array;
  upHeld: Uint8Array;
  downHeld: Uint8Array;
  pauseHeld: Uint8Array;
  modeHeld: Uint8Array;
}
export interface DrivingInputValue {
  keyboard: number;
  ui: number;
  shiftUp: boolean;
  shiftDown: boolean;
  upHeld: boolean;
  downHeld: boolean;
  pauseHeld: boolean;
  modeHeld: boolean;
}
/** DrivingInput (resource, sim) */
export const DrivingInput = typeToken<DrivingInputViews, DrivingInputValue>('DrivingInput', 'resource', { sig: 'keyboard:u32:1,ui:u32:1,shiftUp:bool:1,shiftDown:bool:1,upHeld:bool:1,downHeld:bool:1,pauseHeld:bool:1,modeHeld:bool:1', read: (v: DrivingInputViews, i: number, o: Record<string, unknown>) => { o.keyboard = v.keyboard[i]; o.ui = v.ui[i]; o.shiftUp = v.shiftUp[i] !== 0; o.shiftDown = v.shiftDown[i] !== 0; o.upHeld = v.upHeld[i] !== 0; o.downHeld = v.downHeld[i] !== 0; o.pauseHeld = v.pauseHeld[i] !== 0; o.modeHeld = v.modeHeld[i] !== 0; return o; } });

export interface DrivingPauseRequestedViews {
  paused: Uint8Array;
}
export interface DrivingPauseRequestedValue {
  paused: boolean;
}
/** DrivingPauseRequested (event, sim) */
export const DrivingPauseRequested = typeToken<DrivingPauseRequestedViews, DrivingPauseRequestedValue>('DrivingPauseRequested', 'event', { sig: 'paused:bool:1', read: (v: DrivingPauseRequestedViews, i: number, o: Record<string, unknown>) => { o.paused = v.paused[i] !== 0; return o; } });

export interface DrivingResetRequestedViews {
  manual: Uint8Array;
  legacySpeed: Float32Array;
  distance: Float32Array;
  lateral: Float32Array;
}
export interface DrivingResetRequestedValue {
  manual: boolean;
  legacySpeed: number;
  distance: number;
  lateral: number;
}
/** DrivingResetRequested (event, sim) */
export const DrivingResetRequested = typeToken<DrivingResetRequestedViews, DrivingResetRequestedValue>('DrivingResetRequested', 'event', { sig: 'manual:bool:1,legacySpeed:f32:1,distance:f32:1,lateral:f32:1', read: (v: DrivingResetRequestedViews, i: number, o: Record<string, unknown>) => { o.manual = v.manual[i] !== 0; o.legacySpeed = v.legacySpeed[i]; o.distance = v.distance[i]; o.lateral = v.lateral[i]; return o; } });

export interface DrivingStateViews {
  active: Uint8Array;
  playing: Uint8Array;
  manual: Uint8Array;
  legacySpeed: Float32Array;
  gear: Uint32Array;
  steering: Float32Array;
  distance: Float32Array;
  previousDistance: Float32Array;
  lateral: Float32Array;
  previousLateral: Float32Array;
}
export interface DrivingStateValue {
  active: boolean;
  playing: boolean;
  manual: boolean;
  legacySpeed: number;
  gear: number;
  steering: number;
  distance: number;
  previousDistance: number;
  lateral: number;
  previousLateral: number;
}
/** DrivingState (resource, sim) */
export const DrivingState = typeToken<DrivingStateViews, DrivingStateValue>('DrivingState', 'resource', { sig: 'active:bool:1,playing:bool:1,manual:bool:1,legacySpeed:f32:1,gear:u32:1,steering:f32:1,distance:f32:1,previousDistance:f32:1,lateral:f32:1,previousLateral:f32:1', read: (v: DrivingStateViews, i: number, o: Record<string, unknown>) => { o.active = v.active[i] !== 0; o.playing = v.playing[i] !== 0; o.manual = v.manual[i] !== 0; o.legacySpeed = v.legacySpeed[i]; o.gear = v.gear[i]; o.steering = v.steering[i]; o.distance = v.distance[i]; o.previousDistance = v.previousDistance[i]; o.lateral = v.lateral[i]; o.previousLateral = v.previousLateral[i]; return o; } });

export interface ForkPreviewRequestedViews {
  side: Uint32Array;
  distance: Float32Array;
  tick: Uint32Array;
  configurePlayback: Uint8Array;
  playing: Uint8Array;
}
export interface ForkPreviewRequestedValue {
  side: number;
  distance: number;
  tick: number;
  configurePlayback: boolean;
  playing: boolean;
}
/** ForkPreviewRequested (event, sim) */
export const ForkPreviewRequested = typeToken<ForkPreviewRequestedViews, ForkPreviewRequestedValue>('ForkPreviewRequested', 'event', { sig: 'side:u32:1,distance:f32:1,tick:u32:1,configurePlayback:bool:1,playing:bool:1', read: (v: ForkPreviewRequestedViews, i: number, o: Record<string, unknown>) => { o.side = v.side[i]; o.distance = v.distance[i]; o.tick = v.tick[i]; o.configurePlayback = v.configurePlayback[i] !== 0; o.playing = v.playing[i] !== 0; return o; } });

export interface ForkPreviewStateViews {
  active: Uint8Array;
  side: Uint32Array;
  previousTick: Uint32Array;
  tick: Uint32Array;
  durationTicks: Uint32Array;
}
export interface ForkPreviewStateValue {
  active: boolean;
  side: number;
  previousTick: number;
  tick: number;
  durationTicks: number;
}
/** ForkPreviewState (resource, sim) */
export const ForkPreviewState = typeToken<ForkPreviewStateViews, ForkPreviewStateValue>('ForkPreviewState', 'resource', { sig: 'active:bool:1,side:u32:1,previousTick:u32:1,tick:u32:1,durationTicks:u32:1', read: (v: ForkPreviewStateViews, i: number, o: Record<string, unknown>) => { o.active = v.active[i] !== 0; o.side = v.side[i]; o.previousTick = v.previousTick[i]; o.tick = v.tick[i]; o.durationTicks = v.durationTicks[i]; return o; } });

export interface ForkVisualCacheViews {
  active: Uint8Array;
  side: Uint32Array;
  progress: Float32Array;
}
export interface ForkVisualCacheValue {
  active: boolean;
  side: number;
  progress: number;
}
/** ForkVisualCache (resource, presentation-only) */
export const ForkVisualCache = typeToken<ForkVisualCacheViews, ForkVisualCacheValue>('ForkVisualCache', 'resource', { sig: 'active:bool:1,side:u32:1,progress:f32:1', read: (v: ForkVisualCacheViews, i: number, o: Record<string, unknown>) => { o.active = v.active[i] !== 0; o.side = v.side[i]; o.progress = v.progress[i]; return o; } });

export interface RoadFixtureRequestedViews {
  fixtureId: Uint32Array;
  distance: Float32Array;
  speed: Float32Array;
  lateral: Float32Array;
  playing: Uint8Array;
}
export interface RoadFixtureRequestedValue {
  fixtureId: number;
  distance: number;
  speed: number;
  lateral: number;
  playing: boolean;
}
/** RoadFixtureRequested (event, sim) */
export const RoadFixtureRequested = typeToken<RoadFixtureRequestedViews, RoadFixtureRequestedValue>('RoadFixtureRequested', 'event', { sig: 'fixtureId:u32:1,distance:f32:1,speed:f32:1,lateral:f32:1,playing:bool:1', read: (v: RoadFixtureRequestedViews, i: number, o: Record<string, unknown>) => { o.fixtureId = v.fixtureId[i]; o.distance = v.distance[i]; o.speed = v.speed[i]; o.lateral = v.lateral[i]; o.playing = v.playing[i] !== 0; return o; } });

export interface RoadProofStateViews {
  fixtureId: Uint32Array;
  distance: Float32Array;
  previousDistance: Float32Array;
  lateral: Float32Array;
  speed: Float32Array;
  playing: Uint8Array;
  spaceHeld: Uint8Array;
}
export interface RoadProofStateValue {
  fixtureId: number;
  distance: number;
  previousDistance: number;
  lateral: number;
  speed: number;
  playing: boolean;
  spaceHeld: boolean;
}
/** RoadProofState (resource, sim) */
export const RoadProofState = typeToken<RoadProofStateViews, RoadProofStateValue>('RoadProofState', 'resource', { sig: 'fixtureId:u32:1,distance:f32:1,previousDistance:f32:1,lateral:f32:1,speed:f32:1,playing:bool:1,spaceHeld:bool:1', read: (v: RoadProofStateViews, i: number, o: Record<string, unknown>) => { o.fixtureId = v.fixtureId[i]; o.distance = v.distance[i]; o.previousDistance = v.previousDistance[i]; o.lateral = v.lateral[i]; o.speed = v.speed[i]; o.playing = v.playing[i] !== 0; o.spaceHeld = v.spaceHeld[i] !== 0; return o; } });

export interface RoadProofVisualCacheViews {
  fixtureId: Uint32Array;
  distance: Float32Array;
  lateral: Float32Array;
  aspect: Float32Array;
}
export interface RoadProofVisualCacheValue {
  fixtureId: number;
  distance: number;
  lateral: number;
  aspect: number;
}
/** RoadProofVisualCache (resource, presentation-only) */
export const RoadProofVisualCache = typeToken<RoadProofVisualCacheViews, RoadProofVisualCacheValue>('RoadProofVisualCache', 'resource', { sig: 'fixtureId:u32:1,distance:f32:1,lateral:f32:1,aspect:f32:1', read: (v: RoadProofVisualCacheViews, i: number, o: Record<string, unknown>) => { o.fixtureId = v.fixtureId[i]; o.distance = v.distance[i]; o.lateral = v.lateral[i]; o.aspect = v.aspect[i]; return o; } });
