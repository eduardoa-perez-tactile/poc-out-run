# Source-track terrain handling — ticket #12

This opt-in proof adds road-space wheel contact, terrain coasting, centrifugal drift,
skidding and stopped-off-road recentering to the #11 driving model. Reference source:
`6882721c99bc79365f815f68d389bf5078129e68`, `Map.cpp:236–321,750–860`,
`PlayerCar.cpp:464–650,712–739,1459–1530`, and `Globals.h:61–62`.
These are code/formula references; no original gameplay timing or pixel equality is claimed.

Use `scenes/driving-terrain.scene.json` for the source-driving proof. It starts on a Map1
curve at camera-origin distance300000, legacy speed100 and high gear, with the existing
keyboard/touch controls. It is a handling demonstration, not a race start or route system.
The older driving proof retains its original synthetic length and behavior.

## Coordinate and contact contract

Lateral position is normalized against1600 road units. Individual wheels are at
`lateral*1600 ±210`, independently of the provisional vehicle collision footprint or image
dimensions. A wheel is on-road when it belongs to either inclusive interval
`[-1831,1831]` or `[gap-1831,gap+1831]`. At gap0, x1.0 is inside, x1.1 has only the right
wheel outside and x1.3 has both outside. The central gap is open only when gap>3662;
touching either edge still counts as contact. This contact boundary includes the source's
extra road margin and is not reconstructed from projected asphalt or pixels.

The player samples the immutable cooked SourceBiome at camera-origin+702. Curve, gap and
mirror are logical segment data; cumulative visual curvature never moves a collider.
Nearest logical carriageway center determines side, with an exact tie choosing left.
The previous side/gap determines one right-carriageway carry before the side is refreshed.

Geometric contact is computed even at rest and before the same step's pedal decision.
These deliberately replace the source's speed-gated flags and previous-frame contact lag.
In the source, hidden recentering skips wheel updates, so the port does not claim a proven
one-step recenter stall. Its explicit phase removes the source's reliance on hidden/stale
wheel state and also handles a stationary outside spawn consistently.

## Speed, drift and bounds

Rates and #11 priorities stay unchanged: acceleration100/6.5 per second, braking50 per
second, coast0.75×acceleration, brake priority and the documented gear eligibility rules.
Either outside wheel blocks throttle acceleration, causing coast even below75. There is
no immediate clamp or acceleration toward75, and sand/grass/snow/mud have the same source
coasting rate. Terrain IDs1..4 select effects2..5; terrain0 can still be physically outside
without an effect. Nonzero on-road terrain changes feedback without an off-road penalty.

The handling denominator is75 only when an outside wheel has a supported terrain effect;
otherwise it is the pre-control gear cap100/200. Capturing the cap before an upshift keeps
the source's upshift-step drift ordering. Drift begins at legacy speed>=30.5:

```
coefficient = speed < 100 ? 0.5 : (speed-50)/90
delta       = curve * min(speed/handlingCap,1) * coefficient * dt
```

Left and nonmirrored right roads subtract delta. Mirrored right roads add delta. A selected
right road also adds `(newGap-previousGap)/1600`, once, inside that same30.5 speed gate.
Below it the source does not carry the car with the expanding carriageway. All outputs use
explicit f32 arithmetic at fixed steps; legacy speed becomes world distance using `speed*60*dt`.
Non-exact source float literals are rounded before use, including 0.8f in the skid
threshold and 1.73f in the right inner-road snap. Exact boundary fixtures use extracted
C++ arithmetic, separately from gameplay observations or port screenshot approvals.

The existing port's outer clamp correction remains, extended to
`[-1.5,1.5+gap/1600]`; it does not restore the source's ±1.48 snap. The separate source
mirrored inner-gap rule remains: when gap/1600>3.5 and1.75<x<gap/1600-1.75, snap toward the
selected side to1.73 or gap/1600-1.73. This rule does not guarantee both wheels are on-road.

This bounded proof stops at `lastLine*segmentLength` (Map1:882450), setting speed0,
playing=false and sectionEnd=true. It does not wrap180000, silently run beyond the visible
source data, award a finish bonus or choose a route. Recorded driving reset clears the
section-end latch; map/route progression belongs to #15/#16.

## Skid, recenter and presentation

Skid requires both wheels on-road, speed>70, absolute curve>=2.75 and absolute steering
>=speed*dt*0.8. It is recomputed every active step, clearing stale skid state. Outside
terrain takes priority for an outside wheel; on-road skid/brake/low-speed boot smoke can
override on-road terrain feedback. Source gear-change smoke latches and SHOW_TERRAIN
sprite overlap are not new friction rules and are not added by this handling slice.

A stopped outside car latches recentering toward the nearest logical center. It moves at
0.72 normalized units/second (0.012 per nominal60Hz update), checks tolerance0.05 before
moving, and reveals on the following completion check. It need not end exactly at center.
Pedal/steering movement and forward distance are locked during the phase. Pause freezes it.
Crash reaction timing/recovery and Survival outcomes remain #14/#16.

The scene-owned sim TerrainDriver contains contact, side, previous gap, skid, recenter and
section-end state. No asset readiness, camera size, presentation transport or animation
completion participates in those decisions. Per-wheel imported effects and car visibility
read this state; hiding during recenter preserves the selected-car resource ownership.
The renderer may interpolate previous/current driving samples, but cannot advance them.

## Verification

During edits run `npm run test:focus -- "terrain.*"`. Focused fixtures cover individual and
split-road wheels, exact boundaries, all terrain IDs, coasting/gear priorities, drift
thresholds/mirror/carry, bounds, skid clearing, recenter, pause and the bounded endpoint.
Actual scene tests exercise recorded reset beyond the old length and viewport-independent
outcomes. The default `advanceDriving` path keeps its original clamp arithmetic; existing
canonical tapes must verify without rehashing when the optional driver is absent.

Handoff requires the full PR gate, native/wasm and cooked parity, focused T1 feedback at
landscape sizes and a short native/background-browser curve and edge drive. Screenshot
goldens, phone-low residency and actual timings need coordinator validation; this document
does not mark them as passed. Physical-phone testing is excluded.

## Focused profiling and iteration evidence

The canonical `terrain.profile recorded source drive skid edge pause and recenter` starts
from the configured project scene and records EnterScene, keyboard throttle/steer, pause,
resume and a stopped outside reset. Its 168 steps observe skid, terrain feedback, hidden
recenter and restored geometry. Reproduce from `outrun/` with:

```sh
gameengine test --tier t1 --js v8 --filter "terrain.profile*" --jobs 1 --gpu-tier mobile --json
gameengine test --tier t1 --js v8 --filter "terrain.profile*" --jobs 1 --gpu-tier mobile --cooked --json
gameengine test --tier t1 --js v8 --filter "terrain.view recorded reset*" --jobs 1 --gpu-tier mobile --json
```

The local full T1 run passed 134 tests and all seven structural budgets. The terrain tape
reported a 10-draw peak, zero pipelines created during play, zero GC pauses over 4 ms and
17.10 MiB JS allocation. The sampled draw counts were 8 while driving, 10 with the pause
overlay, briefly 9 after resume/while hidden, then 8 restored. These are scenario counters;
JS allocation is neither peak heap nor hardware memory. The focused T1 test body's own
instrumentation has a different allocation cost from the replay-backed budget scenario.

One complete map/car build submits 453,420 raw typed-array bytes (452,760 map + 660 car);
the native dynamic meshes retain 478,152 CPU bytes, with a separate GPU copy. Those values
do not measure hardware memory or GPU bandwidth. Selected-group texture accounting was:

| Path | Map1 charge | Car charge | Whole-session texture charge |
|---|---:|---:|---:|
| Loose | 10,485,864 B | 5,592,420 B | 16,758,436 B |
| Cooked | 7,864,400 B | 4,194,320 B | 12,738,872 B |

The loose loader retains generated mip chains; cooked textures keep the authored base
level. Both groups remain pinned through recenter and satisfy the phone-low test bounds.
Recorded reset also resets presentation animation phase: a regression compares selected
source-frame hashes and actual car-region pixels after identical resets separated by
17 extra frames, without allowing asset-loading time to choose another animation frame.

A native iteration probe explicitly used the public `script.reloadBundle` operation;
plain CLI save/rebuild was not counted as an implicit reload. Only TerrainPresentation
changed, in 6.977 ms, while the paused step21/hash `f4ed4192d5c80b31` stayed unchanged.
Two subsequent recorded resets produced the same sample1 and driving state. Reproduce by
retaining old/new compiled bundles locally, applying that operation to an owned paused
session, comparing world hashes, then issuing the same recorded reset after different waits.

Local evidence is in `/tmp/outrun-terrain12-all-tiers-profile.json`,
`/tmp/outrun-terrain12-profile-cooked.json` and
`/tmp/outrun-terrain12-explicit-reload-proof.json`. These focused results do not replace
the full PR gate, targeted native/background-browser drive or required GitHub CI. The PR
records their final exact-head evidence and results.
