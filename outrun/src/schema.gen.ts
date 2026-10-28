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
    },
    {
      "name": "VehiclePreview",
      "kind": "resource",
      "sim": false,
      "fields": [
        {
          "name": "enabled",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "pose",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "sample",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "effect",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "scale",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 3.2
        },
        {
          "name": "placeholder",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "autoplay",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "loaded",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "reconciled",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "VehicleVisualSlot",
      "kind": "component",
      "sim": false,
      "fields": [
        {
          "name": "slot",
          "kind": "u32",
          "scalar": "u32",
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

export interface VehiclePreviewViews {
  enabled: Uint8Array;
  pose: Uint32Array;
  sample: Uint32Array;
  effect: Uint32Array;
  scale: Float32Array;
  placeholder: Uint8Array;
  autoplay: Uint8Array;
  loaded: Uint8Array;
  reconciled: Uint8Array;
}
export interface VehiclePreviewValue {
  enabled: boolean;
  pose: number;
  sample: number;
  effect: number;
  scale: number;
  placeholder: boolean;
  autoplay: boolean;
  loaded: boolean;
  reconciled: boolean;
}
/** VehiclePreview (resource, presentation-only) */
export const VehiclePreview = typeToken<VehiclePreviewViews, VehiclePreviewValue>('VehiclePreview', 'resource', { sig: 'enabled:bool:1,pose:u32:1,sample:u32:1,effect:u32:1,scale:f32:1,placeholder:bool:1,autoplay:bool:1,loaded:bool:1,reconciled:bool:1', read: (v: VehiclePreviewViews, i: number, o: Record<string, unknown>) => { o.enabled = v.enabled[i] !== 0; o.pose = v.pose[i]; o.sample = v.sample[i]; o.effect = v.effect[i]; o.scale = v.scale[i]; o.placeholder = v.placeholder[i] !== 0; o.autoplay = v.autoplay[i] !== 0; o.loaded = v.loaded[i] !== 0; o.reconciled = v.reconciled[i] !== 0; return o; } });

export interface VehicleVisualSlotViews {
  slot: Uint32Array;
}
export interface VehicleVisualSlotValue {
  slot: number;
}
/** VehicleVisualSlot (component, presentation-only) */
export const VehicleVisualSlot = typeToken<VehicleVisualSlotViews, VehicleVisualSlotValue>('VehicleVisualSlot', 'component', { sig: 'slot:u32:1', read: (v: VehicleVisualSlotViews, i: number, o: Record<string, unknown>) => { o.slot = v.slot[i]; return o; } });
