# Source crash presentation

Issue #63 connects the [deterministic recovery phases](crash-recovery.md) to the existing
Ferrari1 artwork. The nondefault `scenes/driving-crash.scene.json` remains the collision
slice; the project start scene is unchanged. This work does not add flip physics, change
recovery duration or activate a complete race.

Reference source is OutRun commit `6882721c99bc79365f815f68d389bf5078129e68`.
`PlayerCar.cpp` selects body frames 121–146 for the two spin/reaction families. The
[vehicle guide](../art/vehicles-animation.md) records the source canvases and anchors.

## One pose owner, fixed-step samples

`TerrainPresentation` remains the single terrain/crash pose writer. Its optional read-only
`CrashDriver` query must match the sole terrain owner and map. The
[pure mapper](../../outrun/src/render/crash-presentation-math.ts) supplies:

| Recovery state | Pose | Sample | One-based source frame |
|---|---|---|---|
| Spin, variant 0 | 18 | advances % 8 | 121–128 |
| Spin, variant 1 | 20 | advances % 8 | 134–141 |
| Reaction, variant 0 | 19 | floor(reactionTick / 7) % 5 | 129–133 |
| Reaction, variant 1 | 21 | floor(reactionTick / 7) % 5 | 142–146 |
| Recenter | Last reaction pose | 4, hidden | No visible body |
| Idle | No crash override | Existing terrain sample | Ordinary driving family |

The mapper validates phase, variant and bounded integer counters. Spin/reaction selection
uses authoritative SIM counters, never the ordinary visual clock, asset readiness or render
frequency. Reaction ticks 0–104 display three complete five-frame cycles; phase 3 hides at
completion. Existing SIM wheel flags select smoke while moving and no effect when stopped;
the chosen sample also feeds the existing four-frame smoke loop.

`VehiclePresentation` remains the sole geometry and asset-group owner. It uses the unchanged
12-vertex/18-index pool; hidden recovery degenerates geometry while retaining the group pin.
All 26 crash/reaction canvases retain their full 171 × 46 source pixels, ground anchor
[85.5, 46], untrimmed atlas rectangles and separate wheel anchors. Art dimensions do not
change the independently authored physical hull. No atlas, importer or source PNG changed.
The [mapping tests](../../outrun/tests/content/collision-crash-mapping.test.ts) cover both
variants, all spin advances, every reaction tick, hidden/idle transitions and those anchors.

## Completion followed by pause

A crash can finish without another presentation update before pause. The old ordinary
paused fallback could then keep an inherited spin/reaction pose. For the same live crash
owner at phase 0, the presenter now recomputes the ordinary terrain pose only when the
inherited pose is 18–21. Ordinary paused poses and standalone authored review poses retain
their established behavior.

The T1 inherited-state regression models stale presentation through `VehiclePreview` alone;
that test does not establish skipped native LateUpdates. A separate actual native proof
scheduled recorded pause during one step batch, completing recovery and pausing before its
next LateUpdate. The previous fallback retained pose 19/sample 42 at paused step 251;
the corrected presenter selected ordinary pose 0 at the same SIM hash
`43a885680134dbe5`. Live hot reload exercised the correction, and subsequent input restored
movement. The earlier assumption that ordinary separate `step()` calls alone proved this
missing-update sequence was insufficient; the scheduled-pause proof supplies that evidence.
These bounded reload observations are not hardware frame-time measurements.

## Read-only diagnostics and source readiness

The [project diagnostic helper](../../outrun/src/render/crash-diagnostics.ts) publishes an
owned frozen `live-crash` snapshot: current physical state, phase/counters, selected source
frame, hidden/effects, viewport and at most two current/previous contact rows. It does not
accumulate a game-side history or accept commands. Tests cover copy ownership, malformed
values, stale namespace cleanup and disabled paths.

This API is separate from the SDK probe. It enables only for an explicit local DEV probe
or a distinct parent exposing the public probe function and `postMessage`. Cooked game
bundles can have DEV false while the outer probe player supplies that opt-in. The helper
checks function presence without invoking it, sends one-way `outrun-crash-diagnostics`
version-1 messages, and sends a single null when clearing an existing snapshot. Cross-origin
`SecurityError` disables transport; unexpected errors remain visible. Native/release paths
without that opt-in return before copying caller state. No SDK reflection, inbound listener
or SIM write is introduced. Snapshots and image bounds never prove rasterized pixels.

Loading completion is insufficient source-art readiness. A real missing-atlas experiment
reported the player group as `loaded`, progress 1, but with failed member
`textures/player-ferrari1` and zero resident source texture bytes. The old progress-only
predicate failed a focused regression. `crashPlayerArtReady` now also requires an enabled,
requested player group, no forced placeholder and an empty `failed` list; the focused
[diagnostics suite](../../outrun/tests/content/collision-crash-diagnostics.test.ts) then passed
all ten cases.

## Recorded evidence and remaining lanes

The current preservation audit compared 192 full baseline trace files byte for byte and
separately compared the outcomes of three registered replay cases. All 13 existing replay
files remained byte-identical. This is not a claim that all 195 baseline cases supplied
full trace files.

The [render tests](../../outrun/tests/render/collision-crash.test.ts) cover real contacts,
both naturally selected variants, low/high roadside impacts, source phases at 1280 × 720
and 852 × 393, pause, scene exit/reentry and restoration. A separate active low-traffic
fixture proves actual approach pixels before contact; the older rear/inactive physical
fixture is not visible-approach evidence. Normal native captures initially reported missing
new goldens; 22 mobile and 22 compat files were subsequently inspected and specifically
approved. Their paired decoded/encoded comparisons matched. Fresh cooked T1 runs passed
all eight cases on each tier. Existing goldens were unchanged.

Forced-placeholder and body-disabled T1 cases prove recovery independence from those
presentation branches. They are not actual missing-file or delayed-network tests. The
separate missing-art proof removed the copied player PNG in an isolated loose project and
fresh host without copied asset caches. The expected asset errors and failed group were
recorded; the real source pixel was absent. The unchanged 252-step recovery replay still
finished at `58be6f66b0a1a872` with no divergence. Restoring the PNG and starting a fresh host
restored the expected source color. Pixel checks used a five-level per-channel consistency
limit, not exact raw source RGBA equality. The original candidate PNG was untouched and
both owned hosts cleaned up. This proves actual missing-art invariance, not measured network
delay or same-session late arrival.

## Background browser evidence

Four actual browser scenarios passed: low/high traffic and low/high roadside impacts,
covering both naturally selected variants at 1280 × 720 and 852 × 393, DPR 1. These bounded
collision fixtures exercised trusted UI resume, Space pause and held-throttle control return;
they are not a complete race from the default start scene. The audit retained 34 PNG captures,
2,953 OS focus samples, zero browser errors, absent owned browser PIDs and deleted test
profiles. Chrome remained in the background. Independent review inspected and approved all 34 captures and their raw input, phase,
focus and cleanup records.

The low-traffic approach also checks fixed original `Car1/c1.png` texels (49–52, 25), rather
than taking a screenshot baseline. Chrome uses `--force-color-profile=srgb`. The reference
calculation decodes source sRGB, quantizes the scene to linear RGBA8, blends 0.4 of that scene
with 0.6 of decoded default scrim `#05070d`, quantizes again, then encodes sRGB. Source amber
[213, 115, 0] at x 49/50 becomes [141, 75, 13]; gray 65 at x 51 becomes [38, 42, 42]; gray 82
at x 52 becomes [53, 53, 53]. All 12 RGB channels matched exactly at both viewports. Captures
wait at least 300 ms for the documented 220 ms scrim transition. No baseline or tolerance was
widened to obtain these matches.

Three earlier trials remain failed evidence: the initial ICC-profile run, the sRGB run with
an incorrect old color oracle, and the composite run with a resume polling race. When polling
misses a brief running interval, the resume check requires a fresh one-way phase signal at a
newer step. An observed running state is also valid; a stale paused snapshot is rejected.
This adds no game-state writes.

## Integrated validation and remaining review

The local full gate passed all 19 stages in 334.93 seconds: 213 cases in each
native V8/Hermes and V8/Wasm lane, 213 cooked V8 cases and 161 T1 cases on each GPU tier. An additional
cooked Hermes run passed all 213 cases. All 13 existing tapes were validated on both native
runtimes through eight budget replays, three registered replay cases and two explicit replay
checks. The preservation audit above still distinguishes 192 full trace comparisons from
three registered replay outcome comparisons.

[PR #66](https://github.com/eduardoa-perez-tactile/poc-out-run/pull/66) records final exact-head
GitHub CI and review evidence. Integration requires those checks to pass; browser evidence
alone is insufficient. Physical-phone testing is excluded; these results make no
hardware frame-time or thermal claim. This document does not mark #63, parent #14 or the
full game port complete.
