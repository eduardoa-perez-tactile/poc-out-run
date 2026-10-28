# Ferrari1 import brief — ticket #10

Import one selected vehicle from pinned source `6882721c99bc79365f815f68d389bf5078129e68`:
`Resources/Vehicles/PlayerCar/Ferraris/Ferrari1/c1.png` through `c148.png`, plus the 28
shared `PlayerCar/Wheels` frames. Preserve source pixels, alpha, proportions and every pose.
No recoloring, image generation, source documentation, other cars or traffic imports.

The reference is a red open-top rear-view sports car with two occupants, dark underside,
bright rear body highlights and clustered tire/contact shading. Source frames range from
94–96 × 44 to 171 × 46; never scale a wide crash to the neutral image width.

Keep source sizes and explicit anchors per frame. For this prototype, the visual ground
anchor is the bottom-center source boundary, `[width/2, height]`; this is a declared stable
placement convention, not a measured axle pivot. Wheel attachments are separate positions
relative to that anchor, initially ±32 source pixels and 3 pixels above the boundary, and
require visual review. Original source screen-placement anchor `[width/2,height/4]` remains
provenance only. Native Sprite anchor uses bottom-left normalized coordinates, so the new
bottom-center convention maps to `[0.5,0]`. Alpha trimming must preserve these source sizes.

Import all driving, braking, slope, crash/reaction and arrival frames, with semantic ranges
verified against `PlayerCar.cpp`. Pose preview timing is presentation only, never a crash
simulation or control-unlock signal. Collision metadata lives in a separate simulation file;
image dimensions, loading, trimming and atlas packing cannot modify it.

An early actual-road native Sprite capture showed bilinear blur. The approved bounded
fallback is one deterministic 1024 × 1024 RGBA atlas (4 MiB before renderer copies), with
three fixed quad slots and a texel-center material. Every frame retains its full source
rectangle and explicit `trimPx: [0,0,w,h]`; this path does not consume engine sprite trim.
Two extruded texels surround each frame. No rotation, resampling or image-scale change.
The texture is `kind="texture"`, `atlas="none"`, `compression="none"`, `mipmaps=false`.
These settings apply to this magnified player atlas, not all game art. Individual original
PNGs remain checked import inputs and are excluded from the runtime bundle/groups.
Only the selected-car atlas and material preload. A red procedural quad is available for
focused placeholder review, with no wheel effects. Native/browser captures still must
prove pixel clusters, alpha and no adjacent-frame leakage.

Review neutral, entry/held turns on all slopes, braking, both wide spins, final reaction,
arrival poses and wheel effects over road/light/dark backgrounds. Review mobile and compat
renders, landscape resizing and desktop phone-low residency. No physical-phone validation.

## Reproduce and validate

From repository root:

```sh
python3 scripts/art/import-player-car.py --source /path/to/clean/pinned/OutRun
python3 -m unittest discover -s scripts/art -p 'test_*.py'
# Only after reviewing a deliberate source/import-contract change:
python3 scripts/art/import-player-car.py --source /path/to/clean/pinned/OutRun --write
npm run test:focus -- "vehicle.*"
npm run gate:pr -- --base origin/develop
npm run test:cooked
npm run test:visual
```

`--write` copies only the selected 176 source PNGs and writes the deterministic atlas and
TypeScript manifest. Default mode recomputes and checks every source SHA, source pixel file,
packed atlas and manifest, without writing. The decoder handles this source's noninterlaced
RGBA8 and indexed 4/8-bit PNGs with tRNS; unsupported formats fail explicitly. Parser tests
cover PNG CRC/truncation, alpha, all five row filters, palette transparency, packing and
extrusion, wrong commit and tracked dirty Resources. No Pillow dependency is required.

Engine-generated sidecars must remain committed. For a new import run the engine generation
and cook through the serialized engine window, then confirm the atlas's exact settings above.
Individual source-image sidecars serve authoring; runtime bundle exclusions remove those
PNGs. Inspect actual cooked manifest/groups; do not infer shipped contents from file names.

Preview scene: `scenes/vehicle-preview.scene.json`; the project start scene is unchanged.
Its presentation-only `VehiclePreview` resource selects `pose` (0–22 in `POSE_NAMES`), `sample`
(discrete preview frame), `effect` (0 none, 1 smoke, 2 sand, 3 grass, 4 snow, 5 mud), `scale`
(source pixels scaled relative to a 720-pixel design height), and `placeholder`. `autoplay`
uses the proof road's distance for a proposed 20 fps review cadence at 7200 road units/s
and therefore freezes with its pause. This is not an exact port of speed-dependent draw counters.
These are art review controls, not race inputs, crash outcomes or collision tests.

T1 `vehicle.cooked-pixels*` samples an explicitly recorded opaque source texel for every body
frame through the real material; run it with `--cooked` as well. Visual samples show all
18 driving families, both spins/reactions and arrival endpoints, five effect families,
placeholder and repeated pool changes. Native Sprite's blurred exploratory capture is local
only; production goldens must show the approved texel-center path and be reviewed separately.

Initial author verification (uncommitted candidate; coordinator must rerun final gates on the
reviewed PR head): 12 offline parser tests passed; default importer check passed; focused native
T0 5/5 passed. Native T1 mobile 36/36 passed (1.48 s summed host test time); compat 36/36
passed (2.17 s). The 148-frame pixel loop took 0.27/0.28 s loose and 0.67 s cooked, so it stays
in the focused suite without a frame × viewport permutation matrix. Cold cooked verification
first waits for queued art and another presentation step; it must not mistake the red loading
placeholder for a corrupted source texel. RGB comparisons retain a two-level tolerance.

Reviewed 68 production goldens (34 shots in each tier), including all 18 driving families,
wide crash/arrival endpoints, paired effects and a narrow-layout placeholder. The selected
atlas's cooked entry is 4,194,516 bytes including its container header; its RGBA texels occupy
4 MiB. The actual desktop cooked manifest has 15 total entries and zero individual source
body/effect PNG entries. The focused phone-low test bounds total texture residency at 10 MiB;
that is a desktop structural check, not a physical-phone memory measurement. Full harness,
independent review and targeted real-browser verification remain coordinator gates.

## Preview lifetime and CI integrity

Disabling the preview, removing its slot entity or entering another scene removes the dynamic
mesh with the engine's `meshes.destroy` API, releases the selected-car group's pin, and resets
the world-owned load flag. Re-enabling creates the same three fixed quad slots. A scene-exit
test deliberately emits `EnterScene` with an empty `release` list: this proves post-exit
controller cleanup, rather than relying on the loading screen to release the group first.
Release makes cached textures eligible for budget eviction; it does not promise immediate GPU
unloading. No hardware memory reduction is claimed.

Engine `Session.rebuild` replaces project resources while retaining its native asset book.
A presentation-only `reconciled` flag therefore checks native group ownership once per new
world and releases a stale pin when the new world has no enabled preview. The code does not
assume its first presentation occurs at fixed step one. `assets.load` returns synchronously;
this controller owns no JavaScript promise or callback that can write into a replaced world.
Native release drops pending read handles; already resident textures may remain cached. Four
focused native lifecycle tests passed: disable/re-enable, missing slot plus real scene exit,
disabling during initial preload, and reset resources with a surviving native pin.

`npm run test:harness` now automatically discovers `scripts/art.test.mjs`. Its Python stdlib
subprocess runs the 12 parser regressions plus repository-only committed-art integrity: all
176 PNG CRCs/SHA/dimensions, explicit anchors, nonoverlapping atlas rectangles, every decoded
source pixel, extruded borders and opaque probe texels agree with the committed manifest and
atlas. It needs neither upstream checkout, Pillow nor network access. Measured bridge cost
is about 1.15 seconds; focused engine T0 iteration does not run this extra offline suite.
