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
| Destination art/readiness | Source canvases, three-texture painter order, durable review input, readiness and ownership | Full native/cooked source witnesses, mobile/compat, bounded phone-low cache | Representative background Chrome projection, source pixels, selectors and resize |
| Content/import | Parsed segment counts, graph references, metadata defaults, malformed inputs | Asset validation, cooked loading, affected render shots | New map/object in game |
| Saves/lifecycle | Missing/corrupt save, save/reload, background cancellation, no timer catch-up | Native + web parity; service mocks | Browser denied storage/tab switch and simulated app background/resume |
| Optimization | Baseline trace before edit; same behavior/hash afterward | Same scenario budgets and hash-trace comparison | Same desktop host, build profile, replay and bounded representative run |
| Engine upgrade | All native/web parity, regenerated schema/import compatibility | Milestone gate, cooked content, reviewed golden differences | Targeted browser smoke and desktop phone-low structural/residency checks |

## Landscape checks

Road renderer sizes are 882x344, 852x393, 1080x810, 1280x720 and 720x540 logical points.
HUD/control tests must additionally inject rotated notch/home safe insets in both orientations;
the road renderer tests do not prove HUD safe-area behavior. Assert that controls stay
inside safe bounds and do not hide the playable road. Test final animation frames too.

## Milestone scenarios

Add a short deterministic replay for each implemented flow: straight drive, hill/curve/fork,
busy traffic, roadside/traffic crash, checkpoint/biome transition, timeout, finish/restart,
pause/resume. Run compact boundary fixtures rather than waiting minutes for every T0 test.
Keep one full start-to-results integration replay and mode/route integration scenarios.
Pipeline recordings must cover every newly introduced material/effect/UI/transition before
using them as evidence that racing creates no new pipelines. Never bless snapshots automatically.

Initial phone budgets are in harness.config.json. They are targets, not measurements or engine-
enforced budget files. The road proof has a scenario-backed structural budget in
`outrun/tests/budgets/road.json` (draws, runtime pipeline creation, GC and JS allocations).
The flat-road T1 suite checks five landscape sizes; hill T1 scenarios add crest phases and
transparent ordering. Add new scenario budgets when real gameplay and dense fixtures exist. Desktop timings do not certify phone frame time, GPU cost, peak RSS, or thermals.

Before a milestone, run a short WebGPU browser check from localhost/HTTPS covering the changed
implemented flows: start/unlock audio, controls, focus, resize, hide/restore, or storage as
relevant. Add compact replay-backed desktop checks for busy traffic, scenery and transitions.
Record engine/game commit, desktop host/profile/tier and observed structural/residency results.
Do not run physical-phone tests or 10-minute hardware/thermal profiling. Hardware design targets
remain low-end 30 fps (33.3 ms), mid-range 60 fps (16.7 ms), low-end step p95 <=8 ms, RSS <=350 MiB,
textures <=120 MiB and JS heap <=32 MiB; desktop checks do not establish those hardware results.

## Road proof coverage

The starter has been replaced by the projected road. `road.state*` covers units, pause, loop
wrap, fixture validation, viewport-independent progress and simultaneous key ordering across
following ticks. `road.projection*` covers near-plane finiteness, bounds, reusable buffers and
mirrored curves. Fifteen T1 scenarios cover straight/right/left roads at all five landscape
sizes with pixel probes and reviewed mobile/compat goldens. The road replay supports structural
budgets and recorded pipelines. These particular tests cover renderer/proof controls. Driving, traffic, collision and controls
have separate feature tests; road-proof results alone do not establish their coverage or a complete race.

Issue #7 adds `road.clipping*`: synthetic hill/valley continuity, crest visibility, preserved
UV crop, object ordering and fixed buffer capacity; T1 covers approach/crest/descent/valley at three
landscape sizes. Two opposite landscape safe-inset cases probe the diagnostic UI strip; these do not prove a
future driving HUD or touch controls. Diagnostic objects are presentation fixtures with no collision or AI. Record
actual run/review evidence for the candidate in its PR; this inventory does not establish an
unrun gate, browser check or hardware result.

## Destination art and readiness (#71)

The destination review scene covers original Maps2–15 and goal art: 627 local object IDs and
30 panoramas. These are presentation-only source scenes; they do not prove a new-map SIM race,
route handoff, checkpoint, timer or goal-arrival outcome. Map1 assets, renderer and existing
canonical replays remain separate preservation checks.

Use the smallest affected name glob while editing. Run commands from the repository root after
setup, with the engine window serialized. The T0 review globs cover recorded selectors, held
repeat/release, command order and isolation of legacy proof clocks. The entry selection checks
recorded scene entry clears prior driving/held controls; destination T1 covers dirty acquired
ledgers and same-config reentry with fresh frames. The durable
SIM input tag retains commands across fixed-step batches without rendering; a SIMFALSE owner
cursor consumes each version once. Native atomic-batch and HMR checks additionally observe real
callbacks, fresh pixels and same-step SIM hashes; ordinary T0 steps alone do not prove that gap.

```sh
npm run test:focus -- 'environment.reviewKeys*'
npm run test:focus -- 'environment.reviewIsolation*'
npm run test:focus -- 'environment.review entering*'
npm run test:focus -- 'environment.reviewRelay*'
npm run test:focus -- 'environment.geometry*'
npm run test:focus -- 'environment.readiness*'

# Actual source controls, binding/order, panorama, canonical profile and residency.
# Repeat the affected selection on compat and with --cooked before handoff.
for filter in 'environment.destination*' 'environment.bindings*' 'environment.occlusion*' 'environment.panoramaDestination*' 'environment.profile canonical recorded destination art workload' 'environment.residency*'; do
  node outrun/.gameengine/engine/tools/cli/bin/gameengine.mjs test --project outrun --tier t1 --js v8 --gpu-tier mobile --memory-class phone-low --filter "$filter"
done
```

`environment.destination*` compares all 627 object witnesses and all 30 panorama witnesses
against independent opaque source colors on the actual GPU, including cold two-page arrival
and repeated submissions before readback. Native/cooked mobile and compat checks cover the
whole cohort; representative background Chrome checks cover Maps2/3/4/10/goal at 1280x720 and
852x393 with trusted selectors, current telemetry, actual source/control PNG pairs and real
texture/binding/draw observations. Browser telemetry or IO progress alone is not pixel proof.
Chrome stays in an owned background session with verified OS focus and owned cleanup.

The separate 19-frame source-filter review approves the unchanged linear LOD0 props using the
same goal flagger near/mid/far, seven camera-motion frames, projected crowd/log/flag art, dense
Map4, two-page Map10, actual fork/crest clipping and equivalent panorama-wrap pixels. It is not
a point-versus-linear experiment. Source controls establish texel fidelity; they do not replace
projected alpha, crop, occlusion or motion inspection. Keep all five landscape panorama-boundary
sizes and actual page0/page1/traffic overlap orders in the automated T1 selections.

The recorded art profile exercises real selectors, projection/catalog modes and return/exit.
The all-15 residency sweep separately checks bounded incoming/outgoing ownership, boot pins,
released caches, actual phone-low charges and recurring uploads; it is a presentation fixture,
not a replay-backed race or a heap measurement. Preserve actual missing-member failure/retry
and held-input HMR evidence alongside these automated checks. Record candidate-specific
commands, raw results, approvals and remaining failures in the PR. This matrix does not declare
final gates, hosted CI, complete race coverage or phone hardware performance passed.

## Historical bootstrap evidence

The initial starter had two bubble T0 tests; one structural renderer test at five landscape sizes;
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
At bootstrap, `gameengine check` reported a redundant camera orthoSize and absent pipeline
recording. Issue #6 replaced that camera setup and recorded road-scenario pipelines; the
historical starter evidence itself did not prove pipeline warm-up coverage.
