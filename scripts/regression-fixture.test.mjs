import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {createRegressionFixture} from './lib/regression-fixture.mjs';

test('regression fixture preserves candidate files, rejects tampering, keeps failure evidence and cleans only its owned copy',()=>{
  const root=mkdtempSync(join(tmpdir(),'outrun-fixture-test-'));
  try{
    const project=join(root,'outrun'),sdkRoot=join(root,'sdk');
    const put=(path,value)=>{mkdirSync(dirname(path),{recursive:true});writeFileSync(path,value);};
    const git=(...args)=>{const result=spawnSync('git',args,{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);};
    put(join(root,'.gitignore'),'outrun/.gameengine/\noutrun/.agents/\noutrun/AGENTS.md\noutrun/assets/ignored.dat\n.artifacts/\n');
    const config='{\n  "name": "OutRun",\n  "startScene": "scenes/original-race.scene.json",\n  "sim": {"seed": 9}\n}\n';
    put(join(project,'project.gameengine.json'),config);
    put(join(project,'scenes/road-proof.scene.json'),'{}\n');
    put(join(project,'scenes/original-race.scene.json'),'{}\n');
    put(join(project,'src/main.ts'),'export const candidate = 7;\n');
    put(join(project,'src/deleted.ts'),'removed from candidate\n');
    put(join(sdkRoot,'tools/cli/bin/gameengine.mjs'),'// SDK link only; never executed\n');
    git('init','--quiet');git('add','--all');
    rmSync(join(project,'src/deleted.ts'));
    put(join(project,'src/new.ts'),'export const added = true;\n');
    put(join(project,'assets/ignored.dat'),'must not copy\n');
    put(join(project,'.agents/skills/copied/SKILL.md'),'engine-managed instructions\n');
    put(join(project,'AGENTS.md'),'engine-managed instructions\n');
    put(join(project,'.gameengine/cache.bin'),'must not copy\n');
    const make=output=>createRegressionFixture({root,project,sdkRoot,output,engineVersion:'0.1.21'});
    const first=make(join(root,'.artifacts/success'));
    assert.equal(readFileSync(join(first.project,'project.gameengine.json'),'utf8'),config.replace('scenes/original-race.scene.json','scenes/road-proof.scene.json'));
    assert.deepEqual(first.provenance.files.map(row=>row.path),['project.gameengine.json','scenes/original-race.scene.json','scenes/road-proof.scene.json','src/main.ts','src/new.ts']);
    assert.equal(readFileSync(join(first.project,'src/main.ts'),'utf8'),'export const candidate = 7;\n');
    assert.equal(readFileSync(join(first.project,'src/new.ts'),'utf8'),'export const added = true;\n');
    assert.equal(realpathSync(join(first.project,'.gameengine/engine')),realpathSync(sdkRoot));
    assert.equal(existsSync(join(first.project,'.gameengine/cache.bin')),false);
    first.dispose();assert.equal(existsSync(first.provenance.owned),false);
    assert.equal(first.provenance.finalVerified,true);assert.equal(first.provenance.cleaned,true);

    const output=join(root,'.artifacts/failure'),failed=make(output);
    put(join(failed.project,'.gameengine/t1/race/view.mobile.actual.png'),'retained actual pixels');
    put(join(failed.project,'src/main.ts'),'tampered candidate');
    assert.throws(()=>failed.dispose(),/Fixture candidate content changed: src\/main.ts/);
    assert.equal(existsSync(failed.provenance.owned),false);
    const report=JSON.parse(readFileSync(join(output,'regression-fixture.json'),'utf8'));
    assert.equal(report.verified,false);assert.equal(report.cleaned,true);
    assert.equal(readFileSync(join(report.t1Artifacts,'race/view.mobile.actual.png'),'utf8'),'retained actual pixels');
    assert.equal(readFileSync(join(project,'project.gameengine.json'),'utf8'),config);
    assert.equal(readFileSync(join(project,'src/main.ts'),'utf8'),'export const candidate = 7;\n');
    assert.equal(existsSync(join(sdkRoot,'tools/cli/bin/gameengine.mjs')),true);
  }finally{rmSync(root,{recursive:true,force:true});}
});
