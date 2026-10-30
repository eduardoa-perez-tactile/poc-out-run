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

## Runtime filtering decision

Use linear sampling at explicit texture level zero for the projected prop atlas and the
independent panorama layers, with cooked mipmaps disabled. This is an intentional presentation choice, rather than a claim of exact
sampling equivalence with the upstream SFML default. Original input/atlas pixels remain
unchanged. Point sampling was compared at the same near/middle/far palm poses, at the start
banner, and during seven consecutive fixed-step frames at the start, hill and dense presets.
The motion pairs use identical recorded preset/KeyP inputs and matching camera distances:
45120–45840, 54120–54840 and 289620–290340, advancing 120 source units per step.

Point sampling preserves sharper enlarged banner/spectator pixel clusters; linear sampling
softens those edges but gives calmer distant palm, surf and crowd detail while keeping the
silhouettes and direction signs readable. The coordinator and independent reviewer inspected
both cooked point/linear candidates and nine cooked linear motion frames at the same
start/hill/dense distances. Cooked distant foliage and surf are visibly more granular than
the loose preview with generated mips; that loose-only observation is superseded for the
single-level decision. The comparison covers short native 1280×720 sequences; it does not prove
that subpixel shimmer is eliminated or establish performance on physical phones.

The loose PNG preview automatically builds mipmaps in engine 0.1.21, regardless of the cook
setting. Cooked KTX textures preserve `mipmaps=false`. Both cooked point/linear palm poses
were captured separately; the loose moving comparison alone cannot approve cooked sampling.
Residual high-frequency speckling remains visible in the cooked minified scenery.
No explicit cooked mipmap candidate was compared. No mipmaps is the bounded initial policy: three source-sized
textures total 7.5 MiB RGBA, and the packed cutouts have a two-texel guard rather than isolation
for a full mip chain. This does not establish that mipmaps would look worse. Revisit the policy
if longer gameplay or smaller viewports expose unacceptable distant aliasing. Panorama V
coordinates clamp to the sampled top-253-row range to prevent the repeat sampler from mixing
the opaque bottom into the transparent top; horizontal coordinates remain continuous/repeating.
Browser movement/wrap, final viewport goldens and actual residency remain separate evidence.

Comparison artifacts: `/tmp/outrun-env40-filter-compare/`,
`/tmp/outrun-env40-filter-motion/observations.json` and the adjacent 42 frame captures;
`/tmp/outrun-env40-live-{linear,point}.png` proves the material hot-reload comparison.
Cooked comparisons are in `/tmp/outrun-env40-filter-compare/cooked-{linear,point}/`
and `/tmp/outrun-env40-filter-motion-cooked/`. These are review artifacts, not source-image
oracles or approved golden files.

## Runtime cost evidence

The canonical travel fixture starts from the configured project scene, enters the art scene
through recorded input, selects the dense preset, and plays 122 fixed steps. A cooked mobile
phone-low run progressed from 289500 to 304140 source units, drawing 105–126 props while
visiting at most 134 placements. Four owned mesh instances plus the capture target's
`post.present` blit cost five draw calls. The recorded frame had zero newly created pipelines.
This is a preview transport check, not a completed race or a hardware performance measurement.

Actual submitted vertex/index arrays total 452,760 bytes over four mesh API calls per render
frame (55,236,720 bytes over the measured travel interval). `meshes.info` reports 477,456 CPU
bytes for the four owned meshes: road 417,600, props 59,392 and two panoramas of 232 each.
The SDK documents a GPU copy; these numbers do not measure GPU bandwidth or process RSS.
Counters distinguish cumulative submissions from submissions in the current `RenderTime.frame`.

The selected eight-member cooked group charges 7,864,400 resident bytes. Its three single-level
RGBA textures contribute 7,864,320 bytes and five material uniform buffers add 80 bytes; the
engine's `resident.textures` counter includes those buffers. Loose previews instead charge
10,485,864 bytes: the PNG loader generates full mip chains (10,485,784 bytes) plus the same
80 bytes. This distinction is observed runtime behavior, not a duplicate-copy estimate.
The fixture bounds either selected-group path to 11 MiB; the project's engine phone-low
texture budget remains 128 MiB. Released groups can remain cached until residency pressure
evicts them; release assertions do not claim immediate physical memory reclamation.

Evidence: `/tmp/outrun-env40-profile-cooked-final.json`; the initial failed four-draw and
8 MiB assumptions are retained in `/tmp/outrun-env40-profile-first.json` and
`/tmp/outrun-env40-profile-measured.json`. The fifth draw was confirmed against frame passes
and the pinned renderer's presentation-blit accounting. The recorded travel tape verifies on V8/Hermes. Its first full mobile structural run passed
five draws, zero runtime pipeline creation, zero GC pauses over 4 ms and 13.50 MiB JS
allocations. All older scenario budgets also passed. This run still failed the eight unapproved
new screenshots and the old vehicle test's global-cache assumption; it is not a passing full
visual gate. The narrow panorama seam was then reproduced by a pixel assertion before repair.
All-tier pipeline refresh after the material repair, cooked catalog inspection, final visual
gates and browser evidence remain required.

## Narrow viewport regression and sampling repair

The first full mobile visual review exposed a one-pixel horizontal panorama line at y=116
in 882×344: its pixels were `(42,152,255)` instead of sky `(0,148,255)`. The base-level V
clamp alone could not stop the larger footprint of loose generated mipmaps from wrapping
opaque bottom texels into the transparent top. A first-covered-row pixel test reproduced
that failure before the repair. Both environment materials now use the supported custom
WGSL `textureSampleLevel(..., 0.0)` operation. They sample the authored base image in loose
and cooked builds, preserving horizontal repeat, the top-253-row crop and all source pixels.
No transparency mask or artwork crop hides the error. The repaired narrow row is sky at all
five sampled positions; pixel-only checks cover the other four required landscape sizes.
Loose mip allocations remain charged even though the shaders no longer sample those levels.
The earlier implicit-LOD pipeline recording must be refreshed for the changed programs.

After the LOD0 repair, all-tier recording refreshed mobile/desktop/compat pipeline coverage
(16/26/16 entries). The full mobile run had 125 cases: 117 passed and the eight new images
awaited review; every older case, including the car cache test, passed. All six structural
budgets passed; the repaired environment replay measured 12.46 MiB JS allocations with the
same five draws, zero new pipelines and zero GC pauses over 4 ms. The eight new mobile images
were inspected by coordinator and independent reviewer. Compat captures passed all other
assertions and decoded to exactly the same full RGBA pixels/dimensions as those approved
mobile images. Only those sixteen new golden paths were approved. Existing golden/replay
bytes remain unchanged. This visual approval does not replace the final PR/browser gates.
