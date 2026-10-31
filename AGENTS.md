# OutRun project harness

Read `outrun/PROJECT.md` and `docs/workflow.md` before work. The engine project is `outrun/`;
run the npm harness commands from this repository root. Engine-managed instructions and skills
are refreshed locally with `npm run setup`; never commit the SDK, caches, or copied engine skills.

This is an internal personal prototype for mobile and web in landscape. Keep work focused on
the game and its development harness. Do not import upstream README or legal documents.
Prioritize fast desktop iteration. Physical-phone testing is excluded unless the user later
requests it: do not install, run, profile or capture games on connected phones, or build phone
probes solely to satisfy validation. Keep mobile viewport/safe-area tests, desktop phone-low
residency and structural budgets, native/web parity, and targeted real-browser checks. Hardware
frame-time, memory and thermal budgets remain design targets, never claimed measurements.

Chrome/browser tests, including headed Chrome, must stay in the background without stealing
user focus or popping up windows. Use a dedicated owned browser profile and preserve the user's
windows; clean up only the test session. Never launch in the foreground, call `bringToFront`,
activate the browser, or cycle minimize/restore. Verify focus preservation and actual WebGPU
pixels/behavior. Headless checks count only when those pixels and behavior are verified. If a
required check cannot remain in the background, report that browser lane as blocked.

## Autonomous ticket coordination

For every ticket, act as coordinator and use subagents. This applies to documentation and
infrastructure tickets as well as gameplay. Read the issue, its dependencies, acceptance
criteria and test matrix before claiming it. Select only ready work within the authorized
scope, record the ticket/branch, and split a ticket before implementation if it exceeds one
independently testable PR.

Delegate implementation to one or more focused subagents with explicit outcomes, file
ownership, constraints and required evidence. Give concurrent writers disjoint files; shared
schema, scene and generated-file changes have one owner and are integrated in order. Keep the
coordinator responsible for architectural decisions, integration, Git operations, validation
and completion. Subagents must not independently switch shared branches, merge or promote.

Use a separate reviewer subagent after integration; it must not review its own implementation.
Resolve blocking findings and obtain review of material follow-up changes before merging.
The coordinator runs the final gates on the integrated candidate and records the tested head
SHA, commands/results, review outcome and applicable visual/browser evidence in the PR. Serialize
engine commands across all agents and wait for any editor native build. If subagents or required
validation cannot run, report the blocker rather than silently treating the ticket as complete.

## Gitflow and standing merge authorization

Use `feature/<topic>`, `fix/<topic>` or `chore/<topic>` from current `develop`; one independently
testable change per PR. Reuse the matching active ticket branch when continuing existing work.
Use draft PRs for unfinished or blocked work. No direct pushes to shared `main`/`develop`, no
force pushes to shared branches, and no branch-protection or check bypasses.

The user has authorized autonomous merging when all applicable checks pass; do not ask for
fresh permission. After independent review, passing required GitHub checks and the ticket's
complete validation/evidence, squash-merge its PR into `develop`. Then assess the complete
`develop` candidate against `main`, including every accumulated change: promote only the fully
verified candidate through a `develop` → `main` PR using a merge commit, never a direct push or
squash. Re-run validation if the candidate/base changes or conflict resolution changes code.
Do not promote unrelated unfinished, failed or unverified work.
Repairs follow the same fix-to-develop-to-main path. When needed after promotion, synchronize
main back into develop through a validated merge-commit PR; never squash shared history.

For a docs-only candidate, repository policy and harness tests are the applicable checks.
For a game-bearing main promotion, run `gate:milestone` plus the targeted real-browser
evidence from the matrix; a narrow ticket gate or hosted repo-policy alone is insufficient.
Unavailable required tooling, missing required evidence or blocking review findings prevent
merge/promotion. The bootstrap wasm-host gap has been resolved with native/web parity and an
actual headed WebGPU startup/resize check; see `docs/engine-setup.md` for reproducible setup.
Physical-phone evidence is not a merge or promotion requirement. Once merged and promoted,
update the issue with evidence and resulting commits/PRs; do not close a ticket merely because
implementation was written.

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
