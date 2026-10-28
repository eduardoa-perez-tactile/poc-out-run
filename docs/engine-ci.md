# On-demand trusted engine CI

The engine workflow queues automatically for PRs into `develop` or `main`. An active coordinator
provides capacity for one reviewed candidate at a time with `scripts/ci/one_job_runner.py`.
This is on-demand interactive-Mac capacity, not a service, an always-on autoscaler or an isolated
OS. No persistent runner or physical-phone test is installed or started.

## Workflow and tested candidate

The hosted trust job accepts only an open same-repository PR on the expected integration bases.
It rejects a moved head or an invalid manual SHA and runs the helper's offline tests. The engine
job checks out that exact reviewed head and uses the captured base SHA for the harness plan.
Its sole runner label contains PR number, full head SHA, workflow-run ID and attempt. The helper
must supply the matching label; generic `gameengine` or `self-hosted` workers cannot pick it up.

PRs into `develop` run `gate:pr`; promotions into `main` run `gate:milestone`. This covers the
selected native, render, cooked and wasm lanes without rebuilding pre-provisioned toolchains.
Targeted headed-browser observations remain separate when the behavior matrix requires them.
A hosted `engine-gate` aggregator runs even after failures/skips, and succeeds only if trust
and actual engine execution both succeeded. An absent worker stays pending, then fails rather
than becoming a skipped pass. Logs identify the tested head/base and upload harness/T1 artifacts.

## Provisioned paths and repository settings

Provision engine 0.1.21 and the wasm host using [engine setup](engine-setup.md). Configure these
repository Actions variables to absolute paths on the selected trusted Mac:

| Variable | Meaning |
|---|---|
| `GAMEENGINE_ROOT` | Installed native engine resources directory |
| `GAMEENGINE_HOST_WEB` | Built wasm test-host JavaScript, with sibling `gameengine_host.wasm` |

The helper discovers the macOS ARM64 runner package and checksum through GitHub's authenticated
runner-download API. On 2026-10-28 that API returned `actions-runner-osx-arm64-2.338.0.tar.gz`,
SHA256 `df4cebda25c86a886ed204e49fee63f5c2e7cec5f447b5c98440a826bbdf9df2`. It checks live metadata
at invocation rather than guessing versions. A reusable archive cache contains only the public
checksum-verified package, not a registration, worktree or credentials.

This repository is public. Before starting a Mac runner, the coordinator must ensure Actions
fork approval is `all_external_contributors` and must never approve external-fork execution.
The helper reads and enforces that setting; it never changes it. It also rejects all nonterminal
external-fork workflows, including requested and pending runs; only completed runs are terminal.
Workflow-local fork guards and custom labels are routing controls, not a global
security boundary. Review all same-repository workflow changes before running them. Code still
executes as the local user; ephemeral registration is not OS isolation. Use a workflow-restricted
runner group or disposable VM if general outside contributions become a requirement.

## Coordinator invocation

Use the helper from a reviewed checkout, never from unreviewed PR code. Check dependencies,
independent review and exact PR head before supplying a worker. Serialize this job with other
engine commands/editor native builds. The helper also prevents concurrent local CI controllers
through `/tmp/outrun-engine-ci.lock`.

```sh
gh run list --repo eduardoa-perez-tactile/poc-out-run --workflow engine-validation.yml
gh run view RUN_ID --repo eduardoa-perez-tactile/poc-out-run --json jobs
python3 scripts/ci/one_job_runner.py --pr PR_NUMBER --sha FULL_REVIEWED_SHA --run-id RUN_ID --job-id ENGINE_JOB_ID
# After inspecting the read-only plan for that reviewed candidate:
python3 scripts/ci/one_job_runner.py --pr PR_NUMBER --sha FULL_REVIEWED_SHA --run-id RUN_ID --job-id ENGINE_JOB_ID --execute
```

The default is a read-only plan: no download, registration token or runner is created. `--execute`
creates a 0700 temporary runner directory, fetches the short-lived registration token into memory,
passes it only through `ACTIONS_RUNNER_INPUT_TOKEN`, configures `--ephemeral --no-default-labels`,
and executes `run.sh --once`. It never prints the token or puts it in command arguments. The
worker gets a temporary HOME and an allowlist of toolchain-path environment variables; API/admin
credentials are not forwarded as environment variables. This does not make a developer Mac a
sandbox. No `svc.sh`, launchctl or background listener is installed.

Manual dispatch uses inputs `pr`, full `sha`, and `gate`. Set the workflow ref to the reviewed
PR branch, so the run's API `head_sha` also matches; a changed branch requires a fresh reviewed
run. The helper refuses a different workflow, head, repository, run attempt, job name or label.
It checks the exact GitHub job conclusion, not merely the listener exit code.

In `finally`, it terminates only its own child process group, deletes any remaining uniquely
named runner registration, verifies removal and deletes temporary credentials/workspace. Job
logs/artifacts remain on GitHub; local runner diagnostics are discarded. SIGKILL, power loss
or an API outage cannot guarantee finally cleanup. After interruption, inspect the printed runner
name, confirm its process has ended, remove an orphan registration and only then remove a stale
lock. Do not report cleanup success when unregister verification failed.

## Validation and activation

Run the focused tests without engine access or registration:

```sh
python3 -m unittest discover -s scripts/ci -p 'test_*.py'
```

Before making `engine-gate` required, the coordinator must record:

1. A reviewed same-repository run executing all native/render/cooked/web lanes with correct
   head/base artifacts; verify zero runner registrations afterward.
2. A deliberately failing game test on a disposable reviewed branch making both the engine job
   and aggregator fail, followed by removal of that test.
3. A bad manual SHA making trust and aggregator fail without Mac execution. Do not execute a
   fork merely to test rejection; use mocked metadata and hosted rejection evidence.
4. Cleanup evidence after normal completion and a controlled interrupted/failed listener.

Until these execution proofs pass, retain `repo-policy` as the required check. Then add the stable
`engine-gate` requirement on develop/main while retaining repo-policy. Do not bypass checks or
represent queued/skipped jobs as game validation. Outside active coordinator sessions jobs wait
for a matching worker; this explicit capacity limitation is acceptable for the current workflow,
not a claim of unattended 24/7 CI. Hardware budgets remain targets, not CI measurements.

Primary references: [ephemeral runner behavior](https://docs.github.com/en/actions/reference/runners/self-hosted-runners#ephemeral-runners-for-autoscaling),
[runner REST API](https://docs.github.com/en/rest/actions/self-hosted-runners),
[environment-input parsing and flags](https://github.com/actions/runner/blob/main/src/Runner.Listener/CommandSettings.cs),
and [fork approval policy](https://docs.github.com/en/rest/actions/permissions).
