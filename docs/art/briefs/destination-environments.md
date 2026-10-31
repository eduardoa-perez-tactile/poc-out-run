# Destination environment import brief — ticket #71

Import the existing Map2–15 and shared goal families from source
`6882721c99bc79365f815f68d389bf5078129e68`. This is deterministic source import,
without new illustration, recoloring, trimming or rescaling. Follow the
[environment guide](../environments.md), [art direction](../art-direction.md),
[delivery rules](../asset-delivery.md) and [creation brief](../creation-brief.md).
Reference the [panorama board](../references/biomes.png),
[props board](../references/props.png) and the complete immutable biome records.

| Brief field | Contract |
|---|---|
| Asset family | Fifteen destination families: ordinary Maps2–15 and goal16 |
| Purpose | Actual projected roadside cutouts and independent front/back panoramas |
| Inventory | 627 local object IDs and 30 panoramas; retain unused definition/animation images too |
| Palette | Original PNG RGBA and each SourceBiome palette; no universal blue sky. Goal sky is source RGB0/207/205 |
| Native canvas | Every complete original canvas, maximum object1000×339; ordinary back/front1536×256/2048×256; goal back2182×256 |
| Contact/anchor | SourceBiome visual pivots selected by offset sign, original scale, original road-space placement |
| Collision | SourceBiome alone owns collision width/pivots/terrain. Importing art cannot alter them |
| States | All source images imported; static review does not implement goal animation, race arrival or live traffic |
| Runtime path | At most two deterministic prop pages/family, each ≤1024×1280, with two source texels of edge extrusion |
| Manifest | Source IDs/paths/SHA/dimensions, page/rect and independently selected source probe; no duplicated physics/pivots |
| Groups | One bounded art group per destination, separate existing data groups; original inputs excluded from runtime discovery |
| Review | Every object/panorama GPU mapping, dense Map4, mixed-page Map10, goal crowd/panorama, near/mid/far/motion, crests/forks |
| Viewports | Existing five landscape sizes and safe areas; representative background WebGPU checks with preserved OS focus |

Maps5/6/10/15 need two pages in the independently audited shelf layout. Use source-height,
source-width, then local-ID ordering. Keep original PNG bytes separate from packed pages.
Goal shares45 raw source paths with Map1,18 already imported; reuse identical raw inputs by
source path and SHA without changing the old Map1 atlas or requiring its art group.
Do not stretch the goal panorama to1536 or let import limits downscale2182 source columns.

Linear sampling at explicit level0 is the starting prop/panorama policy, matching the approved
Map1 presentation choice; traffic keeps source-point sampling. This is not a claim of exact
upstream SFML filtering. Inspect category-specific distant detail and alpha edges. Preserve
source wrap seams and the sampled top253 rows at reference height720; a source seam must not
be silently repainted.

The generic compositor has1032 fixed quads (1000 source props plus32 controlled traffic),
with source far-to-near row ordering and per-row props before stable-slot traffic. Page0,
page1 and traffic are explicit texture choices, not separate page-sorted passes. Map4's full
200-row data window contains1000 queried placements; source near-player exclusion means
975/980 source-eligible visits before further projection/clipping. Report each count honestly.
The legacy Map1 material,256-prop guard,288-quad compositor and existing pixels stay unchanged.

At the approved maximum page size RGBA base storage is5242880 bytes; a loose complete mip
chain can charge6990500 bytes. Neither arithmetic proves admission under the8MiB upload
budget. Keep normal mesh submissions running during cold arrival and verify actual uploaded
textures, bindings, draws and source pixels. Never raise global caps or drop source content.

Data IO progress1 with empty failures permits public data reads outside SIM. Art IO readiness
and fresh settled RenderStatus frames are distinct from validation of actual GPU pixels;
headless/on-demand status alone cannot certify texture arrival. The single review owner may
release only its own pins, preserving boot Map1/catalog and other owners' player/traffic pins.

Approve the three-texture binding/order path and a representative single/two-page family
before expanding runtime import. Offline tests reconstruct source pixels, extrusion and
transparent unused atlas regions without upstream/Pillow. Actual native/cooked mobile+compat
controls cover every imported ID and panorama. Source alpha/blank exceptions need recorded
evidence, never an invented opaque witness. Representative Chrome checks remain background
only. New destination art does not establish live handoff, clocks/results, a complete race,
all player selections or hardware-phone performance.
