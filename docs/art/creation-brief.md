# Art creation brief and prompt templates

Complete this brief before producing a new asset. The approved source family and its intended
on-screen use matter more than a long list of style adjectives. Attach a relevant crop from
[the reference boards](index.md#visual-references), not the whole catalog by default.

## Required brief

```yaml
asset_id: scenery/map01/palm_small_a
purpose: roadside depth cue; decorative, not a collision obstacle
family: coastal_map01
reference: Map1/1.png on props.png; Map1 palette in source-index.json
observed_match: clustered foliage, readable trunk, crisp stepped edges
new_asset_change: a shorter, narrower palm silhouette
view: road-facing billboard; specify visible face and ground contact
logical_size_px: decide from approved family before production
canvas_size_px: decide; include full silhouette and transparent margin
anchor: specify normalized pivot and ground-contact point
states_or_frames: one still frame
palette: specify approved family swatches and shade ramps
background: transparent outside the object
layers: object only; no road, sky, label, frame or baked scene shadow
near_far_check: approve at intended close size and representative distant size
runtime_group: proposed biome group; confirm with implementation
metadata: logical bounds, pivot, collision intent, trim origin, frame IDs
acceptance: silhouette, palette, alpha edge and perspective reviewed in context
```

This is an artist handoff format, not an engine import schema. Replace undecided values before
requesting final production. For a vehicle, use [the animation guide](vehicles-animation.md)
to enumerate the complete required pose family. For UI, specify [states and touch context](ui-hud.md).

## Production sequence

1. Pick the category guide, an approved specimen and target gameplay context.
2. Approve one silhouette/pose at native pixels and representative projected sizes.
3. Fix the palette, logical canvas, contact/pivot and shade direction for that family.
4. Produce variants or the animation family from that approved anchor. Do not independently
   improvise a different car or prop perspective in each frame.
5. Export source layers and clean runtime candidates with the manifest from
   [asset delivery](asset-delivery.md). Check trim/atlas handling separately from collision.
6. Compare against a source specimen and a gameplay frame on light/dark backgrounds. Inspect
   an animation loop/contact sheet for shifting scale, wheelbase, contact and light.
7. Once imported, run the relevant render/cooked checks and inspect motion in-game. A good
   isolated image is not evidence of a correct hill-clipped or distant sprite.

## Reusable image creation prompts

These are starting templates for an artist or image tool, not promises of pixel-accurate output.
Fill every bracket and attach only the relevant reference. If an AI image tool is used later,
follow its image-generation skill at that time. Generated output must still be normalized and
reviewed; a high-resolution illustration is not automatically a usable low-resolution sprite.

### Roadside prop

> Create one [prop] for the attached coastal arcade-racing sprite family. Match the reference's
> road-facing viewpoint, stepped pixel silhouette, compact shade clusters and [palette]. Keep
> [anchor/ground contact] and [logical dimensions] consistent with the approved specimen. Show
> only the prop on transparency. Preserve [specific readable detail] when reduced to [distant
> display size]. Deliver no road, sky, UI, wording, frame, blur or glow. This variant changes
> only [silhouette/material detail].

### Player car pose

> Using the attached approved rear-view car as the identity anchor, produce [one specific pose:
> direction, pitch, action and frame ID]. Preserve body proportions, occupants, wheelbase,
> paint/shade ramps, light direction and bottom-center contact from the approved family. Keep
> all content inside [shared logical canvas] with [pivot]. Render crisp clustered pixel detail
> and a readable rear silhouette on transparency. Change only the requested pose; do not add
> scenery, UI, camera motion, speed blur or a different vehicle design.

Generate and approve an anchor first; request remaining poses against it. A sheet must identify
frame order, cells, per-frame contact and intended state, not merely contain similar cars.

### Biome panorama

> Create the [far/near] panorama layer for the attached [Map ID] reference family. Match the
> configured sky/terrain palette [values], low-detail horizon silhouette and [mountain/cloud/
> coast] motifs. Keep the intended horizon baseline at [row/normalized position], wrap left to
> right without a seam and leave [transparent/opaque] regions exactly as specified. Deliver
> only this layer at [approved dimensions]; no road, cars, foreground props, lettering or HUD.

The far and near layers are separate deliverables. Sky color is driven by the map palette;
blue pixels in a specimen board are not permission to ignore another biome's configured sky.

### UI symbol or frame

> Create [icon/frame] for the attached arcade racing HUD family. Use the approved [role palette],
> hard-edged silhouette and compact dark separation. Deliver [normal/held/selected/disabled]
> states at [approved source dimensions], with [9-slice annotations if a frame]. No baked labels,
> dynamic values, background scene, glow or control behavior. It must read at [logical display
> size] and share stroke/value weight with the attached sibling symbols.

## Acceptance note

Record what changed, the approved reference, native/display size, pivot/collision metadata and
reviewed states. Name any differences intentionally accepted. Do not describe proposed rules as
measured source facts or mark an asset approved solely because a tool generated it.
