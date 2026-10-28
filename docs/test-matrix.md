# OutRun behavior and evidence matrix

Tests arrive with the feature they prove. Avoid building a speculative suite for gameplay that
does not exist. Use stable names (`driving.accelerates`, `collision.sweptCrossing`, etc.) so a
feature can be selected with a name glob. Assert player-visible outcomes and boundary cases.

Physical-phone testing is excluded unless the user later requests it. All mobile viewport,
safe-area, phone-low residency and structural checks run on desktop; targeted browser checks
use a real WebGPU browser. Do not require device installation, screenshots, performance probes
or sustained phone runs for edits, PRs or main promotion.

| Change | Focused checks during editing | PR additions | Manual observation |
|---|---|---|---|
| Driving/gears | Acceleration, speed caps, braking/coasting, gear transitions, steering return | Native + web parity; frame-independent duration | Short drive with identical reference inputs |
| Curves/terrain | Centrifugal drift, each wheel surface, off-road speed cap and recentering | Native + web parity; focused road frame if appearance changes | High-speed curve, edge contact |
| Collision/crash | Road-space boundaries, swept crossing, first-hit priority, crash/recovery duration | Native + web parity; crash frame/end state | Traffic and roadside crashes at low/high speed |
| Traffic | Seeded spawn/recycle, AI response, density cap, passing bonus once | Native + web parity | Busy road, maximum traffic |
| Routes/checkpoints | Left/right choice once, next map, timer bonus once, terminal route | Native + web parity, cooked transitions | Both fork arms and biome transition |
| Race flow/scoring | Start, pause, timeout, finish, simultaneous finish/timeout priority, restart | Native + web parity; cooked flow | Start to results to restart |
| Road renderer | Near plane, curve seams, hill clipping, forks, sorting, clipped sprite UVs | T1 mobile/compat, phone-low; screenshot comparisons at fixed steps | Inspect moving road and crest in native + browser |
| HUD/menus | Model states, hit-tested presses, modal blocking, final animation placement | T1 landscape matrix + safe-area assertions, ui doc check | Desktop tablet/notched-phone viewport samples; browser resize |
| Touch/input | Hold/release, multi-touch steer+pedal, cancel, focus loss, bindings | Native + web parity; UI hit tests | Recorded multi-pointer input and real-browser keyboard/pointer checks |
| Audio | One-shot counts, engine loop transitions, pause/resume, voice limit | Cooked preload/first-use checks | Audible first start, background/resume; WebAudio unlock |
| Content/import | Parsed segment counts, graph references, metadata defaults, malformed inputs | Asset validation, cooked loading, affected render shots | New map/object in game |
| Saves/lifecycle | Missing/corrupt save, save/reload, background cancellation, no timer catch-up | Native + web parity; service mocks | Browser denied storage/tab switch and simulated app background/resume |
| Optimization | Baseline trace before edit; same behavior/hash afterward | Same scenario budgets and hash-trace comparison | Same desktop host, build profile, replay and bounded representative run |
| Engine upgrade | All native/web parity, regenerated schema/import compatibility | Milestone gate, cooked content, reviewed golden differences | Targeted browser smoke and desktop phone-low structural/residency checks |

## Landscape checks

Render/bootstrap sizes are 882x344, 852x393, 1080x810, 1280x720 and 720x540 logical points.
HUD/control tests must additionally inject rotated notch/home safe insets in both orientations;
the bootstrap renderer test does not yet prove safe-area behavior. Assert that controls stay
inside safe bounds and do not hide the playable road. Test final animation frames too.

## Milestone scenarios

Add a short deterministic replay for each implemented flow: straight drive, hill/curve/fork,
busy traffic, roadside/traffic crash, checkpoint/biome transition, timeout, finish/restart,
pause/resume. Run compact boundary fixtures rather than waiting minutes for every T0 test.
Keep one full start-to-results integration replay and mode/route integration scenarios.
Pipeline recordings must cover every newly introduced material/effect/UI/transition before
using them as evidence that racing creates no new pipelines. Never bless snapshots automatically.

Initial phone budgets are in harness.config.json. They are targets, not measurements or engine-
enforced budget files. The starter T1 test currently enforces only <=50 draws at each size.
Add scenario-backed tests/budgets entries with the engine's supported format as those scenarios
exist. Desktop timings do not certify phone frame time, GPU cost, peak RSS, or thermals.

Before a milestone, run a short WebGPU browser check from localhost/HTTPS covering the changed
implemented flows: start/unlock audio, controls, focus, resize, hide/restore, or storage as
relevant. Add compact replay-backed desktop checks for busy traffic, scenery and transitions.
Record engine/game commit, desktop host/profile/tier and observed structural/residency results.
Do not run physical-phone tests or 10-minute hardware/thermal profiling. Hardware design targets
remain low-end 30 fps (33.3 ms), mid-range 60 fps (16.7 ms), low-end step p95 <=8 ms, RSS <=350 MiB,
textures <=120 MiB and JS heap <=32 MiB; desktop checks do not establish those hardware results.

## Coverage at bootstrap

Implemented: two starter bubble T0 tests; one structural renderer test at five landscape sizes;
harness classifier regression tests; repository configuration checks. The automated bootstrap
gate passed on commit d8de56feb4f9f6274099104610af07f7a41453d0, including V8/Hermes and V8/web parity,
mobile/compat T1, cooked tests and startup smoke. A separately exported probe game rendered
actual colored bubbles and resized successfully in headed Chromium153/native WebGPU with no
engine/page errors. See [engine setup](engine-setup.md) for toolchain and evidence details.
No OutRun gameplay, replay, safe-area, browser lifecycle/storage or hardware-performance coverage
is claimed by this starter evidence. Physical-phone testing is excluded from the workflow.

Initial warm-cache observations on the local macOS release hosts: native integrity 1.62 s,
four T0 executions across V8/Hermes 0.57 s, T1 mobile/compat 0.45 s each, cooked T0 0.76 s.
These are starter/harness measurements, not estimates of the eventual racing game or phones.
`gameengine check` also reports starter warnings for the redundant camera orthoSize and absent
pipeline recording. Replace the starter camera setup and record scenario-backed pipelines as
the road renderer is introduced; do not claim pipeline warm-up coverage at bootstrap.
