import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPaths, parseNameStatus } from './lib/plan.mjs';

test('documentation does not start an engine build', () => {
  const p = classifyPaths(['AGENTS.md', 'outrun/PROJECT.md', 'docs/workflow.md']);
  assert.equal(p.docsOnly, true);
  assert.equal(p.core, false);
});
test('simulation changes require native and web parity without unrelated render tests', () => {
  const p = classifyPaths(['outrun/src/sim/driving.ts']);
  assert.equal(p.core, true);
  assert.equal(p.web, true);
  assert.equal(p.visual, false);
});
test('presentation changes require actual visual and browser evidence', () => {
  const p = classifyPaths(['outrun/src/presentation/road.ts']);
  assert.equal(p.visual, true);
  assert.equal(p.web, true);
  assert.equal(p.manual.length, 1);
});
test('assets and scene changes exercise cooked loading', () => {
  for (const path of ['outrun/assets/road.png', 'outrun/scenes/race.scene.json']) {
    const p = classifyPaths([path]);
    assert.equal(p.cooked, true);
    assert.equal(p.visual, true);
  }
});
test('unknown paths and input configuration fail toward broader coverage', () => {
  for (const path of ['outrun/input.json', 'outrun/src/main.ts', 'unexpected/file.ts']) {
    const p = classifyPaths([path]);
    assert.equal(p.core && p.visual && p.web && p.cooked, true);
  }
});
test('harness changes exercise project integrity but do not require a wasm rebuild', () => {
  const p = classifyPaths(['scripts/harness.mjs']);
  assert.equal(p.core, true);
  assert.equal(p.web, false);
});
test('engine pin and platform policy changes require all lanes', () => {
  const p = classifyPaths(['harness.config.json']);
  assert.equal(p.core && p.visual && p.web && p.cooked, true);
});
test('renames include old and new paths so moving a render file cannot hide it', () => {
  const paths = parseNameStatus('R100\0outrun/src/render/road.ts\0outrun/src/sim/road.ts\0D\0outrun/assets/tree.png\0');
  assert.deepEqual(paths, ['outrun/src/render/road.ts', 'outrun/src/sim/road.ts', 'outrun/assets/tree.png']);
  assert.equal(classifyPaths(paths).visual, true);
});
