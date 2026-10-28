## Behavior

Describe the trigger and resulting behavior. Keep this PR to one independently testable change.

- Ticket and dependencies:
- Coordinator and implementation subagent contributions:
- Independent reviewer findings and their resolution:

## Validation

- Base ref, exact tested head SHA and base SHA:
- `npm run gate:pr -- --base origin/develop` result (or main for promotion):
- For game/engine main promotion: `npm run gate:milestone` result for the complete candidate:
- Focused test command/result:
- Additional render/web/cooked checks selected by the plan:
- Screenshot/replay or browser/device evidence when relevant:
- Unrun or blocked checks and why:

## Integration

- Ticket acceptance criteria satisfied:
- Full develop-to-main diff reviewed for unrelated unfinished/unverified work (promotion only):
- Applicable checks, independent review, manual evidence and protected-branch requirements pass:
- Merge state and resulting commit(s): feature PR squash to develop; promotion PR merge commit to main:

The coordinator has standing permission to merge/promote once all applicable requirements pass.
Keep incomplete work in draft; missing required tooling/evidence blocks integration. Never bypass
checks or reuse stale head/base evidence to merge.

## Baselines

For changed goldens/replay hashes: explain the intentional behavior/appearance change and what
was reviewed. Do not regenerate baselines solely to clear failures.
