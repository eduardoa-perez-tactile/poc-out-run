import {DEV} from '@gameengine/runtime';
import type {CrashDriverValue,ContactAcceptedValue} from '../schema.gen.ts';

export interface CrashDiagnosticsInput {
  readonly step:number;readonly frame:number;readonly ready:boolean;readonly placeholder:boolean;
  readonly viewport:Readonly<{width:number;height:number}>;
  readonly driver:Readonly<{distance:number;previousDistance:number;lateral:number;previousLateral:number;legacySpeed:number;playing:boolean}>;
  readonly crash:Readonly<CrashDriverValue>;
  readonly collision:Readonly<{acceptedCount:number;locked:boolean;ledgerCount:number}>;
  readonly visual:Readonly<{pose:number;sample:number;sourceFrame:number;hidden:boolean;leftEffect:number;rightEffect:number}>;
  readonly contacts:readonly Readonly<ContactAcceptedValue>[];
}
export interface CrashDiagnosticsSnapshot extends CrashDiagnosticsInput {
  readonly version:1;readonly scope:'live-crash';
}
export interface CrashDiagnosticsAPI {snapshot():CrashDiagnosticsSnapshot|null;}
export interface CrashDiagnosticsMessage {readonly type:'outrun-crash-diagnostics';readonly version:1;readonly snapshot:CrashDiagnosticsSnapshot|null;}
export interface CrashDiagnosticsHost {
  parent?:CrashDiagnosticsHost;
  postMessage?:(message:CrashDiagnosticsMessage,targetOrigin:string)=>void;
  gameengineProbe?:{state?:unknown};
  outrunCrashProbe?:Readonly<CrashDiagnosticsAPI>;
}
const defaultHost=globalThis as unknown as CrashDiagnosticsHost;
let current:CrashDiagnosticsSnapshot|null=null;
let ownedAPI:Readonly<CrashDiagnosticsAPI>|null=null;
let currentHost:CrashDiagnosticsHost|null=null;
function parentTransport(host:CrashDiagnosticsHost):boolean {
  try{
    const parent=host.parent;
    return parent!==undefined&&parent!==host&&typeof parent.postMessage==='function'
      &&typeof parent.gameengineProbe?.state==='function';
  }catch(error){
    if(typeof error==='object'&&error!==null&&(error as {name?:unknown}).name==='SecurityError')return false;
    throw error;
  }
}
export function crashDiagnosticsEnabled(dev=DEV,host:CrashDiagnosticsHost=defaultHost):boolean {
  // The documented probe function is only an opt-in marker. Never call it or
  // reflect into the parent game/SDK realm; transport is strictly outbound.
  return (dev&&typeof host.gameengineProbe?.state==='function')||parentTransport(host);
}
function finite(value:number,name:string):number {
  if(!Number.isFinite(value))throw new Error(`Crash diagnostics ${name} must be finite`);
  return value;
}
function integer(value:number,name:string,max=0xffffffff):number {
  finite(value,name);if(!Number.isInteger(value)||value<0||value>max)throw new Error(`Crash diagnostics ${name} outside0..${max}`);
  return value;
}
/** Loading completion and source-art availability are separate observations. */
export function crashPlayerArtReady(enabled:boolean,loaded:boolean,placeholder:boolean,progress:number,failed:readonly string[]):boolean {
  return enabled&&loaded&&!placeholder&&progress>=1&&failed.length===0;
}
/** A bounded owned observation, never a world/input API or rasterization proof. */
export function buildCrashDiagnosticsSnapshot(input:CrashDiagnosticsInput):CrashDiagnosticsSnapshot {
  integer(input.step,'step');integer(input.frame,'frame');
  const {width,height}=input.viewport;finite(width,'viewport.width');finite(height,'viewport.height');
  if(width<=0||height<=0)throw new Error('Crash diagnostics viewport must be positive');
  for(const [name,value] of Object.entries(input.driver))if(typeof value==='number')finite(value,'driver.'+name);
  for(const [name,value] of Object.entries(input.crash))finite(value,'crash.'+name);
  for(const field of ['mapId','consumedAcceptedCount','pendingStep','kind','totalAdvances','cadenceTick'] as const)
    integer(input.crash[field],'crash.'+field);
  integer(input.crash.phase,'phase',3);integer(input.crash.variant,'variant',1);
  integer(input.crash.advances,'advances',32);integer(input.crash.reactionTick,'reactionTick',105);
  integer(input.collision.acceptedCount,'acceptedCount');integer(input.collision.ledgerCount,'ledgerCount',64);
  integer(input.visual.pose,'pose',22);integer(input.visual.sample,'sample');integer(input.visual.sourceFrame,'sourceFrame',148);
  if(input.visual.sourceFrame<1)throw new Error('Crash diagnostics source frame must be one-based');
  integer(input.visual.leftEffect,'leftEffect',5);integer(input.visual.rightEffect,'rightEffect',5);
  // SDK event views can contain previous and current rows. Recovery immunity
  // bounds this to two accepted contacts; never accumulate a game-side history.
  if(input.contacts.length>2)throw new Error('Crash diagnostics contact batch exceeds2');
  const contacts=input.contacts.map(contact=>{
    for(const [name,value] of Object.entries(contact))finite(value,'contact.'+name);
    integer(contact.kind,'contact.kind',2);if(contact.kind<1)throw new Error('Invalid diagnostic contact kind');
    return Object.freeze({...contact});
  });
  return Object.freeze({version:1,scope:'live-crash',step:input.step,frame:input.frame,ready:input.ready,placeholder:input.placeholder,
    viewport:Object.freeze({width,height}),driver:Object.freeze({...input.driver}),crash:Object.freeze({...input.crash}),
    collision:Object.freeze({...input.collision}),visual:Object.freeze({...input.visual}),contacts:Object.freeze(contacts)});
}
export function clearCrashDiagnostics(host:CrashDiagnosticsHost=defaultHost,_dev=DEV):void {
  const hadSnapshot=host.outrunCrashProbe!==undefined||(currentHost===host&&current!==null);
  current=null;currentHost=null;delete host.outrunCrashProbe;
  if(hadSnapshot&&parentTransport(host))host.parent!.postMessage!(Object.freeze({type:'outrun-crash-diagnostics',version:1,snapshot:null}),'*');
}
export function publishCrashDiagnostics(input:CrashDiagnosticsInput,dev=DEV,host:CrashDiagnosticsHost=defaultHost):CrashDiagnosticsSnapshot|null {
  // Native/release without an explicit probe returns before snapshot copies.
  if(!crashDiagnosticsEnabled(dev,host)){clearCrashDiagnostics(host,dev);return null;}
  current=buildCrashDiagnosticsSnapshot(input);
  if(ownedAPI===null)ownedAPI=Object.freeze({snapshot:()=>currentHost?.outrunCrashProbe===ownedAPI?current:null});
  currentHost=host;host.outrunCrashProbe=ownedAPI;
  if(parentTransport(host))host.parent!.postMessage!(Object.freeze({type:'outrun-crash-diagnostics',version:1,snapshot:current}),'*');
  return current;
}
