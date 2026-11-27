import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('Map1 converter compatibility and committed-data integrity', () => {
  const r=spawnSync('python3',['-m','unittest','discover','-s','scripts/content','-p','test_*.py'],{
    cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',timeout:30000,maxBuffer:1024*1024,
  });
  assert.ifError(r.error);assert.equal(r.signal,null);assert.equal(r.status,0,`${r.stdout}\n${r.stderr}`);
  assert.match(r.stderr,/Ran [1-9][0-9]* tests? in /,'Converter discovery must execute tests');
});
