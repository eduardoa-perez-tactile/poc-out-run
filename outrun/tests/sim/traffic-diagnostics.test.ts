import {worldTest,expect} from '@gameengine/test';
import {createEmptyTrafficPool} from '../../src/sim/traffic-math.ts';
import {buildTrafficDiagnosticsSnapshot,trafficDiagnosticsEnabled,publishTrafficDiagnostics,clearTrafficDiagnostics,
  type TrafficDiagnosticsHost,type TrafficDiagnosticsInput,type TrafficDiagnosticsMessage} from '../../src/render/traffic-diagnostics.ts';

function sample():TrafficDiagnosticsInput{
  const pool=createEmptyTrafficPool();pool.initialized=true;pool.population=32;pool.epoch=3;
  pool.active[0]=1;pool.generation[0]=4;pool.motionTicks[0]=3;pool.z[0]=50000;
  pool.active[31]=1;pool.generation[31]=2;pool.side[31]=1;pool.z[31]=55000;
  const frame=new Uint8Array(32),fraction=new Float32Array(32),left=new Float32Array(32),right=new Float32Array(32),top=new Float32Array(32),bottom=new Float32Array(32);
  frame[0]=2;fraction[0]=.75;left[0]=-.5;right[0]=.5;top[0]=.5;bottom[0]=-.25;
  frame[31]=15; // Pose chosen but culled: no visible fraction/bounds.
  return{step:200,frame:800,viewport:{width:1280,height:720},ready:true,
    driver:{distance:45000,lateral:.25,legacySpeed:100,playing:true,playerZ:45702,roadSide:1},pool,stats:{visible:1},
    samples:{frame,fraction,left,right,top,bottom},passes:[{epoch:3,slot:31,generation:1,points:20000}]};
}
worldTest('traffic.diagnostics copies bounded live source IDs events and clipped viewport bounds without writes',()=>{
  const input=sample(),before=JSON.stringify(input),dto=buildTrafficDiagnosticsSnapshot(input);
  expect(JSON.stringify(input)).toBe(before);expect(dto.version).toBe(1);expect(dto.scope).toBe('live-traffic');
  expect(dto.mapId).toBe(1);expect(dto.epoch).toBe(3);expect(dto.driver.roadSide).toBe(1);expect(dto.step).toBe(200);expect(dto.frame).toBe(800);expect(dto.viewport).toEqual({width:1280,height:720});
  expect(dto.population).toBe(32);expect(dto.activeCount).toBe(2);expect(dto.visibleCount).toBe(1);expect(dto.cars.length).toBe(32);
  expect(dto.cars[0]).toEqual({slot:0,model:1,generation:4,side:0,active:true,parked:false,motionTicks:3,z:50000,relativeZ:4298,frame:2,
    boundsPx:{left:460,top:180,right:820,bottom:450}});
  expect(dto.cars[31]!.model).toBe(32);expect(dto.cars[31]!.side).toBe(1);expect(dto.cars[31]!.boundsPx).toBe(null);
  expect(dto.passes).toEqual([{epoch:3,slot:31,generation:1,points:20000}]);
  const crop=sample();(crop.samples.left as Float32Array)[0]=-4;(crop.samples.right as Float32Array)[0]=4;
  expect(buildTrafficDiagnosticsSnapshot(crop).cars[0]!.boundsPx).toEqual({left:0,top:180,right:1280,bottom:450});
});
worldTest('traffic.diagnostics owns and freezes every published nested value',()=>{
  const input=sample(),dto=buildTrafficDiagnosticsSnapshot(input),before=JSON.stringify(dto);
  for(const value of [dto,dto.viewport,dto.driver,dto.cars,dto.cars[0],dto.cars[0]!.boundsPx,dto.passes,dto.passes[0]])expect(Object.isFrozen(value)).toBe(true);
  input.pool.z[0]=999;(input.samples.left as Float32Array)[0]=9;
  (input.passes[0] as {points:number}).points=1;
  (input.viewport as {width:number}).width=1;(input.driver as {distance:number}).distance=1;
  try{(dto.cars[0] as unknown as {z:number}).z=0;}catch{/* Strict frozen write is expected. */}
  try{(dto.passes as unknown as unknown[]).push({});}catch{/* Frozen array cannot be extended. */}
  expect(JSON.stringify(dto)).toBe(before);
});
worldTest('traffic.diagnostics not-ready snapshots suppress stale renderer pose and bounds',()=>{
  const input=sample(),dto=buildTrafficDiagnosticsSnapshot({...input,ready:false});
  expect(dto.ready).toBe(false);expect(dto.visibleCount).toBe(0);expect(dto.activeCount).toBe(2);
  expect(dto.cars.every(car=>car.frame===0&&car.boundsPx===null)).toBe(true);
});
worldTest('traffic.diagnostics release native and absent-probe paths return before reading caller state',()=>{
  const publicProbe:TrafficDiagnosticsHost={gameengineProbe:{state:()=>({})}},native:TrafficDiagnosticsHost={};
  expect(trafficDiagnosticsEnabled(true,publicProbe)).toBe(true);expect(trafficDiagnosticsEnabled(false,publicProbe)).toBe(false);
  expect(trafficDiagnosticsEnabled(true,native)).toBe(false);expect(trafficDiagnosticsEnabled(true,{gameengineProbe:{state:4}})).toBe(false);
  const poison=new Proxy({} as TrafficDiagnosticsInput,{get(){throw new Error('Disabled telemetry copied caller data');}});
  expect(publishTrafficDiagnostics(poison,false,publicProbe)).toBe(null);expect(publishTrafficDiagnostics(poison,true,native)).toBe(null);
  expect(publicProbe.outrunTrafficProbe).toBe(undefined);expect(native.outrunTrafficProbe).toBe(undefined);
});
worldTest('traffic.diagnostics clears old handles and never accumulates event history',()=>{
  const host:TrafficDiagnosticsHost={gameengineProbe:{state:()=>({})}},first=publishTrafficDiagnostics(sample(),true,host)!;
  const handle=host.outrunTrafficProbe!;expect(Object.isFrozen(handle)).toBe(true);expect(handle.snapshot()).toBe(first);
  const second=publishTrafficDiagnostics({...sample(),passes:[]},true,host)!;
  expect(handle.snapshot()).toBe(second);expect(second.passes.length).toBe(0);expect(first.passes.length).toBe(1);
  delete host.outrunTrafficProbe;expect(handle.snapshot()).toBe(null);
  publishTrafficDiagnostics(sample(),true,host);
  clearTrafficDiagnostics(host);expect(handle.snapshot()).toBe(null);expect(host.outrunTrafficProbe).toBe(undefined);
  host.outrunTrafficProbe=Object.freeze({snapshot:()=>first}); // Stale previous publisher namespace.
  clearTrafficDiagnostics(host);expect(host.outrunTrafficProbe).toBe(undefined);
  publishTrafficDiagnostics(sample(),true,host);publishTrafficDiagnostics({} as TrafficDiagnosticsInput,false,host);
  expect(handle.snapshot()).toBe(null);expect(host.outrunTrafficProbe).toBe(undefined);
});
worldTest('traffic.diagnostics invalid numbers or overflow fail visibly instead of fabricating telemetry',()=>{
  const inputs=[{...sample(),viewport:{width:0,height:720}},
    {...sample(),driver:{...sample().driver,legacySpeed:NaN}},
    {...sample(),driver:{...sample().driver,roadSide:2}},
    {...sample(),pool:{...sample().pool,population:33}},
    {...sample(),passes:[{epoch:1,slot:32,generation:1,points:20000}]},
    {...sample(),passes:Array.from({length:65},()=>({epoch:1,slot:0,generation:1,points:20000}))}];
  for(const input of inputs){let failed=false;try{buildTrafficDiagnosticsSnapshot(input);}catch{failed=true;}expect(failed).toBe(true);}
});

worldTest('traffic.diagnostics iframe parent transport sends owned snapshots and one clear without inbound commands',()=>{
  const messages:{message:TrafficDiagnosticsMessage;origin:string}[]=[];
  const parent:TrafficDiagnosticsHost={postMessage:(message,origin)=>messages.push({message,origin})};
  const host:TrafficDiagnosticsHost={parent};
  expect(trafficDiagnosticsEnabled(true,host)).toBe(true);
  const input=sample(),before=JSON.stringify(input),dto=publishTrafficDiagnostics(input,true,host)!;
  expect(JSON.stringify(input)).toBe(before);expect(messages.length).toBe(1);
  expect(messages[0]!.origin).toBe('*');expect(messages[0]!.message.type).toBe('outrun-traffic-diagnostics');
  expect(messages[0]!.message.version).toBe(1);expect(messages[0]!.message.snapshot===dto).toBe(true);
  expect(Object.isFrozen(messages[0]!.message)).toBe(true);expect(Object.isFrozen(dto.viewport)).toBe(true);
  expect(host.outrunTrafficProbe!.snapshot()).toBe(dto);
  clearTrafficDiagnostics(host,true);expect(messages.length).toBe(2);expect(messages[1]!.message.snapshot).toBe(null);
  clearTrafficDiagnostics(host,true);expect(messages.length).toBe(2);
  expect(host.outrunTrafficProbe).toBe(undefined);
});
worldTest('traffic.diagnostics release and self-parent transports never copy or post messages',()=>{
  let posted=0;
  const parent:TrafficDiagnosticsHost={postMessage:()=>{posted++;}},host:TrafficDiagnosticsHost={parent};
  const self:TrafficDiagnosticsHost={postMessage:()=>{posted++;}};self.parent=self;
  const poison=new Proxy({} as TrafficDiagnosticsInput,{get(){throw new Error('Disabled transport copied caller state');}});
  expect(trafficDiagnosticsEnabled(false,host)).toBe(false);expect(trafficDiagnosticsEnabled(true,self)).toBe(false);
  expect(publishTrafficDiagnostics(poison,false,host)).toBe(null);expect(publishTrafficDiagnostics(poison,true,self)).toBe(null);
  clearTrafficDiagnostics(host,false);expect(posted).toBe(0);
  publishTrafficDiagnostics(sample(),true,host);expect(posted).toBe(1);
  publishTrafficDiagnostics(poison,false,host);expect(posted).toBe(1);expect(host.outrunTrafficProbe).toBe(undefined);
});
