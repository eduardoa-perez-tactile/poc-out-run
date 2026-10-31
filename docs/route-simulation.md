# ORIGINAL route simulation

The optional route scene integrates five ordinary stages from the real 15-map graph, then genuine
goal 16. It starts at source camera **45000**, lateral 0, speed 0 and gear 0. This is route simulation
and source-arrival work (#73). Live route presentation is #74; clocks, ending roll/brake, scoring
completion/results and restart remain #16. Parent #15 and race milestone #19 remain open.

Source references below use revision `6882721c99bc79365f815f68d389bf5078129e68`. They describe
extracted source code, not measurements of the original game or random-device/MT bit parity.

## Ownership and immutable startup

One entity co-owns `RouteDriver`, `RouteTrafficCoordinates`, `TerrainDriver`, `TrafficPool`,
`CollisionDriver` and `CrashDriver`. Handoff preserves that entity and its traffic lifetimes;
it does not use EnterScene or a reset/rebase input event to replace the next biome. Worlds without
a route owner retain their existing bounded proof behavior and native RNG ownership.

`src/content/route-boot.ts` reads the 16 immutable bases, catalog and compact tail profiles during
module evaluation, before fixed steps. `createRuntimeProfileSourceAccessor` composes frozen
−1/0/+1 views once; `originalRouteSources().get(mapId,gradient)` is thereafter only a lookup.
Gradient 0 retains the existing record. Authored rows and metadata remain shared; nonzero profiles
replace source tail heights, without a runtime geometry compiler. Missing/invalid mounted content
fails at startup, including direct replay, cooked/web and reload paths. No first-use IO/parse or
asset-progress read occurs in active route SIM. This startup acquires no asset-group pins; that
says nothing about raw data, decoded heap, web download size or later art readiness.

`RouteDriver.camera/previousCamera` and `RouteTrafficCoordinates.rawZ/previousRawZ` retain source
integer authority. `hydrateRouteTrafficPool` validates epochs and restores raw coordinates for
SIM; `packRouteTrafficPool` publishes canonical f32 presentation mirrors separately. Never recover
an unwrapped position or lap from those mirrors, especially for odd integers above 2^24.

## Fixed-step transaction

Source `Game.cpp:719–737` processes controls before `Map.cpp:552–657`: outgoing traffic moves and
runs AI, player longitudinal movement happens once, then choice/entry commits before destination
crash/contact/CF/bounds (`Map.cpp:684–746,781–823`). The port preserves that physical order:

1. `AdvanceDriving` leaves route-owned integration to the route transaction. Guarded `AdvanceRoute`
   prepares pure controls/longitudinal operands, selects a profile with its own native RNG, and
   stores a schema-owned pending intent. It does not prematurely commit actors into the new map.
2. The existing **AdvanceTraffic** invocation runs `commitRouteActors`: outgoing movement/AI and
   old-life pass candidates; prepared player movement; destination finishing and contact eligibility;
   one old-life finalize/recycle; then literal transfer of the finalized pool. The same native stream
   supplies activation, AI and recycle draws. There is no second traffic advance or finalize stream.
3. Handoff snaps camera 0 and discards overshoot, subtracting the actual outgoing integer camera
   from NPC coordinates (`Map.cpp:644–653`). Side/AI/epoch/generation, speed/gear/holds and running
   crash operands/counters survive valid transfer. Negative transferred positions park under the
   explicit safe policy; finite positive aliases are not discarded at lastLine or full-map length.
4. `BeginCrashRecovery` remains the separate native RNG owner after the producer. Immediate physical
   latch/count/step validation starts a genuine accepted impact once on its hit tick; deferred public
   events are not read back to discover that same-tick hit.

Strict route comparisons use the selected real profile: sampled player row **>swapLine** latches
prior stored canonical side once; **>lastLine** enters the destination. Equality does not cross.
Player sampling includes offset 702 and modulo totalCount (`Map.cpp:580,657`). A destination checkpoint
crosses only at **>checkpointLine**, once per map epoch; Map1 and goal have none (`Map.cpp:863–868`).
Map2/3 row 203 therefore first awards at row 204/camera 29898: +90/+85 integer seconds. ORIGINAL stage
factors are .53125/.5/.46875/.4375 (`Globals.h:95–98`, `Game.cpp:771–784`). These are bonus events/
latches, not a clock implementation.

## Integer movement and canonical aliases

Source camera/initial camera/track length are int (`Map.h:61,64,70`), and NPC posZ/setPosZ are int
(`Vehicle.h:86`, `Vehicle.cpp:118–119`). At nominal 60 Hz, camera/NPC movement rounds the FLOAT
expression **before truncation toward0**, e.g. `trunc(fround(fround(position)+speed))`; do not truncate
speed first or accumulate fractional distance. Traffic-crash retreat uses the rounded half-speed
subtraction, then clamps to 0 before full camera wrap (`Map.cpp:559–577`). Speed/lateral remain f32.
Source initial acceleration is100/6.5 (`PlayerCar.cpp:63–65`); first four throttle assignments from
45000 leave cameras 45000,45000,45000,45001. Recycle addition and handoff subtraction retain integer
semantics; overflow is an error. Legacy ownerless f32 proof integrators are unchanged.

Source keeps raw NPC Z unwrapped while sampling `floor(z/150)%totalCount` for AI, rendering and
contact (`Map.cpp:343,350,358,798,1190–1193`; `PlayerCar.cpp:838–844`). `sampleRouteZ` exposes raw Z,
absolute row, lap, canonical row/position and source fraction. Rendering and physical contact share
canonical space: a car one raw map-length ahead can still be a visible, collidable alias.

CCD splits actual source row/lap boundaries. It tests the incoming interval and atomic pre/post
landing occupancy; it never sweeps the skipped chord from full length to 0, through a road-gap jump,
or across a map handoff. Route movement retains **unwrapped motion endpoints** even when physical
camera is wrapped; destination handoff uses endpoint occupancy only. Roadside broadphase visits
short canonical edge ranges and validated five-slot prefixes, not a false full-road sweep.

## Deliberate source adaptations

- The existing physical road-space hull/CCD and eligibility-mask-before-award/recycle policy remains
  explicit. Source awards immediately by sampled row-behind; the port requires a genuine continuous
  canonical overtake, once per life. An alias overtake can award; a wrap-only sign jump cannot.
- On exit, outgoing sweep can deny an outgoing pass but cannot start a new outgoing crash. Destination
  endpoint contact checks old lives before replacement. A matching traffic hit denies only its exact
  outgoing route/map/pool epoch, slot and generation candidate; roadside impact denies the whole tick.
  Goal entry suppresses new contacts while preserving eligible outgoing passes; recovery lock denies
  all passes. The source roadside-before-traffic priority is retained.
- Destination terrain is authoritative at the fixed handoff seam, independent of visual blending.
  Synchronize previousGap to the destination row; do not invent old-to-new gap carry or a relocation
  sweep. Clear only map-local contact ledger/motion, preserving accepted-versus-consumed coherence.
- Source recenter derives a target each tick from road side/mapDistance (`Map.cpp:728–740`), whose
  original timing could depend on rendering. The port latches recovery and, on handoff, reanchors a
  phase 3 center to destination terrain. This is an explicit fixed-step adaptation. It changes the
  recenter target, never captured variant/cap/curve/decrement, cadence/advances/reaction counters,
  acceptance identity or RNG. Completion tick remains locked; held controls return next tick.

## RNG and same-tick producers

Stable guarded **AdvanceRoute** owns the native `ctx.rng` ROUT stream. Recorded full reset seeds
its borrowed words with public `pcg32(seedLo,seedHi,0x524f5554,0)`; no owner means no dispatch or idle
route stream. Never rename/reseed AdvanceTraffic or BeginCrashRecovery during ordinary handoff.

The source append schedule (`Game.cpp:167–169,1214–1221`; `Map.cpp:437,502–510,625,632`) is:
initial Map1 random; accepted entries at zero-based stages 1/2/3 random; fifth ordinary/stage 4 forced+1
without a draw; genuine goal/stage 5 random, even though its tail is normally unused. This is exactly
**five range(-1,2) calls**, not necessarily five u32 words: native range uses unbiased rejection.
Pause, render cadence, IO, duplicate checks and HMR add no calls. This PCG adaptation preserves
source domain/call schedule, not the original thread-local random_device/MT sequence. Immutable goal
crowd offsets use their separate offline SHA-u24 profile and consume no route RNG.

Emitted events become visible at end-of-step. `RouteDriver` therefore also publishes immediate
checkpoint count/step/bonus, arrival count/step, and accepted-pass batch count/step/amount/outgoing
map epoch. Future #16 must consume coherent new producer counts on that tick; stale bools/events
cannot decide checkpoint/arrival versus expiration. Full reset changes routeEpoch and clears these
latches. Public route events retain route/map and old-life identities for traces.

Source arrival is **goal entry**, not row 500: `Map.cpp:641–642`, `Game.cpp:745,939–953` stop the racing
round/clock there. Ending autopilot later reaches row 500, brakes, stops, completes bonus and shows
results (`Map.cpp:661–662`, `PlayerCar.cpp:656–699`, `Game.cpp:977–1092`). #73 holds ordinary route
advancement at entry without pretending that these later phases exist or cancelling a running crash.
#16 owns the reviewed EndingRecovery→roll/brake/results policy and deterministic timeout priority.

## Tests and fast iteration

Use the smallest relevant root harness focus; all globs must select nonzero cases:

| Edit | Focus |
|---|---|
| Graph, integer assignment, gradient calls, checkpoint/latch | `routes.math*` |
| Immutable profiles/raw coordinate sampling | `routes.profiles*`, `routes.space*`, `routes.trafficState*` |
| Controls/CF/recovery and raw motion | `routes.driving*` |
| Canonical contacts/masks/ledger or traffic lifecycle | `routes.collision*`, `routes.traffic*` |
| Transaction ordering, same-owner handoff | `routes.transaction*` |
| Recorded native startup/entry/boundaries | `routes.native*`, `routes.entry*`, `routes.handoff*` |
| Direct-scene fixed-input integration | `routes.traversal*` |
| Canonical default-world recorded entry and fixed-input playback | `routes.canonical*` |
| Entire recorded normal-driving hash streams | `replay tests/replays/routes_canonical*` |

For example: `npm run test:focus -- 'routes.driving*'`. Run the full selected PR gate and required
native V8/Hermes, clean-cooked and web parity at handoff. Bootstrap additionally needs cold/direct
replay/HMR readiness and visible missing-content failure; do not hide first-use parsing in SIM.

`routes.landmark` is a **recorded debug supplement**, using current-map real bounds, not arbitrary
map/stage teleport. Optional quiet traffic and explicitly synthetic spin physics isolate compact
boundaries; neither proves natural traffic traversal/impact or native variant selection. Cheats
are auto-discovered dev/probe files, never imported by main/systems or used in normal canonical plans.
The explicit eligible/colliding old-life pass fixtures use synthetic recorded setup, then run the
actual native handoff transaction and check old-map award identity or collision denial. The normal
plans contain natural impacts and passes, but no pass on their exact handoff ticks.

Normal plan discovery used public reads to choose real keyboard inputs with source LOW population 9
and no cheats/setters/geometry patches. The all-left authoring run reached1→2→4→7→11→16 in 35,878 steps,
with 8 natural impacts,100 pass batches and 4 real checkpoints; right-first reached1→3 in 7,332 steps.
The independently reviewed extracted plans under `outrun/tests/fixtures/routes/` reproduce both
original direct-plan outcomes on native V8 and Hermes, with no reactive controller during playback.
Direct-scene tests remain separate from canonical boot: `routes.canonical*` starts in the default
road-proof world, records EnterScene into the route scene (initial route epoch 1), then records the
explicit fixed-plan reset (route epoch 2). New registered `routes_canonical*` tapes therefore include
the actual startup/entry and verify without a hidden scene override. Fresh native V8/Hermes replay
verification passed both canonical recordings at 35,879 and 7,333 steps. Recordings retain every
step hash and one detailed checkpoint per 60 steps. Clean-cooked/web checks, current-actor HMR,
background browser and exact CI evidence remain pending; native success alone is not final acceptance.

Preservation compares behavior, not only container bytes. Adding registered optional systems can add
SKIPPED names to old trace containers. The final local V8 checkpoint passed 353 cases while all 267
prior outcomes and 2120 protected files stayed unchanged. Of 264 trace containers, 176 were byte-identical
and 88 gained only the two registered SKIPPED no-op system names. A strict audit matched all 10,563
original step hashes/checkpoint parts and ordered original system hashes, with no added RNG parts.
No old baseline/tape rewrite was needed. The PR must carry fresh exact-candidate gate evidence;
these local checkpoint facts do not replace the remaining lanes.

No phone testing or hardware-memory claim is required. A whole desktop Chrome context's used heap
without GC is not retained profile heap or phone memory; loading observations do not authorize a
budget increase. Required Chrome checks remain background-only with owned profiles, focus preservation
and owned cleanup. This internal work imports no upstream README/legal or store workflow.
