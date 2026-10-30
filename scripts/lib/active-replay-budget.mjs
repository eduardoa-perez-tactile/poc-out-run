import {budgetReplayPaths} from './replay-budgets.mjs';

export const CAPTURE_SIZE=Object.freeze({width:1280,height:720});
export const MEMORY_CLASS='phone-low';
export const ACTIVE_METRICS=Object.freeze({drawCallsMax:'drawCallsMax',pipelinesCreatedDuringPlay:'pipelinesCreatedDuringCapture',gcPausesOver4msMax:'gcPausesOver4ms',jsAllocatedMBMax:'jsAllocatedMB'});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const hash=v=>typeof v==='string'&&/^[a-f0-9]{16}$/i.test(v);
const require=(ok,message)=>{if(!ok)throw new Error(message);};

export function activeLimits(value){
  require(object(value),'Active structural limits must be an object');
  for(const key of Object.keys(value))require(Object.hasOwn(ACTIVE_METRICS,key)||key==='repeat',`Unknown active structural limit: ${key}`);
  for(const key of Object.keys(ACTIVE_METRICS))require(finite(value[key])&&value[key]>=0,`Active budget requires finite nonnegative ${key}`);
  require(value.repeat===undefined||(Number.isSafeInteger(value.repeat)&&value.repeat>=1&&value.repeat<=9),'Active repeat must be an integer1..9');
  return {...value};
}
export function selectActiveBudgets(entries,budget){
  if(budget!==undefined)require(typeof budget==='string'&&/^[A-Za-z0-9_-]+\.json$/.test(budget),'--budget must be a canonical budget filename');
  const selected=[];
  for(const {file,value} of entries){
    require(object(value),`Malformed budget: ${file}`);
    if(!Object.hasOwn(value,'activeReplay'))continue;
    require(value.activeReplay===true,`Budget ${file}: activeReplay must be true or absent`);
    budgetReplayPaths([{file,value}]);activeLimits(value.structural);
    if(budget===undefined||file===budget)selected.push({file,replay:value.replay,limits:{...value.structural}});
  }
  require(selected.length>0,'No active-replay budgets selected');return selected;
}
export function replayHeader(bytes){
  require(bytes.length>=12&&bytes.subarray(0,8).toString()==='GAMERPL1','Invalid replay magic/header');
  const length=bytes.readUInt32LE(8);
  require(length>0&&length<=16*1024*1024&&12+length<=bytes.length,'Truncated/oversized replay header');
  const header=JSON.parse(bytes.subarray(12,12+length).toString('utf8'));
  require(object(header)&&Number.isSafeInteger(header.steps)&&header.steps>0,'Replay header requires positive step count');
  return header;
}
export function judgeActiveMetrics(limits,perf,sampledDrawPeak,pipelineEvidence){
  activeLimits(limits);require(object(perf),'Missing active perf metrics');
  return Object.entries(ACTIVE_METRICS).map(([metric,key])=>{
    const raw=perf[key];
    require(finite(raw)&&(key==='jsAllocatedMB'?raw>0:integer(raw)),`Missing/invalid active metric ${key}`);
    const value=key==='drawCallsMax'&&sampledDrawPeak!==undefined?Math.max(sampledDrawPeak,raw):
      key==='pipelinesCreatedDuringCapture'&&pipelineEvidence?Math.max(raw,pipelineEvidence.sampledCreated,pipelineEvidence.newKeyCount):raw;
    require(key!=='drawCallsMax'||value>0,'Active replay must render positive draws');
    return {metric,value,limit:limits[metric],ok:value<=limits[metric],...(key==='drawCallsMax'&&sampledDrawPeak!==undefined?{source:'max(raw perf, per-step render.stats)'}:
      key==='pipelinesCreatedDuringCapture'&&pipelineEvidence?{source:'max(raw perf, sampled creations, new pipeline keys)'}:{})};
  });
}
function position(status,total,start){
  require(object(status)&&status.loaded===true,'Replay is not loaded');
  require(status.divergence===null,'Replay divergence is missing or non-null');
  require(status.steps===total,'Replay total differs from header/load');
  require(start?status.step===0&&status.finished===false:status.step===total&&status.finished===true,
    start?'Replay must remain unfinished at step0 before capture':'Replay did not finish at its exact final step');
}
function gpuSample(gpu,previousFrames){
  require(object(gpu)&&gpu.rendered===true,'Missing real GPU render stats');
  require(integer(gpu.drawCalls)&&gpu.drawCalls>0,'Per-step GPU frame must contain positive draws');
  require(integer(gpu.pipelines)&&integer(gpu.pipelinesCreatedThisFrame),'Missing/invalid per-step pipeline counts');
  require(Array.isArray(gpu.validationErrors)&&gpu.validationErrors.length===0,'GPU presentation validation errors or missing error list');
  require(Number.isSafeInteger(gpu.framesRendered)&&gpu.framesRendered>previousFrames,'GPU frame did not advance');
}
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(object(value))return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  require(value===null||typeof value==='string'||typeof value==='boolean'||finite(value),'Invalid pipeline key value');return value;
}
function pipelineSnapshot(value){
  require(object(value)&&['mobile','compat'].includes(value.tier)&&Array.isArray(value.pipelines),'Missing pipeline-key snapshot');
  // Public warm records contain key/state metadata, never shader bodies. Omit
  // the API's blobCache object entirely from report snapshots.
  for(const record of value.pipelines)require(object(record)&&typeof record.r==='string'&&Object.keys(record).length>1,'Invalid pipeline record');
  return {tier:value.tier,pipelines:value.pipelines};
}
function actualPipelineKeys(snapshot){
  pipelineSnapshot(snapshot);
  return new Set(snapshot.pipelines.filter(record=>record.r!=='3d-program'&&record.r!=='3d-load')
    .map(record=>JSON.stringify(canonical(record))));
}
function pipelineCoverage(row){
  require(row.pipelinesBefore?.tier===row.tier&&row.pipelinesAfter?.tier===row.tier,'Pipeline snapshot GPU tier differs');
  const before=actualPipelineKeys(row.pipelinesBefore),after=actualPipelineKeys(row.pipelinesAfter);
  const added=[...after].filter(key=>!before.has(key)).sort();
  require(JSON.stringify(row.newPipelineKeys)===JSON.stringify(added),'New actual pipeline keys differ from snapshots');
  return {sampledCreated:row.sampledPipelinesCreated,newKeyCount:added.length};
}
function sampleCoverage(row,total){
  require(row.cadence==='one-render-request-per-fixed-step'&&row.sampledFrames===total&&Array.isArray(row.samples)&&row.samples.length===total,'Incomplete per-step GPU coverage');
  let previousFrames=row.warmRender?.framesRendered,peak=0,created=0;
  require(integer(previousFrames)&&row.gpuFrameBaseline===previousFrames,'Missing warm-up GPU frame provenance');
  for(let i=0;i<total;i++){
    const sample=row.samples[i];require(sample.step===i+1&&hash(sample.hash),'Skipped/overshot fixed step or missing hash');
    require(sample.replay?.step===i+1&&sample.replay.steps===total&&sample.replay.loaded===true&&sample.replay.divergence===null&&sample.replay.finished===(i===total-1),'Replay step/finish/divergence does not match GPU sample');
    gpuSample(sample.gpu,previousFrames);require(sample.gpuFrameDelta===sample.gpu.framesRendered-previousFrames,'GPU frame delta differs from trace');
    previousFrames=sample.gpu.framesRendered;peak=Math.max(peak,sample.gpu.drawCalls);created+=sample.gpu.pipelinesCreatedThisFrame;
  }
  require(row.observedDrawCallsMax===peak&&row.end.hash===row.samples.at(-1).hash,'GPU peak/final hash differs from trace');
  require(row.actualGpuFrames===previousFrames-row.gpuFrameBaseline&&row.extraInternalRenderFrames===row.actualGpuFrames-total&&row.sampledPipelinesCreated===created,'GPU frame/pipeline accounting differs from trace');
  return peak;
}
export function validateActiveCapture(row){
  require(row?.ok===true,'Capture did not pass');
  require(row.captureSize?.width===1280&&row.captureSize?.height===720&&row.memoryClass===MEMORY_CLASS,'Missing landscape/phone-low capture provenance');
  const total=row.header?.steps;require(Number.isSafeInteger(total)&&total>0,'Missing positive replay header step count');
  require(row.load?.steps===total,'Replay load/header steps differ');
  position(row.start,total,true);position(row.end,total,false);
  require(hash(row.start.hash)&&hash(row.end.hash),'Missing start/end world hash');
  require(row.perf?.steps===total,'Perf captured a truncated or idle-only workload');
  require(Number.isSafeInteger(row.perf.frames)&&row.perf.frames>0,'Perf captured no rendered frames');
  require(row.warmAssets?.pending===0,'Replay was not warmed at step0');
  require(row.cleanup?.ok===true,'Owned session cleanup did not finish');
  const checks=judgeActiveMetrics(row.limits,row.perf,sampleCoverage(row,total),pipelineCoverage(row));
  require(checks.every(check=>check.ok),'Active metric exceeded its declared limit');
  require(Array.isArray(row.checks)&&row.checks.length===checks.length&&checks.every(check=>row.checks.some(got=>
    got.metric===check.metric&&got.value===check.value&&got.limit===check.limit&&got.source===check.source&&got.ok===true)),'Missing or inconsistent active checks');
  return true;
}
export function activeReplayReport(report){
  try{
    require(report?.ok===true&&['mobile','compat'].includes(report.tier),'Active report failed or has invalid tier');
    require(Array.isArray(report.captures)&&report.captures.length>0,'Empty active report');
    for(const row of report.captures){require(row.tier===report.tier&&typeof row.file==='string'&&row.file.length>0,'Invalid capture identity');validateActiveCapture(row);}
    return true;
  }catch{return false;}
}

function abortError(signal){return new Error(`Active replay cancelled: ${signal.reason?.message??signal.reason??'interrupted'}`);}
function checkAbort(signal){if(signal?.aborted)throw abortError(signal);}
function interruptible(promise,signal,onLate=()=>{}){
  if(!signal)return promise;
  if(signal.aborted){Promise.resolve(promise).then(onLate,()=>{});return Promise.reject(abortError(signal));}
  return new Promise((resolve,reject)=>{
    let cancelled=false;
    const abort=()=>{cancelled=true;signal.removeEventListener('abort',abort);reject(abortError(signal));};
    signal.addEventListener('abort',abort,{once:true});
    Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',abort);if(cancelled)onLate(value);else resolve(value);},
      error=>{signal.removeEventListener('abort',abort);if(!cancelled)reject(error);});
  });
}
async function bounded(promise,ms){
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('cleanup RPC timed out')),ms);})]);}
  finally{clearTimeout(timer);}
}

// Injectable SDK boundary. stopPrivateSession recognizes its own ChildProcess
// through the SDK WeakMap: no process-name scans or arbitrary PID kill calls.
export async function captureActiveReplay(options,deps){
  const {project,bundlePath,file,replay,bytes,tier,limits,signal}=options;
  const now=deps.now??Date.now,sleep=deps.sleep??(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
  const row={file,replay,tier,cadence:'one-render-request-per-fixed-step',actualGpuFrames:0,extraInternalRenderFrames:0,sampledPipelinesCreated:0,sampledFrames:0,samples:[],observedDrawCallsMax:0,captureSize:{...CAPTURE_SIZE},memoryClass:MEMORY_CLASS,run:options.run??1,limits:{...limits},ok:false,checks:[],cleanup:{ok:false,warnings:[]}};
  let session,client,capturing=false;
  try{
    checkAbort(signal);activeLimits(limits);require(['mobile','compat'].includes(tier),'Unsupported active GPU tier');
    row.header=replayHeader(bytes);
    session=await deps.startSession(project,bundlePath,{js:'v8',paused:true,register:false,signal,
      extra:['--no-validation','--tier',tier,'--memory-class',MEMORY_CLASS]});
    row.host={pid:session.pid,host:session.host,bundleHash:session.bundleHash};
    checkAbort(signal);
    client=await interruptible(deps.connect(session,{client:'outrun-active-replay-budget',timeoutMs:10000,requestTimeoutMs:10000}),signal,late=>late.close());
    const call=(method,args={})=>{checkAbort(signal);return interruptible(client.call(method,args),signal);};
    const wait=ms=>{checkAbort(signal);return interruptible(sleep(ms),signal);};
    row.load=await call('replay.load',{data:bytes.toString('base64')});
    require(row.load.steps===row.header.steps,'Replay load/header steps differ');
    position(await call('replay.status'),row.header.steps,true);
    row.coldAssets=await call('assets.status');
    const warmDeadline=now()+(options.warmTimeoutMs??30000);
    for(;;){
      row.warmRender=await call('render.stats',{render:true,...CAPTURE_SIZE});
      row.warmAssets=await call('assets.status');
      require(integer(row.warmAssets?.pending),'Missing asset pending count');
      if(row.warmAssets.pending===0)break;
      require(now()<warmDeadline,'Step0 asset warm-up timed out');await wait(50);
    }
    row.start=await call('replay.status');position(row.start,row.header.steps,true);
    const startHash=await call('world.hash');require(startHash.step===0&&hash(startHash.hash),'Missing step0 world hash');row.start={...row.start,hash:startHash.hash};
    row.pipelinesBefore=pipelineSnapshot(await call('render.pipelines'));
    row.gpuFrameBaseline=row.warmRender.framesRendered;
    row.captureNote='Allocation includes internal asset/UI render retries and extra LateUpdate work. Raw perf.frames counts protocol/CPU frames, not GPU requests; no real-time FPS or phone hardware measurement.';
    await call('perf.start');capturing=true;
    // Manual player frames consume recorded inputs without a wall-clock
    // accumulator adding an extra SIM tick at the replay's end.
    const deadline=now()+(options.playTimeoutMs??Math.max(60000,row.header.steps/20*1000));
    let previousFrames=row.warmRender.framesRendered;
    require(integer(previousFrames),'Missing warm-up GPU frame provenance');
    for(let i=0;i<row.header.steps;i++){
      require(now()<deadline,'Active replay timed out');
      const stepped=await call('engine.step',{n:1,frames:true});
      require(stepped.step===i+1&&hash(stepped.hash),'Skipped/overshot fixed step or missing hash');
      row.end=await call('replay.status');
      require(row.end?.loaded===true&&row.end.step===i+1&&row.end.steps===row.header.steps&&row.end.divergence===null&&row.end.finished===(i===row.header.steps-1),'Replay step/finish/divergence does not match GPU sample');
      const gpu=await call('render.stats',{render:true,...CAPTURE_SIZE});
      row.samples.push({step:stepped.step,hash:stepped.hash,replay:{...row.end},gpu,gpuFrameDelta:gpu.framesRendered-previousFrames});
      gpuSample(gpu,previousFrames);previousFrames=gpu.framesRendered;
      row.sampledPipelinesCreated+=gpu.pipelinesCreatedThisFrame;row.actualGpuFrames=gpu.framesRendered-row.gpuFrameBaseline;
      row.sampledFrames++;row.extraInternalRenderFrames=row.actualGpuFrames-row.sampledFrames;row.observedDrawCallsMax=Math.max(row.observedDrawCallsMax,gpu.drawCalls);
    }
    position(row.end,row.header.steps,false);
    row.perf=await call('perf.stats',{stop:true});capturing=false;
    row.pipelinesAfter=pipelineSnapshot(await call('render.pipelines'));
    const beforeKeys=actualPipelineKeys(row.pipelinesBefore);
    row.newPipelineKeys=[...actualPipelineKeys(row.pipelinesAfter)].filter(key=>!beforeKeys.has(key)).sort();
    const endHash=await call('world.hash');require(endHash.step===row.header.steps&&hash(endHash.hash),'Missing final world hash');row.end={...row.end,hash:endHash.hash};
    require(row.perf?.steps===row.header.steps,'Perf captured a truncated or idle-only workload');
    require(Number.isSafeInteger(row.perf.frames)&&row.perf.frames>0,'Perf captured no rendered frames');
    row.checks=judgeActiveMetrics(limits,row.perf,row.observedDrawCallsMax,pipelineCoverage(row));require(row.checks.every(check=>check.ok),'Active metric exceeded its declared limit');
    row.ok=true;
  }catch(error){row.error=error.message;if(signal?.aborted)row.cancelled=true;}
  finally{
    if(client){
      const cleanupCall=(method,args)=>bounded(client.call(method,args,{timeoutMs:1000}),options.cleanupTimeoutMs??1100);
      if(capturing)try{row.perf=await cleanupCall('perf.stats',{stop:true});}catch(error){row.cleanup.warnings.push(`perf.stop: ${error.message}`);}
      try{await cleanupCall('engine.quit',{});}catch(error){row.cleanup.warnings.push(`engine.quit: ${error.message}`);}
      try{client.close();}catch(error){row.cleanup.warnings.push(`client.close: ${error.message}`);}
    }
    if(session){
      try{await deps.stopPrivateSession(session);row.cleanup.ok=true;}catch(error){row.ok=false;row.cleanup.error=error.message;row.error??=`Owned session cleanup: ${error.message}`;}
    }else row.cleanup.ok=true; // SDK startSession itself cleans failed startup.
  }
  if(signal?.aborted){row.ok=false;row.cancelled=true;row.error??=abortError(signal).message;}
  if(row.ok)try{validateActiveCapture(row);}catch(error){row.ok=false;row.error=error.message;}
  return row;
}
