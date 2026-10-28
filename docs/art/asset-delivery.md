# Art asset delivery and engine integration

This is the production contract for new art in the internal landscape mobile/web prototype.
Read the [art direction](art-direction.md) and the relevant category guide before creating
assets. Source measurements appear in the [reference index](references/source-index.json).
The naming and manifest examples below are proposed project conventions, not existing
engine schemas. Implement and validate the converter/import contract before relying on them.

## Deliver the asset and the information needed to use it

| Deliverable | Requirement |
|---|---|
| Editable master | Preserve layers or frames and palette decisions; keep it outside the runtime asset group |
| Runtime image | PNG with genuine alpha for isolated sprites; no checkerboard, white mat, label or preview border baked in |
| Frame manifest | Semantic state, frame order, duration/loop intent, logical canvas, anchor and per-frame offset |
| Object metadata | Visual scale/side, ground anchor and collision bounds stored separately |
| Review preview | Labeled contact sheet and short animation preview on neutral plus representative biome backgrounds |
| Integration metadata | Engine-generated `.gmeta` sidecar and verified import/atlas grouping |

Opaque sky/menu backgrounds may be opaque. A sprite cutout needs transparent surroundings,
including between leaves, mirrors, tires and signposts where appropriate. Inspect on dark
and light backgrounds to catch pale fringes. Do not bake the documentation board's checkerboard
into deliverables. Avoid lossy JPEG for pixel sprites; verify the actual encoding rather than
trusting the filename extension.

## Keep coordinate spaces separate

1. **Source texels** are the editable image/frame pixels. Borders and offsets in the proposed
   manifest refer to this declared source space.
2. **Logical canvas coordinates** place differently trimmed frames around one stable anchor.
   Use top-left origin, +x right and +y down in the proposed art manifest. This is an art-data
   convention, not the engine's world-coordinate system.
3. **Atlas coordinates** locate the cooked packed region, including trim and extrusion. Do
   not use atlas rectangle width as original sprite width or collider width.
4. **World/road coordinates** determine contact, collision and projected size. The simulation
   owns these values. A viewport resize or texture replacement cannot change their meaning.
5. **UI reference coordinates** lay out HUD and controls in the landscape UI document. A
   source-pixel border width is not automatically a physical touch-target size.

Proposed manifest sketch for a new vehicle family:

```json
{
  "assetId": "player_sport_red",
  "logicalCanvasPx": [192, 64],
  "groundAnchorPx": [96, 60],
  "frames": [
    {
      "state": "drive_flat_straight",
      "image": "vehicles/player/sport_red/drive_flat_straight_00.png",
      "sourceSizePx": [94, 44],
      "offsetPx": [49, 16]
    }
  ]
}
```

These canvas/anchor/offset values are illustrative, not measurements of the source's player
anchor. They place the example frame's bottom at y=60 and center at x=96. Establish the actual
contact anchor from the approved art and animation; wider crash frames must fit without
distortion. Alternatively retain source frames and store offsets without creating padded
PNGs. Treat semantic frame references, clip timing and road-space collision data as separately
validated records.

## Naming and grouping conventions

Use lowercase descriptive IDs and stable state names, with numbered frame suffixes:

```text
assets/art/vehicles/player/sport_red/drive_flat_straight_00.png
assets/art/vehicles/traffic/compact_green/near_left_00.png
assets/art/biomes/map01/props/palm_wide_01.png
assets/art/biomes/map01/backgrounds/far.png
assets/art/effects/wheels/sand_00.png
assets/art/ui/hud/panel_time.png
```

These are proposed destinations. Keep a source-ID-to-semantic-ID map when migrating numbered
files; do not rename cN files without preserving their frame mapping. Separate asset groups
by selected player vehicle, active biome, candidate successor biome and shared small HUD/effects.
Avoid a single atlas/group containing the entire vehicle and environment catalog.

## Import and atlas rules verified against Game Engine 0.1.21 guidance

The engine's local `atlasing` skill documents these `.gmeta` settings:

```toml
[settings]
atlas = "hud"
trim = true
```

Named atlas groups such as `hud` are supported; `"auto"` and `"none"` are also supported.
Trim is on by default and preserves the sprite's source size, anchor and pivot in the engine
sprite path. Our custom projected-quad path must explicitly consume that metadata or resolve
trimmed UVs/offsets itself; it does not inherit correct clipping merely because an atlas exists.

- Named groups should contain sprites with compatible color/compression settings. The engine
  warns about conflicting named-group settings. Keep group settings consistent.
- Consecutive compatible sprite draws can batch; overlapping transparent objects still need
  correct ordering. Do not reorder a tree in front of a car merely to share an atlas page.
- The documented page limits are 2048 on mobile and 4096 on desktop. Treat these as page
  ceilings, not targets to fill with oversized source art.
- The engine extrudes compressed-block-aligned edges during packing. Do not add a manual
  colored border or duplicate extrusion into artist source files.
- Textures sampled by materials/effects are kept out of sprite auto-atlasing. The road's
  projected mesh/material path may need explicitly packed textures and UV handling; measure
  that implementation instead of promising automatic sprite batching for every quad.
- The documented `compression = "astc6x6"` option can reduce mobile texture cost, but inspect
  the cooked result for lost small text, broken pixel clusters and alpha fringes before use.
  Do not assume one compressed format is appropriate on all runtime platforms.
- Choose sampling and mip behavior by inspecting near/far projected art in the actual cooked
  renderer. Preserve the intended pixel-cluster look without shimmer or seams; this guide
  does not invent an unverified filter flag or impose “no mipmaps” on every category.

UI images needing 9-slicing carry named `border` sides in source texels, with optional `body`
and `content` padding in `.gmeta`. Use the engine's documented `slice="auto"` path. Do not put
text or detailed ornament across a stretchable center. Check scaled borders at both tablet
and narrow/wide landscape phone layouts.

Create/import assets through engine tools so new runtime files get `.gmeta` sidecars. A cook
after adding files can generate them; commit the sidecars with the art. The analytical boards
under `docs/art/references/` are documentation and are not runtime textures to import or cook.

## Size and memory decisions

Use observed source dimensions as starting references, then judge the intended display size.
A 94-pixel rear car does not need a 2048-pixel export simply because the screen is high density.
Keep important shape/color cues at the farthest useful projected size. Large background strips
should wrap with verified seams and load with their biome, not with every car selection.

The migration's initial budgets are targets for the whole game, not per-asset allocations or
measured results: phone-low peak RSS ≤350 MiB, textures ≤120 MiB, JS heap ≤32 MiB, roughly
≤50 draws, and sustained 30 fps; mid-range aims at 60 fps. Record actual texture residency,
draw order and transition peaks once the runtime scenario exists. Uncompressed RGBA storage
is `width × height × 4` bytes before mip levels, atlas padding, compression or other copies.

Scale resolution, secondary scenery/effect density and optional polish for low-end devices.
Never change a collision footprint, sign meaning or readable hazard cue by device tier.
Keep cheap small sprites shared when a separate low-tier version adds no measurable benefit.
Atlas sprites do not support independent per-device `max_size` overrides in the documented
engine path; non-atlas textures can use the supported device-tier overrides where warranted.

## Brief required before producing an asset

```text
Ticket and asset ID:
Category / biome / role in gameplay:
Approved reference image(s), palette and visual rules:
Required views/states and smallest expected display size:
Logical canvas, contact anchor and expected footprint:
Frame offsets / side variants / wrap edges / slicing borders, as applicable:
Separate collision or UI hit-area metadata:
Output files, alpha, naming and manifest contract:
Loading group / atlas or mesh-material path:
Review scenes, backgrounds and device sizes:
Acceptance evidence and deferred states:
```

Approve one representative asset first. Expand a family only after its scale, anchors,
palette, silhouette and runtime import are accepted. Keep original master, approved export
and packed runtime result distinguishable; only the latter proves importer behavior.

## Acceptance and validation cadence

Before integration, inspect transparent edges, verify filename/encoding/dimensions, check
every frame reference and offset, preview animation on a fixed ground line, and compare
the asset at smallest useful scale. For props, review silhouette and contact/collision
separately. For backgrounds, inspect wrap seams. For UI, inspect 9-slice corners, safe bounds,
text contrast and actual hit-target size.

When the runtime converter and harness from PR #1 have landed, run the applicable checks
from the repository root:

```sh
npm run test:plan -- --base origin/develop
npm run test:focus -- "content.*"
npm run test:cooked
npm run test:visual
npm run gate:pr -- --base origin/develop
```

These are future integration commands for this art-guides branch, which starts from develop
before the harness has landed. Do not represent them as executed here. Add category-specific
`vehicle.*`, road-clipping or UI checks when that implementation exists; zero selected tests
must fail. Use `gameengine validate`, atlas reports and memory reporting in the game project
to verify actual imports. A documentation review alone certifies no mobile frame time,
engine rendering, browser input or memory limit.

Changes to collision/state/timing data also require native/web parity. Changes to images,
atlas layout, materials or animation appearance require reviewed T1 samples and moving near/far
observations in native/browser mobile-size previews when the renderer exists. Check safe-area
layout, emulated touch states and phone-low residency; physical-phone testing is outside this
fast-iteration workflow. Those checks do not establish hardware frame time or thermals.
Do not reapprove a changed golden solely
because the file was intentionally replaced; verify the new art meets the category brief.
