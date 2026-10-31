# Deterministic crash recovery

Issue #62 adds the nondefault `scenes/driving-crash.scene.json` fixture. It opts the
same terrain/traffic/contact entity into `CrashDriver`; existing scenes and canonical
recordings have no recovery owner. Source poses and actual browser impact-to-control
acceptance belong to #63. Parent #14 and the complete race remain unfinished.

Reference source: ZgzInfinity/OutRun commit `6882721c99bc79365f815f68d389bf5078129e68`.
`Game.cpp` gates ordinary controls during a crash. `Map.cpp` applies decrement and
collision drift before its row-gap carry and centrifugal term; that latter term
still applies during crashes. `PlayerCar.cpp` supplies the spin bands, animation
cadence, reaction cycles and recenter behavior. Recovery uses fixed simulation
steps rather than draw calls. There is no airborne flip physics.

## Hit handoff and ordering

`ResetMap01Driving` → `ResetCrashLifecycle` → `CaptureDrivingInput` →
`AdvanceDriving` → `AdvanceTraffic` → `BeginCrashRecovery` → presentation.

The normal hit tick completes once. Contact TOI selects a witness, never rewinds
that pose or adds another movement. `AdvanceTraffic` retains its original native
RNG stream and old-lifetime advance/detect/finalize seam. On an accepted hit it
copies the actual physical capture into the optional `CrashDriver` with
`pendingStep`; `BeginCrashRecovery` then consumes the new acceptance count and
current-step latch, draws one variant on its own native stream, locks recovery and
sets smoke/stopped diagnostics without moving the player.

This immediate SIM handoff is required by SDK 0.1.21: emitted event commands apply
**after all SIM stages**. An event-triggered downstream system cannot consume the
new `ContactAccepted` on the hit tick. That event remains unchanged for observers.
Count equality returns before reading the latch or RNG. A new count requires
exactly one increment, idle phase, current pending step, matching owners and valid
physical values. Consumption and lifecycle resets clear pending state.

## Fixed-step phases

| Phase | Behavior | Transition |
|---|---|---|
| Idle | Ordinary terrain/control integration | One accepted hit latches recovery |
| Spin | Captured-impact deceleration and crash movement; ordinary controls ignored | Exactly the selected number of advances, forced zero speed |
| Reaction | No movement; stopped gear/steering/effects | Exactly 105 following ticks |
| Recenter | Hidden, zero speed, move toward the latched nearest center | Entry error at most f32(0.05) restores visibility |

Positive impact speed selects 1/2/3/4 laps at ≤20/≤60/≤120/>120, with eight
advances per lap. The fixed decrement is f32(impact speed / advances). Each tick's
entry speed selects the current advance period: ≥100:3, ≥60:4, ≥20:5, >0:6 ticks.
The last advance forces zero, preventing a rounding residue from creating a lap.
Zero impact enters reaction directly; its first following tick normalizes stopped
diagnostics, gear and steering without shortening the 105-tick reaction.

Spin distance uses the **pre-decrement** speed with the established association
`f32(speed * 60 * dt)`. Roadside moves forward; traffic retreats by f32(delta ×
f32(0.5)). Clamp camera distance to 0..882450. Reverse-floor clamping alone does
not finish recovery. The upper section boundary cancels recovery and leaves the
existing bounded paused driver; it does not advance a campaign route.

Collision drift uses post-decrement speed and the captured positive handling cap.
Its sign follows captured global lateral direction; traffic uses source curve
fallback 1.67, while roadside uses the already captured source-reduced curve.
Then choose the nearest canonical road after collision drift (left tie), apply
right-road carry from the **actual stored previous gap** at speed ≥30.5, apply the
row centrifugal term once, and apply terrain bounds once. Publish the exact
`L0 → LS(collision drift) → LC(carry) → LR(CF) → LF(bound)` operands for detector
ledger pruning. Reaction is stationary; recenter publishes its continuous move.

Canonical side selection replaces the source's previous-render projected-point
choice so rendering cannot change outcomes. Existing port bounds remain ±1.5,
including its inner-gap rule; this does not claim the source's ±1.48 snap.

Reaction comprises three five-frame seven-tick cycles. Recenter latches the nearest
road center at reaction completion, checks tolerance **before** moving, and moves
at f32(0.72) × dt. The completion tick remains locked for contacts and passing;
normal controls and contact eligibility resume on the following ordinary tick.
Both spin variants share identical physics.

## Controls, barriers and evidence

Input capture continues during recovery. Held throttle/brake/steering can resume;
ignored gear pulses are not queued. Global manual-mode changes remain recorded,
without changing the captured recovery cap. Pause/resume and cancellation retain
the existing hold-release rules. Pause freezes recovery, detector, traffic and RNG.

Recorded driver reset, traffic reset/rebase and scene entry reset recovery and the
contact ledger coherently even while paused. Traffic-only cancellation preserves
actual current pose/speed/gear/manual state, clears steering/crash diagnostics and
synchronizes histories. It never restores impact speed or teleports the driver.
Scene-entry classification explicitly clears default-valued cooked input/preview
rows. The native crash RNG is not reseeded by these barriers.

Run `npm run test:focus -- 'collision.recovery*'` during edits and the full correct-base
PR gate at handoff. Tests include independent numeric boundary oracles; actual
recorded source roadside placement 9451 and seeded traffic contacts at low/high
speed; complete control return; lifecycle barriers; and landscape physical traces.
The low rear traffic fixture is physical contact with a selected nonparked car,
not a claim that it was visible. Active-spin upper-bound cancellation is a pure
physics case: source roadside props end far before that bound and traffic retreats.

Native/cooked V8 and Hermes, wasm parity, old replay/trace preservation, one new
complete recovery replay, hot reload, diagnostic smoke/hidden/restored frames and
desktop structural/performance evidence must be recorded against the final PR head.
Unchanged `TerrainPresentation` supplies diagnostic body/smoke/hidden behavior;
held brake can select its ordinary brake body. Correct source crash poses and
actual background-browser visual/manual acceptance remain #63. No phone testing
or measured phone performance is claimed.

The new unconditional recovery replay is
`collision_recovery_integration_high_seeded_traffic_reaches_exact_reactions_recenter_and_returned_control.greplay`:252steps, final`58be6f66b0a1a872`. Its genuine traffic impact captures speed199.42308044433594,cap200 and variant0; recovery occupies243following ticks (124spin,105reaction,14recenter). Native diagnostic samples occur at steps7/131/236/250. These are measured fixture outcomes, not fixed durations for every impact.
