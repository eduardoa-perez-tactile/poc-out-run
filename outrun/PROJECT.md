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

## Conventions

The Git repository and npm harness live one directory above this game. Read ../AGENTS.md,
../docs/workflow.md and ../docs/test-matrix.md. Run npm commands from the repository root;
run direct gameengine commands here. Engine skills and caches remain local.

Place simulation in src/sim/, rendering in src/render/ or src/presentation/, and UI glue in
src/ui/. These boundaries drive test selection. Simulation remains deterministic and UI is
authored through engine UI documents. Test names identify behavior, e.g. driving.brakes.

## Decisions

Use lightweight Gitflow: feature/fix/chore branches into develop; verified playable milestones
promote to main through a merge-commit PR. Do not merge or promote without user instruction.
During edits run focused V8 tests; at handoff run the root gate:pr harness against the PR base.
The harness adds visual, web and cooked checks based on changed paths. See the test matrix for
manual browser/device evidence. Missing tooling is a blocked lane, never a pass.

This is a personal internal project. Do not import upstream README or legal documents, and do
not add store/public deployment work. Native and browser/device validation still matter.

## Links

Repository: https://github.com/eduardoa-perez-tactile/poc-out-run
Workflow: ../docs/workflow.md
Behavior checks and coverage status: ../docs/test-matrix.md
