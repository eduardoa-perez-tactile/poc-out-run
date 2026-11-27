import {worldTest,expect} from '@gameengine/test';
import {pcg32} from '@gameengine/runtime';
import {loadSourceBiome,loadSourceBiomeCatalog,type SourceBiomeId} from '../../src/content/biome.ts';
import {originalRouteSources} from '../../src/content/route-boot.ts';
import {emptyRouteDriver,resetRouteDriver,advanceRouteState,sourceRouteCamera,sourceRouteTrafficZ,sourceRouteTransferZ,
  publishRoutePassAwards,type RouteContent,type RouteDriverState,type RouteRandom} from '../../src/sim/route-math.ts';

const SCENE={scene:'scenes/map01-data.scene.json'};
// Actual source-backed profiles are composed/primed by route-boot at module
// evaluation, before SIM. Every reducer lookup selects immutable real tail data.
function content():RouteContent {return originalRouteSources();}
function reject(fn:()=>unknown){let failed=false;try{fn();}catch{failed=true;}expect(failed).toBe(true);}
function random(){return pcg32(0,0,0,0);}
function initialized(id:SourceBiomeId=1):RouteDriverState {
  const entry=loadSourceBiomeCatalog().entries.find(value=>value.id===id)!;
  return {...emptyRouteDriver(),initialized:true,routeEpoch:1,mapEpoch:entry.stage,mapId:id,stage:entry.stage-1,
    entryCount:entry.stage,processedStep:1};
}
function exit(route:RouteDriverState,side:0|1,step:number,rng:RouteRandom=random()){
  const data=content().get(route.mapId as SourceBiomeId,route.gradient);
  return advanceRouteState(route,(data.lastLine+1)*150-702,side,true,content(),rng,step);
}

worldTest('routes.math source integer assignments retain fractional speed but never fractional longitudinal carry',()=>{
  for(const [speed,forward,retreat,npc] of [[.1,45000,44999,28100],[.9,45000,44999,28100],
    [1.1,45001,44999,28101],[19.230766,45019,44990,28119],[199.99998,45200,44900,28300]]){
    expect(sourceRouteCamera(45000,Math.fround(speed!),false,7000)).toBe(forward);
    expect(sourceRouteCamera(45000,Math.fround(speed!),true,7000)).toBe(retreat);
    if(speed!<=160)expect(sourceRouteTrafficZ(28100,Math.fround(speed!))).toBe(npc);
  }
  const q=Math.fround,dt=q(1/60);let speed=0,camera=45000;
  for(const expected of [45000,45000,45000,45001]){
    speed=q(speed+q(q(100/q(6.5))*dt));camera=sourceRouteCamera(camera,speed,false,7000);
    expect(camera).toBe(expected);
  }
  expect(sourceRouteCamera(0,.1,true,7000)).toBe(0);
  expect(sourceRouteCamera(7000*150-1,2.1,false,7000)).toBe(1);
  expect(sourceRouteCamera(881897,1.1,false,6083)).toBe(881898);
  expect(sourceRouteTransferZ(900001,881898)).toBe(18103);
},SCENE);

worldTest('routes.math source integer transfer preserves odd raw positions above f32 exact range',()=>{
  expect(sourceRouteTransferZ(16777217,0)).toBe(16777217);
  expect(sourceRouteTransferZ(16777217,1)).toBe(16777216);
  // C++ converts integer to FLOAT for movement, but INT subtraction at handoff
  // preserves the odd value when no movement occurred.
  expect(sourceRouteTrafficZ(16777217,1)).toBe(16777216);
  expect(sourceRouteCamera(16777217,0,false,200000)).toBe(16777217);
  reject(()=>sourceRouteTransferZ(2147483647,-1));reject(()=>sourceRouteTrafficZ(2147483647,160));
  reject(()=>sourceRouteCamera(0,NaN,false,6083));reject(()=>sourceRouteCamera(0,1,false,0));
},SCENE);

worldTest('routes.math real Map1 swap and exit use strict rows prior side and latched choice',()=>{
  const data=loadSourceBiome(1),rng=random(),c=content();let route=initialized();
  const atSwap=data.swapLine*150-702;
  let result=advanceRouteState(route,atSwap,0,true,c,rng,2);
  expect(result.events).toEqual([]);expect(result.route.choiceLatched).toBe(false);
  result=advanceRouteState(result.route,atSwap+150,1,true,c,rng,3);
  expect(result.route.nextMapId).toBe(3);expect(result.events.map(e=>e.kind)).toEqual(['choice']);
  route=advanceRouteState(result.route,45000,0,true,c,rng,4).route;
  expect(route.nextMapId).toBe(3);
  result=advanceRouteState(route,data.lastLine*150-702,0,true,c,rng,5);
  expect(result.entry).toBe(null);expect(result.route.mapId).toBe(1);
  result=advanceRouteState(result.route,(data.lastLine+1)*150-702,0,true,c,rng,6);
  expect(result.entry!.outgoingCamera).toBe(881898);expect(result.route.mapId).toBe(3);
  expect(result.route.camera).toBe(0);expect(result.route.previousCamera).toBe(0);
  expect(result.entry!.oldMapEpoch).toBe(1);expect(result.entry!.mapEpoch).toBe(2);
},SCENE);

worldTest('routes.math every real ORIGINAL graph edge selects destination source bounds',()=>{
  const c=content();let checked=0;
  for(const entry of c.catalog.entries){if(entry.terminal)continue;
    for(const side of [0,1] as const){
      const result=exit(initialized(entry.id as SourceBiomeId),side,2);
      expect(result.route.mapId).toBe(side===0?entry.links.left:entry.links.right);
      expect(result.route.stage).toBe(entry.stage);expect(result.route.mapEpoch).toBe(entry.stage+1);
      expect(result.route.gradient===-1||result.route.gradient===0||result.route.gradient===1).toBe(true);
      expect(result.route.camera).toBe(0);checked++;
    }
  }
  expect(checked).toBe(30);
},SCENE);

worldTest('routes.math native ROUT PCG pins five range calls forced fifth stage and unused goal draw',()=>{
  const native=random(),borrowed=native.state;let calls=0;
  const rng:RouteRandom={state:borrowed,range(lo,hi){expect(lo).toBe(-1);expect(hi).toBe(2);calls++;return native.range(lo,hi);}};
  let route=resetRouteDriver(emptyRouteDriver(),{seedLo:9,seedHi:2596069104},content(),rng,1).route;
  expect(rng.state===borrowed).toBe(true);expect(route.camera).toBe(45000);
  expect(route.gradient).toBe(-1);expect(Array.from(rng.state)).toEqual([3837470560,1857364149,2761861801,0]);
  const oracles=[
    {id:2,g:-1,state:[485308041,1722030321,2761861801,0]},
    {id:4,g:1,state:[3525064638,321547282,2761861801,0]},
    {id:7,g:0,state:[1825683727,2929452266,2761861801,0]},
    {id:11,g:1,state:[1825683727,2929452266,2761861801,0]},
    {id:16,g:-1,state:[4194673484,2545284565,2761861801,0]},
  ];
  for(let i=0;i<oracles.length;i++){
    const result=exit(route,0,i+2,rng),oracle=oracles[i]!;route=result.route;
    expect(route.mapId).toBe(oracle.id);expect(route.gradient).toBe(oracle.g);
    expect(Array.from(rng.state)).toEqual(oracle.state);
  }
  expect(calls).toBe(5);expect(route.rangeCalls).toBe(5);expect(route.entryCount).toBe(6);
  expect(route.goalEntered).toBe(true);expect(route.arrivalCount).toBe(1);expect(route.arrivalStep).toBe(6);
  const before=Array.from(rng.state),held=advanceRouteState(route,0,1,true,content(),rng,7);
  expect(held.route).toEqual(route);expect(held.events).toEqual([]);expect(Array.from(rng.state)).toEqual(before);
},SCENE);

worldTest('routes.math actual destination checkpoints latch exact integer seconds once and exclude start goal',()=>{
  for(const [id,bonus] of [[2,90],[3,85],[4,80],[7,77],[11,72]] as const){
    const data=loadSourceBiome(id),rng=random();let route=initialized(id);
    let result=advanceRouteState(route,data.checkpointLine*150-702,0,true,content(),rng,2);
    expect(result.route.checkpointCount).toBe(0);
    result=advanceRouteState(result.route,(data.checkpointLine+1)*150-702,0,true,content(),rng,3);
    expect(result.route.checkpointBonusSeconds).toBe(bonus);expect(result.route.checkpointStep).toBe(3);
    expect(result.route.checkpointCount).toBe(1);expect(result.events.map(e=>e.kind)).toEqual(['checkpoint']);
    route=advanceRouteState(result.route,10000,0,true,content(),rng,4).route;
    result=advanceRouteState(route,(data.checkpointLine+2)*150-702,0,true,content(),rng,5);
    expect(result.route.checkpointCount).toBe(1);expect(result.events).toEqual([]);
  }
  for(const id of [1,16] as const){
    const result=advanceRouteState(initialized(id),45000,0,true,content(),random(),2);
    expect(result.route.checkpointCount).toBe(0);expect(result.events).toEqual([]);
  }
},SCENE);

worldTest('routes.math pause duplicate step and full reset never introduce extra gradient draws',()=>{
  const native=random();let calls=0;const rng:RouteRandom={state:native.state,range(lo,hi){calls++;return native.range(lo,hi);}};
  const reset=resetRouteDriver(emptyRouteDriver(),{seedLo:9,seedHi:2596069104},content(),rng,1).route;
  const before=Array.from(rng.state),paused=advanceRouteState(reset,881898,1,false,content(),rng,2);
  expect(paused.route===reset).toBe(true);expect(Array.from(rng.state)).toEqual(before);expect(calls).toBe(1);
  const repeated=advanceRouteState(reset,45000,0,true,content(),rng,1);
  expect(repeated.events).toEqual([]);expect(calls).toBe(1);
  const fresh=resetRouteDriver(reset,{seedLo:9,seedHi:2596069104},content(),rng,3).route;
  expect(fresh.routeEpoch).toBe(2);expect(fresh.mapEpoch).toBe(1);expect(fresh.gradient).toBe(reset.gradient);
  expect(Array.from(rng.state)).toEqual(before);expect(fresh.rangeCalls).toBe(1);expect(calls).toBe(2);
  reject(()=>advanceRouteState(fresh,45000,2 as 0,false,content(),rng,4));
  reject(()=>advanceRouteState(fresh,45000,0,true,content(),rng,2));
},SCENE);

worldTest('routes.math pass producer latch retains outgoing epoch on goal entry and rejects duplicate batches',()=>{
  const goal=exit(initialized(11),0,2).route;
  const awarded=publishRoutePassAwards(goal,5,40000,2);
  expect(awarded.mapId).toBe(16);expect(awarded.arrivalStep).toBe(2);
  expect(awarded.passAwardCount).toBe(1);expect(awarded.passAwardStep).toBe(2);
  expect(awarded.passAwardAmount).toBe(40000);expect(awarded.passAwardOldMapEpoch).toBe(5);
  expect(publishRoutePassAwards(awarded,6,0,3)===awarded).toBe(true);
  reject(()=>publishRoutePassAwards(awarded,5,20000,2));reject(()=>publishRoutePassAwards(awarded,3,20000,3));
},SCENE);

worldTest('routes.math malformed selected content and integer overflow remain visible failures',()=>{
  const c=content(),rng=random();
  reject(()=>resetRouteDriver(emptyRouteDriver(),{seedLo:-1,seedHi:0},c,rng,1));
  reject(()=>resetRouteDriver({...emptyRouteDriver(),routeEpoch:0xffffffff},{seedLo:0,seedHi:0},c,rng,1));
  reject(()=>resetRouteDriver(emptyRouteDriver(),{seedLo:9,seedHi:2596069104},
    {...c,get(id){return loadSourceBiome(id);}},rng,1));
  reject(()=>advanceRouteState(initialized(),6083*150,0,true,c,rng,2));
  reject(()=>exit({...initialized(),mapEpoch:0xffffffff},0,2));
},SCENE);

worldTest('routes.math real source player offset wraps its row before choice exit and checkpoint checks',()=>{
  for(const id of [1,2,3,16] as const){
    const data=content().get(id,0),camera=data.totalCount*data.segmentLength-1;
    // Camera is still inside the real source array, but player offset702 has
    // crossed its end: source Map580 samples modulo, landing on row4.
    expect(Math.floor((camera+702)/150)%data.totalCount).toBe(4);
    const route=initialized(id),result=advanceRouteState(route,camera,1,true,content(),random(),2);
    expect(result.route.mapId).toBe(id);expect(result.route.choiceLatched).toBe(false);
    expect(result.route.checkpointCount).toBe(0);expect(result.route.arrivalCount).toBe(0);
    expect(result.entry).toBe(null);expect(result.events).toEqual([]);
  }
},SCENE);
