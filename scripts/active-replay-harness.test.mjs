import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('a zero-exit empty active capture blocks the visual harness before its next GPU tier',()=>{
  const dir=mkdtempSync(join(tmpdir(),'outrun-active-harness-'));
  try{
    for(const path of ['scripts/lib','outrun/tests/budgets','outrun/tests/replays'])mkdirSync(join(dir,path),{recursive:true});
    for(const file of ['scripts/harness.mjs','scripts/lib/plan.mjs','scripts/lib/replay-budgets.mjs','scripts/lib/active-replay-budget.mjs','harness.config.json'])copyFileSync(resolve(file),join(dir,file));
    writeFileSync(join(dir,'package.json'),'{"type":"module"}');
    writeFileSync(join(dir,'outrun/tests/replays/fixture.greplay'),'mock replay: only the parent process boundary is under test');
    writeFileSync(join(dir,'outrun/tests/budgets/fixture.json'),JSON.stringify({activeReplay:true,replay:'tests/replays/fixture.greplay',structural:{drawCallsMax:10,pipelinesCreatedDuringPlay:0,gcPausesOver4msMax:0,jsAllocatedMBMax:80}}));
    const calls=join(dir,'calls.jsonl'),fake=join(dir,'fake-engine.mjs');
    const version=JSON.parse(readFileSync(resolve('harness.config.json'),'utf8')).engineVersion;
    writeFileSync(fake,`import{appendFileSync}from'node:fs';const a=process.argv.slice(2);appendFileSync(${JSON.stringify(calls)},JSON.stringify(a)+'\\n');if(a.includes('--version'))console.log(${JSON.stringify(version)});else if(a[0]==='editor'){console.log('{"ok":false}');process.exitCode=1;}else if(a[0]==='replay')console.log(JSON.stringify({ok:true,results:{v8:{ok:true,steps:4},hermes:{ok:true,steps:4}}}));else console.log(JSON.stringify({ok:true,results:{v8:[{name:'mock stock render',ok:true}]}}));`);
    // Deliberately dishonest child: exit0/top-level green with no captured work.
    writeFileSync(join(dir,'scripts/active-replay-budget.mjs'),`process.stdout.write(JSON.stringify({ok:true,tier:'mobile',captures:[]})+'\\n');`);
    const run=spawnSync(process.execPath,[join(dir,'scripts/harness.mjs'),'visual'],{cwd:dir,encoding:'utf8',env:{...process.env,GAMEENGINE_CLI:fake}});
    assert.equal(run.status,1,run.stdout+run.stderr);
    const summary=JSON.parse(readFileSync(join(dir,'.artifacts/harness/visual.json'),'utf8'));
    assert.equal(summary.ok,false);
    assert.equal(summary.steps.find(step=>step.label==='render-mobile')?.ok,true);
    assert.equal(summary.steps.find(step=>step.label==='active-replay-mobile')?.ok,false);
    const invoked=readFileSync(calls,'utf8').trim().split('\n').map(line=>JSON.parse(line));
    assert(invoked.some(args=>args[0]==='test'&&args.includes('mobile')));
    assert(!invoked.some(args=>args[0]==='test'&&args.includes('compat')),'Later render tier must not run after missing active evidence');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
