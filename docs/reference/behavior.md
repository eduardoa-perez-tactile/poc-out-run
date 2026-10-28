# OutRun reference behavior and deterministic migration fixtures

Source: [ZgzInfinity/OutRun at 6882721c99bc79365f815f68d389bf5078129e68](https://github.com/ZgzInfinity/OutRun/tree/6882721c99bc79365f815f68d389bf5078129e68). This reference is for implementing the new engine port; it contains source findings, explicitly labeled arithmetic diagnostics, and proposed migration decisions.

`synthetic-fixtures.json` is a compact scenario proposal, **not the engine's executable test format**. `source-track-summary.json` calculates map counts using the source parser's actual behavior. Neither is a claim of successful gameplay measurement. `nominal-kernel.cpp` and its JSON output isolate source arithmetic at nominal 60 Hz; they do not execute the original game, its clocks, rendering, audio, AI or collision detection.

## Evidence and build status

The source was read directly at the pinned commit, including all 15 map configuration files. The original game initially could not configure because CMake was unavailable. After CMake appeared through the coordinator's toolchain work, CMake FetchContent successfully fetched/configured SFML 2.6.2 and generated an independent build under `/tmp/outrun-reference-task/build`. The original Release executable subsequently built successfully with AppleClang on arm64 at `/tmp/outrun-reference-task/build/OutRun` (CMake build exit 0). Build warnings include non-exhaustive switches and missing-return paths in the source. A short desktop startup attempt subsequently failed immediately with exit139: macOS reports EXC_BAD_ACCESS/SIGSEGV at pthread_mutex_lock via SFML GlContext::initResource, Texture construction and static HudCheckPoint initialization. The run used a disposable copy of Resources so the original source stayed unchanged. No usable source window, screenshot, gameplay input or elapsed-time measurement was obtained; windowed/attempt.json records the attempt. This is an original-source startup blocker, not a failure of the migrated engine game. `build-capability.json` records commands, binary SHA-256 and build/run status. The existence of the binary does not turn the static arithmetic samples below into measured gameplay.

An AppleClang C++14 `-O0` arithmetic diagnostic was built and run separately. Its numeric samples are reproducible source-formula calculations under an injected binary32 `dt=1.f/60.f`, not timings measured from a windowed session.

## The time and coordinate model to migrate

| Source fact | Consequence for the port |
|---|---|
| [`Input.h:167`](https://github.com/ZgzInfinity/OutRun/blob/6882721c99bc79365f815f68d389bf5078129e68/src/Input/Input.h#L167) sets frame limit 60 and enables VSync | 60 updates/s is a calibration assumption, not proof every original frame ran at that rate |
| [`Game.cpp:715`](https://github.com/ZgzInfinity/OutRun/blob/6882721c99bc79365f815f68d389bf5078129e68/src/Game/Game.cpp#L715) derives driving `time` from C `clock()` | This is process CPU time, not the renderer's wall-frame delta; a busy timer thread complicates runtime behavior further |
| [`Map.cpp:558`](https://github.com/ZgzInfinity/OutRun/blob/6882721c99bc79365f815f68d389bf5078129e68/src/Scene/Map/Map.cpp#L558) adds `speed` to integer `position` each update | Movement is legacy distance/update, with integer truncation; do not multiply this by dt alone and slow the game by 60× |
| Segment length 150; road half-width parameter 1600; visible distance 200 segments | Use these as legacy content coordinates; keep conversion to engine units explicit |
| Lateral `posX` is normalized against 1600; player wheels use offsets ±210 | This is separate from projected pixel widths and rendering scale |
| [`HudRound.cpp:429`](https://github.com/ZgzInfinity/OutRun/blob/6882721c99bc79365f815f68d389bf5078129e68/src/Gui/Huds/HudRound/HudRound.cpp#L429) displays speed ×1.65 | Legacy internal speed 200 displays 330; do not confuse HUD units with road units/s |
| [`Map.cpp:441`](https://github.com/ZgzInfinity/OutRun/blob/6882721c99bc79365f815f68d389bf5078129e68/src/Scene/Map/Map.cpp#L441) starts integer position at 300×150 | A synthetic test can start at zero, but full source-map fidelity must retain the startup runway offset |
| Player longitudinal offset is `int(CAMERA_HEIGHT * CAMERA_DISTANCE)+241` | Player segment selection is ahead of the camera/base segment, not simply floor(cameraDistance/150) |

**Proposed implementation convention:** run authoritative state at exactly 60 Hz. Keep speed in documented legacy units initially. Choose and document either the source integer assignment `position = trunc(f32(f32(position) + speed))` for nominal source compatibility, or continuous `position += speed*60*dt` for a deliberate smoother port. Here `f32` means binary32 rounding and `trunc` means truncation toward zero. The source first converts its integer position to float, adds float speed, rounds that sum, and only then converts back to integer; this is **not** equivalent to `position += trunc(speed)`. For example, position77620 plus source speed199.9993896484375 rounds to77820 in binary32 before truncation; adding truncated speed would instead produce77819. The continuous convention is a behavior change and must not be compared against exact integer source positions. Put f32 state in schema and use deterministic engine math/RNG; rendering and platform frame rate never feed simulation.

## Driving and gear rules

[`PlayerCar.cpp:56`](https://github.com/ZgzInfinity/OutRun/blob/6882721c99bc79365f815f68d389bf5078129e68/src/Car/PlayerCar/PlayerCar.cpp#L56) initializes acceleration to `100/6.5` (approximately 15.384615 legacy-speed units/s), braking to 50, gear 0 and speed 0. Initial maxHighSpeed 75 is overwritten by the first on-road driving update.

[`accelerationControl:464`](https://github.com/ZgzInfinity/OutRun/blob/6882721c99bc79365f815f68d389bf5078129e68/src/Car/PlayerCar/PlayerCar.cpp#L464) evaluates braking before throttle. Low gear caps at 100, high at 200. Braking reduces speed by `50*time`, clamps to zero and downshifts when speed becomes strictly less than 100, even in manual mode. With neither pedal, speed loses `0.75*lowAccel*time` (approximately 11.538462/s); that branch can briefly produce negative speed before the next update clamps it.

Automatic high gear is selected on reaching the low-gear cap. Manual up/down actions are checked **only inside the acceleration branch**, which also requires both wheels on road and current speed no greater than the active cap. A gear-up press without throttle does nothing in the source. The `UP_GEAR` expression also has asymmetric operator precedence; `pressed || held && gear!=1` is not a uniformly edge-triggered intent. `sf::Event event` in this function is not populated from the event loop before `pressed()` reads it. Do not reproduce undefined/uninitialized-input behavior in the port.

Steering checks left before right, so both held directions select left. Target steering threshold is `speed*time`. While held, threshold changes by a fixed 0.3/update toward the signed target and can overshoot/oscillate around it. On release it multiplies by 0.9/update and snaps to zero inside (-0.1,0.1). Lateral position then changes by `threshold*time`. An analog deadzone or clamp is a deliberate refinement, not exact source math.

### Nominal arithmetic samples

The extracted diagnostic applies held acceleration on an empty straight road at binary32 1/60 s. It includes integer position assignment and the source floating-point score expression.

| Tick | Speed | Gear | Integer distance from zero |
|---|---:|---:|---:|
| 1 | 0.256410271 | 0 | 0 |
| 60 | 15.3846235 | 0 | 441 |
| 120 | 30.7692585 | 0 | 1803 |
| 390 | 99.9996185 | 0 | 19360 |
| 391 | 100 | 1 | 19460 |
| 780 | 199.742981 | 1 | 77620 |
| 781 | 199.999390 | 1 | 77820 |

The theoretical 6.5 s low-gear acceleration time is not exactly tick390 under binary32 accumulation; the source equality/cap check selects high gear at tick391 in this diagnostic. These are useful tolerance/compatibility oracles, not a reason to hard-code 391 in a newly chosen continuous-physics model.

## Terrain, road sides and centrifugal drift

[`Map::updateCarPlayerWheels:236`](https://github.com/ZgzInfinity/OutRun/blob/6882721c99bc79365f815f68d389bf5078129e68/src/Scene/Map/Map.cpp#L236) uses `wheelL=x*1600-210`, `wheelR=x*1600+210`, outside bounds -1831 and `roadGap+1831`. When roads are separated by more than 3662, the interval (1831, roadGap-1831) is also off-road. Every call clears both outside-wheel booleans before the positive-speed gate. Only when speed>0 does it recompute outside contact and terrain effects; at speed0 the booleans therefore become false even if the stationary car remains outside the road. This function does not itself clear previously stored wheel effect states at speed0. For a single centered road at positive speed, x=1.0 is on-road, x=1.1 has its right wheel out, and x=1.3 has both out.

Terrain identifiers: 1 sand, 2 grass, 3 snow, 4 mud. Road terrain 0 is normal. Nonzero road terrain and SHOW_TERRAIN markings mainly choose wheel effects in the drawing path; they do not, by themselves, implement distinct friction coefficients.

**Source quirk:** an outside wheel sets cap field 75, but throttle is rejected whenever either wheel is outside. The source therefore coasts under held throttle, even below75; it does not accelerate to75 or instantly clamp to75. Handle contact in simulation and explicitly choose whether to preserve this behavior.

[`controlCentrifugalForce:712`](https://github.com/ZgzInfinity/OutRun/blob/6882721c99bc79365f815f68d389bf5078129e68/src/Car/PlayerCar/PlayerCar.cpp#L712) is called only at speed ≥30.5. Its coefficient is 0.5 below100, then `(speed-50)/90`. On the left road, lateral delta is `-curve*min(speed/cap,1)*coefficient*dt`. The right road reverses curve sign on mirrored segments and adjusts lateral position as the carriageway gap changes. Road side is currently chosen from projected camera coordinates; replace that with nearest logical road center and define the equal-distance tie (proposal: left).

Source outer bounds snap x outside -1.5 to -1.48, or beyond `1.5+gap/1600` to `1.48+gap/1600`. Widely separated mirrored roads also snap a player out of the forbidden center gap. Skid feedback requires road contact, speed>70, |steering|≥speed*dt*0.8 and |curve|≥2.75.

## Collision and recovery

[`hasCrashed:744`](https://github.com/ZgzInfinity/OutRun/blob/6882721c99bc79365f815f68d389bf5078129e68/src/Car/PlayerCar/PlayerCar.cpp#L744) performs inclusive 1D screen interval overlap. The player uses width77×3.2 regardless of resolution; objects use projection, image dimensions, collision pivots and configured width. Traffic only checks collision when its segment equals the player segment. At high speed this can miss crossing events and results can depend on screen width and previously rendered projection data.

The migration should keep authored logical contact dimensions separate from images, use road-space overlap and swept longitudinal crossing, and test identical outcomes at different viewports. This is an intentional correction to the original collision implementation.

Source collision priority is deterministic within an update: far-left roadside, near-left, center, far-right, near-right, then traffic vector order. Stop at the first hit. Source also disables collision detection when `currentBiome.end` is true; do not silently confuse this flag with “all traffic in final playable stage should be harmless.” Define the port's goal-approach rule explicitly.

Impact speeds ≤20, (20,60], (60,120], >120 select 1,2,3,4 spin laps. Each lap has eight sprites. Crash deceleration is `impactSpeed/(laps*8)` per animation advance. The render counter advances a frame every three calls (counter 0→1→2→advance), producing nominal spin durations about24/48/72/96 updates before the stopped recovery, excluding first-frame/state-order subtleties. Source crash state therefore depends on drawing. Stopped recovery loops a five-frame reaction three times, then hides/recenters the car in increments0.012/update toward the nearest road center until within±0.05. Own these durations in sim timers; presentation displays them.

For a traffic crash, camera position moves backward by `speed*0.5` per update until recovery, rather than moving forward. Survival ends when a crashing car's speed reaches zero, before the subsequent recenter completes. Preserve that terminal boundary or record the replacement rule.

## Traffic rules and source defects

[`Map::updateCars:337`](https://github.com/ZgzInfinity/OutRun/blob/6882721c99bc79365f815f68d389bf5078129e68/src/Scene/Map/Map.cpp#L337) updates traffic before player movement and player collision detection. Population is9/20/32 for low/medium/high; initial six vehicles have explicit source positions and speed120, while later speed selection is100..160 in steps10. Recycled offsets are an inclusive integer in[-6,6]×0.15, road side0/1, and forward relocation is500..700/900/1100 segments by traffic setting. The source RNG is thread-local MT seeded from random_device; exact traffic sequences are not reproducible. Replace with seeded per-system engine RNG and pin draw order.

Inactive vehicles become active strictly ahead of the player and strictly inside the200-segment draw window. Active vehicles leaving that window are recycled; if already behind, they award20,000 points. Because this happens before collision, a same-update pass/crash can award a passing bonus before a crash is discovered. Do not claim the source prevents that duplication.

AI codes: 1 PACIFIC, 2 EVASIVE, 3 OBSTACLE. Lateral changes are0.005/update (nominal0.3 units/s), generally bounded±0.9, and proximity is within20 segments. PACIFIC maintains its lane. EVASIVE selects a direction based on available lane-edge distance, tie random, and tries half-unit offset targets. Its missing braces attach the `else` to the clamp test, and its return counter increments on target arrival instead of each waiting update; literal code can stick at a boundary. OBSTACLE approaches the player's lateral position on the same road. Its right-road overshoot branch contains a same-direction add where an undo would normally subtract. Preserve the observable categories, but implement corrected bounded target motion as a documented port decision unless strict bug compatibility is requested.

## Maps, procedural commands and graph

[`Biome::addBiome:423`](https://github.com/ZgzInfinity/OutRun/blob/6882721c99bc79365f815f68d389bf5078129e68/src/Scene/Biome/Biome.cpp#L423) constructs `enter+hold+leave` segments. Curve entry is quadratic; leave and elevation use cosine ease. The elevation sample is n/total, so the final segment does not reach the nominal endY. New commands begin from that actual last elevation. `slope` is multiplied by150. Width/gap changes use `dist += (int)distPerc` each segment, so fractional increments are discarded; some transitions never reach their requested target gap.

Road gap values from integer source arithmetic: three tracks0, four1036, five2072, six3108, seven4144, eight5180, two24756. These names represent the original paired-road construction rather than a generic modern lane-width API. The rumble light flag alternates every three segment indices.

The parser supports:

| Command | Arguments | Actual source expansion |
|---|---|---|
| STRAIGHT | enter hold leave mirror tracks | enter + hold + leave |
| CURVE_LEFT/RIGHT | enter hold leave curve mirror tracks factor | enter + hold×factor + leave |
| HILL_STRAIGHT | enter hold leave slope tracks factor | enter + hold×factor + leave; mirror=false |
| HILL_LEFT/RIGHT | enter hold leave slope curve mirror tracks | **enter + hold + enter**, ignoring authored leave |

The last row is an implementation bug at [`Logger.cpp:1140`](https://github.com/ZgzInfinity/OutRun/blob/6882721c99bc79365f815f68d389bf5078129e68/src/Logger/Logger.cpp#L1140). Keep a named `sourceCompatibility` expansion mode and fixture for it. Correcting it blindly shifts sprite, checkpoint, fork and total map indices. An improved command format can use the authored leave, but conversion of existing content must use an explicit policy.

Each map also receives procedural tail segments: Original appends1960 total; Continuous/Survival append1200. Original's first fork block is10/300/50, curve-2, mirrored, slope chosen inclusively from[-1,1]×80 except ending slope+80. Subsequent hold blocks complete the tail. Continuous appends two200/200/200 straights, first forceSwap=true. `lastLine` is overwritten to totalSegments-200. First mirrored/forced hold midpoint sets swapLine after adding that midpoint segment; `playerLine > swapLine` commits the choice once. Palette/background swapping currently runs during rendering: background advances5 screen pixels/update and each RGB channel moves1 toward its target/update. A fixed-duration/distance-based port transition is a deliberate correction to its resolution dependence.

Map rows are1; 2,3; 4,5,6; 7,8,9,10; 11..15. Original graph edges from row/column go to next-row same-column (left) or column+1 (right), then goal. Leftmost path:1→2→4→7→11→goal. Rightmost:1→3→6→10→15→goal. Continuous/Survival traverse1..15→goal. Goal itself is a procedural1050-segment straight before further tail setup. Five playable stages are required for Original,15 for the sequential modes.

`source-track-summary.json` contains exact calculated base segment counts, authored checkpoint lines, time and terrain per map. The calculated base counts are:4123,4605,4920,4420,4220,4190,4520,3930,4250,4080,4260,4300,4070,4720,4370. These deliberately include the hill-curve leave bug. Map1 has no authored checkpoint; maps2..15 use202 or203.

## Race clock, checkpoints and scoring

Initial time is current map time, with **hard +5 s/easy -5 s**, and **high traffic +5 s/low -5 s**. This counterintuitive mapping is source behavior, not an inferred intended difficulty design. Map1 normal/medium starts160 s; easy/low150; hard/high170.

The timer thread at [`Game::updateTime:320`](https://github.com/ZgzInfinity/OutRun/blob/6882721c99bc79365f815f68d389bf5078129e68/src/Game/Game.cpp#L320) polls a0.01 s SFML clock, accumulates elapsed seconds, decrements whole seconds, and races state written by the main loop. It contains an unlock without a matching lock in that interval block. Use fixed-step countdown and elapsed ticks, not this thread or wall clocks. The start sequence also waits for a showman sound before a four-interval semaphore loop; do not make authoritative race start depend on audio playback completion.

Checkpoint detection uses `playerLine > lineCheckPoint` on non-start/non-goal biomes, once per map. It resets stage elapsed time and increments level. Time added for Original newly reached levels2/3/4/5 is `int(mapTime×0.53125/0.5/0.46875/0.4375)`; sequential modes use`int(mapTime×0.52)`. A mapTime160 fixture produces85/80/75/70 s, or83 s sequential. Keep integer truncation and single-award semantics.

When neither wheel is a terrain state and speed>5, driving score each update uses `int((10 + 950*(speed-5)/141)/3.7) * 2.3f` added to a long long. The compound expression converts the existing total to floating point, which loses precision at large scores. Use an explicit integer/fixed-point score rule for the port, document rounding, and test it. Finishing sets target total `score + remainingWholeSeconds×1,000,000`; presentation counts toward it in integer32967 increments/update. Bonus is authoritative once; its display animation must not award it repeatedly.

## Ordering policy requiring an explicit migration choice

Source order inside a frame is input/driving → traffic updates/pass bonuses → player movement/map transition → crash progression/roadside-then-traffic collision → road-side choice/drift/wheel contact/checkpoint detection → render (including mutations) → arrival flag → checkpoint award → score. The timer runs concurrently. `playRound` resolves terminal flags as arrival first, then escape, then pause, else game over. That suggests finish wins if both flags are set when the loop exits, but it does not define an exact same-step source result because the flags race.

Proposed deterministic policy, to be accepted by the coordinator and encoded in tests:

1. Handle pause/background cancellation at the beginning of the step; a paused step does not consume race time.
2. Apply input/driving and movement, then logical terrain/contact and swept collision. Choose first collision by the documented roadside slot/traffic stable order.
3. Resolve route/checkpoint/finish crossings from movement. Commit route once. A terminal finish supersedes a coincident checkpoint.
4. Award passing bonuses only for eligible non-collided traffic and only once; apply checkpoint time if not terminal.
5. Consume one countdown tick for the active racing step. A finish crossed this step wins over expiry; otherwise zero remaining ticks means timeout. Stage/total elapsed ticks count the active step consistently.
6. Apply finish bonus once from the defined remaining whole-second value. Survival crash terminal is evaluated at speed-zero boundary. Define its tie with finish explicitly (proposal: finish already crossed in step wins).
7. Emit presentation events after authoritative transitions. Rendering/audio/quality cannot rescue or end a race.

This policy deliberately fixes source races, pass-before-crash anomalies and view-dependent contact. Keep these deviations named in the implementation PR. Do not label them source measurements.

## Focused acceptance scenarios

The19 JSON scenarios cover nominal acceleration, pedal priority, off-road coasting, manual gear limitation, wheel edges, drift gate, crash speed bands/priority, hill-parser compatibility, hold factor, gap truncation, hill endpoint, fork choice once, settings time, checkpoint bonus, finish bonus, simultaneous events and full mode graph. Add corresponding worldTest/renderTest fixtures with the feature, not speculative passing stubs.

Use focused T0 name globs during editing; at integration compare native V8/Hermes and V8/web hashes, cooked transitions and T1 frames for appearance changes. Assert invariant outcomes independently of viewport and render cadence. Replay fixtures pin the new engine's own deterministic behavior; the original game has neither matching schemas nor comparable state hashes.

## Reproducing the reference artifacts

From the repository root, regenerate the static map/fixture data with Python (no engine needed):

```sh
python3 docs/reference/build-fixtures.py --source /path/to/pinned/OutRun --out /tmp/outrun-reference-check
```

The generator explicitly verifies the source commit and reads map blobs directly from that Git
revision, so dirty working-tree maps cannot be mislabeled as pinned evidence. It consumes the recorded nominal diagnostic JSON;
rebuild that arithmetic diagnostic explicitly when checking compiler/float behavior:

```sh
clang++ -std=c++14 -O0 docs/reference/nominal-kernel.cpp -o /tmp/outrun-nominal-kernel
/tmp/outrun-nominal-kernel
```

These are reference-generation checks, not implemented OutRun gameplay tests. The full original
Release binary was built successfully on macOS arm64 using CMake and fetched SFML2.6.2; the
build-capability record identifies that observation and its unrun windowed-playback limitation.
