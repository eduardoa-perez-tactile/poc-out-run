# Destination environment delivery

This guide covers the existing-source Map2–15 and goal 16 art cohort on Game Engine 0.1.21.
Read the [destination brief](briefs/destination-environments.md), [environment style guide](environments.md),
[art direction](art-direction.md) and [asset delivery rules](asset-delivery.md) first. Source revision
is `6882721c99bc79365f815f68d389bf5078129e68`; the reference boards and immutable biome data
retain the real palettes. This pipeline imports existing artwork; it does not create illustrations.

## Source and manifests

The complete cohort contains **627 local object records, 30 panoramas and 19 prop pages**.
Local IDs resolve within their biome, never against another biome's ID or a placement index.
Typed `EnvironmentArtManifest` records original source paths/SHA256s/canvases, runtime page
and rectangle, and a real source-pixel probe. Geometry, scale, visual pivots, collision widths,
collision pivots and terrain remain authoritative in `SourceBiome`, not duplicated in art metadata.

Preserve full source PNG bytes and decoded RGBA, including transparent padding. Original inputs
live under assets/art and are excluded from runtime texture discovery. Goal shares 45 original
paths with Map1 metadata; 18 reuse already-imported originals by sourcePath+SHA. Its independently
packed pages do not require pinning Map1's atlas. Raw-file reuse and duplicated packed texel
charges are different facts. Keep old Map1 art, pools, materials, streams, goldens and replay bytes
unchanged; the generic destination renderer is a separate path.

Packing is deterministic height-descending, width-descending, then local-ID shelves, at most
two pages/family, each at most 1024×1280. Preserve the complete canvas with 2 px edge extrusion
on all sides, no trim/rotation/rescaling/recoloring, and transparent unused page regions. NPOT
page heights stop at the final extrusion; Maps5/6/10/15 need two pages. Keep standalone original
panorama bytes: ordinary back/front 1536×256/2048×256, goal back **2182×256**, goal front 2048×256.
The goal back texture's metadata uses `max_size=4096` so a default 2048 import limit cannot downscale
its real columns. Metadata and actual cooked dimensions both need validation.

The maximum 1024×1280 RGBA base is 5242880 bytes; a complete loose mip chain is 6990500 bytes.
These are arithmetic, not proof of actual charges or upload admission. Authored no-mip settings
do not justify assuming loose/native mip allocation is absent. Verify the actual native and cooked
counter values. No texture may starve behind recurring mesh uploads at the 8 MiB admission limit;
do not suspend normal uploads, drop source pixels or raise global caps merely to force readiness.

## Projection, sampling and order

The generic compositor has 1032 fixed quads: a 1000-placement source window plus 32 controlled
traffic slots. Map4's real dense window queries 1000 records; near-player exclusion leaves 980
source-eligible at an integer camera row or 975 at the tested fractional row. Positive projection,
crest clipping, offscreen culling and emitted counts are separate observations. Do not claim that
1000 props appear on screen, or raise the legacy Map1 capacity 256 to reuse its old path.

One indexed mesh preserves far-to-near rows, each row's source-slot props, then stable-slot
traffic. UV1.x is constant across a quad: 0=page0, 1=page1, 2=traffic. A three-binding material samples
only that texture. Sorting entire pages into separate passes would break alpha/painter order.
Unused page1 can alias page0 only without an extra underlying texture charge/pin. Controlled
traffic is an explicit art fixture, not a destination TrafficPool or a claim of live AI/racing.

Props and panoramas use linear sampling at explicit LOD0; traffic retains its reviewed source-point
policy. This follows the existing presentation choice, not a claim that all upstream SFML filtering
was linear. Review new categories near/mid/far and in motion for pixel clusters, alpha edges,
atlas bleed and source seams; sampled static frames alone are not temporal-quality evidence.
Panoramas wrap U and clamp V at source texel centers, sample the top 253 source rows at reference
height 720 and contact the actual road crest. Preserve the goal's actual NPOT width and source
seam imperfections. The pinned 30 panoramas' first six rows are alpha 0; transparent RGB is white
except goal back's black. First-covered-row tests compare each map's own sky, never a universal blue,
and remain separate from positive opaque source-pixel proof that the image really rendered.

For accounting, a normal five-mesh projection submits 656724 raw typed-array bytes if each fixed
array is submitted once. Current layout arithmetic/native mesh inspection gives 690744 bytes of
owned CPU mesh storage (road 417600, compositor 272448, two panoramas 232 each, sky 232).
Extra render callbacks/submissions are counted separately. Neither number is measured GPU
bandwidth, hardware GPU memory, JS heap or phone RSS; collect actual candidate counters in the PR.

The destination canonical replay has a separate active structural budget,
`tests/budgets/destination-environment.json`. Its strict 388-step diagnostic captured 388 positive
GPU requests per tier: cumulative JS allocation 257.6 MiB mobile / 258.3 MiB compat, six peak draws
and zero reported GC pauses over 4 ms. The 288 MiB allocation limit gives about 11.5% headroom above
the larger measured total. This is allocated-over-capture work, including protocol/presentation
capture overhead, not retained JS heap, production allocation per frame or phone memory.
The remaining limits are six draws, zero new pipelines and zero GC pauses over 4 ms. Diagnostics
observed three missing-warmup pipelines: the final requirement stays **zero**, with no allowance
for those misses. Pipeline warmup and final strict reruns must pass before budget acceptance.

## Loading and review ownership

The full data catalog exceeds the native 4 MiB automatic raw-preload cap. Game-entry boot explicitly
primes only Map1/catalog. A destination owner requests its explicit data group, waits for real IO
progress 1 with empty failed[], then primes public data access outside SIM. Never read an unprimed
map in SIM or hide synchronous frame IO in LateUpdate. Art IO readiness and fresh settled
RenderStatus frames are distinct from actual GPU texture/binding/draw/source-pixel proof.

One review owner acquires/reconciles/releases only its own data/art/shared pins, including pending
selection, scene reentry and HMR. Preserve boot Map1/catalog and other owners' references.
Loaded groups are active pins; released groups may retain a cache until pressure evicts them.
The configured desktop phone-low texture cache budget is 120 MiB (125829120 bytes), matching
the design target; it was lowered rather than increasing a budget or dropping content. Verify
actual public class budgets and bounded outgoing+incoming overlap. Native T1 can report a zero
raw-data counter: that does not establish zero retained raw data or decoded JS heap. Separate
native protocol observations, public record identity, package bytes and GPU/native book charges;
none implies deferred web download, hardware phone performance or thermals.

The nondefault destination-review scene isolates legacy proof/driving simulation. Keyboard 2/3/4/0/G
selects Maps2/3/4/10/goal; C selects object controls, V panorama controls and R projection. Review
input is captured in a scene-owned SIMTRUE tag at fixed steps: held edges and monotonic map/mode
revisions survive multiple simulation steps before rendering. Map selection resets mode; a later
mode command wins without inventing a map selection. A SIMFALSE residency cursor consumes each
revision once by tag entity index/generation; it is never scene-authored, so stale acquired pins or
versions are not reset by a resource row. Scene reentry gets a fresh tag and authored review state.
This transport does not write actors/RNG or create route/checkpoint/goal-arrival outcomes.

## Iteration and handoff

Run from the repository root. Normal committed reconstruction needs Python stdlib, not an upstream
checkout or Pillow. Source mode requires the clean pinned checkout. The coordinator owns runtime
asset writes, engine-created sidecars, shared groups/scenes/materials, engine serialization and Git.

```sh
# Inspect source inventory/packing without writing assets.
python3 scripts/art/import-environments.py --source /path/to/clean/OutRun --maps 2,10 --inventory
# Verify selected committed manifests/pages/originals.
python3 scripts/art/import-environments.py --committed --maps 2,10
# Explicit reviewed regeneration, followed by official metadata/gen/cook checks.
python3 scripts/art/import-environments.py --source /path/to/clean/OutRun --maps 2,10 --write
# Fast focused geometry/input work; select a narrower glob while editing.
npm run test:focus -- 'environment.geometry*'
npm run test:focus -- 'environment.reviewRelay*'
# Expensive full-cohort pixel reconstruction belongs at handoff/CI, not every save.
node --test scripts/destination-art.test.mjs
```

For full source/committed verification omit --maps; intentional writes still require an explicit
complete ID list 2…16. Full-pixel tests must require the whole 15-family cohort, nonzero assertions,
all source canvases/CRC/SHA/extrusion/padding and real alpha/blank exceptions. Do not invent an
opaque probe when a source image has none. Keep failures visible and preserve old source outputs.

Handoff additionally needs native and clean-cooked mobile/compat controls for every imported ID
and panorama; actual two-page/traffic overlap orders; all five landscape sizes/safe insets; cold
arrival during recurring submissions; failure/reentry/HMR; full-family residency; and representative
real WebGPU startup/pixels/resize in an owned focus-safe background Chrome session. Record exact
candidate head/base, commands, source probes, approved new screenshots, raw evidence and limits
in the PR. A screenshot, progress flag or telemetry quad alone cannot prove all those behaviors.
Final gates, browser completeness, pipeline caps and exact CI remain candidate-specific evidence,
not promises made by this guide. Never rebaseline old goldens or rehash old tapes just to pass.

This internal prototype imports no upstream README/legal documents or store workflow. Physical
phones are excluded. Destination-art readiness does not complete #15 routes, #16 clocks/results,
#19 the authentic race milestone or #22's remaining 14-player/32-traffic/full-catalog obligations.
