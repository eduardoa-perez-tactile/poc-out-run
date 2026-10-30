import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('traffic committed importer CLI validates all32 models and512 original frames without upstream',()=>{
  // The existing art bridge discovers test_import_traffic.py. This separate test
  // exercises the public committed-check CLI instead of repeating that suite.
  const result=spawnSync('python3',['scripts/art/import-traffic.py','--committed'],{
    cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',timeout:30_000,maxBuffer:1024*1024,
  });
  assert.ifError(result.error);assert.equal(result.signal,null);
  assert.equal(result.status,0,`Traffic import verification failed:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout,/Verified32 traffic models ×16 original frames,32 SCALE files,1024×1280 atlas/);
  assert.match(result.stdout,/32×16 independent source-color control/);
});
