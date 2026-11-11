# OutRun — project notes

This file is yours. `gameengine skills update` writes it once, when it is missing, and never
touches it again, so this is where everything specific to OutRun goes. `AGENTS.md`, `CLAUDE.md`
and the skills belong to the engine and are replaced when it updates them; put nothing project-specific there.

Agents read this file before `AGENTS.md`. Where the two disagree, this file wins for this project.
Agents do not write here on their own; they change this file only when someone asks them to add
specific guidance.

## The game

Internal personal OutRun prototype on Game Engine, targeting mobile and web in landscape.
The game includes the connected ORIGINAL race; remaining selections, audio and modes are tracked separately.
Fast desktop iteration is the priority. Physical-phone testing is excluded unless the user
later requests it; do not use connected phones for installs, runs, profiling or screenshots.
Use simulated mobile viewports/safe areas, desktop phone-low residency and structural checks,
native/web parity and targeted real-browser checks. Hardware budgets remain design targets.

Real-browser checks must launch Chrome in the background without interrupting the user's
work or stealing focus. Use a dedicated owned test session, reusing it when possible;
on macOS launch with `open -g` and use CDP `focus:false` where supported. Never launch in
the foreground, call `bringToFront`, activate the browser or minimize/restore its windows.
Verify focus preservation and actual rendered pixels/behavior; stop and report the blocked
lane if background behavior cannot be preserved. Clean up only that session's owned test
windows/processes.

## Current delivery priority

Finish the complete playable game as quickly as possible. The unit of progress is a working
player-facing feature. Follow the delivery-first policy in ../AGENTS.md and ../docs/workflow.md:

- During implementation, use build/type checks or hot reload plus one short changed-flow smoke.
  Add/run focused automated tests only for meaningful behavior or a concrete regression. No
  full suite, browser session or new test is required for each edit/save/checkpoint commit.
- Run the existing required PR gate once on the finished candidate through exact-head CI.
  A local full gate is only for a concrete CI diagnostic, never a routine prerequisite. Reuse
  CI results instead of duplicating them locally or repeating their render/web/cooked lanes.
  A material candidate/base change or unresolved failure requires the affected checks and
  protected CI to pass again; unchanged behavior can reuse its existing evidence.
- Use the matrix to select affected behavior only. Fixing a text box needs a focused preview,
  not a repeated full race. Full race/mode acceptance belongs to relevant outcome changes and
  completed milestones. Run the milestone gate at those milestones/main promotion, not per feature.
- Do not start optimization/profiling passes unless explicitly requested by the user. Expand
  coverage or validation infrastructure only when requested or necessary for the smallest fix
  to a concrete delivery blocker; use minimal diagnosis. After two failed attempts at the same
  validation blockage, preserve/report it and move to independent ready
  feature work where possible; leave its merge blocked rather than expanding the harness.
- Keep PR evidence short and reuse harness output. Docs-only work uses policy/harness CI,
  without an engine build or browser check. Existing tests/budgets and protected checks stay intact.

Chrome stays in the background and physical-phone testing remains excluded.

## Play

Run `npm run play` from the repository root to launch the connected ORIGINAL race.
The live scene is `scenes/original-race.scene.json`; the browser preview also starts there.
The project starts directly in that race. The harness runs legacy recordings in an owned copy
with the proof bootstrap; only that copy's startScene differs. Production checks and exports
use the actual race startup.

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
During edits follow the minimum checks above; a focused V8 test is selected when meaningful.
Run the root gate:pr once at the finished PR boundary through required CI. Its selected visual,
web and cooked lanes do not need separate reruns. Use the matrix for relevant browser evidence;
reuse unchanged observations. Missing required tooling blocks that lane, never counts as a pass.

This is a personal internal project. Do not import upstream README or legal documents, and do
not add store/public deployment work. Native and browser validation still matter.

## Links

Repository: https://github.com/eduardoa-perez-tactile/poc-out-run
Workflow: ../docs/workflow.md
Behavior checks and coverage status: ../docs/test-matrix.md
Reproducible engine/web setup: ../docs/engine-setup.md

## Art production

Before creating or changing art, read ../docs/art/index.md and the relevant category guide.
Fill out ../docs/art/creation-brief.md with the reference family, palette, logical pixel size,
pivot and required poses/states before expanding an asset family. Use the source boards as
visual evidence, distinguish observed facts from proposed rules, and check imported art in
its actual projected/mobile context. These guides do not change the engine import schema.
