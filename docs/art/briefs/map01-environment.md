# Map1 environment import brief — ticket #40

Import the existing coastal Map1 family from source commit
`6882721c99bc79365f815f68d389bf5078129e68`. Preserve source pixels, canvas sizes,
alpha and source object IDs. This is an import, with no new illustration or recoloring.
Reference [environment rules](../environments.md), [delivery rules](../asset-delivery.md),
the [props board](../references/props.png) and [panorama board](../references/biomes.png).

The palette is Map1's configured sky `#0094FF`, terrain `#E6D6C5`/`#EFDECE` and asphalt
`#949494`/`#9C9C9C`. Representative source specimens are the 162×99 palm
`MapLevels/Map1/1.png`, 120×86 structure `7.png`, 60×116 direction sign `14.png`,
and the shared 81×103 starter `MapStartGoal/1.png`. Cutouts are road-facing billboards;
their authored scale and contact pivots come exclusively from the immutable `SourceBiome`
record. Left/right visual pivot selection follows offset sign, independently of road arm.
Collision widths/pivots and terrain flags are also exclusively source-track data.

Import all 42 distinct object IDs referenced by Map1's definition catalog: 24 local and
18 shared. Final last-write placements use 39 of those IDs; IDs 27, 65 and 68 survive only
in overwritten-definition provenance and are intentionally retained in this selected family.
Do not invent three additional logical placements. Each source canvas remains untrimmed,
unrotated and unscaled in the atlas, including the 1000×300 strip at source object ID 51.
Preserve silhouettes, transparent spaces and full canvas contact relationships.

One bounded deterministic square RGBA atlas starts with a measured 1024×1024 packing
attempt and may grow to 2048×2048 only if required. Two extruded source texels surround
each rectangle. Standalone `back.png` (1536×256) and `front.png` (2048×256) remain original
PNG bytes outside the cutout atlas. These are distinct repeating cloud/coastal layers.
Their first and last columns differ; retained source artwork does not establish an
invisible pixel seam. Inspect the wrap boundary while moving instead of claiming perfect
seamlessness from metadata. Filtering/mip choices require actual distant-scene evidence;
the player car's magnification settings are not an environment-wide default.

The `MAP01_ART` manifest identifies source object IDs, source/input paths, source dimensions
and SHA256, atlas rectangles and opaque pixel probes. Atlas metadata identifies its image,
size, two-pixel extrusion and SHA256. The back/front records identify source/runtime paths,
dimensions and SHA256. Do not duplicate authored pivots, scale, collision or placement in
the art manifest. Runtime group is `map01-environment`; original input cutouts remain
separate from the packed runtime texture. The coordinator owns generated import metadata,
group configuration and actual cooked-catalog validation.

Review source alpha edges and contact at native size, near/middle/far projected sizes,
alternating terrain colors, dense placements, a crest and both fork arms. Maintain the fixed
256-quad ceiling with no silent truncation of the 1475 logical placements. T1 mobile/compat,
desktop phone-low residency and real background-browser movement/resize provide runtime
evidence; no physical-phone tests or hardware-performance guarantees are requested.

The repository-only importer tests must check every source pixel/hash/CRC/dimension against
the atlas, including every extruded edge/corner, transparent padding, rectangle separation,
packing overflow and deterministic output. Normal CI must need neither the upstream checkout
nor Pillow. Exact-source checks separately reject another HEAD or dirty Resources/src.
Source regeneration is explicit `--write`; default commands only verify committed output.
Runtime art approval, filtering, wrap/clipping and cooked residency remain integration gates.

## Import evidence

The approved deterministic height-descending/width-descending/source-ID shelf layout fits
all 711,308 original cutout texels in 1024×1024, with the final extruded row ending at 866.
Manifest entries remain source-ID sorted. Atlas RGBA storage is 4 MiB; original back/front
RGBA canvases add 1.5/2 MiB respectively, totaling 7.5 MiB before renderer copies, mipmaps
or runtime residency decisions. Input cutouts are separate and must be excluded from the
runtime catalog. These arithmetic sizes are not measured hardware memory.

Offline checks: eight repository-only importer/integrity tests passed in about 2.7 seconds,
including every source/atlas pixel and all extruded/unused transparent regions. The Node
bridge discovers this suite separately from the existing player-car suite, avoiding duplicate
execution. Both exact-source verification and repository-only deterministic reconstruction
passed. No engine, cooked, filtering, browser or movement approval follows from those checks.

```sh
python3 scripts/art/import-map01.py --source /path/to/clean/pinned/OutRun
# Deliberate regeneration, after reviewing the source/import contract:
python3 scripts/art/import-map01.py --source /path/to/clean/pinned/OutRun --write
python3 scripts/art/import-map01.py --committed
node --test scripts/environment-art.test.mjs
```
