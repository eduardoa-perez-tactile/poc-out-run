import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// npm run test:harness already discovers scripts/*.test.mjs on hosted CI.
// No engine, upstream checkout, network or third-party Python packages needed.
test('committed vehicle art and stdlib importer regressions', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const result = spawnSync('python3', ['-m', 'unittest', 'discover', '-s', 'scripts/art', '-p', 'test_*.py'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, `Python art tests terminated: ${result.signal}`);
  assert.equal(result.status, 0, `Python art tests failed:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /Ran [1-9][0-9]* tests? in /, 'Python discovery must execute at least one test');
});
