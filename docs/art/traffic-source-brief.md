# Traffic source import brief — ticket #54

Import the complete original 32 traffic models × 16 frames from source commit
`6882721c99bc79365f815f68d389bf5078129e68`,
`Resources/Vehicles/TrafficCars/Car1/c1.png` through `Car32/c16.png`, and each
`CarN.txt` SCALE property. Match the [vehicle reference board](references/vehicles.png)
and [vehicle guide](vehicles-animation.md): varied rear-view car/truck/bus silhouettes,
crisp painted clusters, dark tires/undersides and original paint/glass/light ramps.
This is a byte-preserving import, with no recoloring or generated replacement frames.

Keep each full unequal source canvas and its transparency. Ground contact is the declared
bottom-center source boundary `[width/2,height]`; no trimming, rotation, resampling or shared
canvas stretching. Source SCALE is0.9 for models1/7/13/19/25 and1.3 for the others; keep it
separate from pixel dimensions and road projection. Image masks/dimensions never create a
simulation collider. All eight source pose pairs are required for every model:

| Pose | Source TURNRIGHT | Source TURNLEFT |
|---|---|---|
| Flat close | c1–c2 | c3–c4 |
| Uphill | c5–c6 | c7–c8 |
| Downhill | c9–c10 | c11–c12 |
| Flat far | c13–c14 | c15–c16 |

Keep raw PNGs and SCALE files under `outrun/art/vehicles/traffic/carNN/`, outside runtime
assets. Runtime uses one1024×2048 RGBA atlas, deterministic height/width/model/frame shelf
packing and two extruded texels per edge; no padding baked into source rectangles. Base
RGBA arithmetic is8MiB before mips/copies; engine residency is measured separately. Export
an ID-ordered typed catalog with source hashes, canvas/ground anchor, atlas rectangles and
an actually opaque texel probe. Runtime group is `traffic-source`; point sampling is a
candidate pending moving near/mid/far comparison, not an approved global filtering rule.

Import checks validate all512 original byte hashes, SCALE hashes, dimensions, alpha,
source-frame/model identity, complete pixel preservation, nonoverlap and extrusion, plus
repeatable atlas/catalog generation and malformed input rejection using Python stdlib.
Engine metadata/cook/group membership and phase/projection/painter behavior belong to
coordinator/renderer integration. Native and background browser reviews must assess both
frames across pose pairs, representative all32-model silhouettes/palettes, hill clipping,
close overtakes and mobile-size distant readability over light/dark terrain. No engine,
visual approval, hardware memory/performance or physical-phone result is claimed by this brief.

Reproduce from repository root:

```sh
python3 scripts/art/import-traffic.py --source /path/to/clean/pinned/OutRun --write
python3 scripts/art/import-traffic.py --source /path/to/clean/pinned/OutRun
python3 scripts/art/import-traffic.py --committed
python3 -m unittest discover -s scripts/art -p 'test_import_traffic.py'
node --test scripts/traffic-art.test.mjs
```
