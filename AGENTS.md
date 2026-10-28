# OutRun project harness

Read `outrun/PROJECT.md` and `docs/workflow.md` before work. The engine project is `outrun/`;
run the npm harness commands from this repository root. Engine-managed instructions and skills
are refreshed locally with `npm run setup`; never commit the SDK, caches, or copied engine skills.

This is an internal personal prototype for mobile and web in landscape. Keep work focused on
the game and its development harness. Do not import upstream README or legal documents.

Use `feature/<topic>` or `fix/<topic>` from `develop`; one independently testable change per PR.
Use draft PRs for unfinished work. Never merge, promote to main, or force-push shared branches
unless the user asks. Bootstrap is the one initial direct push to create main and develop.

Before editing, run `npm run test:plan -- --base origin/develop` (use the actual PR base).
While iterating, run a focused T0 test and inspect hot reload. At handoff, run `npm run gate:pr`
with the correct base, which always checks project integrity for game changes and adds render,
web, and cooked checks according to changed paths. Unknown project paths select the broad gate.
Docs-only changes run `npm run verify` and `npm run test:harness` without rebuilding the engine.
Use `docs/test-matrix.md` for the behavior checks required beyond path selection.

Inspect editor state before engine work; never compete with an editor native build. Schema
changes require `gameengine gen` before code imports the generated fields. Keep saves compiling.
Use the engine's UI document commands for UI, and read its touch/camera skills when applicable.
Simulation state belongs in schema components/resources and depends only on recorded input,
fixed steps, deterministic math, and seeded RNG. Presentation cannot change race outcomes.

Failures and unavailable lanes stay visible. Never skip a missing web host, bless goldens or
rehash a replay just to turn a gate green. Report commands, results, timings, coverage gaps,
and a screenshot/replay for visible or behavioral changes. Bootstrap tests prove the starter
and harness only; do not claim that OutRun gameplay is covered before it exists.
