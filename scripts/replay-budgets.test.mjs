import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { budgetReplayPaths, verifiedReplayReport } from './lib/replay-budgets.mjs';

const entry = (replay) => ({ file: 'hill.json', value: { structural: {}, replay } });
test('budget verification selects every unique structural replay, ignoring size-only budgets', () => {
  assert.deepEqual(budgetReplayPaths([entry('tests/replays/road.greplay'), entry('tests/replays/hill.greplay'), entry('tests/replays/hill.greplay'), { file: 'size.json', value: { downloadMB: 10 } }]), ['tests/replays/hill.greplay', 'tests/replays/road.greplay']);
});
test('empty and malformed budget selections cannot pass', () => {
  for (const entries of [[], [{ file: 'bad.json', value: null }], [entry(undefined)], [entry('../outside.greplay')], [entry('tests/replays/../../outside.greplay')], [entry('tests/replays/./road.greplay')], [entry('tests/replays/road.txt')], [{ file: 'bad.json', value: { structural: [], replay: 'tests/replays/road.greplay' } }]]) {
    assert.throws(() => budgetReplayPaths(entries));
  }
});
test('replay verification requires both native lanes with positive equal verified step counts', () => {
  const valid = { ok: true, results: { v8: { ok: true, steps: 180 }, hermes: { ok: true, steps: 180 } } };
  assert.equal(verifiedReplayReport(valid), true);
  for (const invalid of [undefined, {}, { ok: true, results: {} }, { ok: true, results: { v8: valid.results.v8 } }, { ...valid, ok: false }, { ok: true, results: { v8: valid.results.v8, hermes: { ok: false, steps: 180 } } }, { ok: true, results: { v8: { ok: true, steps: 0 }, hermes: { ok: true, steps: 0 } } }, { ok: true, results: { v8: valid.results.v8, hermes: { ok: true, steps: 179 } } }]) {
    assert.equal(verifiedReplayReport(invalid), false);
  }
});
test('a zero-exit false-green replay response blocks structural rendering and fails the harness', () => {
  const dir = mkdtempSync(join(tmpdir(), 'outrun-replay-gate-'));
  try {
    mkdirSync(join(dir, 'scripts/lib'), { recursive: true });
    mkdirSync(join(dir, 'outrun/tests/budgets'), { recursive: true });
    mkdirSync(join(dir, 'outrun/tests/replays'), { recursive: true });
    for (const file of ['scripts/harness.mjs', 'scripts/lib/plan.mjs', 'scripts/lib/replay-budgets.mjs', 'scripts/lib/active-replay-budget.mjs', 'scripts/lib/regression-fixture.mjs', 'harness.config.json']) copyFileSync(resolve(file), join(dir, file));
    const harnessConfig = JSON.parse(readFileSync(join(dir, 'harness.config.json'), 'utf8'));
    writeFileSync(join(dir, 'harness.config.json'), JSON.stringify({ ...harnessConfig, productionScene: 'scenes/original-race.scene.json' }));
    writeFileSync(join(dir, 'outrun/tests/budgets/hill.json'), JSON.stringify(entry('tests/replays/hill.greplay').value));
    writeFileSync(join(dir, 'outrun/tests/replays/hill.greplay'), 'not read by the fake engine');
    // Use the real candidate-copy boundary; only the SDK process is a stub.
    // This tiny repository is owned by this test, never the working checkout.
    writeFileSync(join(dir, '.gitignore'), '.artifacts/\noutrun/.gameengine/\n');
    const productionConfig = JSON.stringify({ startScene: 'scenes/original-race.scene.json' });
    writeFileSync(join(dir, 'outrun/project.gameengine.json'), productionConfig);
    mkdirSync(join(dir, 'outrun/scenes'), { recursive: true });
    for (const scene of ['original-race', 'road-proof']) writeFileSync(join(dir, 'outrun/scenes', `${scene}.scene.json`), '{}');
    const initialized = spawnSync('git', ['init', '--quiet'], { cwd: dir, encoding: 'utf8' });
    assert.equal(initialized.status, 0, initialized.stderr);
    const sdk = join(dir, 'fake-sdk'), fake = join(sdk, 'tools/cli/bin/gameengine.mjs');
    mkdirSync(join(sdk, 'tools/cli/bin'), { recursive: true });
    mkdirSync(join(dir, 'outrun/.gameengine'), { recursive: true });
    symlinkSync(sdk, join(dir, 'outrun/.gameengine/engine'), 'junction');
    writeFileSync(fake, `import { appendFileSync } from 'node:fs';
const args=process.argv.slice(2);appendFileSync(${JSON.stringify(join(dir, 'calls.jsonl'))},JSON.stringify(args)+'\\n');
if(args.includes('--version')) console.log(${JSON.stringify(JSON.parse(readFileSync(resolve('harness.config.json'), 'utf8')).engineVersion)});
else if(args[0]==='editor') console.log('{}');
else if(args[0]==='replay') console.log(JSON.stringify({ok:true,results:{v8:{ok:true,steps:180},hermes:{ok:false,steps:1}}}));
else { console.error('Unexpected structural render started'); process.exitCode=9; }
`);
    const run = spawnSync(process.execPath, [join(dir, 'scripts/harness.mjs'), 'visual'], { cwd: dir, encoding: 'utf8', env: { ...process.env, GAMEENGINE_CLI: fake, GAMEENGINE_ROOT: sdk } });
    assert.equal(run.status, 1, run.stdout + run.stderr);
    const calls = readFileSync(join(dir, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(calls.some((args) => args[0] === 'test'), false);
    assert.match(run.stdout, /FAIL budget-replay-1/);
    const summary = JSON.parse(readFileSync(join(dir, '.artifacts/harness/visual.json'), 'utf8'));
    assert.equal(summary.ok, false);
    assert.equal(summary.steps[0].ok, false);
    const provenance = JSON.parse(readFileSync(join(dir, '.artifacts/harness/regression-fixture.json'), 'utf8'));
    assert.equal(provenance.finalVerified, true);assert.equal(provenance.cleaned, true);
    assert.equal(existsSync(provenance.owned), false);
    assert.equal(readFileSync(join(dir, 'outrun/project.gameengine.json'), 'utf8'), productionConfig);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
