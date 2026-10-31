import {worldTest,expect} from '@gameengine/test';
import {environmentDiagnosticsEnabled,publishEnvironmentDiagnostics,type ProbeHost} from '../../src/render/environment-diagnostics.ts';

worldTest('environment.diagnostics direct public probe publishes only caller-owned outbound values',()=>{
  let probeCalls=0;const messages:{message:unknown;origin:string;receiver:unknown}[]=[];
  const host:ProbeHost={gameengineProbe:{state:()=>{probeCalls++;return {}; }},postMessage(message,origin){messages.push({message,origin,receiver:this});}};
  host.parent=host;
  const snapshot=Object.freeze({scope:'environment-art',mapId:10,viewport:Object.freeze({width:1280,height:720}),ready:true});
  const before=JSON.stringify(snapshot);
  expect(environmentDiagnosticsEnabled(host)).toBe(true);publishEnvironmentDiagnostics(snapshot,host);
  expect(probeCalls).toBe(0);expect(messages.length).toBe(1);expect(messages[0]!.receiver===host).toBe(true);
  expect(messages[0]!.origin).toBe('*');
  const envelope=messages[0]!.message as {type:string;version:number;snapshot:unknown};
  expect(envelope.type).toBe('outrun-environment-diagnostics');expect(envelope.version).toBe(1);
  expect(envelope.snapshot===snapshot).toBe(true);expect(Object.isFrozen(envelope)).toBe(true);
  expect(JSON.stringify(snapshot)).toBe(before);
});

worldTest('environment.diagnostics parent transport uses only public API presence without invoking it',()=>{
  let childMessages=0,parentMessages=0,probeCalls=0;
  const snapshot=Object.freeze({scope:'environment-art',mapId:2});let observed:unknown=null;
  const parent:ProbeHost={gameengineProbe:{state:()=>{probeCalls++;throw new Error('Must not call public probe across realm');}},postMessage(message,origin){parentMessages++;observed=message;expect(origin).toBe('*');expect(this===parent).toBe(true);}};
  const child:ProbeHost={parent,postMessage(){childMessages++;}};
  expect(environmentDiagnosticsEnabled(child)).toBe(true);publishEnvironmentDiagnostics(snapshot,child);
  expect(parentMessages).toBe(1);expect(childMessages).toBe(0);expect(probeCalls).toBe(0);
  expect((observed as {snapshot:unknown}).snapshot===snapshot).toBe(true);
});

worldTest('environment.diagnostics absent or incomplete public APIs never publish',()=>{
  let messages=0;
  const hosts:ProbeHost[]=[{}, {gameengineProbe:{state:()=>({})}}, {postMessage(){messages++;}},
    {gameengineProbe:{state:42},postMessage(){messages++;}},
    {parent:{gameengineProbe:{state:()=>({})}}},
    {parent:{postMessage(){messages++;}},gameengineProbe:{state:()=>({})},postMessage(){messages++;}}];
  for(const host of hosts){expect(environmentDiagnosticsEnabled(host)).toBe(false);publishEnvironmentDiagnostics(Object.freeze({mapId:2}),host);}
  expect(messages).toBe(0);
});

worldTest('environment.diagnostics cross-origin SecurityError alone disables transport safely',()=>{
  const denied=Object.assign(new Error('Blocked cross-origin public parent property'),{name:'SecurityError'});
  const host:ProbeHost={get parent():ProbeHost{throw denied;}};
  expect(environmentDiagnosticsEnabled(host)).toBe(false);publishEnvironmentDiagnostics(Object.freeze({mapId:2}),host);
  const parent:ProbeHost={get gameengineProbe():NonNullable<ProbeHost['gameengineProbe']>{throw denied;}};
  expect(environmentDiagnosticsEnabled({parent})).toBe(false);publishEnvironmentDiagnostics(Object.freeze({mapId:2}),{parent});
});

worldTest('environment.diagnostics unexpected TypeError access and transport failures remain visible',()=>{
  const failure=new TypeError('Unexpected diagnostics implementation defect');
  const host:ProbeHost={get parent():ProbeHost{throw failure;}};
  for(const operation of [()=>environmentDiagnosticsEnabled(host),()=>publishEnvironmentDiagnostics(Object.freeze({mapId:2}),host)]){
    let caught:unknown;try{operation();}catch(error){caught=error;}expect(caught===failure).toBe(true);
  }
  const brokenSend:ProbeHost={gameengineProbe:{state:()=>({})},postMessage(){throw failure;}};
  expect(environmentDiagnosticsEnabled(brokenSend)).toBe(true);
  let caught:unknown;try{publishEnvironmentDiagnostics(Object.freeze({mapId:2}),brokenSend);}catch(error){caught=error;}
  expect(caught===failure).toBe(true);
});
