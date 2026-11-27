# Landscape driving controls

Controls appear only in the opt-in driving scene (`DrivingState.active=true`). Road and hill
preview scenes retain their existing UI and constant-speed behavior. The default start scene
is unchanged; use `gameengine run --scene scenes/driving-proof.scene.json` to inspect controls.

LEFT/RIGHT and BRAKE/ACCEL occupy the bottom corners inside the landscape safe area. The center
40% stays clear. Targets are176 reference pixels square; tests check their actual hit boxes
are at least50 view points at all five supported landscape sizes, with the notch on either
side. These are desktop layout checks, not measured physical-phone dimensions or performance.

Documents own the appearance/layout and were authored with `gameengine ui doc`. Thin view
code supplies held input in document code areas: a public View wrapper starts on
`onPressIn` phase`down` and releases on `onPointerUp` (including cancel/outside release).
Leaving a target does not release it; re-entering does not create a new hold. The visual
Widget has no button behavior, so it cannot steal capture or delay input until release.

Different steering/pedal targets can be held independently. Public UI callbacks do not expose
pointer IDs; independently counting multiple fingers on the same target is outside this slice.
Keyboard/source0 and UI/source1 hold masks combine in simulation. A UI release preserves a
held keyboard control and vice versa. Views emit validated intents; controllers send recorded
`DrivingControlChanged` input. Views never read the world or decide driving outcomes.

The PAUSE action uses recorded `DrivingPauseRequested`; keyboard Space shares its reducer.
Pausing clears both source masks, ignores new holds while paused and shows a blocking dialog.
RESUME clears holds again; it never reinstates a prior touch. Platform pointer cancellation,
lost capture and browser blur release captures; background lifecycle cancellation also clears
both authoritative sources and presentation feedback. Keyboard releases still flow through
recorded KeyEvents. Lifecycle listeners and view handles are cleaned up when disposed.

Focused checks are `controls.*` T0 plus targeted T1 hit tests and safe-area tests. Integration
requires native/web parity, the PR/visual gates and an actual headed-browser multi-touch,
pointer-cancel and keyboard/focus check. Physical-phone testing is excluded by the user.
