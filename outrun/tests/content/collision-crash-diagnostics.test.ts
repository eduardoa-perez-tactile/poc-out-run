import {worldTest,expect} from '@gameengine/test';
import {resetCrashRecovery} from '../../src/sim/crash-recovery-math.ts';
import {buildCrashDiagnosticsSnapshot,crashDiagnosticsEnabled,publishCrashDiagnostics,clearCrashDiagnostics,crashPlayerArtReady,
  type CrashDiagnosticsInput,type CrashDiagnosticsHost,type CrashDiagnosticsMessage} from '../../src/render/crash-diagnostics.ts';

function sample():CrashDiagnosticsInput{
  return {step:200,frame:800,ready:true,placeholder:false,viewport:{width:1280,height:720},
    driver:{distance:45000,previousDistance:45000,lateral:.2,previousLateral:.2,legacySpeed:0,playing:true},
    crash:{...resetCrashRecovery(),phase:2,variant:1,kind:2,consumedAcceptedCount:1,impactSpeed:120,handlingCap:200,totalAdvances:24,advances:24,decrement:5,reactionTick:70},
    collision:{acceptedCount:1,locked:true,ledgerCount:1},
    visual:{pose:21,sample:0,sourceFrame:142,hidden:false,leftEffect:0,rightEffect:0},
    contacts:[{kind:2,mapId:1,id:31,epoch:7,generation:3,slot:31,toi:.5,stage:0,playerX:320,playerZ:45702,otherX:300,otherZ:45740,
      impactSpeed:120,handlingCap:200,collisionDir:.2,curve:0}]};
}
const disabledInput=()=>new Proxy({} as CrashDiagnosticsInput,{get(){throw new Error('Disabled crash telemetry read caller state');}});
worldTest('collision.presentation.diagnostics copies current physical recovery source frame and bounded contact batches',()=>{
  const input=sample(),before=JSON.stringify(input),dto=buildCrashDiagnosticsSnapshot(input);
  expect(JSON.stringify(input)).toBe(before);expect(dto.version).toBe(1);expect(dto.scope).toBe('live-crash');
  expect(dto.step).toBe(200);expect(dto.frame).toBe(800);expect(dto.ready).toBe(true);expect(dto.placeholder).toBe(false);
  expect(dto.viewport).toEqual({width:1280,height:720});expect(dto.driver).toEqual(input.driver);expect(dto.crash).toEqual(input.crash);
  expect(dto.collision).toEqual({acceptedCount:1,locked:true,ledgerCount:1});
  expect(dto.visual).toEqual({pose:21,sample:0,sourceFrame:142,hidden:false,leftEffect:0,rightEffect:0});
  expect(dto.contacts).toEqual(input.contacts);
  const two=buildCrashDiagnosticsSnapshot({...sample(),contacts:[...input.contacts,...input.contacts]});expect(two.contacts.length).toBe(2);
  const next=buildCrashDiagnosticsSnapshot({...sample(),contacts:[],ready:false,placeholder:true});
  expect(next.contacts.length).toBe(0);expect(dto.contacts.length).toBe(1);expect(next.ready).toBe(false);expect(next.placeholder).toBe(true);
});
worldTest('collision.presentation.diagnostics freezes owned nested records and never retains caller fields or contact arrays',()=>{
  const input=sample(),dto=buildCrashDiagnosticsSnapshot(input),before=JSON.stringify(dto);
  for(const value of [dto,dto.viewport,dto.driver,dto.crash,dto.collision,dto.visual,dto.contacts,dto.contacts[0]])expect(Object.isFrozen(value)).toBe(true);
  (input.viewport as {width:number}).width=1;(input.driver as {distance:number}).distance=1;
  (input.crash as {reactionTick:number}).reactionTick=1;(input.collision as {acceptedCount:number}).acceptedCount=1e6;
  (input.visual as {sourceFrame:number}).sourceFrame=1;(input.contacts[0] as {generation:number}).generation=99;
  (input.contacts as unknown as unknown[]).push({});
  try{(dto.visual as {sourceFrame:number}).sourceFrame=1;}catch{/* Frozen DTO cannot change the current observation. */}
  try{(dto.contacts as unknown as unknown[]).pop();}catch{/* Frozen contact array is owned. */}
  expect(JSON.stringify(dto)).toBe(before);
});
worldTest('collision.presentation.diagnostics native release absent and self-parent probes return before reading input',()=>{
  const native:CrashDiagnosticsHost={},local:CrashDiagnosticsHost={gameengineProbe:{state:()=>{throw new Error('Must not call local SDK probe');}}};
  expect(crashDiagnosticsEnabled(true,native)).toBe(false);expect(crashDiagnosticsEnabled(false,local)).toBe(false);
  expect(publishCrashDiagnostics(disabledInput(),true,native)).toBe(null);expect(publishCrashDiagnostics(disabledInput(),false,local)).toBe(null);
  expect(native.outrunCrashProbe).toBe(undefined);expect(local.outrunCrashProbe).toBe(undefined);
  const self:CrashDiagnosticsHost={postMessage:()=>{throw new Error('Self-parent transport posted');}};self.parent=self;
  expect(crashDiagnosticsEnabled(true,self)).toBe(false);expect(publishCrashDiagnostics(disabledInput(),true,self)).toBe(null);
  expect(crashDiagnosticsEnabled(true,local)).toBe(true);expect(publishCrashDiagnostics(sample(),true,local)!.visual.sourceFrame).toBe(142);
  clearCrashDiagnostics(local);
});
worldTest('collision.presentation.diagnostics cooked parent probe sends only one-way owned messages without SDK calls',()=>{
  const messages:{message:CrashDiagnosticsMessage;origin:string}[]=[];
  const parent:CrashDiagnosticsHost={gameengineProbe:{state:()=>{throw new Error('Must not invoke parent SDK probe');}},postMessage:(message,origin)=>messages.push({message,origin})};
  const host:CrashDiagnosticsHost={parent},input=sample(),before=JSON.stringify(input);
  expect(crashDiagnosticsEnabled(false,host)).toBe(true);
  const dto=publishCrashDiagnostics(input,false,host)!;
  expect(JSON.stringify(input)).toBe(before);expect(messages.length).toBe(1);
  expect(messages[0]!.origin).toBe('*');expect(messages[0]!.message.type).toBe('outrun-crash-diagnostics');expect(messages[0]!.message.version).toBe(1);
  expect(messages[0]!.message.snapshot===dto).toBe(true);expect(Object.isFrozen(messages[0]!.message)).toBe(true);expect(host.outrunCrashProbe!.snapshot()).toBe(dto);
  clearCrashDiagnostics(host,false);expect(messages.length).toBe(2);expect(messages[1]!.message.snapshot).toBe(null);
  clearCrashDiagnostics(host,false);expect(messages.length).toBe(2);expect(host.outrunCrashProbe).toBe(undefined);
});
worldTest('collision.presentation.diagnostics release iframe without public parent probe cannot copy or post',()=>{
  let posted=0;const parent:CrashDiagnosticsHost={postMessage:()=>{posted++;}},host:CrashDiagnosticsHost={parent};
  expect(crashDiagnosticsEnabled(false,host)).toBe(false);expect(crashDiagnosticsEnabled(true,host)).toBe(false);
  expect(publishCrashDiagnostics(disabledInput(),false,host)).toBe(null);expect(posted).toBe(0);
  parent.gameengineProbe={state:4};expect(crashDiagnosticsEnabled(false,host)).toBe(false);
  parent.gameengineProbe={state:()=>({})};publishCrashDiagnostics(sample(),false,host);expect(posted).toBe(1);
  delete parent.gameengineProbe;expect(publishCrashDiagnostics(disabledInput(),false,host)).toBe(null);
  expect(posted).toBe(1);expect(host.outrunCrashProbe).toBe(undefined);
});
worldTest('collision.presentation.diagnostics SecurityError disables transport while unexpected errors remain visible',()=>{
  let posted=0;const parent:CrashDiagnosticsHost={postMessage:()=>{posted++;}};
  Object.defineProperty(parent,'gameengineProbe',{get(){const error=new Error('Cross-origin probe');error.name='SecurityError';throw error;}});
  const host:CrashDiagnosticsHost={parent};
  expect(crashDiagnosticsEnabled(false,host)).toBe(false);expect(publishCrashDiagnostics(disabledInput(),false,host)).toBe(null);expect(posted).toBe(0);
  const unavailable:CrashDiagnosticsHost={};Object.defineProperty(unavailable,'parent',{get(){const error=new Error('Cross-origin parent');error.name='SecurityError';throw error;}});
  expect(crashDiagnosticsEnabled(true,unavailable)).toBe(false);expect(publishCrashDiagnostics(disabledInput(),true,unavailable)).toBe(null);
  const broken:CrashDiagnosticsHost={};Object.defineProperty(broken,'parent',{get(){throw new Error('Unexpected transport error');}});
  let error='';try{crashDiagnosticsEnabled(false,broken);}catch(caught){error=(caught as Error).message;}
  expect(error).toBe('Unexpected transport error');
});
worldTest('collision.presentation.diagnostics clears stale hot-reload namespaces and does not accumulate contact history',()=>{
  const host:CrashDiagnosticsHost={gameengineProbe:{state:()=>({})}},first=publishCrashDiagnostics(sample(),true,host)!,handle=host.outrunCrashProbe!;
  expect(Object.isFrozen(handle)).toBe(true);expect(handle.snapshot()).toBe(first);
  const second=publishCrashDiagnostics({...sample(),contacts:[]},true,host)!;
  expect(handle.snapshot()).toBe(second);expect(second.contacts.length).toBe(0);expect(first.contacts.length).toBe(1);
  delete host.outrunCrashProbe;expect(handle.snapshot()).toBe(null);
  publishCrashDiagnostics(sample(),true,host);clearCrashDiagnostics(host);expect(handle.snapshot()).toBe(null);
  host.outrunCrashProbe=Object.freeze({snapshot:()=>first});clearCrashDiagnostics(host);expect(host.outrunCrashProbe).toBe(undefined);
  publishCrashDiagnostics(sample(),true,host);publishCrashDiagnostics(disabledInput(),false,host);
  expect(handle.snapshot()).toBe(null);expect(host.outrunCrashProbe).toBe(undefined);
});
worldTest('collision.presentation.diagnostics invalid viewport source identity and event overflow fail visibly',()=>{
  const inputs:CrashDiagnosticsInput[]=[
    {...sample(),viewport:{width:0,height:720}},{...sample(),viewport:{width:1280,height:NaN}},
    {...sample(),driver:{...sample().driver,distance:Infinity}},
    {...sample(),crash:{...sample().crash,phase:4}},{...sample(),crash:{...sample().crash,variant:2}},
    {...sample(),crash:{...sample().crash,advances:33}},{...sample(),crash:{...sample().crash,reactionTick:106}},
    {...sample(),collision:{...sample().collision,ledgerCount:65}},
    {...sample(),visual:{...sample().visual,sourceFrame:0}},{...sample(),visual:{...sample().visual,sourceFrame:149}},
    {...sample(),visual:{...sample().visual,leftEffect:6}},
    {...sample(),contacts:Array(3).fill(sample().contacts[0]!)},
    {...sample(),contacts:[{...sample().contacts[0]!,playerX:NaN}]},
  ];
  for(const input of inputs){let failed=false;try{buildCrashDiagnosticsSnapshot(input);}catch{failed=true;}expect(failed).toBe(true);}
});
worldTest('collision.presentation.diagnostics persisted SIM counters cannot publish fractional or negative identities',()=>{
  for(const crash of [{...sample().crash,cadenceTick:-1},{...sample().crash,consumedAcceptedCount:.5},{...sample().crash,totalAdvances:1.5},{...sample().crash,pendingStep:-1}]){
    let failed=false;try{buildCrashDiagnosticsSnapshot({...sample(),crash});}catch{failed=true;}expect(failed).toBe(true);
  }
});
worldTest('collision.presentation.diagnostics completed loading with failed source art is not ready',()=>{
  expect(crashPlayerArtReady(true,true,false,1,[])).toBe(true);
  // Actual missing-atlas observation: group statusloaded/progress1 still had
  // failedtextures/player-ferrari1 and no resident source texture.
  const failed=Object.freeze(['textures/player-ferrari1']);
  expect(crashPlayerArtReady(true,true,false,1,failed)).toBe(false);
  expect(failed).toEqual(['textures/player-ferrari1']);
  expect(crashPlayerArtReady(true,true,false,.5,[])).toBe(false);
  expect(crashPlayerArtReady(false,true,false,1,[])).toBe(false);
  expect(crashPlayerArtReady(true,false,false,1,[])).toBe(false);
  expect(crashPlayerArtReady(true,true,true,1,[])).toBe(false);
});
