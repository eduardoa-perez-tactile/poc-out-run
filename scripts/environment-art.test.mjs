import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('Map1 environment source pixels, atlas and standalone panorama integrity', () => {
  // Separate pattern avoids repeating this suite through the existing car bridge.
  const result = spawnSync('python3', ['-m', 'unittest', 'discover', '-s', 'scripts/art', '-p', 'map01_art_tests.py'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, `Environment art tests terminated: ${result.signal}`);
  assert.equal(result.status, 0, `Environment art tests failed:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /Ran [1-9][0-9]* tests? in /, 'Environment discovery must execute tests');
});
