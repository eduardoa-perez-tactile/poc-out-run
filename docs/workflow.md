# OutRun development workflow

This is a personal internal prototype: mobile and web, landscape, deterministic TypeScript
gameplay on Game Engine 0.1.21. The working game is `outrun/`. Commands below run at the repo root.
The current game is still the engine's bubble starter. Its passing tests are bootstrap evidence,
not OutRun driving, road, UI, browser, or device coverage.

## Branches and integration

| Branch | Purpose | Integration |
|---|---|---|
| `develop` | Daily integration; default PR base | Feature/fix/chore PRs, squash merge |
| `feature/<topic>` | One playable behavior or renderer capability | Start from latest develop; normally hours to two days |
| `fix/<topic>` | Regression with a reproducing test | PR to develop |
| `chore/<topic>` | Harness, engine upgrade, content tooling | PR to develop |
| `main` | Last verified playable milestone | PR from develop; merge commit, never squash |
| `hotfix/<topic>` | Repair the current main milestone | PR to main, then carry the fix back to develop through a PR |

No release branches or store/deployment process. Tag main milestones `poc-m01-road`,
`poc-m02-driving`, `poc-m03-race`, etc. A main promotion is a deliberate user action, not an
automatic consequence of a green PR. Keep unfinished experiments on short branches or draft PRs.
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

The installed desktop app supports this machine's V8/Hermes checks. Web parity additionally
needs the engine's wasm test host. A real web build currently needs an engine source checkout,
its pinned Rust toolchain and Emscripten toolchain. In that checkout, follow its setup and
`pnpm wasm:host` instructions; then select it with GAMEENGINE_ROOT and run setup again.
Do not silently substitute native tests for the unavailable web lane.

## The edit loop

1. State the behavior being changed and the smallest observation proving it works.
2. Run the test plan against the actual PR base. Inspect engine editor state/console before
   starting checks; wait for any native build to finish.
3. For a bug, reproduce it in a focused test first. For a feature, add its behavioral test with
   the implementation. Do not add tests for comments or implementation details.
4. Edit one behavior. Use hot reload and `npm run test:focus -- "driving.*"` until it works.
   There is no `driving.*` suite yet; use `"*bubble*"` for the current starter.
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
| Before main promotion, engine upgrade, or integration milestone | `npm run gate:milestone` + manual evidence | Core, both render tiers, cooked T0, web parity, plus actual browser and phone validation |

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

Engine checks run locally today. At setup there are zero registered GitHub runners. The manual
`Engine validation` workflow has a readiness job that fails until GAMEENGINE_CI_READY=true;
it must not present a skipped engine job as successful gameplay validation. Provision a trusted
macOS ARM64 runner labeled `gameengine`, install the pinned engine source/toolchains (including
the wasm host), set GAMEENGINE_ROOT, then enable that variable. Dispatch against the exact
feature commit and correct base, never an unreviewed external fork. Do not install a persistent
runner on a developer laptop as part of this task.

Until automatic trusted engine PR jobs are provisioned, hosted branch rules enforce repo-policy
only. The PR author supplies local gate logs for the current head; engine evidence is a workflow
requirement, not falsely advertised as remotely enforced. Any subsequent code edit invalidates
that evidence. Browser/device observations are recorded separately from automated results.

## PR evidence and completion

Use the PR template: concrete behavior, exact test commands/results, relevant image/replay,
and remaining gaps. Do not check boxes for unrun tests. A missing web host is a blocked web
lane, not a pass. A focused passing test does not replace the PR gate.

Review golden differences visually before approving specific shots. Record/re-pin replay
hashes only for an intended simulation change and explain it in the PR. Before a behavior-
preserving refactor, record a hash trace; afterward compare it with --hash-trace-baseline.

For main promotion, add an actual WebGPU browser playthrough and a sustained low-end-phone run.
These validate the personal prototype; no store, public deployment or upstream-document
migration is part of this workflow.
