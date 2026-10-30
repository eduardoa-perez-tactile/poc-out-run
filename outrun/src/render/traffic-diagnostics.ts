import {DEV} from '@gameengine/runtime';
import type {TrafficPoolValue,TrafficPassedValue} from '../schema.gen.ts';

export interface TrafficDiagnosticsInput {
  readonly step:number;readonly frame:number;readonly viewport:{readonly width:number;readonly height:number};readonly ready:boolean;
  readonly driver:{readonly distance:number;readonly lateral:number;readonly legacySpeed:number;readonly playing:boolean;readonly playerZ:number;readonly roadSide:number};
  readonly pool:Readonly<TrafficPoolValue>;
  readonly stats:{readonly visible:number};
  readonly samples:{readonly frame:ArrayLike<number>;readonly fraction:ArrayLike<number>;readonly left:ArrayLike<number>;
    readonly right:ArrayLike<number>;readonly bottom:ArrayLike<number>;readonly top:ArrayLike<number>};
  readonly passes:readonly TrafficPassedValue[];
}
export interface TrafficDiagnosticCar {
  readonly slot:number;readonly model:number;readonly generation:number;readonly side:number;readonly active:boolean;readonly parked:boolean;
  readonly motionTicks:number;readonly z:number;readonly relativeZ:number;readonly frame:number;
  readonly boundsPx:Readonly<{left:number;top:number;right:number;bottom:number}>|null;
}
export interface TrafficDiagnosticsSnapshot {
  readonly version:1;readonly scope:'live-traffic';readonly mapId:number;readonly epoch:number;readonly step:number;readonly frame:number;readonly ready:boolean;
  readonly viewport:Readonly<{width:number;height:number}>;readonly driver:TrafficDiagnosticsInput['driver'];
  readonly population:number;readonly activeCount:number;readonly visibleCount:number;
  readonly cars:readonly TrafficDiagnosticCar[];readonly passes:readonly Readonly<TrafficPassedValue>[];
}
export interface TrafficDiagnosticsAPI {snapshot():TrafficDiagnosticsSnapshot|null;}
export interface TrafficDiagnosticsMessage {readonly type:'outrun-traffic-diagnostics';readonly version:1;readonly snapshot:TrafficDiagnosticsSnapshot|null;}
export interface TrafficDiagnosticsHost {
  parent?:TrafficDiagnosticsHost;postMessage?:(message:TrafficDiagnosticsMessage,targetOrigin:string)=>void;
  gameengineProbe?:{state?:unknown};outrunTrafficProbe?:Readonly<TrafficDiagnosticsAPI>;
}
const defaultHost=globalThis as unknown as TrafficDiagnosticsHost;
let current:TrafficDiagnosticsSnapshot|null=null;
let ownedAPI:Readonly<TrafficDiagnosticsAPI>|null=null;
let currentHost:TrafficDiagnosticsHost|null=null;
function finite(value:number,name:string){if(!Number.isFinite(value))throw new Error(`Traffic diagnostics ${name} must be finite`);return value;}
function integer(value:number,name:string){finite(value,name);if(!Number.isInteger(value)||value<0)throw new Error(`Traffic diagnostics ${name} must be a nonnegative integer`);return value;}
function bounded(value:number,name:string,max:number){integer(value,name);if(value>max)throw new Error(`Traffic diagnostics ${name} exceeds${max}`);return value;}
function side(value:number,name:string):0|1{if(value!==0&&value!==1)throw new Error(`Traffic diagnostics ${name} must be0or1`);return value;}
function parentTransport(host:TrafficDiagnosticsHost):boolean{
  // A cross-origin WindowProxy permits postMessage but can reject probe access.
  // Unavailable public telemetry must disable this helper, never interrupt gameplay.
  try{
    const parent=host.parent;
    return parent!==undefined&&parent!==host&&typeof parent.postMessage==='function'
      &&typeof parent.gameengineProbe?.state==='function';
  }catch(error){
    if(typeof error==='object'&&error!==null&&(error as {name?:unknown}).name==='SecurityError')return false;
    throw error;
  }
}
export function trafficDiagnosticsEnabled(dev=DEV,host:TrafficDiagnosticsHost=defaultHost):boolean{
  // Cooked game bundles set DEV=false even when the outer player is a probe build.
  // Inspect only the documented public function's presence; never call into its realm.
  return (dev&&typeof host.gameengineProbe?.state==='function')||parentTransport(host);
}

// Pure owned snapshot. View bounds describe the clipped image quad, never a
// collider or guaranteed opaque silhouette. No input/typed-array view escapes.
export function buildTrafficDiagnosticsSnapshot(input:TrafficDiagnosticsInput):TrafficDiagnosticsSnapshot{
  const width=finite(input.viewport.width,'viewport.width'),height=finite(input.viewport.height,'viewport.height');
  if(width<=0||height<=0)throw new Error('Traffic diagnostics viewport must be positive');
  const pool=input.pool,population=integer(pool.population,'population');
  if(![9,20,32].includes(population))throw new Error('Traffic diagnostics population must be9/20/32');
  const driver=Object.freeze({distance:finite(input.driver.distance,'distance'),lateral:finite(input.driver.lateral,'lateral'),
    legacySpeed:finite(input.driver.legacySpeed,'legacySpeed'),playing:input.driver.playing,playerZ:finite(input.driver.playerZ,'playerZ'),roadSide:side(input.driver.roadSide,'driver.roadSide')});
  const aspect=width/height,cars:TrafficDiagnosticCar[]=[];
  let activeCount=0,visibleCount=0;
  for(let slot=0;slot<population;slot++){
    const active=side(pool.active[slot]!,'car.active')===1,parked=side(pool.parked[slot]!,'car.parked')===1,z=finite(pool.z[slot]!,'car.z');
    if(active)activeCount++;
    const frame=input.ready?bounded(input.samples.frame[slot]!,'car.frame',16):0;
    let boundsPx:TrafficDiagnosticCar['boundsPx']=null;
    if(input.ready&&active&&!parked&&frame>0&&finite(input.samples.fraction[slot]!,'car.fraction')>0){
      const clampX=(x:number)=>Math.max(0,Math.min(width,x)),clampY=(y:number)=>Math.max(0,Math.min(height,y));
      const left=clampX((finite(input.samples.left[slot]!,'car.left')/aspect+1)*width/2);
      const right=clampX((finite(input.samples.right[slot]!,'car.right')/aspect+1)*width/2);
      const top=clampY((1-finite(input.samples.top[slot]!,'car.top'))*height/2);
      const bottom=clampY((1-finite(input.samples.bottom[slot]!,'car.bottom'))*height/2);
      if(right>left&&bottom>top){boundsPx=Object.freeze({left,top,right,bottom});visibleCount++;}
    }
    cars.push(Object.freeze({slot,model:slot+1,generation:integer(pool.generation[slot]!,'car.generation'),side:side(pool.side[slot]!,'car.side'),
      active,parked,motionTicks:bounded(pool.motionTicks[slot]!,'car.motionTicks',5),z,relativeZ:finite(z-driver.playerZ,'car.relativeZ'),frame,boundsPx}));
  }
  if(input.ready&&visibleCount!==integer(input.stats.visible,'visibleCount'))throw new Error('Traffic diagnostic visible samples disagree with renderer count');
  // The SDK may supply previous+current event rows: at most two32-slot batches.
  // Expose only this supplied batch, never accumulate history or silently drop it.
  if(input.passes.length>64)throw new Error('Traffic diagnostic event batch exceeds64');
  const passes=input.passes.map(pass=>{
    const slot=integer(pass.slot,'pass.slot');if(slot>=32)throw new Error('Traffic diagnostic pass slot exceeds31');
    return Object.freeze({epoch:integer(pass.epoch,'pass.epoch'),slot,generation:integer(pass.generation,'pass.generation'),points:finite(pass.points,'pass.points')});
  });
  return Object.freeze({version:1,scope:'live-traffic',mapId:integer(pool.mapId,'mapId'),epoch:integer(pool.epoch,'epoch'),step:integer(input.step,'step'),frame:integer(input.frame,'frame'),ready:input.ready,
    viewport:Object.freeze({width,height}),driver,population,activeCount,visibleCount,cars:Object.freeze(cars),passes:Object.freeze(passes)});
}

export function clearTrafficDiagnostics(host:TrafficDiagnosticsHost=defaultHost,_dev=DEV):void{
  const hadSnapshot=host.outrunTrafficProbe!==undefined||(currentHost===host&&current!==null);
  current=null;
  currentHost=null;
  // This project owns this namespace, including a handle left by a hot reload.
  delete host.outrunTrafficProbe;
  if(hadSnapshot&&parentTransport(host))host.parent!.postMessage!(Object.freeze({type:'outrun-traffic-diagnostics',version:1,snapshot:null}),'*');
}
export function publishTrafficDiagnostics(input:TrafficDiagnosticsInput,dev=DEV,host:TrafficDiagnosticsHost=defaultHost):TrafficDiagnosticsSnapshot|null{
  // Browser game scripts have their own iframe realm. This is one-way project
  // telemetry only: no inbound listener, SDK edits or parent-world reflection.
  // Native/release players without a public probe return before any snapshot/API copy.
  if(!trafficDiagnosticsEnabled(dev,host)){clearTrafficDiagnostics(host,dev);return null;}
  current=buildTrafficDiagnosticsSnapshot(input);
  if(ownedAPI===null)ownedAPI=Object.freeze({snapshot:()=>currentHost?.outrunTrafficProbe===ownedAPI?current:null});
  currentHost=host;host.outrunTrafficProbe=ownedAPI;
  if(parentTransport(host))host.parent!.postMessage!(Object.freeze({type:'outrun-traffic-diagnostics',version:1,snapshot:current}),'*');
  return current;
}
