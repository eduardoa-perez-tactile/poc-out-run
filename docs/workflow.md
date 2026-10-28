# OutRun development workflow

This is a personal internal prototype: mobile and web, landscape, deterministic TypeScript
gameplay on Game Engine 0.1.21. The working game is `outrun/`. Commands below run at the repo root.
The game currently proves straight/curved road projection, synthetic hill/object clipping
and recorded road-state controls. These fixtures do not prove car handling,
traffic AI or race flow. Historical browser bootstrap evidence is recorded in
[engine setup](engine-setup.md); current coverage is in [the matrix](test-matrix.md).

Fast iteration takes priority. Physical-phone testing is excluded unless the user later requests
it: do not install/run/profile/capture a game on a connected phone, or build a phone probe solely
for validation. Mobile remains a target through desktop viewport/safe-area tests, phone-low
residency and structural budgets, native/web parity and targeted real-browser checks. Physical
phone frame-time, memory and thermal budgets remain design targets, not measured guarantees.

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
# edit, run focused checks, inspect the result
npm run gate:pr -- --base origin/develop
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
   outcome and acceptance criteria. Select an unblocked dependency before starting dependent
   implementation. Continue an existing matching branch/PR, or start a feature/fix/chore branch
   from updated develop. Do not switch a shared checkout while another agent is editing it.
2. Delegate a specific implementation task to a subagent with explicit file ownership, inputs,
   expected output and focused validation. Use additional implementation subagents only for
   independent work with disjoint ownership. Integrate shared schema, entry-point and config
   changes sequentially through the coordinator; keep every save compiling.
3. Use a separate reviewer subagent to inspect the integrated diff against the ticket's
   acceptance criteria and engine boundaries. The reviewer must not approve its own
   implementation. Include architecture or measured desktop structural/performance review when
   relevant; use the engine's reviewer instructions for those reviews.
4. Resolve actionable review findings, run focused checks during edits, and have the coordinator
   run the required integration gates against the actual candidate. Serialize engine commands
   across agents and wait for editor native builds; subagents must coordinate before starting
   tests that share the host, session or SDK checkout.
5. Record subagent contributions/findings, resolved findings, exact tested head/base SHAs,
   commands/results and required screenshots/replays/targeted browser observations in the PR.
   Any implementation or base change requires the affected checks and review to be refreshed.
6. When the ticket's applicable gates, review and evidence pass, mark its PR ready and squash
   merge into develop through GitHub. Verify the resulting develop commit and issue acceptance
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
Install Game Engine 0.1.21 separately. The engine and generated machine paths are ignored.

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

## The edit loop

1. State the behavior being changed and the smallest observation proving it works.
2. Run the test plan against the actual PR base. Inspect engine editor state/console before
   starting checks; wait for any native build to finish.
3. For a bug, reproduce it in a focused test first. For a feature, add its behavioral test with
   the implementation. Do not add tests for comments or implementation details.
4. Edit one behavior. Use hot reload and `npm run test:focus -- "driving.*"` until it works.
   Use `"road.state*"` for the road proof controls and `"road.clipping*"` for hill/crop behavior.
   Add `driving.*` tests with the car-handling implementation.
5. For schema changes, run `gameengine gen` from outrun before saving dependent imports.
6. For visible work, inspect a real frame during this loop. Do not wait for final integration
   to discover a road seam or hidden touch target.
7. At handoff run `npm run gate:pr -- --base origin/develop`; attach required manual evidence.

`test:focus` refuses an empty selection. `--changed` is not dependency analysis: engine source
changes can cause it to run the whole suite. Use explicit test-name globs while iterating and
the full T0 suite at the PR boundary. Keep the fast loop independent of device packaging.

The harness serializes its own engine commands, checks the pinned version, and records logs,
step results and wall times in `.artifacts/harness/`. It does not control engine commands
started outside the harness. Remove a stale engine.lock only after confirming its PID is dead.

## Gates and cadence

| When | Command | What it proves |
|---|---|---|
| Docs/config policy and every hosted PR | `npm run verify` + `npm run test:harness` | Repository configuration and test-selection harness; no game execution |
| Each behavior edit | `npm run test:focus -- "driving.*"` | Relevant T0 behavior on V8 |
| Before a checkpoint commit | `npm run test:fast` | All T0 on V8; optional for intermediate WIP saves |
| Every game PR/handoff | `npm run gate:pr -- --base origin/develop` | Generated files, canonical formatting, engine check (types/validation/cook/120-frame smoke), all native T0 parity; additional lanes selected below |
| Sim/schema/input change | PR gate adds `test:web` | V8/wasm hash parity; not a real browser test |
| Presentation/UI/material change | PR gate adds `test:visual` and `test:web` | T1 at mobile + compat with phone-low residency; browser observation still required |
| Assets/scenes/prefabs/load paths | PR gate adds visual, cooked, web | Import/loading references and cooked behavior |
| Before game/engine main promotion or integration milestone | `npm run gate:milestone` + relevant manual evidence | Core, both render tiers, cooked T0, web parity, plus targeted actual-browser validation; no physical-phone test |

The path classifier is conservative for unknown paths. `src/sim/` contains simulation-only
files. Put presentation in `src/presentation/`, `src/render/`, and `src/ui/`. A change affecting
pixels through sim state also needs a focused visual check even if its path is sim-only.
Run additional lanes explicitly when the change warrants it; path selection is a floor.

Docs-only PRs require no engine. Harness-only PRs still exercise native project integrity.
The classifier includes committed changes since merge-base, staged/unstaged edits, untracked
files, deletions, and both ends of renames. A missing base ref is an error; fetch it first.

Budget warm-cache goals: focus <=2 s, full T0 <=5 s, native PR core <=30 s, render add-on <=30 s.
These are iteration targets, not measured guarantees. Report a slow gate and fix the cause;
do not remove coverage to make the timing look good. Cold imports/toolchains run separately.
Read logs only on failure; rerun broader suites only after changes or unresolved failures.

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

Until real positive and negative execution proofs establish that engine-gate is reliable,
branch rules continue to require repo-policy only. Then add engine-gate without removing the
existing policy requirement. Do not install a required status that merely skips unavailable
validation. Candidate evidence must identify exact head/base SHAs, and later code/base changes
invalidate affected results. Targeted headed-browser observations remain separate; no physical-
phone testing is required or performed by CI.

## PR evidence and completion

Use the PR template: concrete behavior, exact test commands/results, relevant image/replay,
and remaining gaps. Do not check boxes for unrun tests. A missing web host is a blocked web
lane, not a pass. A focused passing test does not replace the PR gate.

Review golden differences visually before approving specific shots. Record/re-pin replay
hashes only for an intended simulation change and explain it in the PR. Before a behavior-
preserving refactor, record a hash trace; afterward compare it with --hash-trace-baseline.

For game/engine main promotion, add a targeted actual WebGPU browser playthrough of the changed
flows and the desktop mobile-viewport/phone-low checks from the matrix. Keep it short and
repeatable; do not require physical-phone runs or sustained hardware profiling. These validate
the personal prototype within the chosen desktop/browser scope; no store, public deployment
or upstream-document migration is part of this workflow.
