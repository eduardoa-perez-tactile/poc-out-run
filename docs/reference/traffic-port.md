# Traffic simulation port

Ticket #53 implements the simulation foundation of parent #13. Ticket #54 supplies the
source traffic catalog, projected sprites, painter ordering and actual busy-road visual
checks. This document describes the intended simulation contract and its source corrections;
it does not claim traffic pixels, collision/crash handling, race score aggregation or campaign
transitions are already implemented.

The reference is OutRun commit `6882721c99bc79365f815f68d389bf5078129e68`, particularly
`src/Game/Game.cpp`, `src/Scene/Map/Map.cpp`, `src/Car/TrafficCar/TrafficCar.cpp`,
`src/Car/PlayerCar/PlayerCar.cpp` and `src/Car/Vehicle/Vehicle.cpp`.

## Authority and bounded work

One simulation `TrafficPool` component holds 32 fixed slots on the source-driving scene's
owner. Selected populations are exactly 9, 20 or 32; unused lanes remain zero and inert.
Model ID is slot + 1. Slots retain stable identity while generation identifies each recycled
lifetime; reset epoch distinguishes identical seeded layouts from different full resets.
Position, offset, speed, side, AI category and AI phase belong to this component. Texture size,
projected position, visibility, asset loading and presentation frame rate cannot alter them.

`AdvanceTraffic` owns creation, activation, random ties and recycling after authoritative
driving. Per fixed tick, movement, activation and AI run first in ascending stable slot
order; finalize then performs recycling draws in ascending slot order. This deliberately
phased order differs from the source per-car interleaving; the original unseeded entropy
sequence is not a parity oracle. Helpers receive the borrowed RNG; they do not retain or
reseed it. `TrafficResetRequested` explicitly reseeds this system's stream using its recorded
seedLo/seedHi and the fixed traffic stream domain. A paused initialized pool consumes no draws.
A native owner-query condition skips the system before dispatch in other scenes. Leaving the
scene does not promise to erase the engine's historical RNG stream or restore a cold-world
hash. Equal fresh worlds and equal recorded histories remain the determinism requirement.

The bounded Map1 proof uses the existing cooked logical data. Sampled rows are checked before
access, and invalid end/negative positions are parked rather than wrapped with unchecked
modulo or silently dropped. There is no campaign routing policy here: #15 owns real biome
transition policy. Traffic loops over at most 32 selected slots and uses direct row sampling;
it does not scan every road segment for every car.

## Source layout and movement

The first six source cars begin at segments 190, 170, 165, 160, 155 and 150, with speed 120,
offsets .5, 0, -.5, -.25, 0, .25, right-road side and initially inactive. `originZ` is an
explicit recorded world shift added to these source positions, independent of the camera.
Later slots use the source low/medium/high ranges of 500–700 / 500–900 / 500–1100 segments
in 100-segment increments, speeds 100–160 in tens, offsets integer[-6,6] × float32(.15), and
seeded side 0/1. Category cycling and the source extra advance before slot 7 are explicit.
Activation rerolls speed and category; Pacific updates require no random draw.

The proof scene starts camera 45000, speed 0, gear 0, population 32. First-six traffic starts
behind the player but within the source 1600-segment movement window. The canonical busy
profile waits 200 stationary fixed ticks for real catchup, then uses a recorded driving reset
to speed 180 at the same camera and real keyboard throttle. It does not reuse the terrain
fixture's camera 300000, where initial source cars would freeze beyond the update window,
or claim to implement the complete source introduction/race sequence (#16).

Traffic movement is float32 `speed × 60 × dt`, not integer-truncated source draw movement.
Strict segment activation endpoints and equality retention follow the source; final Map1
bounds park the car. Driver recentering does not itself pause traffic. Authoritative driving
pause freezes movement, cooldowns and random draws.

## AI and deliberate source corrections

| Category | Port behavior |
|---|---|
| Pacific | Retain the current bounded lateral position. |
| Evasive | Within 20 segments, including cars on the other road, choose the farther lateral edge; a tie consumes one RNG draw. Approach target ±.5, bounded ±.9, at .3 offset units/second without overshoot. On arrival wait exactly 200 eligible nonparked selected fixed ticks before selecting again. |
| Obstacle | Within 20 segments on the same logical side, approach the player's same-side normalized offset, bounded ±.9, at .3 units/second in either direction without overshoot. |

AI updates eligible nonparked selected slots, including inactive cars behind or on the
player's segment; the visible/active flag is not an AI gate. This preserves the source
Map::controlAiTrack invocation outside the activation switch. Paused traffic still freezes.
The explicit 200-tick evasive cooldown corrects the source missing-brace/counter behavior;
its behavior must not be described as an exact literal line-by-line port. All motion, target
and cooldown phase fields initialize deterministically. Obstacle movement corrects the source
right-road double-add so it approaches the target consistently rather than using a
carriageway-dependent overshoot. These choices are tested boundaries, not random tuning.

Logical X is `offset × 1600 + (side ? gapAtThatCarZ : 0)`. Side remains owned by the lifetime
until recycling, even when the carriageways overlap. Player targeting normalizes against the
player's own sampled gap. This canonical per-car gap intentionally differs from the source's
use of the player's gap for every traffic car. #54 will map canonical side/offset onto the
selected projected road arm; the current source-style renderer uses the player's gap for the
right-arm projection. Its apparent pixels never become collision or AI authority. #14 must
use logical coordinates and a separate collision footprint, never PNG width.

Source close/far sprite state also has an uninitialized/sticky proximity flag (same-segment
collision path fails to refresh it). #54 should derive proximity afresh rather than preserve
undefined state. Source perspective direction depends on car versus player world X, not
lateral velocity. These presentation facts do not add a simulated sprite state to #53.

## Passing, resets and transition hook

A previously active eligible lifetime passes when continuous relative separation changes
from >=0 to <0. It emits `TrafficPassed {epoch, slot, generation, points:20000}` once, in stable
slot order. This corrects the source's whole-segment behind check. #16 owns score consumption;
no provisional full race score or crash state is added here.

Advance and finalize form an explicit insertion point for #14: movement produces pass
candidates, collision eligibility masks each slot, then finalize consumes the lifetime and
performs replacement. Denied eligibility still latches consumption, preventing a later false
bonus. Until collision lands, the adapter allows all eligible candidates; pure tests exercise
the deny mask so the seam is functional rather than an unused placeholder.

Recorded full reset uses the last reset event, reproducible layout/RNG draws, and a new epoch.
Layout equality excludes deliberately different epochs. `DrivingResetRequested` suppresses
passing that tick and snaps previous traffic poses to current without silently reseeding the
traffic stream. A driver teleport is not a swept overtake.

Recorded `TrafficRebaseRequested` subtracts shift from traffic Z while preserving valid
lifetimes, epoch and generations, and snaps previous poses to current. Invalid negative/end
slots park inactive at bounded stored positions with speed zero and no invented bonus. The
caller must rebase authoritative driver coordinates consistently. Actual campaign handoff is
outside this Map1-only hook and remains #15. Input requests without a sole traffic owner do
not create a pool in a preview or menu scene.

## Evidence and coverage

Focused `traffic.*` tests cover pure source boundaries plus recorded scene entry, seeded
9/20/32 resets, unused lanes, last-request precedence, pause, owner removal/reentry, reset and
rebase pass barriers. `traffic.profile` starts at the normal project scene and records the
busy catchup/drive/pass/recycle/pause flow; root records a canonical replay after the tests
pass. Event observations read the native current-step rows, not a system's combined
previous/current view; lifetime IDs and stable ordering catch duplicate awards.

The coordinator validates the exact candidate with native V8/Hermes and wasm parity, cooked
coverage, hot-reload state preservation and the applicable PR gate. Eight pre-existing
canonical tapes (seven have structural budget fixtures) must continue verifying unchanged;
never rehash them merely to pass. See [workflow](../workflow.md) and
[test matrix](../test-matrix.md). Test results and measured timings belong in PR evidence;
this design reference alone does not claim those lanes passed. The heavily asserted T0
profile repeatedly decodes native world state; its script allocation/GC totals include test
instrumentation and are not a structural gameplay budget. Measure the recorded tape
separately before claiming runtime allocation or GC evidence.

#54 remains responsible for all 32 variants / 512 source frames, ordered prop/traffic alpha
composition, projection/cropping, actual busy-road screenshots/browser play and measured
residency/draw/upload checks. No physical-phone test is required. Desktop structural evidence
is not a claim of phone frame time, RSS or thermals. Browser tests must remain in the
background and preserve user focus; unavailable required lanes stay visible.
