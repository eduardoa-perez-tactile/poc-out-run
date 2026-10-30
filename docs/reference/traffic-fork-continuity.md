# Live Map1 traffic through forks and overlaps

Ticket #59 extends [traffic simulation](traffic-port.md) with authoritative traversal tests,
following the [traffic rendering delivery](traffic-rendering.md). It uses the unchanged
[committed Map1 data](../../outrun/assets/data/biomes/map01.json), derived from source commit
`6882721c99bc79365f815f68d389bf5078129e68`. It adds no production behavior, source content,
render fixture or campaign transfer.

## Actual road boundaries

Map1 has 150-unit segments, 4,123 authored rows, 6,083 total rows, choice marker 4,284 and
bounded live endpoint 5,883. The last 200 rows support lookahead. Mirror is true only for
rows 4,123–4,782. Road overlap means gap below 3,200; it is geometry, not a route event.

| First next row | Z | Previous → next gap | Meaning |
|---|---:|---:|---|
| 1387 | 208050 | 3200 → 3192 | First authored overlap |
| 4123 | 618450 | 22 → 90 | Generated fork and mirror begin |
| 4169 | 625350 | 3150 → 3218 | Fork roads stop overlapping |
| 4284 | 642600 | 10970 → 11038 | Source choice marker |
| 4482 | 672300 | 24434 → 24502 | Fork reaches plateau |
| 4783 | 717450 | 24502 → 24428 | Mirror ends; contraction starts |
| 5070 | 760500 | 3264 → 3190 | Roads overlap again |
| 5782 | 867300 | 3 → 2 | Residual gap reached |
| 5883 | 882450 | 2 → 2 | Exclusive live endpoint; park |

Source-generated gap steps remain discrete. For side 0, canonical X is
`f32(offset * 1600)`; side 1 adds its **own car row's** gap with f32 evaluation. Mirror
changes do not flip a car's logical side. OBSTACLE's local target instead subtracts the
**previous player row's** gap on the right road. This preserves the port's road-coordinate
adaptation; the original source used the player's gap for screen placement. Tests do not
require invented smooth X across gap steps or use projected art bounds as physics.

## Recorded setup and normal traversal

The [six `traffic.fork*` tests](../../outrun/tests/sim/traffic-fork-continuity.test.ts) enter the
real driving-traffic scene after recording a 1280 × 720, DPR-1 view, pause, record one driver reset and one seeded traffic reset,
then resume. Driver reset intentionally resumes play, so setup records another pause in
that same reset tick. Seed `9:2596069104`, population 32 and the existing public RNG stream
select slot 26/right and slot 30/left. After resume, both are active at speed 160. Their
first movement uses the pre-activation speed; offline tick estimates are not runtime evidence.

Fork, contraction and authored-overlap windows use only changed keyboard inputs after setup.
A deterministic controller follows the chosen source road while accelerating normally.
The endpoint window starts the driver at speed 180 and coasts. A stopped player would
legitimately recycle faster cars when they leave its 200-row active window; that initial
fixture failure did not demonstrate a production defect. Neither setup correction patches
individual cars, biome rows or traversal state.

Both selected generation-1 lifetimes cross every required row while active and nonparked.
The tests verify own-row f32 positions, stable epoch/side/generation, finite bounded AI state,
and actual near-player samples of all three AI classes. Same-road OBSTACLE samples assert
previous-player-gap targeting and bounded lane approach on both player arms. Every observed
passing award has a unique epoch/slot/generation and an actual swept separation crossing,
using the prior lifetime even if it recycles that tick. Source boundaries alone cannot award.

Endpoint assertions observe each original active car's first transition: ordinary speed
advance reaches 882450, then the car parks without changing generation or awarding a pass.
Twenty further running steps and recorded pause preserve those parked lifetimes; they do
not wrap into lookahead or create another map owner.

## Cross-lane evidence

All six explicit-landscape tests passed native V8/Hermes, cooked V8/Hermes and wasm.
Step counts, final hashes and complete boundary/AI/event logs match across all five lanes.
These final hashes include setup and trailing pause checks; checkpoint hashes printed in
boundary logs describe an earlier step. Every continuing/paused endpoint tick checks parked
state and forbidden awards; the other pause tails also inspect every tick.

| Scenario | Traversal ticks | Test steps | Final hash |
|---|---:|---:|---|
| Fork, player arm 0 | 671 | 684 | `ca14d0c838ca3979` |
| Fork, player arm 1 | 671 | 684 | `4725292193c5d3bf` |
| Return overlap/residual, arm 0 | 702 | 715 | `34ca2a0cbec5660a` |
| Return overlap/residual, arm 1 | 702 | 715 | `fc848d0595ca347a` |
| First authored overlap | 50 | 63 | `99c13094ca6cc16c` |
| Endpoint parking | 46 | 78 | `1f024468723e2bff` |

Each fork run recorded 10 selected-car crossings, 7 genuine unique passing awards and near
PACIFIC/EVASIVE/OBSTACLE sample counts 131/69/166. Same-road OBSTACLE target checks occurred
34 times on player arm 0 and 132 on arm 1. Each contraction run recorded 4 selected-car
crossings, 8 unique awards and near-AI counts 135/129/174, including 36/138 same-road
OBSTACLE checks. The short first-overlap case proves 2 crossings; it deliberately has no
near-AI or passing claim. Endpoint parked both original lifetimes at 882450 with no award.

Run the focused selection through the repository harness:

```sh
npm run test:focus -- 'traffic.fork*'
```

The engine declares `ViewInfo` as `sim:true`: viewport dimensions are recorded input and
contribute to the whole-world hash. Initial default-portrait setup therefore had different
whole hashes. After adding the intended landscape input, every observed physical boundary,
AI and passing trace and every step count stayed identical; current hashes above match
across all five lanes. Only the new unpublished tape was recorded again for that authored
input change. The ten existing canonical tapes and all goldens remain unchanged.

The new [right-arm fork replay](../../outrun/tests/replays/traffic_fork_fork_mirror_choice_and_plateau_follows_live_lifetimes_on_player_arm1.greplay)
contains 684 steps and verifies on native V8/Hermes with final hash `4725292193c5d3bf`.
It is registered unconditionally with `worldTest.replay`, so the full gate verifies the
stored hash stream automatically. This replay case also passed native V8/Hermes, cooked
V8/Hermes and wasm separately from the six live traversal tests.
Actual native GPU snapshots of this live replay at steps 300 and 678 rendered at 1280 × 720
on desktop mobile tier with `phone-low` residency. They show real traffic on the fork; each
reported eight draws and no validation errors. Repeated rendering preserved the entire
traffic pool and world hash at both snapshots; the private native host was stopped. These
are live-pool replay captures, not the presentation-only fixture used by the older fork test.

The initial portrait-aspect captures were rejected as landscape evidence. Render output size
alone does not replace a recorded view size; the accepted captures use the corrected tape.

Merge acceptance additionally requires independent review, the path-selected PR gate and
required exact-head CI; final commands/results and resulting commits are recorded in the
ticket PR. Parent #13 must be re-audited after integration. These Map1 results do not prove
Map2/Map3 handoff or complete campaign ticket #15. Physical-phone testing is excluded; no
hardware FPS, memory or thermal measurement is claimed.
