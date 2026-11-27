# OutRun development workflow

This is a personal internal prototype: mobile and web, landscape, deterministic TypeScript
gameplay on Game Engine 0.1.34. The working game is `outrun/`. Commands below run at the repo root.
The project starts at the original main menu: configure difficulty and traffic, choose
ORIGINAL mode, transmission and vehicle, then choose radio music and start the connected race.
Driving, traffic, collisions, route transitions, HUD, results and audio are playable.
Continuous/Survival modes and remaining features are tracked in the backlog. Historical bootstrap evidence is in [engine setup](engine-setup.md); the
[behavior matrix](test-matrix.md) is a coverage reference for selecting affected checks.

## Delivery-first execution

Finish working player-facing features. During implementation use a build/hot-reload check and
one short smoke check of the changed player flow. Add or run a focused automated test only
when it proves meaningful new behavior or a reproducible regression. No test-per-edit,
test-per-save, full-suite checkpoint or speculative test expansion is required.

Run one required exact-head CI gate on the finished, independently usable candidate. Its
complete result also satisfies handoff. A local full gate is only for a concrete CI diagnostic,
never a routine prerequisite, and cannot replace required CI. Do not repeat a passed gate
because a reviewer replied, a PR became ready, or a squash produced the same tested tree.
Arrange ready-for-review before starting final CI to avoid an unnecessary replacement run. Material code/base changes require affected evidence to be
refreshed and all required GitHub checks to pass for the actual candidate. Reuse evidence for
unchanged behavior and document its scope briefly in the PR.

Use `gate:milestone` only for an explicitly completed milestone or a game-bearing main
promotion, not each feature, checkpoint or documentation change. The matrix selects relevant
checks; it is not a requirement to repeat every listed scenario on every ticket. Run a new
browser check only for directly affected browser/platform behavior, and keep it short.

Do not start optimization or profiling passes unless the user explicitly requests them.
Do not expand the harness, custom automation or proof reports unless requested or the smallest
bounded diagnostic/fix is necessary for a concrete reproducible delivery blocker. After a
repeated validation failure, stop the rerun loop: preserve the failure, identify its cause in
one short triage, then fix that cause or report the blocker.
Keep unrelated ready feature work moving; an open parent acceptance checklist alone does not
block independently usable work whose implementation dependencies are already integrated.
Keep parent completion and missing acceptance evidence honest.

Physical-phone testing is excluded unless the user later requests
it: do not install/run/profile/capture a game on a connected phone, or build a phone probe solely
for validation. Mobile remains a target through desktop viewport/safe-area tests, phone-low
residency and structural budgets, native/web parity and targeted real-browser checks. Physical
phone frame-time, memory and thermal budgets remain design targets, not measured guarantees.

Run Chrome/browser checks, including headed Chrome, in the background without stealing user
focus or popping up windows. Use a dedicated owned browser profile and reuse that test session
when possible. Do not launch in the foreground, use `bringToFront` or browser activation, or cycle
minimize/restore. Preserve the user's windows and other applications; clean up only the test
session's owned windows/processes/profile. Verify focus preservation and actual WebGPU pixels
and behavior. Headless runs qualify only when the expected pixels and behavior are verified.
If a required check cannot remain in the background, report the browser lane as blocked.

## Branches and integration

| Branch | Purpose | Integration |
|---|---|---|
| `develop` | Daily integration; default PR base | Feature/fix/chore PRs, squash merge |
| `feature/<topic>` | One playable behavior or renderer capability | Start from latest develop; normally hours to two days |
| `fix/<topic>` | Regression with a reproducing test | PR to develop |
| `chore/<topic>` | Harness, engine upgrade, content tooling | PR to develop |
| `main` | Last verified playable milestone | PR from develop; merge commit, never squash |

No release branches or store/deployment process. Tag main milestones `poc-m01-road`,
`poc-m02-driving`, `poc-m03-race`, etc. The user gives standing permission to merge completed
ticket PRs into develop and promote a verified develop candidate to main once all applicable
checks and evidence pass. No further confirmation is required. A green hosted repo-policy
check alone does not establish that the game passed. Keep unfinished experiments on short branches or draft PRs.
Do not combine a mechanical engine upgrade with gameplay tuning.

```sh
git fetch origin
git switch develop
git pull --ff-only
git switch -c feature/road-hills
npm run test:plan -- --base origin/develop
# implement, check build/hot reload, smoke the changed player flow
# the finished candidate runs one required exact-head gate:pr in CI
git add <specific-files>
git commit -m "feat: clip road scenery behind hills"
git push -u origin feature/road-hills
gh pr create --base develop
```

Feature PRs should leave develop usable. If the full feature is larger, land a small vertical
slice with a safe default, rather than a half-connected subsystem. Squash only feature PRs.
Use a merge commit when promoting develop to main so the shared history stays connected.
Rebase only your private feature branch; never rewrite shared main/develop history.
Repairs use the same fix-to-develop-to-main flow; there is no direct-to-main hotfix exception.

## Coordinator and subagent ticket lifecycle

For every ticket, the primary agent acts as coordinator and uses subagents. The coordinator
owns scope, integration, validation and completion; delegation does not transfer those duties.

1. Read the issue, dependencies and current PR state; claim the ticket and record its bounded
   outcome and acceptance criteria. Check concrete implementation dependencies before
   starting dependent work; track unrelated parent acceptance separately. Continue an existing
   matching branch/PR, or start a feature/fix/chore branch from updated develop. Do not switch a shared checkout while another agent is editing it.
2. Delegate a specific implementation task to a subagent with explicit file ownership, inputs,
   expected output and focused validation. Use additional implementation subagents only for
   independent work with disjoint ownership. Integrate shared schema, entry-point and config
   changes sequentially through the coordinator; keep every save compiling.
3. Use a separate reviewer subagent to inspect the integrated diff against the ticket's
   acceptance criteria and engine boundaries. The reviewer must not approve its own
   implementation. Keep review proportional to the changed behavior; do not initiate a
   performance study or new validation workstream for routine feature review.
4. Resolve blocking findings, use the minimum edit loop below, and have the coordinator run
   the required integration gate once against the finished candidate. Serialize engine commands
   across agents and wait for editor native builds; subagents must coordinate before starting
   tests that share the host, session or SDK checkout.
5. Record contributions/review, tested head/base, command results and applicable existing or
   new screenshot/replay/browser evidence directly in the PR. Do not create a separate report
   or automation project just to restate it. Refresh affected checks/review for material changes.
6. Mark the finished PR ready before launching final CI. Once applicable checks, review and
   evidence pass, squash-merge into develop through GitHub. Verify the resulting develop commit and issue acceptance
   criteria. Close the issue only after its implementation is integrated; report whether it
   has also reached main. Keep blocked or unfinished work in draft with a precise blocker.

Do not bypass protected-branch requirements, force a merge, disable a required check, silently
skip an unavailable lane or regenerate a failing baseline merely to integrate. Missing required
tooling or evidence blocks the affected merge/promotion; it is not a request for renewed merge
permission. The original PR #1 wasm-host gap has been resolved through a pinned external source
build, passing native/web parity and actual headed-browser startup/resize evidence. See engine-setup.md.
A future missing required host still blocks the relevant gate.

## Autonomous promotion to main

After ticket integration, inspect the complete develop-to-main diff and all included tickets.
Do not promote unrelated unfinished or unverified work just because the current ticket passed.
Open a develop-to-main PR and use a merge commit, never squash or direct-push to main.

For game-code/content, engine or integration candidates, run `npm run gate:milestone` on the
full candidate and obtain the relevant real-browser and desktop mobile-viewport/phone-low
evidence from the behavior matrix.
Use native and web hashes, cooked/render checks and required CI for the exact candidate and
current main base. A candidate whose complete diff is documentation-only needs repository
policy/harness checks and independent document review, without redundant engine/browser runs.
Harness changes retain the game-integrity checks required by their scope.

Check that the base and head have not moved before merging. If either changes, update the
candidate and rerun the affected checks; do not reuse evidence from an older integration.
Merge autonomously once all applicable checks/evidence and protected-branch requirements pass,
then verify the resulting main commit and report the promotion PR, commit and validation.
Keep develop current with main through a synchronization PR using a merge commit when needed;
do not squash shared history or push directly. Validate the combined result and refresh any
affected checks/review before merging that synchronization PR.
If promotion is blocked, keep the PR draft and state what remains; completed work may remain
on develop until the complete main candidate qualifies.

## Machine setup

Use Node 22 or later. The harness has no npm dependencies; no npm install is required.
Install Game Engine 0.1.34 separately. The engine and generated machine paths are ignored.

For this existing machine, `npm run setup` uses the engine linked under `outrun/.gameengine`.
On a fresh checkout, either put the pinned `gameengine` CLI on PATH, or set `GAMEENGINE_ROOT`
to its installed engine directory/source checkout and run `npm run setup`. The latter creates
the local engine link. `GAMEENGINE_CLI` can explicitly select a launcher or CLI `.mjs`.
Setup refreshes local engine skills and regenerates bindings. Inspect any generated diff.
Commit schema.gen.json, src/schema.gen.ts, asset .gmeta files, goldens and accepted replays.
Do not commit the engine installation, caches, cooked bundles or local screenshots/logs.

The installed desktop app supports V8/Hermes checks. Web parity uses the separately built wasm
host through the officially supported GAMEENGINE_HOST_WEB override; the installed CLI/native
hosts can remain unchanged. Real web exports use the pinned engine source CLI and Rust/Emscripten
toolchains, with supported native cooker overrides. Follow [engine setup](engine-setup.md) for
portable commands and the headed-WebGPU requirement on this Mac. Do not substitute native tests
for an unavailable web lane.

## The minimum edit loop

1. State the player-visible change and one short observation that will prove it works.
2. Run `npm run test:plan -- --base origin/develop` before editing; it selects gate scope and
   does not execute or prove gameplay. Inspect editor state before engine commands and wait
   for native builds. Serialize shared engine CLI/session work across agents.
3. Implement the feature. Use build feedback and hot reload; smoke the changed flow once the
   behavior is ready. A meaningful focused test can replace repeated manual reproduction.
   Do not run a test on every save or expand coverage for unrelated behavior.
4. Generate schema bindings before dependent imports when the schema changes. Use official
   UI document commands for UI. Inspect one representative real frame for a visible change.
5. At the finished PR boundary, run one required exact-head `gate:pr` in CI and attach only
   the applicable additional observation. A local full gate is only for a concrete CI
   diagnostic, never a routine prerequisite or substitute for required CI. Do not run
   individual full lanes and then repeat them in the gate.

`test:focus` refuses an empty selection. Use an explicit behavior-name glob when a focused
check is justified; `--changed` may select the entire suite. `test:fast`, `test:parity`,
`test:visual`, `test:web` and `test:cooked` are available diagnostic commands, not extra routine
steps on top of a gate that already ran those lanes.

The harness serializes its commands, checks the pinned version and records results in
`.artifacts/harness/`. It does not control commands started elsewhere. Remove a stale lock
only after confirming its PID is dead. Preserve failed results; do not bless snapshots or
rehash replays to manufacture a passing gate.

## Gates and cadence

| When | Minimum action | Scope |
|---|---|---|
| Documentation-only candidate | `verify` + `test:harness`, once through applicable CI | No engine build, game/browser run or phone work |
| Feature implementation | Build/hot reload + one short changed-flow smoke | Add/run one focused automated selection only when meaningful |
| Finished game PR | One required exact-head `gate:pr` in CI | Local full gate only for concrete CI diagnostics; required checks remain mandatory |
| Directly affected browser behavior | One short background-browser observation | Reuse unchanged controls, layout, lifecycle and outcome evidence |
| Explicit finished milestone/game-bearing main promotion | `gate:milestone` + applicable observations | Complete candidate, not each feature checkpoint |

The current classifier selects native core for game changes, web parity for simulation/input,
visual and web lanes for presentation/UI, and visual/cooked/web lanes for assets or scene/load
paths. Unknown project paths select broad coverage. The existing selected lanes, budgets and
required branch checks remain mandatory; this policy prevents extra or repeated runs and does
not change the harness or allow a skipped lane to pass. A docs-only candidate requires no
engine validation; existing CI setup may still provision the SDK before its docs-only gate.
Harness changes retain the project integrity checks their actual scope requires.

Manual evidence is proportional to the change. A text-box fix uses a focused layout/frame
check, not another full race. An additional content variant uses inventory validation and a
representative new visual category. Repeat a long race only when race/mode outcome behavior
changes or when establishing its first required acceptance. Test relevant mobile/safe-area
layouts when layout changes; do not repeat the entire matrix for an unrelated feature.

Existing `activeReplay: true` budgets still run inside each selected visual gate and enforce
actual recorded workload coverage. Their standalone `test:budget` command is for an affected
budget failure, not an additional step before or after the same gate. Preserve current tests,
goldens and limits; no new profiling/optimization pass is authorized by this workflow.

A slow check is a visible cost, not a new optimization ticket. Keep its result, reuse valid
evidence, and continue feature delivery when independent work is ready. Escalate a concrete
blocker after bounded triage instead of starting a harness rewrite or repeated broad runs.

## GitHub checks and runner activation

Hosted `repo-policy` runs on PRs and pushes to main/develop using Node only. It runs policy and
harness tests. Branch rules require this check and a PR, with no mandatory second reviewer.
The initial bootstrap push creates the empty repository's branches before those rules exist.

`Engine validation` now queues an exact-head job automatically for PRs targeting develop/main,
with a hosted trust check and an always-running hosted `engine-gate` aggregator. Forks, stale
SHAs, skipped engine jobs and failed jobs cannot make that aggregator green. Main candidates
select the milestone scope. Manual dispatch requires a PR number and its full reviewed SHA.

The active coordinator supplies on-demand capacity by launching the reviewed
`scripts/ci/one_job_runner.py` helper for that exact queued PR/SHA/run/job. It registers one
short-lived Mac runner with a unique PR/SHA/run/attempt label, processes one job, then unregisters
and deletes local credentials/workspace. There is no service or persistent developer-laptop
runner. Outside active coordinator sessions the job waits; this is not always-on autoscaling.
The Mac is a trusted interactive host, not an isolated VM. The helper rejects forks and requires
all external contributors to need workflow approval before any registration. Never approve an
external-fork run for this host. See [engine CI](engine-ci.md) for setup, invocation and cleanup.

The engine-gate activation proofs are complete; both repo-policy and engine-gate are required.
Keep these protections. Candidate evidence identifies exact head/base SHAs; material changes
invalidate affected results and require the actual candidate's required checks to pass.
Targeted browser observations remain separate only when the changed behavior needs them.
No physical-phone testing is required or performed by CI.

One complete coordinator-launched exact-head CI run of the required PR or milestone gate
satisfies both the final gate and required CI. Do not add a duplicate local full run; use a
local full gate only to diagnose a concrete CI failure, while keeping required CI mandatory.
Every selected lane must run, and required independent review and manual/browser evidence
still apply. Audit the actual head/base, current validators, raw artifacts and owned
runner/session cleanup before accepting the result. Material code or base changes invalidate
affected prior results; an earlier local pass is not evidence for the changed candidate. This changes
neither gate scope nor permission to skip a lane.

## PR evidence and completion

Use the PR template: concrete behavior, exact test commands/results, relevant image/replay,
and remaining gaps. Do not check boxes for unrun tests. A missing web host is a blocked web
lane, not a pass. A focused passing test does not replace the PR gate.

Review changed golden images before approving them. Record/re-pin replay hashes only for an
intended simulation change and explain it in the PR. Reuse existing replay/hash evidence for
unchanged simulation; add a before/after hash trace only for an authorized behavior-preserving
refactor whose affected behavior cannot be established by existing checks.

For game/engine main promotion, add a targeted actual WebGPU browser playthrough of the changed
flows and the desktop mobile-viewport/phone-low checks from the matrix. Keep it short and
repeatable; do not require physical-phone runs or sustained hardware profiling. These validate
the personal prototype within the chosen desktop/browser scope; no store, public deployment
or upstream-document migration is part of this workflow.
