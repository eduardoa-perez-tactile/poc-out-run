# OutRun — project notes

This file is yours. `gameengine skills update` writes it once, when it is missing, and never
touches it again, so this is where everything specific to OutRun goes. `AGENTS.md`, `CLAUDE.md`
and the skills belong to the engine and are replaced when it updates them; put nothing project-specific there.

Agents read this file before `AGENTS.md`. Where the two disagree, this file wins for this project.
Agents do not write here on their own; they change this file only when someone asks them to add
specific guidance.

## The game

Internal personal OutRun prototype on Game Engine, targeting mobile and web in landscape.
The current code is the engine starter; OutRun gameplay is migrated in small playable slices.
Fast desktop iteration is the priority. Physical-phone testing is excluded unless the user
later requests it; do not use connected phones for installs, runs, profiling or screenshots.
Use simulated mobile viewports/safe areas, desktop phone-low residency and structural checks,
native/web parity and targeted real-browser checks. Hardware budgets remain design targets.

## Conventions

The Git repository and npm harness live one directory above this game. Read ../AGENTS.md,
../docs/workflow.md and ../docs/test-matrix.md. Run npm commands from the repository root;
run direct gameengine commands here. Engine skills and caches remain local.

Place simulation in src/sim/, rendering in src/render/ or src/presentation/, and UI glue in
src/ui/. These boundaries drive test selection. Simulation remains deterministic and UI is
authored through engine UI documents. Test names identify behavior, e.g. driving.brakes.

## Decisions

For every ticket, act as coordinator and use implementation subagent(s) plus an independent
reviewer subagent. Check dependencies, define acceptance/tests, assign disjoint file ownership,
integrate the result, resolve review findings and validate the exact candidate head. The
coordinator owns Git operations and final evidence; subagents do not independently switch shared
branches or merge. Serialize engine commands across agents and the editor's native build.

Use lightweight Gitflow: feature/fix/chore branches from develop, squash-merged through a PR;
fully verified develop candidates promote to main through a merge-commit PR. The user has given
standing authorization to merge and promote once all applicable checks, independent review and
required manual evidence pass. Do not ask again at that point. Check the entire develop-to-main
candidate, not just the most recent ticket; do not promote unrelated unverified work. Shared
branches are never directly pushed, force-pushed or merged by bypassing required checks.

Docs-only candidates require repository-policy/harness checks; game-bearing main promotions
require gate:milestone plus applicable real-browser evidence. Required tooling or evidence
that is unavailable blocks integration/promotion; a green hosted repo-policy check alone does
not prove game validation. The bootstrap wasm-host gap is resolved; reproduce the native/web
and headed-browser setup through ../docs/engine-setup.md. Physical-phone evidence is not a gate.
During edits run focused V8 tests; at handoff run the root gate:pr harness against the PR base.
The harness adds visual, web and cooked checks based on changed paths. See the test matrix for
targeted browser evidence. Missing required tooling is a blocked lane, never a pass.

This is a personal internal project. Do not import upstream README or legal documents, and do
not add store/public deployment work. Native and browser validation still matter.

## Links

Repository: https://github.com/eduardoa-perez-tactile/poc-out-run
Workflow: ../docs/workflow.md
Behavior checks and coverage status: ../docs/test-matrix.md
Reproducible engine/web setup: ../docs/engine-setup.md
