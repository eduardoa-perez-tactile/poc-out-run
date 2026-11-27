# Traffic sprite rendering

Ticket #54 supplies the full source traffic catalog and a shared roadside/traffic compositor
for the simulation from [#53](traffic-port.md). Source reference is OutRun commit
`6882721c99bc79365f815f68d389bf5078129e68`. Use the [vehicle art guide](../art/vehicles-animation.md)
and [import brief](../art/traffic-source-brief.md) for original frame families and importer
integrity. No replacement or generated art is required.

## Source images and frame selection

All 32 source models retain their 16 original transparent PNGs (512 frames), source SCALE and untrimmed
canvas dimensions. The runtime uses one explicitly packed 1024 × 1280 atlas with 2-pixel
extrusion; per-frame original size and bottom-center ground anchor remain separate metadata.
Numeric IDs map to stable traffic slots, never to PNG-derived collision dimensions.

The renderer selects the source perspective from canonical car versus player X, using each
car's logical row gap. Equal X uses source TURNRIGHT. Fresh proximity is inclusive 2000 road
units and 20 segments; it fixes the source uninitialized/sticky close flag. Elevation compares
integer-truncated row endpoints. Flat close uses c1–c4, uphill c5–c8, downhill c9–c12 and flat
far c13–c16; each direction has a two-frame pair.

`TrafficPool.motionTicks` publishes bounded movement phase 0–5 from fixed simulation steps.
The renderer reads `floor(motionTicks / 3)`; it does not accumulate a LateUpdate clock or wait
for asset readiness. Activation, full reset and recycling start a new phase; the activation
tick publishes 1. Pause, stopped cars and parked slots hold their phase. Skipped renders,
texture loading and viewport changes therefore cannot choose another lifetime's frame.
This is a defined 20-fps movement convention, replacing a source counter tied to draw calls.
The reviewed schema addition changes the traffic replay hash intentionally while physical
fields, passing events and RNG remain identical; other canonical tapes must stay unchanged.

## One compositor, stable painter order

`Map01ArtPresentation` remains the sole owner of the four Map1 dynamic meshes. After the
road projection it either uses the existing prop path or `buildTrafficComposite` for the
sole traffic owner. No second traffic updater draws a duplicate prop mesh.

The compositor first builds existing props unchanged, then merges their segments with at
most 32 traffic quads. Source placement IDs are opaque, not array indices: the prop builder
publishes each emitted segment explicitly. Fixed segment buckets retain far-to-near segment
order, existing prop slot order, then ascending traffic slot order within each segment.
Fractional car Z does not reorder same-segment ties. This preserves roadside occlusion with
alpha blending, whose engine material path does not write depth.

Traffic anchors interpolate the current source row's actual projected near/far endpoints,
including its own mirror choice. The next row's near endpoint is not an interchangeable far
endpoint at a mirror seam. Model scale, full source width/height and the source 3.2 horizontal /
3.43 vertical multipliers determine visual size. Ground contact is bottom-center. Crest
clipping crops both geometry and UVs, preserving top texels; it deliberately fixes the source
full-texture clipping bug. Cars behind the player, parked/inactive cars and out-of-view quads
are culled without changing simulation. The right projected arm retains the source-style
player-gap projection while canonical physics uses per-car gap; pixels never feed physics.

One fixed buffer holds 256 prop plus 32 car quads. Unused indices are degenerate. UV1.x is
0 for props and 1 for traffic, UV1.y is zero; colors remain white with alpha 255. The material
branches to sample only the selected atlas at explicit LOD0. Original prop stream values are
copied unchanged. No full-course scan, per-frame object sort or per-car road scan is needed.

## Filtering and asset lifetime

Props retain their approved linear LOD0 sampling. Traffic uses approved point sampling:
flooring UVs to exact texel centers uses the common linear sampler without
resampling the original artwork. The shader has independent `propsFiltered` and
`trafficFiltered` comparison parameters. Source traffic constructs SFML textures without
enabling smoothing; [SFML documents smoothing disabled by default](https://www.sfml-dev.org/documentation/2.5.0/classsf_1_1Texture.html).
Native point/linear comparison captured 60 near, 60 middle and 32 far consecutive fixed-step
frames per variant; all 152 paired simulation hashes matched. Inspection of adjacent-frame
windows retained sharper source clusters/outlines with point, with no observed halos, atlas
bleed or unexplained flashing. Ordinary minified pixel quantization is an accepted source-style
tradeoff, not a guarantee of zero aliasing. This bounded native visual approval does not claim
measured 60-fps rendering or phone performance. LOD0 prevents generated whole-atlas mips
from blending unrelated frames.
Loose PNG loading may still allocate mip levels, so sampled LOD and resident allocation are
separate facts.

In pinned engine 0.1.21, `mipmaps = false` is the supported cook setting. The cooker reads it
through `TexSettings::from_json` and emits one level when no smaller device override requires
additional levels. The loose 3D PNG path instead builds a full chain unconditionally in
`gameengine-render/src/assets.rs` (`MeshTexture::of`); `upload_rgba_mips` uploads those levels.
Changing the setting's name cannot remove that loose allocation. Explicit LOD0 still controls
which texels this material samples.

The unique `traffic-source` group holds runtime atlas/material dependencies. Source PNGs,
source SCALE inputs and reference boards are not individually resident runtime assets.
`TrafficArtResidency` is a global presentation resource so the sole compositor can reconcile
hot reload and release its group after its scene owner disappears. Map1 and player groups
remain separate. Asset readiness can withhold traffic rendering; it never pauses traffic AI,
resets movement phase or changes passing results.

## Verification and honest measurements

Focused `traffic.art` T0 tests cover all frame mappings, original anchors/scales, fractional
projection, the final cached endpoint, mirror seams, geometry/UV crest cropping, all 32 visible
slots, stable interleave, exact old prop streams and read-only simulation inputs. The native [controlled projection fixtures](../../outrun/tests/render/traffic-projection.test.ts)
prove exactly 32 projected cars, both fork arms, crest cropping and the final row-199 fractional
endpoint through the actual compositor. These local presentation snapshots are not live traffic.
Targeted T1 fixtures use recorded lifecycle requests for near/mid/far vehicles, pause and scene
release / reentry. A source busy-drive T1
profile follows genuine controls through passing/recycling and prints selected-group and
whole-scene residency, mesh storage, per-frame API submissions and draws.
Its 829-step run observed 6 passing awards for 6 unique lifetimes, one recycle generation,
an 8-step pause and 15-step resumed continuation. This render profile is separate from the
852-step canonical simulation replay; their lengths and coverage must not be conflated.

The complete fixed compositor arrays contain 72,576 raw bytes: 288 × 252 bytes including
UV1. This replaces the previous 56,320-byte prop buffer, an arithmetic delta of 16,256 bytes.
Native `meshes.info` reports 76,032 bytes for that mesh: 1,152 vertices × 52 bytes, plus
1,152 UV1 pairs × 8 bytes, plus 1,728 indices × 4 bytes. The host widens submitted Uint16
indices to u32, explaining the exact 3,456-byte difference from raw arrays. This is native
mesh storage accounting, not unexplained normal padding or an additional API submission.
The raw array figures count typed-array submission payload, not measured GPU bandwidth, hardware
frame time, RSS or phone thermals. Actual engine resident charges include dependencies and
may differ between loose/cooked paths. Numeric ceilings must follow observed reports and
review rather than being invented to pass a test. Distinguish post-present overhead from
content draws, and released-but-cached textures from live group pins.

The original 1024 × 2048 native busy-drive profile observed a peak of 7 visible cars, 8 draws,
4 mesh uploads and 469,016 raw array bytes submitted in one frame. It reported the traffic
group loaded with 3 members, 220,250 encoded content bytes and 11,184,876 resident bytes;
whole-scene resident charge was 27,953,872 bytes. The 1024 × 2048 loose RGBA full mip chain
accounts for 11,184,812 bytes across 12 levels; the remaining 64 bytes are the material
uniform charge. Asset-group `resident.textures` sums renderer charges for its members,
including material uniforms, while `cookedBytes` describes encoded member sizes. Neither
counter is process RSS or physical-phone memory. The test-only catalog reference group was
absent from this production driving profile.

That original atlas's cooked profile passed with traffic resident charge 8,388,672 bytes: 8,388,608
base-level bytes plus the 64-byte material charge, matching `compression = "none"` and
`mipmaps = false`. Its encoded group size was 8,391,993 bytes (8,388,820 texture bytes and
3,173 material/program bytes). Whole-scene resident charge was 21,138,104 bytes, with
779,901 data bytes reported separately. Cooked and loose profiles observed the same peaks
of 7 visible cars, 8 draws, 4 uploads and 469,016 raw submission bytes, and the same
76,032-byte native composite mesh. These are desktop structural/residency observations;
neither lane measures phone hardware or proves the full 32-car rendering capacity by itself.

The browser exposed an upload-budget boundary in the original atlas. Its 8 MiB base upload
never reached the GPU while recurring dynamic-road uploads consumed part of the pinned
engine's 8 MiB frame allowance. The public WebGPU trace retained all 25 texture creations:
other atlases appeared, but the traffic texture did not; the valid composite pipeline issued
no draw across a positive traffic workload and 30 subsequent fixed steps. Native capture's
same-snapshot retries could admit that texture without another road upload.

The atlas now removes only 768 fully transparent rows. Its last extruded content ends at
row 1241; the 1280-row image retains 39 blank rows. Every decoded pixel equals the old
image's prefix, and all 512 original PNGs, 32 SCALE files, frame metadata and packing rectangles
remain byte-identical. Base upload is 5,242,880 bytes. Fresh native/cooked/compat checks passed
all 19 traffic render tests each, including 512 exact sprite/control pairs and unchanged
traffic goldens. V8 and Hermes each passed all 38 focused traffic tests.

Fresh measured traffic-group resident charge is 6,990,564 bytes loose (6,990,500 across 11
floor-halved mip levels plus 64 material bytes) and 5,242,944 bytes cooked (base plus 64).
Whole-scene charges are 23,759,560 / 17,992,376 bytes, with cooked data 779,901 bytes reported
separately. The 829-step profile retains its 6 unique passing awards, recycle, pause/resume,
7-visible/8-draw peaks and unchanged mesh/upload counts. These are desktop observations.
The corrected atlas also passed an actual background WebGPU diagnostic: all 26 texture
creations were retained, including the 1024 × 1280 traffic texture, with 1,538 composite draws
and UV1 bindings. Screenshots showed the start-line scenery and distinct source traffic cars.
All 1,826 OS-focus samples stayed on the existing foreground process; the owned profile was
removed and browser/GPU errors were zero.

Native and cooked catalog tests each passed 512 exact sprite/control RGBA comparisons: one selected
opaque source texel for each of 32 models × 16 frames. The independent 32 × 16 reference
texture is reconstructed by decoding original PNGs at their verified source probe coordinates,
without reading atlas pixels or GPU output. Both samples traverse the same material/pass,
so transfer and quantization affect them equally; no tolerance or GPU-specific expected-color
branch is used. This checks native source-reference selection and shader sampling. Separate
offline checks prove every full source canvas, atlas pixel, extrusion and control byte.
The native test does not prove that all atlas pixels were sampled, or that GPU output equals
raw source sRGB bytes: the LDR linear target and final sRGB transfer can change those bytes.
The cooked catalog-to-game lifecycle check also passed. Eleven new shot names across mobile
and compat produced 22 specifically inspected and approved golden files; decoded pixels matched
their reviewed actual captures. No existing golden changed.

An explicit native helper hot reload changed the compiled bundle in 15.524 ms while paused
at step 273: hash `32faf485cd0ff10b` and the full traffic pool stayed unchanged. The next step
274 produced `8d2e5c0899023e04`. Reload reported `systems.changed: []` because system bodies
were unchanged; the edited helper still appeared in the new bundle. This proves that bounded
reload/state-preservation case, not a general hardware frame-time result.
After the atlas correction, the same supported helper-reload procedure passed again at
recorded replay step 810: the code bundle changed, the complete traffic pool and world hash
stayed equal, and step 811 continued with hash `13c8b0c5de1dd787`. Reload took 17.063 ms;
the source and compiled bundle were restored and the owned native host was stopped.
The final full-suite pipeline capture passed 153 T1 tests and recorded 19 mobile, 30 desktop
and 19 compat pipeline warm-up records, including the corrected material program. Excluding
program metadata, these contain 12 / 23 / 12 actual compiled pipeline keys.

## Strict active replay budget

The [829-step render profile](../../outrun/tests/render/traffic-art-profile.test.ts) has its own
[recorded replay](../../outrun/tests/replays/traffic_art_profile_canonical_source_busy_drive_measures_composite_residency_and_submissions.greplay)
and [active budget](../../outrun/tests/budgets/traffic-art.json). Follow the
[active replay harness contract](../active-replay-budgets.md): warm paused at step 0, then
measure every recorded fixed step with one explicit 1280 × 720 render request. Both GPU tiers
use the desktop host's explicit `phone-low` memory class. No free-running playback or finished,
idle-only capture substitutes for these samples.

Before the padding-only trim, focused strict captures passed on mobile and compat: exactly 829 steps and 829 render
requests, no replay divergence, 10 peak actual draws, zero new pipelines and zero GC pauses
over 4 ms. Allocation was 378.312 MiB on mobile and 377.191 MiB on compat. The 448 MiB ceiling
provides approximately 18.4% allowance above the larger observation; it follows these captures,
not the earlier 376.7 MiB diagnostic. Raw perf counters and per-request GPU evidence are retained
separately: mobile reported 2,490 protocol frames and 886 actual GPU frames; compat reported
2,488 and 884. The extra 57 / 55 GPU frames are internal same-snapshot UI/asset retries, not
extra simulation steps. Both owned hosts cleaned up successfully.

Allocation includes protocol-driven presentation and capture overhead. It is neither production
allocation per frame nor a phone FPS, hardware memory or thermal measurement. These focused
budget passes do not replace the final integrated gate and CI results.

The post-trim integrated PR gate passed all 19 harness steps: 43 harness tests, 122 T0 tests
on each native JS engine, 153 T1 tests on each mobile/compat tier, 122 cooked T0 tests and
122 tests on each V8/wasm parity lane. All eight canonical budget replays passed. Strict
terrain and traffic captures passed both tiers with exact 168 / 829 steps and requests,
respectively, no divergence, 10 peak draws, zero new pipelines and zero GC pauses over 4 ms.
Traffic allocation was 378.679 / 378.084 MiB; each run had 2,488 protocol frames, with
884 / 882 actual GPU frames and 55 / 53 internal same-snapshot retries. Terrain allocation
was 69.498 / 69.434 MiB, below its 80 MiB ceiling. Each owned host cleaned up successfully.
The two additional canonical tapes (right fork and 852-step traffic simulation) also passed
explicit V8/Hermes verification, completing all ten checked-in tapes without another rewrite.

## Read-only browser diagnostics

The probe-gated [project telemetry helper](../../outrun/src/render/traffic-diagnostics.ts) copies
bounded, deeply frozen snapshots from the actual live traffic owner after the compositor
uploads its current frame. It exposes population, active/visible counts, canonical driver side,
car lifetime identity, source frame, clipped image bounds and the current passing-event batch.
Image bounds are not collision hulls or proof of opaque pixels; event batches are not a score
history. Not-ready snapshots suppress stale visible samples. Fixture/catalog modes and scene
exit clear the live snapshot.

This API is separate from the SDK's public `gameengineProbe`. Browser game code runs in a
separate iframe realm, so the project sends one-way `outrun-traffic-diagnostics` version-1
messages to its parent; clearing sends a single null snapshot. The local
`outrunTrafficProbe.snapshot()` handle returns the same owned read-only data. There is no
inbound command listener, private-world reflection, simulation write or camera change. Native
and release paths without a public diagnostic probe return before copying snapshots.
Cooked probe builds also set `DEV=false`; the browser transport therefore checks for the
documented public `gameengineProbe.state` function on its distinct parent, whose web player
publishes it only for non-release configurations. It checks function presence without calling
it or querying world state. The native test fixture uses a local probe with `DEV=true`.
An initial real-browser run exposed the DEV-only gate error: it received no telemetry and
failed before driving. That run preserved focus and cleaned up, but is not traffic evidence.
After fixing that gate, the browser script reported a same-lifetime approach, close pass,
pause/resume and resize. Independent screenshot review rejected traffic acceptance: the
target car's published close bounds contained only road/sand/marking colors, with no car.
Computed quads and a passing event do not prove a visible GPU draw. Browser rendering of the
shared scenery/traffic compositor was therefore a blocking investigation; that script's green
result was not accepted as traffic art evidence. The padding-only fix and subsequent actual
GPU/image evidence above resolved this specific defect.

The corrected build also passed the uninstrumented background drive: a visible approach and
close screenshot bracketed the same epoch/slot/generation, followed by its 20,000-point pass
event. Pause preserved the published traffic/driver state and decoded player/world pixels
across 15 observed steps after settling; resume restored motion. All 236 observed inputs were
trusted. The same session resized from 1280 × 720 to 852 × 393 at DPR 1. All 1,872 focus samples
preserved the existing foreground process, its owned profile was removed, and runtime errors
were zero. Configured population remained 32; this is not a claim of 32 naturally simultaneous
visible cars. Actual screenshots, not the DTO or script green alone, establish visibility.
[Ten focused tests](../../outrun/tests/sim/traffic-diagnostics.test.ts) passed on both V8 and
Hermes, and the native integrated render check passed. Browser population/pass acceptance
still requires the actual background browser run, not these helper tests alone.

Final-head browser refresh and required GitHub CI remain pending.
Browser checks must preserve user focus and clean up only their own browser profile.
Physical-phone testing is excluded. This reference records
implementation and observed evidence; it does not claim that pending lanes passed.

The separate traffic-art viewer has no live `TrafficPool` or player-car visual owner.
Its catalog and occlusion modes are explicitly presentation fixtures. Occlusion mode keeps
immutable Map1 road segments, palette and source objects, but supplies one local prop placement
and a non-live fixed traffic snapshot. A known opaque palm-trunk texel is aligned over an
opaque source car-body texel by placement offsets; original pixels, visual scale and pivots
are unchanged. Cases exercise both depth orderings through the actual compositor, then compare
the overlap pixel against isolated front/back fixture renders. These controlled fixtures
prove renderer ordering; they do not replace genuine recorded busy-driving evidence.
