# OutRun behavior and evidence matrix

## How to use this matrix

This is a selection and coverage reference, not a per-ticket checklist. The delivery policy in
[workflow.md](workflow.md#delivery-first-execution) governs cadence: build/hot reload and one
short smoke of the changed player flow during implementation; a focused automated selection
only for meaningful new behavior or a reproducible regression. Do not test every row, add a
new test per edit, or expand coverage for unchanged features.

The existing path-selected PR gate runs once in required exact-head CI on the finished
candidate. A local full gate is only for a concrete CI diagnostic, never a routine prerequisite
or replacement for required CI. Keep the required lanes, tests and budgets. Do not run those full lanes separately before or
after the same gate. Milestone-wide validation is reserved for an explicitly finished
milestone or game-bearing main promotion. A documentation-only candidate needs policy/harness
checks, no engine build or game/browser run.

Reuse prior evidence for unchanged behavior and identify that scope in the PR. Select a new
manual/browser check only when the changed behavior needs it. Examples:

- Text or layout fix: one focused real preview at affected sizes; reuse full race outcomes.
- Content variant: inventory/reference checks and a sample of the new visual category.
- Audio unlock, storage or lifecycle change: one short targeted browser interaction.
- Race/mode outcome change: focused boundaries and the affected integration race; do not
  repeat every unrelated mode, route and long race.

No optimization/profiling pass is authorized by a matrix row; those passes require an explicit
user request. Harness/automation expansion also needs a user request, except for the smallest
bounded diagnostic or repair necessary for a concrete reproducible delivery blocker.
After a repeated failure, preserve it, triage the cause briefly and fix or report that blocker;
do not enter an open-ended rerun or test-infrastructure loop. Keep evidence concise in the PR.

Physical-phone testing is excluded unless the user later requests it. All mobile viewport,
safe-area, phone-low residency and structural checks run on desktop; targeted browser checks
use a real WebGPU browser. Do not require device installation, screenshots, performance probes
or sustained phone runs for edits, PRs or main promotion.

| Changed behavior | Relevant focused selection, when needed | Existing PR gate/coverage | Targeted observation, when affected |
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
| Explicitly authorized optimization | Relevant baseline and unchanged behavior/hash afterward | Existing scenario budgets and applicable gate | Same scenario only; no routine optimization pass |
| Explicit engine upgrade | Changed schema/import compatibility | Applicable PR gate; milestone gate at named completion/main promotion | One targeted startup/browser smoke; existing phone-low coverage |

## Landscape checks

Road renderer sizes are 882x344, 852x393, 1080x810, 1280x720 and 720x540 logical points.
Existing HUD/control coverage includes rotated notch/home safe insets; road-renderer coverage
alone does not establish HUD safe-area behavior. For a layout change, select the affected size
and safe-area case and inspect control bounds/playfield visibility. Inspect a final animation
frame when its placement changes; reuse unchanged animation and viewport evidence.

## Milestone scenarios

Existing flow coverage includes straight/curve/fork, traffic/crash, checkpoint/biome, timeout,
finish/restart and pause/resume recordings. Preserve and reuse them. Add a compact scenario
only for an uncovered changed outcome that needs it; avoid speculative additions. Use compact
boundaries while implementing and reserve the affected full race for outcome changes or first
required milestone acceptance.
Pipeline recordings must cover every newly introduced material/effect/UI/transition before
using them as evidence that racing creates no new pipelines. Never bless snapshots automatically.

Initial phone budgets are in harness.config.json. They are targets, not measurements or engine-
enforced budget files. The road proof has a scenario-backed structural budget in
`outrun/tests/budgets/road.json` (draws, runtime pipeline creation, GC and JS allocations).
The flat-road T1 suite checks five landscape sizes; hill T1 scenarios add crest phases and
transparent ordering. Add a budget only when an authorized change needs a currently uncovered enforced limit. Desktop timings do not certify phone frame time, GPU cost, peak RSS, or thermals.

Before a milestone, run a short WebGPU browser check from localhost/HTTPS covering the changed
implemented flows: start/unlock audio, controls, focus, resize, hide/restore, or storage as
relevant. Reuse existing replay-backed busy-traffic, scenery and transition checks unless those
behaviors changed.
Record relevant existing results and engine/game commit directly in the milestone PR; new
profiling or measurement passes remain excluded unless explicitly authorized.
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

The following names describe existing coverage. Select the smallest affected glob only when
that behavior changes; do not run the whole list during unrelated feature work. Run from the
repository root after setup, with the engine window serialized. The T0 review globs cover recorded selectors, held
repeat/release, command order and isolation of legacy proof clocks. The entry selection checks
recorded scene entry clears prior driving/held controls; destination T1 covers dirty acquired
ledgers and same-config reentry with fresh frames. The durable
SIM input tag retains commands across fixed-step batches without rendering; a SIMFALSE owner
cursor consumes each version once. Native atomic-batch and HMR checks additionally observe real
callbacks, fresh pixels and same-step SIM hashes; ordinary T0 steps alone do not prove that gap.

For example, a changed selector can use this one focused command:

```sh
npm run test:focus -- 'environment.reviewKeys*'
```

Other existing T0 reference names include `environment.reviewIsolation*`,
`environment.review entering*`, `environment.reviewRelay*`, `environment.geometry*` and
`environment.readiness*`. Existing render selections include `environment.destination*`,
`environment.bindings*`, `environment.occlusion*`, `environment.panoramaDestination*`,
`environment.profile canonical recorded destination art workload` and `environment.residency*`.
These names are a lookup reference, not a sequence to run. The finished CI gate supplies its
selected compatibility/cooked/render coverage once.

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
projected alpha, crop, occlusion or motion inspection. Preserve the existing panorama-boundary
and page0/page1/traffic overlap tests; their full selected gate run is not an extra edit-loop task.

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

## #73 ORIGINAL route simulation scope

[Route simulation](route-simulation.md) documents the optional co-owned actor, pin-free immutable
startup, source integer positions, canonical aliases, stable RNG owners and transaction/latch APIs.
Use `routes.math*` for strict choice/exit/checkpoint/gradient scheduling; `routes.driving*` for
movement/recovery; `routes.space*`/`routes.trafficState*` for raw integer authority;
`routes.collision*`/`routes.traffic*` for canonical contact/pass/lifetime rules;
`routes.transaction*` for the one advance→eligibility→finalize→transfer seam; and
`routes.native*`/`routes.entry*`/`routes.handoff*` for recorded startup, lifecycle and compact boundaries.
Use `routes.traversal*` for direct-scene fixed-input integration and `routes.canonical*` for
default-world recorded EnterScene plus fixed-plan reset (route epoch 1 then epoch 2). Select
`replay tests/replays/routes_canonical*` for the complete recorded hash streams; they include
startup and do not depend on a hidden scene override.
For a changed route behavior, select one relevant narrow T0 or short smoke while editing.
The selected finished PR gate supplies native/cooked/web lanes once; do not run each lane
again outside it. Reuse existing cold/direct-entry/HMR/missing-content evidence unless the
change affects that startup behavior.

Recorded landmark cheats isolate real current-map boundaries; quiet traffic/synthetic spin variants
are explicit debug supplements. Normal traversal must use the extracted FIXED keyboard plans with
actual configured traffic, no cheats/setters/patched rows or reactive input decisions during playback.
The extracted all-left/right-first plans and canonical tapes provide prior native integration
evidence at 35,879/7,333 steps. This section records the original #73 coverage scope; consult
the merged PR evidence and current milestone issue for later acceptance results. Do not treat
its historical lane list as a new demand to repeat those runs on unrelated changes.
Preserve all old outcomes/tapes and audit original ordered step/system hashes;
added SKIPPED optional systems can change raw trace containers without changing original behavior.

Goal ENTRY is source arrival after five ordinary stages; row500 is a later ending-brake threshold.
#73 publishes real once-only checkpoint bonus/arrival/pass producer latches. It does not implement
timeout priority, ending/results/restart (#16) or live route visuals (#74). Parent #15 and milestone
#19 remain open. Physical phones are excluded; any targeted Chrome lane must stay in the background
and prove focus preservation. Final exact-candidate evidence belongs in the PR, not an inferred
completion from this matrix.
