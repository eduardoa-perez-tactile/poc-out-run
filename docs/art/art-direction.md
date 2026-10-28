# OutRun art direction

Create art that belongs beside this remake's existing cars, roadside sprites and broad bands
of road, terrain and sky. The target is a readable, colorful pseudo-3D arcade drive on mobile
and web in landscape. Establish the same visual language before making a large asset set.

These guides use source commit `6882721c99bc79365f815f68d389bf5078129e68` of
[ZgzInfinity/OutRun](https://github.com/ZgzInfinity/OutRun/tree/6882721c99bc79365f815f68d389bf5078129e68).
**Observed** describes the inspected source; **production rule** is a convention for new work.
The reference boards are analytical specimens, not finished layouts or approved runtime atlases.
Exact source paths, dimensions, selected GIF frames and configured colors are in
[source-index.json](references/source-index.json).

## Visual reference

![Source gameplay composition and palette references](references/gameplay.png)

The gameplay references come from approximately 4:3 source GIFs. Preserve their visual hierarchy
when composing a wider landscape view; do not stretch the whole source frame to fill a phone.
Road projection, HUD layout and safe areas are separate systems.

## What makes the game recognizable

| Observed source characteristic | Production rule for new art |
|---|---|
| Rear-view convertible anchors the lower center; traffic approaches a common horizon | Make the player silhouette immediately distinct from traffic and maintain a consistent road-facing perspective |
| Large open sky; flat-color projected road/terrain; detail concentrated in sprites | Keep broad screen regions quiet so the road, vehicles and route decisions read while moving |
| Bright blue, cyan, purple, yellow and pink skies across maps | Follow the destination biome's configured palette; there is no single blue-sky palette for the whole game |
| Pixel-cluster shading and crisp silhouettes on cars, signs and foliage | Draw deliberate clusters and material highlights; avoid blurry resampling, painted brush noise or a smooth vector replacement |
| Palms, trees, structures, signs and spectators create roadside rhythm | Use clear repeating silhouettes and occasional landmarks; reserve the driveable corridor for gameplay information |
| Asset families differ in source size and detail density | Match the neighboring asset family and actual projected size, rather than forcing every object onto one arbitrary canvas |

Do not substitute a generic purple-neon synthwave treatment, realistic PBR vehicles, global
bloom, scanlines or motion blur for the source's visual character. Those are not production
defaults. The source is a remake with varied art; it does not establish a universal historical
palette limit, sprite size, outline thickness or strict pixel-perfect display resolution.

## Color and material language

**Observed:** terrain and road use alternating configured colors. Car sprites have brighter
paint highlights, dark undersides, readable lamps and small high-contrast details. Trees use
clustered foliage highlights; many signs have bold border/face contrast. The source also
contains dark and muted biomes, so saturation is not uniformly high everywhere.

**Production rules:**

- Start an environment from its sky, terrain, road and lane colors in the
  [environment guide](environments.md), then add a small coherent material ramp for each prop.
- Keep highlights and contact shadows readable at the intended in-game size. Use nearby source
  sprites as the lighting reference; do not invent independent dramatic light directions for
  objects that appear together.
- Test the player car, traffic and route signs over both terrain colors, at a hill crest and in
  the destination biome. A beautiful isolated sprite can disappear against the road.
- Preserve the source's broad shapes before adding texture. Tiny noise that shimmers under
  perspective scaling is a defect, even if it looks detailed at enlarged editing zoom.
- Treat lane markings, turn arrows and checkpoint indicators as information. Their contrast
  and meaning must survive palette transitions; decorative scenery must not imitate them.

## Shape and depth

The world is represented by projected road strips and mostly camera-facing sprites. Draw a
roadside sprite with the perspective expected by its family, then let the game scale and place
it. Do not bake the whole road's vanishing-point distortion into a single prop.

Favor recognizable outer contours: palm crowns, narrow trunks, broad tree canopies, sign
faces, vehicle roof/body shapes. Keep decorative interior detail subordinate to those contours.
Check each asset near the player, at middle distance and close to the horizon. Distant objects
may become a few pixels; they should become simple color masses rather than flickering noise.

## Composition for landscape mobile and web

**Production rules:** keep the player car and approaching traffic legible, both fork arms visible
at the decision point, and the road's crest/vanishing point unobstructed. Place dense scenery
primarily outside the driveable road. Start/goal dressing may form a special gate-like scene,
but its important opening and race signal must remain clear.

Place HUD and touch controls within the current safe area, not inside a painted screenshot.
Review a narrow-height wide phone, a notched phone, a tablet and resized browser windows.
Backgrounds may extend or wrap; important signs and vehicles must not be cropped merely to
fill the screen. Widening the composition does not authorize changing collision geometry.

## Creating a new asset

1. Pick the matching source family and at least two named specimens. Record their paths and
   dimensions from the source index; inspect the actual source images when precision matters.
2. State the gameplay role, biome, projected near/mid/far sizes, direction/pose and required
   animation states. Choose a canvas and anchor appropriate to that family.
3. Make one representative asset or pose first. Review its silhouette and palette in a game
   frame before producing a whole set. For generated art, use the source board as a visual
   reference and the brief as constraints; generation is a draft, not asset approval.
4. Integrate with separate placement/collision metadata, then inspect scaling, clipping and
   contact with the road. Add the evidence required by the affected implementation ticket.
5. Expand the set only after it matches its neighbors in motion and at the smallest useful size.

## Reusable art brief

```text
Asset / gameplay purpose:
Biome and configured palette:
Source specimens (paths and native sizes):
Requested silhouette, material and viewpoint:
Canvas, transparent background and contact anchor:
Near / middle / far projected use:
States, frame order and loop/transition requirements:
Keep: crisp pixel clusters, readable outline, source-family detail density.
Avoid: baked screen UI, road-wide perspective distortion, blurred edges,
        unintended glow, texture noise and changing the frame-to-frame contact point.
Review frame / scenario:
```

This brief needs concrete values before production. It is not a claim that every source asset
shares one lighting model, palette count or dimension.

## Approval checklist

- The art brief identifies a source family and intended in-game use.
- Silhouette, material ramps and edge treatment match nearby assets without enlarging them
  beyond their useful source resolution.
- Near/mid/far views, dark/light terrain, crest clipping and any route split remain readable.
- Transparent edges have no baked background, halo or accidental crop; anchors remain stable.
- Visual scale and collision data are separate; replacing the image does not alter gameplay.
- Art remains clear at landscape extremes with HUD and touch controls present.
- Still frames and movement have been inspected. A contact sheet alone is not in-game approval.

Use [environments.md](environments.md) for biome and roadside production details. The source
boards and this guide establish art direction; engine imports, animation manifests and runtime
performance are validated through the implementation workflow.
