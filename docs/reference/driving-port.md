# Driving slice: units and compatibility

This implements #11 against source commit `6882721c99bc79365f815f68d389bf5078129e68`,
`src/Car/PlayerCar/PlayerCar.cpp:56,464–650` and `src/Scene/Map/Map.cpp:558`.
The dedicated `scenes/driving-proof.scene.json` opts into driving; the default road proof
and its goldens retain their original constant-speed fixture behavior.

Keyboard: Up throttle, Down brake, Left/Right steering, E/Q up/down gear, M switches
manual/automatic, Space pauses/resumes. Release keys after pausing before pressing anew.
The default mode is automatic. Road fixtures remain available in the original proof only.

Authoritative state advances at the project's fixed 60 Hz. `legacySpeed` is source distance
per nominal update: low cap100, high cap200, acceleration100/6.5 per second, braking50 per
second and coast75% of acceleration. The road adapter publishes world units/second as
`legacySpeed*60`; future HUD speed is `legacySpeed*1.65`. Views never write this state.
Input events are recorded, held sources are separate, and shifts/mode/pause use rising edges.

Preserved rules: left wins opposing steering; brakes win opposing pedals; low/high caps;
automatic upshift at low cap; manual shifts only during eligible throttle; up wins opposing
shifts; braking/coasting below100 selects low even in manual mode. Downshifting above100
removes one acceleration increment, then coasts until acceleration is eligible again.
Terrain, drift, collisions and race phases are intentionally outside this slice.

Deliberate corrections: brakes also win at zero (source can accelerate both-held at rest);
coasting clamps immediately to zero; recorded edges replace uninitialized SFML event reads;
steering approaches its target without source overshoot/oscillation. Outer lateral limits
clamp to±1.5 rather than source snap-to±1.48. Movement uses continuous f32 distance
`legacySpeed*60*dt`, consistent with the road proof; source f32 integer-truncated distance
is not an equality oracle. Presentation never advances movement. The driving scene disables
the original proof mover/input; exactly one system owns distance in either mode.

Nominal source arithmetic speed samples at ticks1/60/120 are0.256410271/15.3846235/30.7692585;
accept absolute speed error0.002 for these comparisons. Upstream tick391 upshift reflects
binary32 accumulation rather than an exact6.5-second promise. Tests assert the threshold
neighborhood and cap semantics. Replay/hash parity pins the port's behavior, not upstream
runtime measurements. No original gameplay timing or physical-phone measurement is claimed.

Targeted validation: `driving.*` world tests during edits, PR gate and native/web parity at
handoff, then a short keyboard drive in the dedicated scene to observe acceleration,
steering, braking and pause/release cancellation. Viewport changes must not affect sim.
