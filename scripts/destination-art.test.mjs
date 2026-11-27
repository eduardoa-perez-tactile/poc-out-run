import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Handoff/CI reconstruction, never part of the focused engine edit loop. This
// suite requires the complete 15-family cohort and uses no upstream checkout.
test('all destination source canvases, packed pixels, extrusion and panoramas reconstruct',()=>{
  const result=spawnSync('python3',['-m','unittest','discover','-s','scripts/art','-p','environment_art_tests.py'],{
    cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',timeout:180_000,maxBuffer:1024*1024,
  });
  assert.ifError(result.error);
  assert.equal(result.signal,null,`Destination art tests terminated: ${result.signal}`);
  assert.equal(result.status,0,`Destination art tests failed:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr,/Ran [1-9][0-9]* tests? in /,'Destination art discovery must execute tests');
});
