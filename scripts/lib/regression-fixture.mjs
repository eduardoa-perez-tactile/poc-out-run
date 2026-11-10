// One harness invocation owns one fixture, containing current candidate files.
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {copyFileSync,existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,realpathSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {basename,dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {isDeepStrictEqual} from 'node:util';

const CONFIG='project.gameengine.json';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const omitted=path=>path==='AGENTS.md'||path==='CLAUDE.md'||['.gameengine','.agents','.claude','.codex/agents'].some(prefix=>path===prefix||path.startsWith(prefix+'/'));
const canonical=path=>path.split(sep).join('/');
const require=(value,message)=>{if(!value)throw new Error(message);};
function inventory(root,project){
  const prefix=relative(root,project);
  require(prefix&&!prefix.startsWith('..')&&!isAbsolute(prefix),'Fixture project must be inside repository root');
  const r=spawnSync('git',['ls-files','--cached','--others','--exclude-standard','-z','--',prefix],{cwd:root,encoding:'utf8'});
  require(r.status===0,r.stderr||'Cannot inventory candidate project');
  const entries=[];
  for(const repoPath of new Set(r.stdout.split('\0').filter(Boolean))){
    const path=canonical(relative(project,resolve(root,repoPath)));
    require(path&&!path.startsWith('../')&&!isAbsolute(path),'Escaping candidate path');
    if(omitted(path)||!existsSync(join(project,path)))continue; // tracked deletion remains deleted
    const stat=lstatSync(join(project,path));
    require(stat.isFile()&&!stat.isSymbolicLink(),`Fixture requires regular candidate file: ${path}`);
    entries.push({path,sha256:sha(readFileSync(join(project,path)))});
  }
  entries.sort((a,b)=>a.path.localeCompare(b.path));
  require(entries.some(row=>row.path===CONFIG),'Candidate project config missing');
  return entries;
}
function fixtureFiles(folder,prefix=''){
  const rows=[];
  for(const entry of readdirSync(folder,{withFileTypes:true})){
    const path=prefix?prefix+'/'+entry.name:entry.name;
    if(omitted(path))continue;
    require(!entry.isSymbolicLink(),`Unexpected fixture symlink: ${path}`);
    if(entry.isDirectory())rows.push(...fixtureFiles(join(folder,entry.name),path));
    else {require(entry.isFile(),`Unexpected fixture entry: ${path}`);rows.push(path);}
  }
  return rows.sort((a,b)=>a.localeCompare(b));
}
export function createRegressionFixture({root,project,sdkRoot,output,productionScene='scenes/original-race.scene.json',regressionScene='scenes/road-proof.scene.json',engineVersion}){
  root=resolve(root);project=resolve(project);output=resolve(output);sdkRoot=realpathSync(sdkRoot);
  require(existsSync(join(sdkRoot,'tools/cli/bin/gameengine.mjs')),'Fixture requires the same installed SDK used by preflight');
  const entries=inventory(root,project),original=readFileSync(join(project,CONFIG),'utf8'),config=JSON.parse(original);
  require(config.startScene===productionScene,`Production must start ${productionScene}; found ${config.startScene}`);
  require(entries.some(row=>row.path===regressionScene),'Legacy regression scene missing');
  const matches=[...original.matchAll(/("startScene"\s*:\s*)"(?:[^"\\]|\\.)*"/g)];
  require(matches.length===1,'Expected exactly one production startScene property');
  const fixtureText=original.replace(/("startScene"\s*:\s*)"(?:[^"\\]|\\.)*"/,(_match,prefix)=>prefix+JSON.stringify(regressionScene));
  require(isDeepStrictEqual(JSON.parse(fixtureText),{...config,startScene:regressionScene}),'Fixture may change only config.startScene');
  mkdirSync(output,{recursive:true});
  const owned=mkdtempSync(join(output,'regression-fixture-')),token=randomUUID(),marker=join(owned,'owner.json'),game=join(owned,basename(project));
  const report=join(output,'regression-fixture.json');
  const proof={token,ownerPid:process.pid,owned,source:project,fixture:game,sdkRoot,engineVersion,
    productionStartScene:productionScene,regressionStartScene:regressionScene,
    configSourceSha256:sha(original),configFixtureSha256:sha(fixtureText),
    candidateTreeSha256:sha(JSON.stringify(entries)),files:entries,soleConfigChange:'startScene',verified:false,cleaned:false};
  const persist=()=>writeFileSync(report,JSON.stringify(proof,null,2)+'\n');
  const cleanup=()=>{
    if(!existsSync(owned))return;
    const owner=JSON.parse(readFileSync(marker,'utf8'));
    require(owner.token===token&&owner.pid===process.pid,'Refuse to remove fixture without its exact owner marker');
    rmSync(owned,{recursive:true});proof.cleaned=true;persist();
  };
  writeFileSync(marker,JSON.stringify({token,pid:process.pid})+'\n');
  try{
    mkdirSync(game);
    for(const {path}of entries){const target=join(game,path);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(project,path),target);}
    writeFileSync(join(game,CONFIG),fixtureText);
    mkdirSync(join(game,'.gameengine'));symlinkSync(sdkRoot,join(game,'.gameengine/engine'),'junction');
    const verify=()=>{
      proof.verified=false;
      require(isDeepStrictEqual(inventory(root,project),entries),'Candidate project changed while regression fixture was running');
      require(isDeepStrictEqual(fixtureFiles(game),entries.map(row=>row.path)),'Fixture gained or lost candidate files');
      for(const {path,sha256}of entries){
        const expected=path===CONFIG?proof.configFixtureSha256:sha256;
        require(sha(readFileSync(join(game,path)))===expected,`Fixture candidate content changed: ${path}`);
      }
      require(realpathSync(join(game,'.gameengine/engine'))===sdkRoot,'Fixture SDK link changed');
      proof.verified=true;persist();
    };
    verify();
    const preserveEvidence=()=>{
      // Keep actual T1 captures/diffs for review even when a lane failed. Never
      // copy the SDK link, bundles, cooked cache or the full .gameengine tree.
      const from=join(game,'.gameengine/t1');
      if(!existsSync(from))return;
      const into=join(output,'regression-t1-'+token);
      for(const path of fixtureFiles(from)){const target=join(into,path);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(from,path),target);}
      proof.t1Artifacts=into;
    };
    return {project:game,provenance:proof,verify,dispose(){try{preserveEvidence();verify();proof.finalVerified=true;}catch(error){proof.error=error.message;throw error;}finally{cleanup();}}};
  }catch(error){proof.error=error.message;try{persist();}finally{cleanup();}throw error;}
}
