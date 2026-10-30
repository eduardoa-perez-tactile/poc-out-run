# Active replay budgets

Use an active replay budget when a performance limit must cover the recorded gameplay,
including its simulation and presentation work. Add top-level `"activeReplay": true` beside
`replay` and `structural` in the scenario's `outrun/tests/budgets/*.json` file. Keep the replay
checked in and declare all four limits. If the marker is present it must be `true`;
`false` is invalid, and a requested run with no matching budgets fails:

| Structural field | What it limits |
|---|---|
| `drawCallsMax` | Peak rendered draw calls |
| `pipelinesCreatedDuringPlay` | New pipelines built during the capture |
| `gcPausesOver4msMax` | Reported GC pauses exceeding 4 ms |
| `jsAllocatedMBMax` | JS allocation during playback, in MiB |

Choose limits from an actual release-host capture of the same replay and GPU tier. Allocation
from a heavily instrumented test body is not replay allocation. A missing, null, negative or
non-finite metric is a failure, even when the declared limit would otherwise allow zero.
Zero new pipelines or GC pauses is valid only when the corresponding metric was reported.
Allocation must be positive; a zero-allocation idle capture cannot pass. Optional `repeat`
is an integer from 1 to 9, with each run independently required to satisfy every limit.

## What the harness measures

The harness builds a fresh game bundle from source once for the active run; it does not
rely on a leftover T1 bundle. The runner uses supported engine APIs and an isolated GPU
headless native host, with no automatic offscreen presentation target. Explicit requests
render at 1280 × 720 landscape; the host sets `--memory-class phone-low` on both mobile
and compat GPU tiers. The report records and
validates that viewport, memory class and tier; an implicit desktop class or portrait host
is insufficient project evidence:

1. Load the replay paused into a fresh world. Warm and inspect rendering at step 0 without
   consuming recorded inputs or advancing fixed steps. Reject a replay already finished,
   a nonzero start step or unavailable rendering/readiness evidence.
2. Start performance capture while the loaded replay remains paused. For each recorded
   fixed step, call `engine.step {n:1, frames:true}`. Verify the current step, hash and replay
   status, including no divergence. Do not call `engine.resume` or `replay.play`; the latter
   rebuilds the world and script VM after the allocation baseline.
3. Make one explicit `render.stats {render:true, width:1280, height:720}` request after
   **every** recorded step. Require exactly N captured simulation steps and N render requests
   for an N-step replay, with completion at N and positive actual GPU draw work on every
   request. Validate each GPU-counter baseline/delta: at least one frame must render.
   Capture may internally redraw the same snapshot while UI/assets settle; record these
   extra GPU frames without inventing extra simulation steps. Reject truncated, overshot
   or idle-only work; no tolerance hides a free-clock overshoot.
4. Validate every measured metric, then compare all four declared limits. Stop and clean up
   only the native host created for this capture on success, failure or timeout. SIGINT and
   SIGTERM must abort the run and trigger the same owned-host cleanup, rather than leaving
   its private child process behind.

Record the replay, exact game/engine candidate, release host, GPU tier, captured steps/frames,
metrics and result. Preserve the raw perf report and every observed GPU peak alongside
viewport, memory-class and tier provenance. Raw native `perf.frames` counts protocol/CPU
frames and LateUpdates, not GPU renders; keep it separate from requested and observed GPU
frame counts. Allocation includes protocol-driven presentation/capture overhead, not measured
production allocation per frame. Draw limits use the maximum of raw perf and observed GPU
peaks. Pipeline limits use the maximum of the raw count, summed per-request creation counts
and new actual pipeline keys. Exclude program/load metadata from key comparisons; zero
manual-capture raw counters cannot hide new pipelines. Preserve the raw report unchanged. A finished replay followed by idle capture is insufficient evidence.

## Why this is an additional lane

With the pinned SDK, one new traffic replay exposed a specific structural-runner limitation:
its post-start asset-status wait could outlast playback, letting capture begin only after
all recorded steps had finished. Those rows did not establish active allocation or GC cost.
This does not invalidate every SDK budget, and this project guard does not patch or claim to
fix the engine's pending-status behavior. Stock SDK checks remain visible alongside the
explicit active lane; neither result silently substitutes for the other.

An earlier free-running diagnostic of that traffic scenario covered 829 steps and 595
frames, but its portrait viewport and variable render cadence do not establish limits for
this lane. The capture contract is **one explicit render request per fixed step**, with no
free-running clock or automatic presentation. New limits require fresh evidence at this
cadence and configuration; investigate and independently review any ceiling adjustment.

Controlled preparatory terrain captures covered all 168 steps and 168 explicit GPU requests
on each tier, with 505 native protocol frames, 10 peak draws, unchanged 11→11 actual pipeline
keys and no GC pauses over 4 ms. Allocation was 66.407 MiB on mobile and 66.312 MiB on compat.
The proposed 80 MiB terrain ceiling gives about 20% allowance over that observed cadence;
the old 32 MiB ceiling measured a different cadence. These preparatory results do not replace
fresh captures of the final helper, both-tier gate results and independent review at the
exact candidate head.

## When to run it

Keep the focused edit loop unchanged: use `npm run test:focus -- "<behavior>*"` for the smallest
relevant T0 selection. For one marked scenario, run from the repository root:

```sh
npm run test:budget -- --gpu-tier mobile --budget terrain.json
npm run test:budget -- --gpu-tier compat --budget terrain.json
```

Omit `--budget` to select every marked budget; a named selection is a canonical budget
basename such as `terrain.json`. Only mobile and compat tiers are accepted. This command
uses the harness lock and pinned-engine/editor preflight. `npm run test:visual` automatically
runs the active lane after stock SDK T1 on each of those two tiers. The applicable PR/milestone
gates still include their normal integrity, parity, cooked, visual and stock structural
checks; use the [workflow](workflow.md) and [test matrix](test-matrix.md) for required behavior evidence.

Interruption cleanup belongs to the private native test session; never stop an unrelated
editor, game host or user process. Deadlines bound failures, not a promised runtime latency.

This lane launches no browser and requires no phone. Its budgets describe structural work
with one explicit render request per fixed step; they do not measure wall-clock FPS, real-time frame duration,
phone RSS or thermals. No simulation state is fabricated to reach a capture. The lane does
not replace actual background-browser checks required for visible gameplay changes.
