// @generated — do not edit. Regenerate with `pnpm gen` (tools/bindgen).
import { typeToken, rowRead as $r, registerSchema, dataToken, type DataRecord, type EntityId } from '@gameengine/runtime';
import './content.gen.ts';

export type { EntityId };

/** Project schema IR, registered with the engine when the bundle boots. */
export const schemaIr = {
  "version": 1,
  "package": "OutRun",
  "enums": [],
  "types": [
    {
      "name": "Map01Preview",
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
          "name": "cameraOriginZ",
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
      "name": "Map01VisualCache",
      "kind": "resource",
      "sim": false,
      "fields": [
        {
          "name": "cameraOriginZ",
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
          "lanes": 1,
          "default": -1
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "Map01VisualSlot",
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
    },
    {
      "name": "CollisionDriver",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "mapId",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "default": 1
        },
        {
          "name": "initialized",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "motionValid",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "motionStep",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "locked",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "acceptedCount",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "z0",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "z1",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "l0",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "ls",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "lc",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "lr",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "lf",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "drift",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "previousGap",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "carryApplied",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "handlingCap",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "ledgerCount",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "ledgerKind",
          "kind": "array",
          "scalar": "u32",
          "lanes": 64
        },
        {
          "name": "ledgerId",
          "kind": "array",
          "scalar": "u32",
          "lanes": 64
        },
        {
          "name": "ledgerEpoch",
          "kind": "array",
          "scalar": "u32",
          "lanes": 64
        },
        {
          "name": "ledgerGeneration",
          "kind": "array",
          "scalar": "u32",
          "lanes": 64
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "ContactAccepted",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "kind",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "mapId",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "id",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "epoch",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "generation",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "slot",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "toi",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "stage",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "playerX",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "playerZ",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "otherX",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "otherZ",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "impactSpeed",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "handlingCap",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "collisionDir",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "curve",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "CrashDriver",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "mapId",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "default": 1
        },
        {
          "name": "phase",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "consumedAcceptedCount",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "pendingStep",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "variant",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "kind",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "impactSpeed",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "handlingCap",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "collisionDir",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "curve",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "totalAdvances",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "advances",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "cadenceTick",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "decrement",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "reactionTick",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "recenterTarget",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        }
      ],
      "package": "OutRun"
    },
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
      "name": "Map01ArtPreview",
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
          "name": "playing",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "followDriving",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "cameraOriginZ",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 45000
        },
        {
          "name": "previousCameraOriginZ",
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
          "name": "speed",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 7200
        },
        {
          "name": "lastStep",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "controlHeld",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "lastCameraOriginZ",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 45000
        },
        {
          "name": "backOffset",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 1000
        },
        {
          "name": "frontOffset",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 1000
        },
        {
          "name": "previousBackOffset",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 1000
        },
        {
          "name": "previousFrontOffset",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 1000
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
      "name": "Map01ArtSlot",
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
      "name": "TerrainDriver",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "mapId",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "default": 1
        },
        {
          "name": "segment",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "roadSide",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "previousGap",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "initialized",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "leftOutside",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "rightOutside",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "leftEffect",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "rightEffect",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "skidding",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "recentering",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "recenterTarget",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "sectionEnd",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "TerrainVisualState",
      "kind": "component",
      "sim": false,
      "fields": [
        {
          "name": "lastStep",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "animationTicks",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "TrafficArtPreview",
      "kind": "resource",
      "sim": false,
      "fields": [
        {
          "name": "mode",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "frame",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "default": 1
        },
        {
          "name": "caseId",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "TrafficArtResidency",
      "kind": "resource",
      "sim": false,
      "fields": [
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
        },
        {
          "name": "catalogLoaded",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "catalogReconciled",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "TrafficPassed",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "epoch",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "slot",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "generation",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "points",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "TrafficPool",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "mapId",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "default": 1
        },
        {
          "name": "initialized",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "population",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "default": 20
        },
        {
          "name": "seedLo",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "default": 305419896
        },
        {
          "name": "seedHi",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "default": 2596069104
        },
        {
          "name": "originZ",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "aiCursor",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "default": 1
        },
        {
          "name": "epoch",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "z",
          "kind": "array",
          "scalar": "f32",
          "lanes": 32
        },
        {
          "name": "previousZ",
          "kind": "array",
          "scalar": "f32",
          "lanes": 32
        },
        {
          "name": "offset",
          "kind": "array",
          "scalar": "f32",
          "lanes": 32
        },
        {
          "name": "previousOffset",
          "kind": "array",
          "scalar": "f32",
          "lanes": 32
        },
        {
          "name": "speed",
          "kind": "array",
          "scalar": "f32",
          "lanes": 32
        },
        {
          "name": "target",
          "kind": "array",
          "scalar": "f32",
          "lanes": 32
        },
        {
          "name": "side",
          "kind": "array",
          "scalar": "u32",
          "lanes": 32
        },
        {
          "name": "ai",
          "kind": "array",
          "scalar": "u32",
          "lanes": 32
        },
        {
          "name": "active",
          "kind": "array",
          "scalar": "u32",
          "lanes": 32
        },
        {
          "name": "generation",
          "kind": "array",
          "scalar": "u32",
          "lanes": 32
        },
        {
          "name": "passed",
          "kind": "array",
          "scalar": "u32",
          "lanes": 32
        },
        {
          "name": "moving",
          "kind": "array",
          "scalar": "u32",
          "lanes": 32
        },
        {
          "name": "cooldown",
          "kind": "array",
          "scalar": "u32",
          "lanes": 32
        },
        {
          "name": "parked",
          "kind": "array",
          "scalar": "u32",
          "lanes": 32
        },
        {
          "name": "motionTicks",
          "kind": "array",
          "scalar": "u32",
          "lanes": 32
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "TrafficRebaseRequested",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "mapId",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "default": 1
        },
        {
          "name": "shift",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        }
      ],
      "package": "OutRun"
    },
    {
      "name": "TrafficResetRequested",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "mapId",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "default": 1
        },
        {
          "name": "population",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "default": 20
        },
        {
          "name": "seedLo",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "default": 305419896
        },
        {
          "name": "seedHi",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "default": 2596069104
        },
        {
          "name": "originZ",
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
        },
        {
          "name": "useWheelEffects",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "leftEffect",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "rightEffect",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "hidden",
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
  "services": [],
  "data": [
    {
      "name": "SourceBiome",
      "schema": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer"
          },
          "sourceCommit": {
            "type": "string"
          },
          "inputSha256": {
            "type": "string"
          },
          "sourceHashes": {
            "type": "object",
            "additionalProperties": {
              "type": "string"
            }
          },
          "profile": {
            "const": "sourceCompatibility-original"
          },
          "forkGradient": {
            "type": "integer"
          },
          "segmentLength": {
            "type": "integer"
          },
          "playerOffsetZ": {
            "type": "integer"
          },
          "cameraHeight": {
            "type": "integer"
          },
          "referenceWidth": {
            "type": "integer"
          },
          "authoredCount": {
            "type": "integer"
          },
          "totalCount": {
            "type": "integer"
          },
          "swapLine": {
            "type": "integer"
          },
          "lastLine": {
            "type": "integer"
          },
          "checkpointLine": {
            "type": "integer"
          },
          "timeSeconds": {
            "type": "integer"
          },
          "terrain": {
            "type": "integer"
          },
          "roadTerrain": {
            "type": "integer"
          },
          "links": {
            "type": "object",
            "properties": {
              "left": {
                "type": "integer"
              },
              "right": {
                "type": "integer"
              },
              "sequential": {
                "type": "integer"
              }
            },
            "required": [
              "left",
              "right",
              "sequential"
            ],
            "additionalProperties": false
          },
          "palette": {
            "type": "array",
            "items": {
              "type": "array",
              "items": {
                "type": "integer"
              }
            }
          },
          "commands": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "sourceLine": {
                  "type": "integer"
                },
                "command": {
                  "type": "string"
                },
                "arguments": {
                  "type": "array",
                  "items": {
                    "type": "number"
                  }
                },
                "firstSegment": {
                  "type": "integer"
                },
                "count": {
                  "type": "integer"
                },
                "effective": {
                  "type": "array",
                  "items": {
                    "type": "integer"
                  }
                }
              },
              "required": [
                "sourceLine",
                "command",
                "arguments",
                "firstSegment",
                "count",
                "effective"
              ],
              "additionalProperties": false
            }
          },
          "objects": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "integer"
                },
                "sourcePath": {
                  "type": "string"
                },
                "sha256": {
                  "type": "string"
                },
                "propertiesSha256": {
                  "type": "string"
                },
                "hasProperties": {
                  "type": "boolean"
                },
                "sourceSizePx": {
                  "type": "array",
                  "items": {
                    "type": "number"
                  }
                },
                "collision": {
                  "type": "boolean"
                },
                "scale": {
                  "type": "number"
                },
                "collisionWidthSourcePx": {
                  "type": "number"
                },
                "showTerrain": {
                  "type": "integer"
                },
                "pivotLeft": {
                  "type": "array",
                  "items": {
                    "type": "number"
                  }
                },
                "pivotRight": {
                  "type": "array",
                  "items": {
                    "type": "number"
                  }
                },
                "collisionPivotLeft": {
                  "type": "array",
                  "items": {
                    "type": "number"
                  }
                },
                "collisionPivotRight": {
                  "type": "array",
                  "items": {
                    "type": "number"
                  }
                }
              },
              "required": [
                "id",
                "sourcePath",
                "sha256",
                "propertiesSha256",
                "hasProperties",
                "sourceSizePx",
                "collision",
                "scale",
                "collisionWidthSourcePx",
                "showTerrain",
                "pivotLeft",
                "pivotRight",
                "collisionPivotLeft",
                "collisionPivotRight"
              ],
              "additionalProperties": false
            }
          },
          "definitions": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "integer"
                },
                "kind": {
                  "enum": [
                    "start",
                    "authored"
                  ]
                },
                "sourceLine": {
                  "type": "integer"
                },
                "objectId": {
                  "type": "integer"
                },
                "offsetX": {
                  "type": "number"
                },
                "offsetY": {
                  "type": "number"
                },
                "side": {
                  "type": "boolean"
                },
                "viewportYFactor": {
                  "type": "number"
                }
              },
              "required": [
                "id",
                "kind",
                "sourceLine",
                "objectId",
                "offsetX",
                "offsetY",
                "side",
                "viewportYFactor"
              ],
              "additionalProperties": false
            }
          },
          "placements": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "integer"
                },
                "segment": {
                  "type": "integer"
                },
                "slot": {
                  "type": "integer"
                },
                "definition": {
                  "type": "integer"
                }
              },
              "required": [
                "id",
                "segment",
                "slot",
                "definition"
              ],
              "additionalProperties": false
            }
          },
          "overwritten": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "segment": {
                  "type": "integer"
                },
                "slot": {
                  "type": "integer"
                },
                "previousDefinition": {
                  "type": "integer"
                },
                "definition": {
                  "type": "integer"
                }
              },
              "required": [
                "segment",
                "slot",
                "previousDefinition",
                "definition"
              ],
              "additionalProperties": false
            }
          },
          "candidatePlacements": {
            "type": "integer"
          },
          "maxWindowProps": {
            "type": "integer"
          },
          "objectOffsets": {
            "type": "array",
            "items": {
              "type": "integer"
            }
          },
          "segments": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "y0": {
                  "type": "number"
                },
                "y1": {
                  "type": "number"
                },
                "curve": {
                  "type": "number"
                },
                "gap": {
                  "type": "number"
                },
                "mirror": {
                  "type": "boolean"
                },
                "light": {
                  "type": "integer"
                }
              },
              "required": [
                "y0",
                "y1",
                "curve",
                "gap",
                "mirror",
                "light"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "id",
          "sourceCommit",
          "inputSha256",
          "sourceHashes",
          "profile",
          "forkGradient",
          "segmentLength",
          "playerOffsetZ",
          "cameraHeight",
          "referenceWidth",
          "authoredCount",
          "totalCount",
          "swapLine",
          "lastLine",
          "checkpointLine",
          "timeSeconds",
          "terrain",
          "roadTerrain",
          "links",
          "palette",
          "commands",
          "objects",
          "definitions",
          "placements",
          "overwritten",
          "candidatePlacements",
          "maxWindowProps",
          "objectOffsets",
          "segments"
        ],
        "additionalProperties": false
      },
      "package": "OutRun",
      "doc": "Immutable source-compatible Map1 geometry/provenance. Source PNG paths are provenance, not runtime art references (child40)."
    }
  ]
} as const;
registerSchema(schemaIr);

export interface Map01PreviewViews {
  enabled: Uint8Array;
  cameraOriginZ: Float32Array;
  lateral: Float32Array;
}
export interface Map01PreviewValue {
  enabled: boolean;
  cameraOriginZ: number;
  lateral: number;
}
/** Map01Preview (resource, presentation-only) */
export const Map01Preview = typeToken<Map01PreviewViews, Map01PreviewValue>('Map01Preview', 'resource', { sig: 'enabled:bool:1,cameraOriginZ:f32:1,lateral:f32:1', read: (v: Map01PreviewViews, i: number, o: Record<string, unknown>) => { o.enabled = v.enabled[i] !== 0; o.cameraOriginZ = v.cameraOriginZ[i]; o.lateral = v.lateral[i]; return o; } });

export interface Map01VisualCacheViews {
  cameraOriginZ: Float32Array;
  lateral: Float32Array;
  aspect: Float32Array;
}
export interface Map01VisualCacheValue {
  cameraOriginZ: number;
  lateral: number;
  aspect: number;
}
/** Map01VisualCache (resource, presentation-only) */
export const Map01VisualCache = typeToken<Map01VisualCacheViews, Map01VisualCacheValue>('Map01VisualCache', 'resource', { sig: 'cameraOriginZ:f32:1,lateral:f32:1,aspect:f32:1', read: (v: Map01VisualCacheViews, i: number, o: Record<string, unknown>) => { o.cameraOriginZ = v.cameraOriginZ[i]; o.lateral = v.lateral[i]; o.aspect = v.aspect[i]; return o; } });

export interface Map01VisualSlotViews {
  slot: Uint32Array;
}
export interface Map01VisualSlotValue {
  slot: number;
}
/** Map01VisualSlot (component, presentation-only) */
export const Map01VisualSlot = typeToken<Map01VisualSlotViews, Map01VisualSlotValue>('Map01VisualSlot', 'component', { sig: 'slot:u32:1', read: (v: Map01VisualSlotViews, i: number, o: Record<string, unknown>) => { o.slot = v.slot[i]; return o; } });

export interface CollisionDriverViews {
  mapId: Uint32Array;
  initialized: Uint8Array;
  motionValid: Uint8Array;
  motionStep: Uint32Array;
  locked: Uint8Array;
  acceptedCount: Uint32Array;
  z0: Float32Array;
  z1: Float32Array;
  l0: Float32Array;
  ls: Float32Array;
  lc: Float32Array;
  lr: Float32Array;
  lf: Float32Array;
  drift: Float32Array;
  previousGap: Float32Array;
  carryApplied: Uint8Array;
  handlingCap: Float32Array;
  ledgerCount: Uint32Array;
  ledgerKind: Uint32Array;
  ledgerId: Uint32Array;
  ledgerEpoch: Uint32Array;
  ledgerGeneration: Uint32Array;
}
export interface CollisionDriverValue {
  mapId: number;
  initialized: boolean;
  motionValid: boolean;
  motionStep: number;
  locked: boolean;
  acceptedCount: number;
  z0: number;
  z1: number;
  l0: number;
  ls: number;
  lc: number;
  lr: number;
  lf: number;
  drift: number;
  previousGap: number;
  carryApplied: boolean;
  handlingCap: number;
  ledgerCount: number;
  ledgerKind: number[];
  ledgerId: number[];
  ledgerEpoch: number[];
  ledgerGeneration: number[];
}
/** CollisionDriver (component, sim) */
export const CollisionDriver = typeToken<CollisionDriverViews, CollisionDriverValue>('CollisionDriver', 'component', { sig: 'mapId:u32:1,initialized:bool:1,motionValid:bool:1,motionStep:u32:1,locked:bool:1,acceptedCount:u32:1,z0:f32:1,z1:f32:1,l0:f32:1,ls:f32:1,lc:f32:1,lr:f32:1,lf:f32:1,drift:f32:1,previousGap:f32:1,carryApplied:bool:1,handlingCap:f32:1,ledgerCount:u32:1,ledgerKind:array:64,ledgerId:array:64,ledgerEpoch:array:64,ledgerGeneration:array:64', read: (v: CollisionDriverViews, i: number, o: Record<string, unknown>) => { o.mapId = v.mapId[i]; o.initialized = v.initialized[i] !== 0; o.motionValid = v.motionValid[i] !== 0; o.motionStep = v.motionStep[i]; o.locked = v.locked[i] !== 0; o.acceptedCount = v.acceptedCount[i]; o.z0 = v.z0[i]; o.z1 = v.z1[i]; o.l0 = v.l0[i]; o.ls = v.ls[i]; o.lc = v.lc[i]; o.lr = v.lr[i]; o.lf = v.lf[i]; o.drift = v.drift[i]; o.previousGap = v.previousGap[i]; o.carryApplied = v.carryApplied[i] !== 0; o.handlingCap = v.handlingCap[i]; o.ledgerCount = v.ledgerCount[i]; o.ledgerKind = $r.lanes(v.ledgerKind, i, 64, o.ledgerKind); o.ledgerId = $r.lanes(v.ledgerId, i, 64, o.ledgerId); o.ledgerEpoch = $r.lanes(v.ledgerEpoch, i, 64, o.ledgerEpoch); o.ledgerGeneration = $r.lanes(v.ledgerGeneration, i, 64, o.ledgerGeneration); return o; } });

export interface ContactAcceptedViews {
  kind: Uint32Array;
  mapId: Uint32Array;
  id: Uint32Array;
  epoch: Uint32Array;
  generation: Uint32Array;
  slot: Uint32Array;
  toi: Float32Array;
  stage: Uint32Array;
  playerX: Float32Array;
  playerZ: Float32Array;
  otherX: Float32Array;
  otherZ: Float32Array;
  impactSpeed: Float32Array;
  handlingCap: Float32Array;
  collisionDir: Float32Array;
  curve: Float32Array;
}
export interface ContactAcceptedValue {
  kind: number;
  mapId: number;
  id: number;
  epoch: number;
  generation: number;
  slot: number;
  toi: number;
  stage: number;
  playerX: number;
  playerZ: number;
  otherX: number;
  otherZ: number;
  impactSpeed: number;
  handlingCap: number;
  collisionDir: number;
  curve: number;
}
/** ContactAccepted (event, sim) */
export const ContactAccepted = typeToken<ContactAcceptedViews, ContactAcceptedValue>('ContactAccepted', 'event', { sig: 'kind:u32:1,mapId:u32:1,id:u32:1,epoch:u32:1,generation:u32:1,slot:u32:1,toi:f32:1,stage:u32:1,playerX:f32:1,playerZ:f32:1,otherX:f32:1,otherZ:f32:1,impactSpeed:f32:1,handlingCap:f32:1,collisionDir:f32:1,curve:f32:1', read: (v: ContactAcceptedViews, i: number, o: Record<string, unknown>) => { o.kind = v.kind[i]; o.mapId = v.mapId[i]; o.id = v.id[i]; o.epoch = v.epoch[i]; o.generation = v.generation[i]; o.slot = v.slot[i]; o.toi = v.toi[i]; o.stage = v.stage[i]; o.playerX = v.playerX[i]; o.playerZ = v.playerZ[i]; o.otherX = v.otherX[i]; o.otherZ = v.otherZ[i]; o.impactSpeed = v.impactSpeed[i]; o.handlingCap = v.handlingCap[i]; o.collisionDir = v.collisionDir[i]; o.curve = v.curve[i]; return o; } });

export interface CrashDriverViews {
  mapId: Uint32Array;
  phase: Uint32Array;
  consumedAcceptedCount: Uint32Array;
  pendingStep: Uint32Array;
  variant: Uint32Array;
  kind: Uint32Array;
  impactSpeed: Float32Array;
  handlingCap: Float32Array;
  collisionDir: Float32Array;
  curve: Float32Array;
  totalAdvances: Uint32Array;
  advances: Uint32Array;
  cadenceTick: Uint32Array;
  decrement: Float32Array;
  reactionTick: Uint32Array;
  recenterTarget: Float32Array;
}
export interface CrashDriverValue {
  mapId: number;
  phase: number;
  consumedAcceptedCount: number;
  pendingStep: number;
  variant: number;
  kind: number;
  impactSpeed: number;
  handlingCap: number;
  collisionDir: number;
  curve: number;
  totalAdvances: number;
  advances: number;
  cadenceTick: number;
  decrement: number;
  reactionTick: number;
  recenterTarget: number;
}
/** CrashDriver (component, sim) */
export const CrashDriver = typeToken<CrashDriverViews, CrashDriverValue>('CrashDriver', 'component', { sig: 'mapId:u32:1,phase:u32:1,consumedAcceptedCount:u32:1,pendingStep:u32:1,variant:u32:1,kind:u32:1,impactSpeed:f32:1,handlingCap:f32:1,collisionDir:f32:1,curve:f32:1,totalAdvances:u32:1,advances:u32:1,cadenceTick:u32:1,decrement:f32:1,reactionTick:u32:1,recenterTarget:f32:1', read: (v: CrashDriverViews, i: number, o: Record<string, unknown>) => { o.mapId = v.mapId[i]; o.phase = v.phase[i]; o.consumedAcceptedCount = v.consumedAcceptedCount[i]; o.pendingStep = v.pendingStep[i]; o.variant = v.variant[i]; o.kind = v.kind[i]; o.impactSpeed = v.impactSpeed[i]; o.handlingCap = v.handlingCap[i]; o.collisionDir = v.collisionDir[i]; o.curve = v.curve[i]; o.totalAdvances = v.totalAdvances[i]; o.advances = v.advances[i]; o.cadenceTick = v.cadenceTick[i]; o.decrement = v.decrement[i]; o.reactionTick = v.reactionTick[i]; o.recenterTarget = v.recenterTarget[i]; return o; } });

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

export interface Map01ArtPreviewViews {
  enabled: Uint8Array;
  playing: Uint8Array;
  followDriving: Uint8Array;
  cameraOriginZ: Float32Array;
  previousCameraOriginZ: Float32Array;
  lateral: Float32Array;
  speed: Float32Array;
  lastStep: Uint32Array;
  controlHeld: Uint32Array;
  lastCameraOriginZ: Float32Array;
  backOffset: Float32Array;
  frontOffset: Float32Array;
  previousBackOffset: Float32Array;
  previousFrontOffset: Float32Array;
  loaded: Uint8Array;
  reconciled: Uint8Array;
}
export interface Map01ArtPreviewValue {
  enabled: boolean;
  playing: boolean;
  followDriving: boolean;
  cameraOriginZ: number;
  previousCameraOriginZ: number;
  lateral: number;
  speed: number;
  lastStep: number;
  controlHeld: number;
  lastCameraOriginZ: number;
  backOffset: number;
  frontOffset: number;
  previousBackOffset: number;
  previousFrontOffset: number;
  loaded: boolean;
  reconciled: boolean;
}
/** Map01ArtPreview (resource, presentation-only) */
export const Map01ArtPreview = typeToken<Map01ArtPreviewViews, Map01ArtPreviewValue>('Map01ArtPreview', 'resource', { sig: 'enabled:bool:1,playing:bool:1,followDriving:bool:1,cameraOriginZ:f32:1,previousCameraOriginZ:f32:1,lateral:f32:1,speed:f32:1,lastStep:u32:1,controlHeld:u32:1,lastCameraOriginZ:f32:1,backOffset:f32:1,frontOffset:f32:1,previousBackOffset:f32:1,previousFrontOffset:f32:1,loaded:bool:1,reconciled:bool:1', read: (v: Map01ArtPreviewViews, i: number, o: Record<string, unknown>) => { o.enabled = v.enabled[i] !== 0; o.playing = v.playing[i] !== 0; o.followDriving = v.followDriving[i] !== 0; o.cameraOriginZ = v.cameraOriginZ[i]; o.previousCameraOriginZ = v.previousCameraOriginZ[i]; o.lateral = v.lateral[i]; o.speed = v.speed[i]; o.lastStep = v.lastStep[i]; o.controlHeld = v.controlHeld[i]; o.lastCameraOriginZ = v.lastCameraOriginZ[i]; o.backOffset = v.backOffset[i]; o.frontOffset = v.frontOffset[i]; o.previousBackOffset = v.previousBackOffset[i]; o.previousFrontOffset = v.previousFrontOffset[i]; o.loaded = v.loaded[i] !== 0; o.reconciled = v.reconciled[i] !== 0; return o; } });

export interface Map01ArtSlotViews {
  slot: Uint32Array;
}
export interface Map01ArtSlotValue {
  slot: number;
}
/** Map01ArtSlot (component, presentation-only) */
export const Map01ArtSlot = typeToken<Map01ArtSlotViews, Map01ArtSlotValue>('Map01ArtSlot', 'component', { sig: 'slot:u32:1', read: (v: Map01ArtSlotViews, i: number, o: Record<string, unknown>) => { o.slot = v.slot[i]; return o; } });

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

export interface TerrainDriverViews {
  mapId: Uint32Array;
  segment: Uint32Array;
  roadSide: Uint32Array;
  previousGap: Float32Array;
  initialized: Uint8Array;
  leftOutside: Uint8Array;
  rightOutside: Uint8Array;
  leftEffect: Uint32Array;
  rightEffect: Uint32Array;
  skidding: Uint8Array;
  recentering: Uint8Array;
  recenterTarget: Float32Array;
  sectionEnd: Uint8Array;
}
export interface TerrainDriverValue {
  mapId: number;
  segment: number;
  roadSide: number;
  previousGap: number;
  initialized: boolean;
  leftOutside: boolean;
  rightOutside: boolean;
  leftEffect: number;
  rightEffect: number;
  skidding: boolean;
  recentering: boolean;
  recenterTarget: number;
  sectionEnd: boolean;
}
/** TerrainDriver (component, sim) */
export const TerrainDriver = typeToken<TerrainDriverViews, TerrainDriverValue>('TerrainDriver', 'component', { sig: 'mapId:u32:1,segment:u32:1,roadSide:u32:1,previousGap:f32:1,initialized:bool:1,leftOutside:bool:1,rightOutside:bool:1,leftEffect:u32:1,rightEffect:u32:1,skidding:bool:1,recentering:bool:1,recenterTarget:f32:1,sectionEnd:bool:1', read: (v: TerrainDriverViews, i: number, o: Record<string, unknown>) => { o.mapId = v.mapId[i]; o.segment = v.segment[i]; o.roadSide = v.roadSide[i]; o.previousGap = v.previousGap[i]; o.initialized = v.initialized[i] !== 0; o.leftOutside = v.leftOutside[i] !== 0; o.rightOutside = v.rightOutside[i] !== 0; o.leftEffect = v.leftEffect[i]; o.rightEffect = v.rightEffect[i]; o.skidding = v.skidding[i] !== 0; o.recentering = v.recentering[i] !== 0; o.recenterTarget = v.recenterTarget[i]; o.sectionEnd = v.sectionEnd[i] !== 0; return o; } });

export interface TerrainVisualStateViews {
  lastStep: Uint32Array;
  animationTicks: Uint32Array;
}
export interface TerrainVisualStateValue {
  lastStep: number;
  animationTicks: number;
}
/** TerrainVisualState (component, presentation-only) */
export const TerrainVisualState = typeToken<TerrainVisualStateViews, TerrainVisualStateValue>('TerrainVisualState', 'component', { sig: 'lastStep:u32:1,animationTicks:u32:1', read: (v: TerrainVisualStateViews, i: number, o: Record<string, unknown>) => { o.lastStep = v.lastStep[i]; o.animationTicks = v.animationTicks[i]; return o; } });

export interface TrafficArtPreviewViews {
  mode: Uint32Array;
  frame: Uint32Array;
  caseId: Uint32Array;
}
export interface TrafficArtPreviewValue {
  mode: number;
  frame: number;
  caseId: number;
}
/** TrafficArtPreview (resource, presentation-only) */
export const TrafficArtPreview = typeToken<TrafficArtPreviewViews, TrafficArtPreviewValue>('TrafficArtPreview', 'resource', { sig: 'mode:u32:1,frame:u32:1,caseId:u32:1', read: (v: TrafficArtPreviewViews, i: number, o: Record<string, unknown>) => { o.mode = v.mode[i]; o.frame = v.frame[i]; o.caseId = v.caseId[i]; return o; } });

export interface TrafficArtResidencyViews {
  loaded: Uint8Array;
  reconciled: Uint8Array;
  catalogLoaded: Uint8Array;
  catalogReconciled: Uint8Array;
}
export interface TrafficArtResidencyValue {
  loaded: boolean;
  reconciled: boolean;
  catalogLoaded: boolean;
  catalogReconciled: boolean;
}
/** TrafficArtResidency (resource, presentation-only) */
export const TrafficArtResidency = typeToken<TrafficArtResidencyViews, TrafficArtResidencyValue>('TrafficArtResidency', 'resource', { sig: 'loaded:bool:1,reconciled:bool:1,catalogLoaded:bool:1,catalogReconciled:bool:1', read: (v: TrafficArtResidencyViews, i: number, o: Record<string, unknown>) => { o.loaded = v.loaded[i] !== 0; o.reconciled = v.reconciled[i] !== 0; o.catalogLoaded = v.catalogLoaded[i] !== 0; o.catalogReconciled = v.catalogReconciled[i] !== 0; return o; } });

export interface TrafficPassedViews {
  epoch: Uint32Array;
  slot: Uint32Array;
  generation: Uint32Array;
  points: Uint32Array;
}
export interface TrafficPassedValue {
  epoch: number;
  slot: number;
  generation: number;
  points: number;
}
/** TrafficPassed (event, sim) */
export const TrafficPassed = typeToken<TrafficPassedViews, TrafficPassedValue>('TrafficPassed', 'event', { sig: 'epoch:u32:1,slot:u32:1,generation:u32:1,points:u32:1', read: (v: TrafficPassedViews, i: number, o: Record<string, unknown>) => { o.epoch = v.epoch[i]; o.slot = v.slot[i]; o.generation = v.generation[i]; o.points = v.points[i]; return o; } });

export interface TrafficPoolViews {
  mapId: Uint32Array;
  initialized: Uint8Array;
  population: Uint32Array;
  seedLo: Uint32Array;
  seedHi: Uint32Array;
  originZ: Float32Array;
  aiCursor: Uint32Array;
  epoch: Uint32Array;
  z: Float32Array;
  previousZ: Float32Array;
  offset: Float32Array;
  previousOffset: Float32Array;
  speed: Float32Array;
  target: Float32Array;
  side: Uint32Array;
  ai: Uint32Array;
  active: Uint32Array;
  generation: Uint32Array;
  passed: Uint32Array;
  moving: Uint32Array;
  cooldown: Uint32Array;
  parked: Uint32Array;
  motionTicks: Uint32Array;
}
export interface TrafficPoolValue {
  mapId: number;
  initialized: boolean;
  population: number;
  seedLo: number;
  seedHi: number;
  originZ: number;
  aiCursor: number;
  epoch: number;
  z: number[];
  previousZ: number[];
  offset: number[];
  previousOffset: number[];
  speed: number[];
  target: number[];
  side: number[];
  ai: number[];
  active: number[];
  generation: number[];
  passed: number[];
  moving: number[];
  cooldown: number[];
  parked: number[];
  motionTicks: number[];
}
/** TrafficPool (component, sim) */
export const TrafficPool = typeToken<TrafficPoolViews, TrafficPoolValue>('TrafficPool', 'component', { sig: 'mapId:u32:1,initialized:bool:1,population:u32:1,seedLo:u32:1,seedHi:u32:1,originZ:f32:1,aiCursor:u32:1,epoch:u32:1,z:array:32,previousZ:array:32,offset:array:32,previousOffset:array:32,speed:array:32,target:array:32,side:array:32,ai:array:32,active:array:32,generation:array:32,passed:array:32,moving:array:32,cooldown:array:32,parked:array:32,motionTicks:array:32', read: (v: TrafficPoolViews, i: number, o: Record<string, unknown>) => { o.mapId = v.mapId[i]; o.initialized = v.initialized[i] !== 0; o.population = v.population[i]; o.seedLo = v.seedLo[i]; o.seedHi = v.seedHi[i]; o.originZ = v.originZ[i]; o.aiCursor = v.aiCursor[i]; o.epoch = v.epoch[i]; o.z = $r.lanes(v.z, i, 32, o.z); o.previousZ = $r.lanes(v.previousZ, i, 32, o.previousZ); o.offset = $r.lanes(v.offset, i, 32, o.offset); o.previousOffset = $r.lanes(v.previousOffset, i, 32, o.previousOffset); o.speed = $r.lanes(v.speed, i, 32, o.speed); o.target = $r.lanes(v.target, i, 32, o.target); o.side = $r.lanes(v.side, i, 32, o.side); o.ai = $r.lanes(v.ai, i, 32, o.ai); o.active = $r.lanes(v.active, i, 32, o.active); o.generation = $r.lanes(v.generation, i, 32, o.generation); o.passed = $r.lanes(v.passed, i, 32, o.passed); o.moving = $r.lanes(v.moving, i, 32, o.moving); o.cooldown = $r.lanes(v.cooldown, i, 32, o.cooldown); o.parked = $r.lanes(v.parked, i, 32, o.parked); o.motionTicks = $r.lanes(v.motionTicks, i, 32, o.motionTicks); return o; } });

export interface TrafficRebaseRequestedViews {
  mapId: Uint32Array;
  shift: Float32Array;
}
export interface TrafficRebaseRequestedValue {
  mapId: number;
  shift: number;
}
/** TrafficRebaseRequested (event, sim) */
export const TrafficRebaseRequested = typeToken<TrafficRebaseRequestedViews, TrafficRebaseRequestedValue>('TrafficRebaseRequested', 'event', { sig: 'mapId:u32:1,shift:f32:1', read: (v: TrafficRebaseRequestedViews, i: number, o: Record<string, unknown>) => { o.mapId = v.mapId[i]; o.shift = v.shift[i]; return o; } });

export interface TrafficResetRequestedViews {
  mapId: Uint32Array;
  population: Uint32Array;
  seedLo: Uint32Array;
  seedHi: Uint32Array;
  originZ: Float32Array;
}
export interface TrafficResetRequestedValue {
  mapId: number;
  population: number;
  seedLo: number;
  seedHi: number;
  originZ: number;
}
/** TrafficResetRequested (event, sim) */
export const TrafficResetRequested = typeToken<TrafficResetRequestedViews, TrafficResetRequestedValue>('TrafficResetRequested', 'event', { sig: 'mapId:u32:1,population:u32:1,seedLo:u32:1,seedHi:u32:1,originZ:f32:1', read: (v: TrafficResetRequestedViews, i: number, o: Record<string, unknown>) => { o.mapId = v.mapId[i]; o.population = v.population[i]; o.seedLo = v.seedLo[i]; o.seedHi = v.seedHi[i]; o.originZ = v.originZ[i]; return o; } });

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
  useWheelEffects: Uint8Array;
  leftEffect: Uint32Array;
  rightEffect: Uint32Array;
  hidden: Uint8Array;
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
  useWheelEffects: boolean;
  leftEffect: number;
  rightEffect: number;
  hidden: boolean;
}
/** VehiclePreview (resource, presentation-only) */
export const VehiclePreview = typeToken<VehiclePreviewViews, VehiclePreviewValue>('VehiclePreview', 'resource', { sig: 'enabled:bool:1,pose:u32:1,sample:u32:1,effect:u32:1,scale:f32:1,placeholder:bool:1,autoplay:bool:1,loaded:bool:1,reconciled:bool:1,useWheelEffects:bool:1,leftEffect:u32:1,rightEffect:u32:1,hidden:bool:1', read: (v: VehiclePreviewViews, i: number, o: Record<string, unknown>) => { o.enabled = v.enabled[i] !== 0; o.pose = v.pose[i]; o.sample = v.sample[i]; o.effect = v.effect[i]; o.scale = v.scale[i]; o.placeholder = v.placeholder[i] !== 0; o.autoplay = v.autoplay[i] !== 0; o.loaded = v.loaded[i] !== 0; o.reconciled = v.reconciled[i] !== 0; o.useWheelEffects = v.useWheelEffects[i] !== 0; o.leftEffect = v.leftEffect[i]; o.rightEffect = v.rightEffect[i]; o.hidden = v.hidden[i] !== 0; return o; } });

export interface VehicleVisualSlotViews {
  slot: Uint32Array;
}
export interface VehicleVisualSlotValue {
  slot: number;
}
/** VehicleVisualSlot (component, presentation-only) */
export const VehicleVisualSlot = typeToken<VehicleVisualSlotViews, VehicleVisualSlotValue>('VehicleVisualSlot', 'component', { sig: 'slot:u32:1', read: (v: VehicleVisualSlotViews, i: number, o: Record<string, unknown>) => { o.slot = v.slot[i]; return o; } });

/** Immutable source-compatible Map1 geometry/provenance. Source PNG paths are provenance, not runtime art references (child40). */
export type SourceBiomeData = {
  id: number;
  sourceCommit: string;
  inputSha256: string;
  sourceHashes: Record<string, string>;
  profile: "sourceCompatibility-original";
  forkGradient: number;
  segmentLength: number;
  playerOffsetZ: number;
  cameraHeight: number;
  referenceWidth: number;
  authoredCount: number;
  totalCount: number;
  swapLine: number;
  lastLine: number;
  checkpointLine: number;
  timeSeconds: number;
  terrain: number;
  roadTerrain: number;
  links: {
    left: number;
    right: number;
    sequential: number;
  };
  palette: number[][];
  commands: {
    sourceLine: number;
    command: string;
    arguments: number[];
    firstSegment: number;
    count: number;
    effective: number[];
  }[];
  objects: {
    id: number;
    sourcePath: string;
    sha256: string;
    propertiesSha256: string;
    hasProperties: boolean;
    sourceSizePx: number[];
    collision: boolean;
    scale: number;
    collisionWidthSourcePx: number;
    showTerrain: number;
    pivotLeft: number[];
    pivotRight: number[];
    collisionPivotLeft: number[];
    collisionPivotRight: number[];
  }[];
  definitions: {
    id: number;
    kind: "start" | "authored";
    sourceLine: number;
    objectId: number;
    offsetX: number;
    offsetY: number;
    side: boolean;
    viewportYFactor: number;
  }[];
  placements: {
    id: number;
    segment: number;
    slot: number;
    definition: number;
  }[];
  overwritten: {
    segment: number;
    slot: number;
    previousDefinition: number;
    definition: number;
  }[];
  candidatePlacements: number;
  maxWindowProps: number;
  objectOffsets: number[];
  segments: {
    y0: number;
    y1: number;
    curve: number;
    gap: number;
    mirror: boolean;
    light: number;
  }[];
};
/** A loaded SourceBiome as `loadData` returns it (frozen). */
export type ReadonlySourceBiomeData = DataRecord<SourceBiomeData>;
export const SourceBiome = dataToken<SourceBiomeData>('SourceBiome');
