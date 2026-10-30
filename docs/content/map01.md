# Map1 source-compatible data — ticket39

This child compiles Map1 geometry and object metadata into the engine's typed `SourceBiome`
data asset. Source cutout/panorama imports are child40. Diagnostic foot markers are deliberately
not approved production art or sprite-occlusion oracles. No campaign decisions, goal expansion, traffic or collisions are
implemented here. The synthetic road/hill/fork fixtures and DrivingState's existing180000-unit
loop remain unchanged.

## Source and reproduction

The source revision is `6882721c99bc79365f815f68d389bf5078129e68`. The compiler records hashes
of map.txt, the five implementation files defining expansion/start placement, every source
PNG and each optional object-property file. `--source` rejects a different HEAD and any tracked
Resources/src edits before reading inputs. It imports no PNGs, README or legal files.

```sh
python3 scripts/content/convert-map.py --source /path/to/clean/pinned/OutRun --fork-gradient 0
# Intentional regeneration after reviewing source/contract changes:
python3 scripts/content/convert-map.py --source /path/to/clean/pinned/OutRun --fork-gradient 0 --write
# Repository-only CI/reproduction; no upstream checkout required:
python3 scripts/content/convert-map.py --fixture scripts/content/fixtures/map01-source.json --fork-gradient 0
npm run test:harness
npm run test:focus -- "content.*"
```

The committed source fixture contains map text, source dimensions/hashes, optional properties
and the extracted start-placement recipe, so normal CI needs only Python stdlib. The canonical
profile is Original with explicit fork gradient0. `-1`/`1` can be generated explicitly, but no
ambient random_device sequence is reproduced. Output bytes are deterministic and verified in
CI. The runtime JSON is under4 MB and uses the engine's immutable `loadData` path; its cooked
content hash participates in engine replay content identity. Source image paths are provenance
strings, not missing runtime texture references.

## Exact boundaries and parser compatibility

Map1 has4123 authored segments and1960 appended Original segments:6083 total, each150 source
units. `swapLine=4284`, `lastLine=5883`, left link2/right link3/sequential link2. There is no
authored checkpoint (`checkpointLine=-1` is the converted absence marker). Metadata preserves
TIME160, terrain1, road terrain0 and all11 RGBA palette values.

Curve hold is multiplied by its factor. Hill-straight also multiplies hold; hill-left/right
preserve the source bug using enter as effective leave. Elevation samples n/total, chains from
the previous actual final height, and slope multiplies150. Gap increment is truncated toward
zero **before each addition**, including negative transitions. Entry/hold/leave zero-length
phases are supported; empty relief and a first mirrored command fail instead of invoking an
invalid source array/division. No malformed values are clamped or silently skipped.

The45 shared MapStartGoal objects precede26 Map1 objects: source ID46 means Map1/1.png, and71
means Map1/26.png. Missing property files use source defaults; authored collision widths and
collision pivots remain independent of texture packing. Visual pivot follows offsetX sign;
`side` independently chooses the left/right road. GROUP ranges end exclusively and require
absolute segment index modulo frequency, not an iteration counter. Slot order is far-left,
near-left, center, far-right, near-right.

Authored calls produce2322 candidates and1457 final segment/slot winners. The19 start calls
produce18 winners: `Logger.cpp:1392` puts woman4 at308/NEAR_RIGHT, then `:1397` overwrites that
slot with cameramanRight. The compiler retains both definitions and overwrite provenance.
Combined totals are2341 candidates,866 overwrites and1475 final slots. It never invents a1476th
slot. The largest200-segment window contains138 slots;256 fixed diagnostic quads suffice.
Compiled prefix offsets select a window without scanning/sorting the whole placement catalog.

## Coordinates and source projection

Distances entering the adapter are **camera-origin Z**, matching DrivingState.distance. The
player sample is camera-origin+702 (`int(800*CAMERA_DISTANCE)+241`). Camera Y is the immutable
terrain height at that ahead player sample, truncated toward zero to match the source's
integer player Y (`Map.cpp:583/810`), plus800. The separate terrain height retains its fraction.
`CAMERA_DISTANCE≈0.57735` is projection
math; source Input.camD0.83/0.84 is a separate screen placement value.

Logical road centers remain left0/right gap for future contact logic. Canonical per-segment gap
is retained. Source `Map.cpp:944–960` nevertheless renders every visible upper-road point using
**the player's current gap** (`mapDistance`); each visible segment's mirror flag decides the
sign of its cumulative curve offset. The source adapter preserves that distinction. Curve
projection offsets do not modify logical wheel/contact positions. Source light=true selects
palette1; false selects palette2. Old synthetic shade fixtures remain untouched.

Immutable data retains every full source image dimension, authored scale, visual and collision
pivot. Diagnostic foot markers use the actual source contact anchor but cap only their drawn
size at8×40 pixels (amber for collidable, cyan for decorative); they do not imitate alpha
silhouettes or establish actual sprite crest occlusion. Child40 projects full textured quads. A
viewport-scaled start-flag Y expression is recorded against the source reference width921;
no developer-screen resolution is baked into canonical geometry. Proper crest clipping reuses
the existing shared fraction calculation. No source texture/UV-art approval is claimed.

## Numeric reference and review

`numeric-oracle.cpp` is an extracted arithmetic diagnostic, **not an original gameplay run**:

```sh
clang++ -std=c++17 -O0 -ffp-contract=off scripts/content/numeric-oracle.cpp -o /tmp/map01-numeric-oracle
python3 scripts/content/check-numeric-oracle.py --binary /tmp/map01-numeric-oracle
```

On the measured host,6078/6083 rows are bit-exact. Four height rows differ by at most
0.00048828125 due to libm cosf vs Python cos rounded to float32; one curve at segment884 differs
by exactly one float32 ULP (5.960464477539063e-8). Only the specifically recorded height fields
have a0.001 source-oracle tolerance, and only884's curve permits one ULP. Tests reject two ULPs,
excess height error and changes elsewhere. Canonical JSON equality, counts/gaps/provenance,
runtime/native/web state and replay hashes remain strict.

Use `scenes/map01-data.scene.json` for review. Keys7/8/9/0 select start, first hill, dense props
and fork views. These presentation-only controls do not move the car or decide routes.
The `map01.json` structural scenario starts the configured default scene, records `EnterScene`
for this review scene, then records Digit9 and120 subsequent steps. Its matching dense T1 test
asserts the selected camera sample and nonempty projected road/props. The presentation rebuilds
and uploads both bounded meshes every frame, so this measures active builder/upload cost with
a static dense camera; it does not establish driving, scrolling-art or phone frame-time cost.
The scene's single `Map01VisualSlot` owns those meshes. Disabling the preview or losing the
slot destroys both; scene exit also disables selectors even though resources survive
`EnterScene`. Actual scene exit/reentry tests cover road and driving destinations.
Before integration run the selected PR gate, cooked content tests, both T1 tiers and targeted
actual-browser landscape checks. Physical-phone testing is excluded. Source-code/PNG oracles
and approved port goldens are the available references; no original-game screenshot equality
is claimed.
