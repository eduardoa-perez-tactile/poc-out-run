# Source-compatible biome data

Ticket #67 extends the existing compiler to actual Map2 and Map3 immutable `SourceBiome`
records. Source revision: `6882721c99bc79365f815f68d389bf5078129e68`. The committed profile is
`sourceCompatibility-original`, fork gradient 0. This is data conversion and typed loading;
it does not implement route handoff, checkpoint rewards, a race finish or new environment art.
The original [Map1 compatibility reference](map01.md) still describes its unchanged profile.

| Source fact | Map2 | Map3 |
|---|---:|---:|
| Local objects / present property files | 36 / 30 | 39 / 29 |
| Authored / total segments | 4605 / 6565 | 4920 / 6880 |
| swapLine / lastLine | 4766 / 6365 | 5081 / 6680 |
| Checkpoint row / source line | 203 / 53 | 203 / 51 |
| Checkpoint object IDs | 35, 36 | 38, 39 |
| TIME / terrain / road terrain | 170 / 2 / 0 | 160 / 2 / 0 |
| Definitions / candidate placement writes | 196 / 4491 | 148 / 4153 |
| Winner placements / overwritten writes | 3692 / 799 | 3702 / 451 |
| Maximum winners in 200 rows | 237 | 396 |
| Left / right / sequential successors | 4 / 5 / 3 | 5 / 6 / 4 |

Counts follow the source hold multipliers, hill-left/right leave=enter compatibility bug,
end-exclusive sprite groups, absolute-row frequency and last-writer wins. All 75 local object
IDs appear in authored definitions. `src/Game/Game.cpp:103–139` prepends shared/start objects
only for Map1; Map2/3 do not inherit its 45 shared objects or 19 start placements. Checkpoint
objects begin the placement prefix at row 203, with IDs 1016 and 1019. A checkpoint here is an
immutable source marker, not an emitted gameplay event or evidence that a timer bonus works.

Source PNG dimensions, paths and SHA256s plus optional property text/defaults are preserved
in committed fixtures. No source PNG tree is copied into runtime assets. Collision widths,
scales and collision pivots remain physical source metadata independent of future atlas packing.
Map2 object 35 has right collision pivot .64; object 36 has .936. Both Map3 checkpoint objects
have .936. Do not normalize the intentional asymmetry. Missing properties retain source defaults;
object 1 in both maps is 40×128, collision enabled, width 40, scale 1, visual pivots [1,1]/[0,1]
and collision pivots [.5,1].

## Reproduce and load

Run commands at the repository root. Normal verification requires only committed fixtures and
Python stdlib; an upstream checkout or Pillow is unnecessary.

```sh
python3 -m unittest discover -s scripts/content -p 'test_*.py'
node --test scripts/content.test.mjs
python3 scripts/content/convert-map.py --map 2 --fixture scripts/content/fixtures/map02-source.json --fork-gradient 0
python3 scripts/content/convert-map.py --map 3 --fixture scripts/content/fixtures/map03-source.json --fork-gradient 0
npm run test:focus -- 'content.biome*'
```

Source regeneration uses `--map 2` or `--map 3` with `--source /path/to/clean/pinned/OutRun`;
`--write` intentionally regenerates reviewed fixtures/output. Existing Map1 calls default to 1.
Source mode checks the pinned HEAD and tracked Resources/src cleanliness. Malformed path, ID,
hash, syntax, numeric or placement bounds fail visibly rather than silently dropping records.

`loadSourceBiome(1|2|3)` requests immutable records through explicit asset keys only when called;
unsupported runtime IDs throw. `loadMap01()` and gameplay callers remain unchanged. Importing
the module makes no eager API calls. This does not imply that the host defers raw data preload
or that each biome is downloaded separately.

The native desktop cook comparison adds exactly two base data entries: Map2 898618 bytes and
Map3 890051 bytes, with no removed entries or added textures/art. Existing Map1 remains 779901
bytes; all three raw data payloads total 2568570 bytes. The compressed base.gpak grows from
757261 to 865126 bytes (+107865), code.gpak from 154306 to 154538 (+232), and their combined
size from 911567 to 1019664 (+108097). Catalog entries increase 45→47 (base 42→44; code 3 unchanged).
The only changed existing file entry is src/main.ts (561029→561079 uncompressed bytes). These
are this candidate's native desktop package measurements, not web download or phone memory data.

An isolated observational copy, using only public listData/loadData/assets.stats, passed in loose
and cooked V8/Hermes. Before explicit reads and after first/repeated Map2/3 reads, the loose
host's resident.data counter stays 0; the cooked host already reports 2568570 before reads and
stays there. Texture/audio counters remain 0 and all four art groups remain unloaded. SIM hashes
are unchanged by the reads. The counter therefore demonstrates cooked raw preload, not the size
of decoded JS objects, JS cache/heap, RSS, or additional allocations; zero loose data bytes does
not mean zero JS memory. No on-demand network/residency guarantee follows from the lazy API.

Tests named `content.biome*` read actual typed assets and use source-derived counts, palette,
curve/relief samples, first/authored/tail boundaries, checkpoint metadata, complete prefixes and
specific overwritten winners. They do not synthesize route events or patch actor state. Native
V8/Hermes, clean cooked V8/Hermes and wasm execution remain required evidence; this document
does not declare an unexecuted lane passed. Map1 fixture/output/numeric oracle, source art,
goldens and all 13 existing canonical tapes must remain byte unchanged. New maps do not inherit
Map1's narrow measured numeric-oracle exceptions.

## Extracted arithmetic comparison

The complete host C++ audit compares all 6565 Map2 rows and 6880 Map3 rows across y0, y1,
curve and gap. Map2 has 19 differing fields (9 y0, 9 y1, 1 curve), at most 12 ULP and
0.0009765625 absolute difference. Map3 has six differing height fields, at most 1 ULP and
the same maximum absolute difference. Every gap is exact. Earlier two Map2 height pairs were
only sampled evidence; they do not describe the complete difference set.

This compares independently parsed source command streams with the unchanged extracted
`numeric-oracle.cpp` kernel on the audited host. It is not an original-game run. The committed
geometry remains the deterministic Python-f32 compatibility profile; no runtime value or output
is adjusted. Versioned `scripts/content/fixtures/maps23-numeric.json` records the exact known
source/port pairs and stream hashes. Normal stdlib checks verify those records; the optional
all-row checker accepts only the recorded exact pairs. There is no generic/runtime tolerance,
and Map1's numeric exceptions are not applied to these maps.

After generating the reviewed data assets, reproduce the optional comparison from the root:

```sh
clang++ -std=c++17 -O0 -ffp-contract=off scripts/content/numeric-oracle.cpp -o /tmp/outrun67-numeric-oracle
python3 scripts/content/check-numeric-oracle.py --map 2 --binary /tmp/outrun67-numeric-oracle
python3 scripts/content/check-numeric-oracle.py --map 3 --binary /tmp/outrun67-numeric-oracle
```

The complete audit is arithmetic evidence, not proof of native/cooked/wasm execution or rendering;
those lanes require their own exact-candidate results.

## Density and remaining catalog work

Map2/3 data permit at most five unique slots per row, giving a structural upper bound of 1000
winners in a 200-row window. Map1 retains its existing 256 compiler/renderer diagnostic policy.
The actual Map3 maximum 396 exceeds that renderer's capacity: these assets are not a claim of
render-ready Map3. Its later environment child must preserve every source winner, explicitly
size/profile a real dense scene and prove cooked readiness, pixels and desktop phone-low
residency. Do not drop objects or blindly raise budget caps. Texture admission must also avoid
the known 8 MiB upload trap where ongoing mesh uploads can prevent a full-budget texture upload.

#22 retains all 15 maps, the genuine procedural goal/start-end additions, all 14 player selections,
32 traffic variants and category-wide visual/cooked acceptance. #15 owns real graph decisions
and actor-preserving handoff; #16 owns clocks/results; #19 owns authentic complete-race evidence.
Map2/3 metadata alone cannot prove a successful race or justify a one-biome finish shortcut.
No new art/golden approval, browser visual claim or phone measurement is made by this data child.
