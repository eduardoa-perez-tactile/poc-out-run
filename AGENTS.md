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

## Delivery first: minimum meaningful validation

The current priority is completing playable features for this internal prototype. Deliver one
usable player-facing feature per gameplay work item. Testing supports that delivery; test counts, new
reports and harness expansion are not deliverables. This section governs how the later test
matrix and historical coverage notes are applied.

- During implementation, use build/type checks or hot reload and one short smoke check of the
  changed flow. Run a focused automated test when it proves meaningful behavior or a regression;
  do not require a new test, full suite or browser run for every edit, save or checkpoint commit.
- Choose checks from the matrix for the actual change. Reuse evidence for unchanged behavior.
  A label/layout fix needs a focused preview, not another complete race; another content variant
  needs inventory/reference checks and a representative category sample, not every frame.
- Run the existing required PR gate once on the finished candidate through exact-head CI.
  A local full gate is only for a concrete CI diagnostic, never a routine prerequisite.
  Required CI supplies the final gate evidence; do not duplicate it locally or repeat separately
  selected render/web/cooked lanes. Repeat only checks affected by a material candidate/base
  change, a failure or an unresolved concern, plus whatever protected CI requires. Ready state,
  another review or a squash whose tree matches the tested tree is not a reason for a manual rerun.
- Reserve milestone gates for an actual completed milestone or main promotion. Run a complete
  race/mode check only when its outcome changes or to finish that acceptance. Do not turn each
  feature ticket into a milestone or replay the full game for an unrelated UI, audio or docs edit.
  Docs-only work needs policy/harness checks; use existing CI results and do not launch the
  engine, export or open a browser for it.
- Do not initiate optimization or profiling passes unless the user explicitly requests them.
  Add validation tools or expand coverage only when requested or necessary for the smallest fix
  to a concrete reproducible delivery blocker. Minimal diagnosis is not a new profiling pass.
  After two failed attempts at the same validation blockage, preserve
  the failure, report the specific blocker and continue independent ready feature work when
  possible; do not spend another work session constructing a larger test harness.
- Keep evidence concise in the PR: the candidate, changed behavior, applicable commands/results,
  one relevant capture/replay when needed and remaining blockers. Do not create additional
  evidence scripts or reports solely to restate results already produced by the harness.

Existing tests, budgets, independent review and required protected checks remain in force.
Missing required evidence still blocks the affected merge; never relabel a failure as a pass.
Physical-phone testing stays excluded and Chrome stays in the background.

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
complete validation/evidence, squash-merge its PR into `develop`. At a completed milestone,
assess the complete `develop` candidate against `main`, including every accumulated change:
promote only the fully verified candidate through a `develop` → `main` PR using a merge commit,
never a direct push or squash. Do not start a separate main promotion after every feature ticket. Re-run affected
validation and required CI if the candidate/base changes or conflict resolution changes code.
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
During implementation, use the minimum meaningful checks above. At the finished PR boundary,
run `npm run gate:pr` once with the correct base through required CI. The existing harness checks
project integrity for game changes and selects render, web and cooked lanes by changed paths;
unknown project paths select the broad gate. Do not run those lanes again as separate commands.
Docs-only changes require `npm run verify` and `npm run test:harness`; existing required CI can
supply these results without a duplicate local run or an engine build. `docs/test-matrix.md`
is a change-selection reference, not a checklist to execute in full for every ticket.

Inspect editor state before engine work; never compete with an editor native build. Schema
changes require `gameengine gen` before code imports the generated fields. Keep saves compiling.
Use the engine's UI document commands for UI, and read its touch/camera skills when applicable.
Simulation state belongs in schema components/resources and depends only on recorded input,
fixed steps, deterministic math, and seeded RNG. Presentation cannot change race outcomes.

Failures and unavailable lanes stay visible. Never skip a missing web host, bless goldens or
rehash a replay just to turn a gate green. Report commands, results, timings, coverage gaps,
and a screenshot/replay for visible or behavioral changes. Bootstrap tests prove the starter
and harness only; do not claim that OutRun gameplay is covered before it exists.
