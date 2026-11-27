import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {isAbsolute,join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {selectActiveBudgets,captureActiveReplay,activeReplayReport} from './lib/active-replay-budget.mjs';

let out,interrupted,report={ok:false,tier:null,captures:[]};
const controller=new AbortController();
const handlers=new Map(['SIGTERM','SIGINT'].map(name=>[name,()=>{if(!controller.signal.aborted){interrupted=name;controller.abort(new Error(name));}}]));
for(const [name,handler] of handlers)process.on(name,handler);
try{
  const args={};const allowed=new Set(['--project','--gpu-tier','--budget','--out']);
  for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i],value=process.argv[i+1];if(!allowed.has(key)||!value||value.startsWith('--')||Object.hasOwn(args,key))throw new Error('Usage: --project /absolute/game --gpu-tier mobile|compat [--budget terrain.json] --out report.json');args[key]=value;}
  out=args['--out'];const project=args['--project'],tier=args['--gpu-tier'];report.tier=tier??null;
  if(!project||!isAbsolute(project)||!['mobile','compat'].includes(tier)||!out)throw new Error('Absolute --project, --gpu-tier mobile|compat and --out are required');
  const folder=join(project,'tests/budgets');const entries=[];
  for(const file of (await readdir(folder)).filter(name=>name.endsWith('.json')).sort())entries.push({file,value:JSON.parse(await readFile(join(folder,file),'utf8'))});
  const selected=selectActiveBudgets(entries,args['--budget']);
  const engine=join(project,'.gameengine/engine');
  const [{GameEngineClient},{startSession,stopPrivateSession},{bundleToDisk}]=await Promise.all([
    import(pathToFileURL(join(engine,'packages/protocol-client/src/client.ts')).href),
    import(pathToFileURL(join(engine,'tools/cli/src/session.ts')).href),
    import(pathToFileURL(join(engine,'tools/cli/src/bundle.ts')).href),
  ]);
  const bundlePath=join(project,'.gameengine/active-replay-bundle.js');
  const built=await bundleToDisk(project,bundlePath);
  controller.signal.throwIfAborted();
  report.bundle={path:built.path,hash:built.hash,entry:built.entry,warnings:built.warnings};
  for(const budget of selected){
    const bytes=await readFile(join(project,budget.replay));
    for(let run=1;run<=(budget.limits.repeat??1);run++)report.captures.push(await captureActiveReplay({...budget,project,bundlePath,bytes,tier,run,signal:controller.signal},
      {startSession,stopPrivateSession,connect:(session,options)=>GameEngineClient.connect(session,options)}));
  }
  controller.signal.throwIfAborted();
  report.ok=report.captures.length>0&&report.captures.every(row=>row.ok);
  if(report.ok&&!activeReplayReport(report))throw new Error('Active replay report failed integrity validation');
}catch(error){report.ok=false;report.error=error.message;}
finally{for(const [name,handler] of handlers)process.off(name,handler);if(interrupted)report.interrupted=interrupted;}
if(out)try{await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2)+'\n');}catch(error){report.ok=false;report.error=`Artifact write failed: ${error.message}`;}
process.stdout.write(JSON.stringify(report)+'\n');process.exitCode=interrupted==='SIGINT'?130:interrupted==='SIGTERM'?143:report.ok?0:1;
