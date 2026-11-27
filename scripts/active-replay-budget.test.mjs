import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ACTIVE_METRICS,selectActiveBudgets,replayHeader,captureActiveReplay,activeReplayReport} from './lib/active-replay-budget.mjs';

const LIMITS={drawCallsMax:10,pipelinesCreatedDuringPlay:0,gcPausesOver4msMax:0,jsAllocatedMBMax:32,repeat:1};
const PERF={steps:4,frames:8,drawCallsMax:3,pipelinesCreatedDuringCapture:0,gcPausesOver4ms:0,jsAllocatedMB:2.5};
function replay(steps=4){const header=Buffer.from(JSON.stringify({steps,dt:1/60,bundleHash:'source'}));const length=Buffer.alloc(4);length.writeUInt32LE(header.length);return Buffer.concat([Buffer.from('GAMERPL1'),length,header,Buffer.from([1])]);}
const entry=(value={})=>({file:'terrain.json',value:{activeReplay:true,replay:'tests/replays/terrain.greplay',structural:{...LIMITS},...value}});
function fake(options={}){
  const events=[],owned={pid:1234,host:{path:'fake'},bundleHash:'compiled'},stopped=[];let time=0,perfStarted=false,gpuFrames=0;
  let state={loaded:true,step:0,steps:4,finished:false,divergence:null};
  const client={close(){events.push('close');},async call(method,args){
    events.push(method);
    if(options.throwAt===method)throw new Error(`injected ${method} failure`);
    switch(method){
      case 'replay.load':return {steps:options.loadSteps??4};
      case 'replay.status':
        if(state.step>0)state={...state,...options.end};
        return {...state};
      case 'assets.status':return {loaded:1,pending:options.pendingWarm?1:0};
      case 'render.stats':
        assert.deepEqual(args,{render:true,width:1280,height:720});
        if(!perfStarted){assert.equal(state.step,0,'warm render consumed recorded steps');if(options.finishDuringWarm)state={...state,step:4,finished:true};}
        gpuFrames+=perfStarted?(options.internalFrames??1):1;return {drawCalls:3,pipelines:4,pipelinesCreatedThisFrame:0,validationErrors:[],rendered:true,framesRendered:gpuFrames,...(perfStarted?options.gpu:{})};
      case 'world.hash':return {step:state.step,hash:state.finished?'1234567890abcdef':'fedcba0987654321'};
      case 'render.pipelines':return {tier:'mobile',pipelines:(perfStarted?options.pipelinesAfter:options.pipelinesBefore)??[{r:'2d',key:{shape:1}}],blobCache:{ignored:true}};
      case 'perf.start':assert.equal(state.step,0);perfStarted=true;return {};
      case 'engine.step':
        assert.equal(perfStarted,true,'playback escaped capture');assert.deepEqual(args,{n:1,frames:true});
        state={...state,step:state.step+1,finished:state.step+1===4};if(options.endless)time+=100;
        return {step:state.step+(options.overshoot?1:0),hash:state.finished?'1234567890abcdef':'fedcba0987654321'};
      case 'perf.stats':assert.equal(args.stop,true);return {...PERF,...options.perf};
      case 'engine.quit':return {};
      default:throw new Error(`Unsupported fake SDK operation ${method}`);
    }
  }};
  const deps={
    async startSession(project,bundle,settings){events.push('start');assert.equal(settings.register,false);assert.equal(settings.paused,true);assert.equal(settings.js,'v8');assert.deepEqual(settings.extra,['--no-validation','--tier','mobile','--memory-class','phone-low']);return owned;},
    async connect(session,settings){events.push('connect');assert.equal(session,owned);assert.equal(settings.requestTimeoutMs,10000);if(options.connectFails)throw new Error('connect refused');return client;},
    async stopPrivateSession(session){stopped.push(session);events.push('stopOwned');assert.equal(session,owned);if(options.cleanupFails)throw new Error('owned host still alive');},
    now:()=>time,sleep:async ms=>{time+=ms;},
  };
  const config={project:'/game',bundlePath:'/game/.gameengine/active-replay-bundle.js',file:'terrain.json',replay:'tests/replays/terrain.greplay',bytes:replay(),tier:'mobile',limits:{...LIMITS},warmTimeoutMs:20,playTimeoutMs:100};
  return {deps,config,events,stopped,owned};
}
async function run(options={}){const f=fake(options),row=await captureActiveReplay(f.config,f.deps);return {...f,row,report:{ok:row.ok,tier:'mobile',captures:[row]}};}

test('active selector rejects empty, false/string markers, unsafe paths and incomplete/unknown limits',()=>{
  assert.equal(selectActiveBudgets([entry()])[0].file,'terrain.json');assert.equal(selectActiveBudgets([entry()],'terrain.json').length,1);
  for(const entries of [[],[entry({activeReplay:false})],[entry({activeReplay:'true'})],[entry({replay:'../escape.greplay'})],[entry({scene:'override'})]])assert.throws(()=>selectActiveBudgets(entries));
  assert.throws(()=>selectActiveBudgets([entry()],'other.json'));assert.throws(()=>selectActiveBudgets([entry()],'../terrain.json'));
  for(const key of Object.keys(ACTIVE_METRICS)){const limits={...LIMITS};delete limits[key];assert.throws(()=>selectActiveBudgets([entry({structural:limits})]),new RegExp(key));}
  for(const structural of [{...LIMITS,repeat:0},{...LIMITS,repeat:1.5},{...LIMITS,drawCallMax:10},{...LIMITS,jsAllocatedMBMax:NaN}])assert.throws(()=>selectActiveBudgets([entry({structural})]));
});
test('replay headers require bounded magic, complete JSON and positive real workload',()=>{
  assert.equal(replayHeader(replay()).steps,4);
  for(const bytes of [Buffer.from('empty'),Buffer.concat([Buffer.from('GAMERPL1'),Buffer.from([255,255,255,255])]),replay(0),replay(-1),replay(1.5)])assert.throws(()=>replayHeader(bytes));
});
test('supported paused warm-up renders after each exact fixed step and records exact active workload plus cleanup',async()=>{
  const {row,report,events,stopped,owned}=await run();assert.equal(row.ok,true,row.error);assert.equal(activeReplayReport(report),true);
  assert.equal(row.start.step,0);assert.equal(row.end.step,4);assert.equal(row.perf.steps,4);assert.equal(row.checks.length,4);
  assert(events.indexOf('render.stats')<events.indexOf('perf.start'));assert(events.indexOf('perf.start')<events.indexOf('engine.step'));
  assert.equal(events.filter(name=>name==='engine.step').length,4);assert.equal(row.sampledFrames,4);assert.equal(events.includes('engine.resume'),false);
  assert.equal(events.includes('replay.play'),false);assert.deepEqual(stopped,[owned]);assert.equal(events.at(-1),'stopOwned');assert.equal(row.cleanup.ok,true);
});
test('finished-before-capture false positive is rejected before perf start or resume',async()=>{
  const {row,events,stopped}=await run({finishDuringWarm:true});assert.equal(row.ok,false);assert.match(row.error,/step0/);
  assert.equal(events.includes('perf.start'),false);assert.equal(events.includes('engine.step'),false);assert.equal(stopped.length,1);
});
test('zero/idle-only or truncated steps and zero frames cannot satisfy a green summary',async()=>{
  for(const perf of [{steps:0},{steps:3},{steps:5},{frames:0},{frames:null},{frames:NaN},{jsAllocatedMB:0}]){
    const {row,report,stopped}=await run({perf});assert.equal(row.ok,false,JSON.stringify(perf));assert.equal(activeReplayReport({...report,ok:true}),false);assert.equal(stopped.length,1);
  }
});
test('missing, null, NaN and negative raw metrics fail even when their limit is zero',async()=>{
  for(const metric of Object.values(ACTIVE_METRICS))for(const value of [undefined,null,NaN,-1]){
    const {row,stopped}=await run({perf:{[metric]:value}});assert.equal(row.ok,false,`${metric}:${value}`);assert.match(row.error,/metric|draw/);assert.equal(stopped.length,1);
  }
});
test('each of the four declared limits is judged without SDK null/software-GPU exemptions',async()=>{
  for(const [metric,value] of [['drawCallsMax',11],['pipelinesCreatedDuringCapture',1],['gcPausesOver4ms',1],['jsAllocatedMB',33]]){
    const {row}=await run({perf:{[metric]:value,cpuAdapter:true}});assert.equal(row.ok,false,metric);assert(row.checks.some(check=>check.ok===false));
  }
});
test('divergence, wrong replay end totals and header/load mismatches are hard failures',async()=>{
  for(const options of [{end:{divergence:{step:2}}},{end:{divergence:undefined}},{end:{steps:5}},{end:{step:3}},{loadSteps:5}]){
    const {row,stopped}=await run(options);assert.equal(row.ok,false);assert.equal(stopped.length,1);
  }
});
test('playback and warm-up timeouts stop capture and only their owned session',async()=>{
  for(const options of [{endless:true},{pendingWarm:true}]){
    const {row,events,stopped,owned}=await run(options);assert.equal(row.ok,false);assert.match(row.error,/timed out/);assert.deepEqual(stopped,[owned]);
    assert(events.includes('engine.quit'));if(options.endless)assert(events.includes('perf.stats'));
  }
});
test('connect, runtime and quit errors still clean up the private SDK child; cleanup failure cannot pass',async()=>{
  for(const options of [{connectFails:true},{throwAt:'render.stats'},{throwAt:'engine.step'},{throwAt:'perf.stats'},{throwAt:'engine.quit'}]){
    const {row,stopped,owned}=await run(options);assert.deepEqual(stopped,[owned]);assert.equal(row.cleanup.ok,true);
    assert.equal(row.ok,options.throwAt==='engine.quit',JSON.stringify(options));
  }
  const {row,report}=await run({cleanupFails:true});assert.equal(row.ok,false);assert.equal(row.cleanup.ok,false);assert.equal(activeReplayReport({...report,ok:true}),false);
});
test('report predicate distrusts top-level ok and copied checks when raw evidence is missing or inconsistent',async()=>{
  const {report}=await run();assert.equal(activeReplayReport(report),true);
  for(const mutate of [r=>r.captures=[],r=>r.captures[0].perf.gcPausesOver4ms=null,r=>r.captures[0].perf.steps=3,r=>r.captures[0].start.step=4,
    r=>delete r.captures[0].end.hash,r=>r.captures[0].end.divergence={},r=>r.captures[0].checks=[],r=>r.captures[0].limits.jsAllocatedMBMax=1,r=>r.captures[0].cleanup.ok=false,r=>r.captures[0].captureSize.width=540,r=>delete r.captures[0].memoryClass]){
    const altered=structuredClone(report);mutate(altered);assert.equal(activeReplayReport(altered),false);
  }
});
test('CLI writes a visible JSON failure for empty selection without importing or starting the SDK',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'outrun-active-budget-test-'));
  try{
    await mkdir(join(directory,'tests/budgets'),{recursive:true});await writeFile(join(directory,'tests/budgets/plain.json'),JSON.stringify({replay:'tests/replays/plain.greplay',structural:LIMITS}));
    const out=join(directory,'report.json'),script=fileURLToPath(new URL('./active-replay-budget.mjs',import.meta.url));
    const result=spawnSync(process.execPath,[script,'--project',directory,'--gpu-tier','mobile','--out',out],{encoding:'utf8',timeout:10000});
    assert.equal(result.status,1);const report=JSON.parse(result.stdout);assert.equal(report.ok,false);assert.match(report.error,/No active-replay/);
    assert.deepEqual(JSON.parse(await readFile(out,'utf8')),report);assert.deepEqual(report.captures,[]);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('cancellation of in-flight warm/play calls or connect cleans only the owned session',async()=>{
  for(const stage of ['render.stats','engine.step','connect']){
    const f=fake(),controller=new AbortController();f.config.signal=controller.signal;
    const connect=f.deps.connect;
    f.deps.connect=async(...args)=>{
      if(stage==='connect'){queueMicrotask(()=>controller.abort(new Error('SIGTERM')));return new Promise(()=>{});}
      const client=await connect(...args),call=client.call.bind(client);
      client.call=(method,args)=>{
        if(method===stage){queueMicrotask(()=>controller.abort(new Error('SIGINT')));return new Promise(()=>{});}
        return call(method,args);
      };return client;
    };
    const row=await captureActiveReplay(f.config,f.deps);
    assert.equal(row.ok,false);assert.equal(row.cancelled,true);assert.match(row.error,/cancelled/);assert.deepEqual(f.stopped,[f.owned]);assert.equal(row.cleanup.ok,true);
  }
});
test('cancellation interrupts pending wait loops and propagates startup signal without losing a late client',async()=>{
  for(const mode of ['warm']){
    const f=fake(mode==='warm'?{pendingWarm:true}:{endless:true}),controller=new AbortController();f.config.signal=controller.signal;
    f.deps.sleep=()=>{controller.abort(new Error('interrupt during wait'));return new Promise(()=>{});};
    const start=f.deps.startSession;f.deps.startSession=(project,bundle,settings)=>{assert.equal(settings.signal,controller.signal);return start(project,bundle,settings);};
    const row=await captureActiveReplay(f.config,f.deps);assert.equal(row.ok,false);assert.equal(row.cancelled,true);assert.deepEqual(f.stopped,[f.owned]);
  }
  const f=fake(),controller=new AbortController();f.config.signal=controller.signal;let resolveConnect;
  const late=await f.deps.connect(f.owned,{requestTimeoutMs:10000});
  f.deps.connect=()=>new Promise(resolve=>{resolveConnect=resolve;queueMicrotask(()=>controller.abort(new Error('late connect')));});
  const row=await captureActiveReplay(f.config,f.deps);assert.equal(row.ok,false);resolveConnect(late);await new Promise(resolve=>setImmediate(resolve));
  assert(f.events.includes('close'));assert.deepEqual(f.stopped,[f.owned]);
});
test('cleanup RPC is bounded and remains independent of the cancelled signal',async()=>{
  const f=fake(),controller=new AbortController();f.config.signal=controller.signal;f.config.cleanupTimeoutMs=5;
  const connect=f.deps.connect;
  f.deps.connect=async(...args)=>{
    const client=await connect(...args),call=client.call.bind(client);
    client.call=(method,args)=>{
      if(method==='engine.step'){controller.abort(new Error('cancelled'));return new Promise(()=>{});}
      if(method==='engine.quit')return new Promise(()=>{});
      return call(method,args);
    };return client;
  };
  const row=await captureActiveReplay(f.config,f.deps);assert.equal(row.ok,false);assert.equal(row.cleanup.ok,true);
  assert(row.cleanup.warnings.some(line=>line.includes('timed out')));assert.deepEqual(f.stopped,[f.owned]);
});

for(const signal of ['SIGTERM','SIGINT'])test(`CLI ${signal} waits for private detached-child cleanup and writes failure artifact`,async()=>{
  const directory=await mkdtemp(join(tmpdir(),'outrun-active-interrupt-'));let ownedPid;
  try{
    const files={
      'tests/budgets/terrain.json':JSON.stringify(entry().value),
      '.gameengine/engine/tools/cli/src/bundle.ts':`export async function bundleToDisk(project,path){return {path,hash:'fresh',entry:'src/main.ts',warnings:[]};}`,
      '.gameengine/engine/tools/cli/src/session.ts':`
        import {spawn} from 'node:child_process';import {writeFileSync} from 'node:fs';import {join} from 'node:path';
        let child,project;
        export async function startSession(dir,bundle,options){
          project=dir;if(!options.signal)throw Error('missing abort signal');
          child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});child.unref();
          writeFileSync(join(dir,'owned-child.pid'),String(child.pid));
          setTimeout(()=>process.kill(process.pid,${JSON.stringify(signal)}),50);
          return {pid:child.pid};
        }
        export async function stopPrivateSession(session){
          if(session.pid!==child.pid)throw Error('not owned');
          if(child.exitCode===null&&child.signalCode===null)await new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>reject(Error('test child did not exit')),1000);
            child.once('exit',()=>{clearTimeout(timer);resolve();});child.kill();
          });
          writeFileSync(join(project,'owned-cleanup.txt'),'stopped');
        }`,
      '.gameengine/engine/packages/protocol-client/src/client.ts':`
        export class GameEngineClient {static async connect(){let step=0,frames=0;return {
          close(){},async call(method,args){switch(method){
            case 'replay.load':return {steps:4};
            case 'replay.status':return {loaded:true,step,steps:4,finished:step===4,divergence:null};
            case 'assets.status':return {loaded:1,pending:0};case 'render.stats':return {drawCalls:1,pipelines:1,pipelinesCreatedThisFrame:0,validationErrors:[],rendered:true,framesRendered:++frames};
            case 'world.hash':return {step:0,hash:'1234567890abcdef'};case 'render.pipelines':return {tier:'mobile',pipelines:[]};case 'perf.start':return {};
            case 'engine.step':await new Promise(resolve=>setTimeout(resolve,100));step++;return {step,hash:'1234567890abcdef'};case 'perf.stats':return {steps:1,frames:1,drawCallsMax:1,pipelinesCreatedDuringCapture:0,gcPausesOver4ms:0,jsAllocatedMB:1};
            case 'engine.quit':return {};default:throw Error(method);
          }}
        };}}`,
    };
    for(const [file,text] of Object.entries(files)){const path=join(directory,file);await mkdir(join(path,'..'),{recursive:true});await writeFile(path,text);}
    await mkdir(join(directory,'tests/replays'),{recursive:true});await writeFile(join(directory,'tests/replays/terrain.greplay'),replay());
    const out=join(directory,'report.json'),script=fileURLToPath(new URL('./active-replay-budget.mjs',import.meta.url));
    const result=spawnSync(process.execPath,[script,'--project',directory,'--gpu-tier','mobile','--out',out],{encoding:'utf8',timeout:10000});
    ownedPid=Number(await readFile(join(directory,'owned-child.pid'),'utf8'));
    assert.equal(result.signal,null,result.stderr);assert.equal(result.status,signal==='SIGINT'?130:143,result.stderr);
    const report=JSON.parse(result.stdout);assert.equal(report.ok,false);assert.equal(report.interrupted,signal);
    assert.equal(report.captures[0].cleanup.ok,true);assert.equal(report.captures[0].cancelled,true);
    assert.equal(await readFile(join(directory,'owned-cleanup.txt'),'utf8'),'stopped');
    assert.deepEqual(JSON.parse(await readFile(out,'utf8')),report);
    assert.throws(()=>process.kill(ownedPid,0),{code:'ESRCH'});
  }finally{
    // Last-resort teardown is restricted to the harmless test child we created.
    if(ownedPid)try{process.kill(ownedPid,'SIGKILL');}catch{}
    await rm(directory,{recursive:true,force:true});
  }
});

test('one missing or invalid actual GPU frame invalidates exact SIM coverage',async()=>{
  for(const gpu of [{drawCalls:0},{drawCalls:NaN},{rendered:false},{framesRendered:1},{validationErrors:['shader failed']},
    {validationErrors:undefined},{pipelines:null},{pipelinesCreatedThisFrame:-1}]){
    const {row,stopped}=await run({gpu});assert.equal(row.ok,false,JSON.stringify(gpu));assert.equal(stopped.length,1);assert.equal(row.sampledFrames,0);
  }
  const {row}=await run({overshoot:true});assert.equal(row.ok,false);assert.match(row.error,/overshot/);assert.equal(row.sampledFrames,0);
});
test('report rejects skipped GPU sample or step/hash divergence despite complete raw perf',async()=>{
  const {report}=await run();
  for(const mutate of [r=>r.captures[0].samples.pop(),r=>r.captures[0].sampledFrames--,r=>r.captures[0].samples[1].step=3,
    r=>r.captures[0].samples[2].gpu.validationErrors=['bad'],r=>r.captures[0].samples[1].gpu.framesRendered=1,
    r=>r.captures[0].samples[0].hash='missing',r=>r.captures[0].cadence='uncontrolled',r=>r.captures[0].observedDrawCallsMax=0]){
    const altered=structuredClone(report);mutate(altered);assert.equal(activeReplayReport(altered),false);
  }
});
test('actual GPU draw peak is judged explicitly without overwriting a lower raw SDK counter',async()=>{
  const {row,report}=await run({perf:{drawCallsMax:0},gpu:{drawCalls:7}});
  assert.equal(row.ok,true,row.error);assert.equal(row.perf.drawCallsMax,0);assert.equal(row.observedDrawCallsMax,7);
  const check=row.checks.find(check=>check.metric==='drawCallsMax');assert.equal(check.value,7);assert.equal(check.source,'max(raw perf, per-step render.stats)');
  assert.equal(activeReplayReport(report),true);
  const exceeded=await run({perf:{drawCallsMax:1},gpu:{drawCalls:11}});assert.equal(exceeded.row.ok,false);
});

test('internal GPU retries are visible without pretending one request means exactly one frame',async()=>{
  const {row,report}=await run({internalFrames:4});assert.equal(row.ok,true,row.error);
  assert.equal(row.cadence,'one-render-request-per-fixed-step');assert.equal(row.sampledFrames,4);
  assert.equal(row.gpuFrameBaseline,1);assert.equal(row.actualGpuFrames,16);assert.equal(row.extraInternalRenderFrames,12);
  assert(row.samples.every(sample=>sample.gpuFrameDelta===4));assert.equal(row.perf.frames,8);
  assert.equal(activeReplayReport(report),true);
});
test('pipeline key growth catches unseen internal creation even when sampled and raw counters are zero',async()=>{
  const extra={r:'3d',key:{Forward:{samples:1,format:22}}};
  const {row}=await run({pipelinesAfter:[{r:'2d',key:{shape:1}},extra]});
  assert.equal(row.ok,false);assert.equal(row.perf.pipelinesCreatedDuringCapture,0);assert.equal(row.sampledPipelinesCreated,0);
  assert.equal(row.newPipelineKeys.length,1);
  const check=row.checks.find(check=>check.metric==='pipelinesCreatedDuringPlay');assert.equal(check.value,1);
  assert.equal(check.source,'max(raw perf, sampled creations, new pipeline keys)');
});
test('pipeline metadata and object-key ordering are not actual pipeline growth',async()=>{
  const {row,report}=await run({pipelinesBefore:[{r:'3d',key:{Forward:{samples:1,format:22}}}],
    pipelinesAfter:[{key:{Forward:{format:22,samples:1}},r:'3d'},{r:'3d-program',program:'new-material'},{r:'3d-load',asset:'mesh'}]});
  assert.equal(row.ok,true,row.error);assert.deepEqual(row.newPipelineKeys,[]);assert.equal(activeReplayReport(report),true);
  assert.equal(Object.hasOwn(row.pipelinesBefore,'blobCache'),false);
});
test('strict report rederives request deltas, GPU totals and actual pipeline-key differences',async()=>{
  const {report}=await run();
  for(const mutate of [r=>r.captures[0].samples[0].gpuFrameDelta=4,r=>r.captures[0].actualGpuFrames++,r=>r.captures[0].extraInternalRenderFrames++,
    r=>r.captures[0].gpuFrameBaseline++,r=>r.captures[0].sampledPipelinesCreated++,r=>r.captures[0].newPipelineKeys=['fake'],
    r=>r.captures[0].pipelinesAfter.pipelines.push({r:'post-outline',format:22}),r=>delete r.captures[0].pipelinesBefore,
    r=>r.captures[0].pipelinesAfter.tier='compat']){
    const altered=structuredClone(report);mutate(altered);assert.equal(activeReplayReport(altered),false);
  }
});
