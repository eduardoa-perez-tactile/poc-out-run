# Replay and structural-budget contract

Every committed structural-budget replay starts from `project.gameengine.json`'s configured
start scene. Its setup must arrive through recorded input. A test's scene override is not
restored by standalone verification or structural playback in Game Engine0.1.21: the replay's
`sceneId` is the test name, and playback rebuilds the configured scene.

Before structural playback, the harness discovers every `tests/budgets/*.json` structural
replay and verifies its complete stream independently on V8 and Hermes. Both lanes must report
success and the same positive verified step count; zero tests, missing files, malformed paths,
invalid JSON and zero-exit unsuccessful reports fail the gate. Native PR gates also perform
this check. A gate verifies each unique replay once per invocation; focused T0 iteration stays
independent of these integration checks.

This explicit verification is necessary because the engine's structural-budget runner waits
for replay completion but does not reject `replay.status.divergence`. A completed playback
can therefore measure allocation/render budgets while its authoritative state differs from
the recording. Completion and structural metrics alone are insufficient replay evidence.

## Fixture repair in #35

The road recording originally covered the #6 scene with two entities. #7 added diagnostic
object and backdrop entities. Their `SceneEntity`, `LocalTransform` and `WorldTransform`
components are authoritative and participate in hashes, even though the additions draw only
presentation diagnostics. The road recording is deliberately rehashed for this scene change,
preserving its original input/header and60-step duration.

The hill recording originally initialized `scenes/hill-proof.scene.json` through the test's
unrecorded scene option. Standalone verification and structural budgets instead loaded the
road start scene. Its revised test uses that canonical scene and records `RoadFixtureRequested`
with fixture3, distance33000, speed7200, lateral0 and playingtrue. After180 steps the expected
distance remains54600. This one-time re-recording changes setup input intentionally so the
budget actually exercises the hill; rehashing the old input on the wrong scene would hide the
scenario error.

Diagnosis on baseline7b63df2: the old road replay verified all60 steps with the pre-#7 scene;
the old hill replay verified all180 steps with its actual hill scene. On the configured road
scene both failed at step0. Temporary baseline copies also verified their complete60/180-step
streams on #11a107de4 in both native engines, demonstrating that #11's inactive driving
resources did not introduce these failures. No physical-phone evidence is involved.

## Updating a replay

First preserve the failure report and identify the intended behavior or scene change.
For a change that preserves recorded input, use `gameengine replay rehash <file> --out <copy>`
and inspect the report before replacing the fixture. For an intentional input/setup change,
record only its named test with `gameengine test --tier t0 --js v8 --filter '<exact name>'
--record-replays`. Explain the new setup and confirm its expected authoritative end state.
Then verify the resulting committed replay with `gameengine replay verify <file> --js both`.
Do not regenerate an unrelated replay or golden to make a gate pass.
