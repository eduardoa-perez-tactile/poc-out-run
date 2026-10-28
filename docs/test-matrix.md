# OutRun behavior and evidence matrix

Tests arrive with the feature they prove. Avoid building a speculative suite for gameplay that
does not exist. Use stable names (`driving.accelerates`, `collision.sweptCrossing`, etc.) so a
feature can be selected with a name glob. Assert player-visible outcomes and boundary cases.

| Change | Focused checks during editing | PR additions | Manual observation |
|---|---|---|---|
| Driving/gears | Acceleration, speed caps, braking/coasting, gear transitions, steering return | Native + web parity; frame-independent duration | Short drive with identical reference inputs |
| Curves/terrain | Centrifugal drift, each wheel surface, off-road speed cap and recentering | Native + web parity; focused road frame if appearance changes | High-speed curve, edge contact |
| Collision/crash | Road-space boundaries, swept crossing, first-hit priority, crash/recovery duration | Native + web parity; crash frame/end state | Traffic and roadside crashes at low/high speed |
| Traffic | Seeded spawn/recycle, AI response, density cap, passing bonus once | Native + web parity | Busy road, maximum traffic |
| Routes/checkpoints | Left/right choice once, next map, timer bonus once, terminal route | Native + web parity, cooked transitions | Both fork arms and biome transition |
| Race flow/scoring | Start, pause, timeout, finish, simultaneous finish/timeout priority, restart | Native + web parity; cooked flow | Start to results to restart |
| Road renderer | Near plane, curve seams, hill clipping, forks, sorting, clipped sprite UVs | T1 mobile/compat, phone-low; screenshot comparisons at fixed steps | Inspect moving road and crest in native + browser |
| HUD/menus | Model states, hit-tested presses, modal blocking, final animation placement | T1 landscape matrix + safe-area assertions, ui doc check | Tablet and notched/wide phone; browser resize |
| Touch/input | Hold/release, multi-touch steer+pedal, cancel, focus loss, bindings | Native + web parity; UI hit tests | Actual phone and browser keyboard/touch |
| Audio | One-shot counts, engine loop transitions, pause/resume, voice limit | Cooked preload/first-use checks | Audible first start, background/resume; WebAudio unlock |
| Content/import | Parsed segment counts, graph references, metadata defaults, malformed inputs | Asset validation, cooked loading, affected render shots | New map/object in game |
| Saves/lifecycle | Missing/corrupt save, save/reload, background cancellation, no timer catch-up | Native + web parity; service mocks | Browser denied storage, tab switch, phone suspend/resume |
| Optimization | Baseline trace before edit; same behavior/hash afterward | Same scenario budgets and hash-trace comparison | Same device, build profile, replay and sustained run |
| Engine upgrade | All native/web parity, regenerated schema/import compatibility | Milestone gate, cooked content, reviewed golden differences | Full browser and low-end-phone smoke |

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

Before a milestone, run a WebGPU browser from localhost/HTTPS: start/unlock audio, hold controls,
lose focus, resize, hide/restore the tab, save/reload and deny storage. Run the busiest phone
scenario for 10 minutes; record device/OS, engine/game commit, profile/tier, p95 frame and sim
step time, peak memory and transitions. Targets: low-end 30 fps (33.3 ms), mid-range 60 fps
(16.7 ms), low-end step p95 <=8 ms, RSS <=350 MiB, textures <=120 MiB, JS heap <=32 MiB.

## Coverage at bootstrap

Implemented: two starter bubble T0 tests; one structural renderer test at five landscape sizes;
harness classifier regression tests; repository configuration checks. Native parity and cooked
smoke can be run with the installed engine. No OutRun gameplay, screenshots, replays, safe-area,
browser, device or sustained-performance coverage is claimed. The installed engine currently
lacks the wasm test host; provisioning that host is an explicit first infrastructure task.

Initial warm-cache observations on the local macOS release hosts: native integrity 1.62 s,
four T0 executions across V8/Hermes 0.57 s, T1 mobile/compat 0.45 s each, cooked T0 0.76 s.
These are starter/harness measurements, not estimates of the eventual racing game or phones.
`gameengine check` also reports starter warnings for the redundant camera orthoSize and absent
pipeline recording. Replace the starter camera setup and record scenario-backed pipelines as
the road renderer is introduced; do not claim pipeline warm-up coverage at bootstrap.
