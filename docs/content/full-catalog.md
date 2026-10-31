# Complete immutable biome catalog

Ticket #69 extends the [existing compatibility profile](source-biomes.md) to ordinary Maps4–15
and a genuine populated goal. Source pin: `6882721c99bc79365f815f68d389bf5078129e68`.
These are ORIGINAL gradient-0 data assets. They do not activate routes, emit checkpoints,
award time, render new environments or complete a race. Maps1–3 fixture/output bytes and
all 13 existing canonical tapes must remain unchanged.

| Map | Authored / total rows | Checkpoint | Local objects | Winners | Maximum / 200 rows |
|---|---:|---:|---:|---:|---:|
| 4 | 4420 / 6380 | 202 | 48 | 20989 | 1000 |
| 5 | 4220 / 6180 | 202 | 53 | 9329 | 660 |
| 6 | 4190 / 6150 | 202 | 51 | 2121 | 120 |
| 7 | 4520 / 6480 | 202 | 38 | 1832 | 167 |
| 8 | 3930 / 5890 | 202 | 35 | 7619 | 416 |
| 9 | 4250 / 6210 | 202 | 33 | 4006 | 327 |
| 10 | 4080 / 6040 | 202 | 51 | 8365 | 494 |
| 11 | 4260 / 6220 | 202 | 27 | 1801 | 136 |
| 12 | 4300 / 6260 | 202 | 41 | 8882 | 460 |
| 13 | 4070 / 6030 | 202 | 40 | 4297 | 310 |
| 14 | 4720 / 6680 | 203 | 41 | 3053 | 276 |
| 15 | 4370 / 6330 | 203 | 49 | 4107 | 339 |
| Goal 16 | 1050 / 3010 | absent (-1) | 45 shared | 383 | 187 |

The 507 new ordinary local records retain source PNG dimensions/hashes, optional properties,
collision metadata and independent visual/collision pivots. Source hold factors, effective
hill leave=enter, end-exclusive placement groups and last-writer semantics remain intact.
The 20000 safety limit bounds segments, not placements: Map4's 20989 winners are valid.
Five unique slots × 200 rows permits 1000 DATA winners; this is not a renderer budget.
The existing Map1 renderer's capacity 256 is unchanged. New destination art/density/readiness
requires its own measured acceptance before live route use, including the known 8 MiB texture
upload admission trap. No source PNG tree or new runtime atlas is imported by this child.

## Genuine goal provenance and semantics

`Biome.cpp:223–269` supplies TIME 80, the actual goal palette, 350/350/350 straight base rows,
45 shared MapStartGoal objects and shared front/back references. The actual back PNG is
**2182×256**, front 2048×256; ordinary-map panorama dimensions are not a goal oracle.
`Map.cpp:625–642` also appends the route tail on goal entry, giving 3010 rows for ORIGINAL
with gradient 0. The forced +1 fifth-ordinary-stage condition is not the goal-entry condition.
Sequential geometry and other gradient profiles remain separate work.

`Logger.cpp:1410–1594` constructs 938 definitions and issues 941 writes, producing 558 overwrites,
383 final winners and 187 maximum/200 rows. The three final logLeft/logRight/endFlag definitions
are reused at two rows each. The crowd's j starts 250, advances 3 while j<668, reaches 670 and
repeats there; the 668…681 contraction loop later replaces relevant far slots. Preserve the
source if/else-if divisor priority 52,60,55,63,65,74,95,70,80,90. At 504 the final near-left flagger
coexists with surviving near-right crowd; log pairs occupy 505/682 and flags 506/683. These are
static initial recipe records; dynamic flagger/semaphore presentation remains future work.

The goal's terrain/roadTerrain int members are uninitialized in the original constructor and
setGoalBiome (`Biome.h:73,76`, `Biome.cpp:39–69,223–269`). The deterministic GOAL-ONLY policy
`goal-terrain-defaults-v1` authors terrain 1 (SAND), roadTerrain 0 (NORMAL). These are approved
port values, not original source assignments. Ordinary maps are unaffected. Goal checkpointLine
-1 and semantic hasCheckpoint=false deliberately encode the source start/goal checkpoint
exclusion (`Map.cpp:863–867`), rather than exposing the C++ default 0 as a usable checkpoint.
Goal 16 is explicitly terminal; row>=500 end-animation termination is not a converter finish event.

## Portable offline offset realization

The original `random_float` uses nondeterministic MT entropy and a C++ float distribution,
including descending endpoint calls. Its portable distribution precondition is violated by those
calls. `goal-offsets-sha256-u24-v1`, seed 0, is an explicit authored portable realization:

1. For i=0…50, hash the UTF-8 bytes represented by
   `outrun-goal-offsets/v1\n6882721c99bc79365f815f68d389bf5078129e68\n0\n{i}\n`.
   Each `\n` means one LF byte 0x0A; i is unpadded ASCII decimal.
2. Read the first three SHA256 bytes as an unsigned big-endian integer n; u=n/16777216.
3. With q=IEEE754 binary32 rounding and original ordered endpoints, compute
   `a32=q(a); b32=q(b); delta=q(b32-a32); product=q(delta*u); value=q(a32+product)`.
   No FMA, endpoint sorting, clamp, skipped sample, retry or extra random call.

The committed goal fixture contains all 51 source call contexts/lines/object IDs, original endpoint
tokens, integers, units and final bits. The first descending call (`i=270:man1`) uses n=3831896,
bits=3205929213; the next call n=12007545/bits=1060946778. Independent scalar C++ stages compiled
with `-O0 -ffp-contract=off` confirm these and additional negative/last-call bit witnesses.
This is extracted arithmetic, not an original-game run or a reproduction of its random stream.
No gameplay RNG or runtime geometry generation is consumed by immutable content loading.

## Explicit data groups and startup

The complete generated catalog has **14818758 raw data bytes**, above the pinned engine's
4 MiB automatic raw-data preload cap. Its native preload decision is all-or-none
(`assets.rs:451`): increasing the catalog past that cap disables automatic raw preload for
every data record. The previous three-map PR68 measurements are historical, not current
full-catalog preload or package totals.

The project declares 17 single-data groups: `biome-map01-data` through `biome-map15-data`,
`biome-goal-data` and `biome-catalog-data`. Importing `content/biome.ts` makes no eager data
calls. The separate game-entry `content/biome-boot.ts` explicitly requests only
`biome-map01-data` and `biome-catalog-data` with public `assets.load`, then primes public
`loadMap01()` and `loadSourceBiomeCatalog()` outside SIM. This supplies existing startup
readers without pinning the whole catalog. Future map activation must load and prime its data
outside SIM and establish readiness first; asynchronous assets must not choose simulation
outcomes or become a hidden dependency of a fixed-step read.

The focused cooked V8/Hermes startup regression first exposed missing groups, then passed with
both startup groups loaded and the other 15 data groups unloaded; the first source step's hash
was preserved. Public record reuse is not a JS heap measurement, and group declarations do
not guarantee deferred network downloads or certify phone memory/performance.

### Measured candidate evidence

The final preservation run passes all 235 native V8 tests. The previous 220 outcomes, 217 available
full trace files and all 25 immutable baseline files remain unchanged, including all 13 canonical
tape bytes. This preservation proof does not substitute for the still-pending full gate/CI.

Compared with PR68, the desktop cook adds exactly 14 data entries (Maps4–15, goal and catalog),
with no removed entries or added art. Its 17 raw data entries total 14818758 bytes. Compressed
code.gpak changes 154538→156486 bytes; base.gpak 865126→1577908; combined 1019664→1734394,
a measured increase of 714730 bytes. The changed existing cooked source entries are src/main.ts
561079→563115 bytes and project configuration 2173→4044. These are native desktop package
measurements, not inferred JS memory or browser download costs.

An isolated cooked cold-start experiment removes only the boot import: it fails with exit 1 and
an actual synchronous Map1 frame-IO error. Exact source restoration then passes 120 steps with
no reported errors. The separate public hot-reload proof changes the invalid-ID error literal
and recompiles the bundle: reload takes 32.998 ms on this desktop, with same-step world hashes
preserved. Fresh callbacks observe the changed message at step 3 and restored message at step 4;
all source/bundle changes and the owned host are restored/cleaned up. Unchanged system bodies
correctly produce an empty changed-system list despite the changed helper literal. Both requested
data groups report progress 1, failed[] and raw residency 783886 bytes (779901 Map1 + 3985 catalog);
the remaining 15 data groups stay unloaded. The existing Map1 road/car screenshot was reviewed
by the coordinator and an independent reviewer. It proves no destination rendering.

The cold-start and reload proofs were independently reviewed. The running full gate and exact-head
CI are still pending; no final gate/merge claim, new environment/browser pixel claim or phone
measurement is made here.

## Reproduce and validate

Run from repository root. Normal verification needs only committed fixtures and Python stdlib:

```sh
python3 -m unittest discover -s scripts/content -p 'test_*.py'
node --test scripts/content.test.mjs
python3 scripts/content/convert-map.py --map 16 --fixture scripts/content/fixtures/goal-source.json --fork-gradient 0
```

Source mode uses the clean pinned checkout guard. `goal_recipe.py` validates exact complete
implementation and function-excerpt hashes, shared object/property records and panorama
provenance. It returns construction definitions and ordered writes only. The existing converter
owns geometry expansion, property assembly, winner folding, prefixes and output serialization;
there is no second goal geometry compiler or fabricated goal map.txt.

Acceptance additionally requires full-row extracted C++ comparisons for every new row/field,
only independently captured exact per-map differences, public catalog discovery and actual typed
loads on native/cooked V8/Hermes and wasm, the post-#67 baseline 220 outcomes/full available traces,
immutable file/tape preservation and exact-candidate gates/CI/independent review. This guide does
not claim those lanes passed before their results exist. API laziness, raw cooked preload,
public immutable record reuse and packaged bytes must be reported separately; none measures
JS heap, phone memory or web download size by itself.

#22 retains all 15 maps, genuine goal, 14 player selections, 32 traffic variants and visual/catalog
acceptance. #15 owns authentic route/profile/handoff and actor continuity, #16 clocks/results,
#19 the real race milestone. One ORIGINAL success needs five ordinary stages and the actual goal;
a complete immutable catalog alone does not establish campaign, mode or visible race completion.
