import {worldTest,expect,type WorldTestContext} from '@gameengine/test';
import {EnterScene,math,Time} from '@gameengine/runtime';
import {DrivingState,DrivingPauseRequested,DrivingResetRequested,TrafficResetRequested,TrafficPool,TrafficPassed,TerrainDriver,
  type TrafficPoolValue,type DrivingStateValue,type ReadonlySourceBiomeData} from '../../src/schema.gen.ts';
import {loadMap01,sourcePlayerSample} from '../../src/content/biome.ts';
import {trafficLogicalX} from '../../src/sim/traffic-math.ts';

const f=math.fround,DT=f(1/60),STEP=f(f(.3)*DT),SLOTS=[26,30] as const;
const BOUNDARIES=[
  [1387,3200,3192],[4123,22,90],[4169,3150,3218],[4284,10970,11038],
  [4482,24434,24502],[4783,24502,24428],[5070,3264,3190],[5782,3,2],[5883,2,2],
] as const;
function check(ok:boolean,message:string):asserts ok{if(!ok)throw new Error(message);}
function index(z:number,data:ReadonlySourceBiomeData){return Math.floor(f(z)/data.segmentLength);}
function playerZ(state:DrivingStateValue,data:ReadonlySourceBiomeData){return f(f(state.distance)+data.playerOffsetZ);}
function originalRows(data:ReadonlySourceBiomeData){
  expect([data.id,data.segmentLength,data.authoredCount,data.totalCount,data.swapLine,data.lastLine]).toEqual([1,150,4123,6083,4284,5883]);
  for(const [row,before,after] of BOUNDARIES){expect(data.segments[row-1]!.gap).toBe(before);expect(data.segments[row]!.gap).toBe(after);}
  expect(data.segments[4122]!.mirror).toBe(false);expect(data.segments[4123]!.mirror).toBe(true);
  expect(data.segments[4782]!.mirror).toBe(true);expect(data.segments[4783]!.mirror).toBe(false);
}
function bounded(pool:TrafficPoolValue,data:ReadonlySourceBiomeData){
  check(pool.mapId===1&&pool.population===32,'Expected the single real Map1 population32');
  for(let slot=0;slot<32;slot++){
    for(const name of ['z','previousZ','offset','previousOffset','speed','target','cooldown'] as const)check(Number.isFinite(pool[name][slot]),`Nonfinite ${name}/${slot}`);
    check(pool.z[slot]!>=0&&pool.z[slot]!<=data.lastLine*150,`Traffic left bounded section/${slot}`);
    check(pool.speed[slot]!>=0&&pool.speed[slot]!<=160,`Invalid speed/${slot}`);
    check(Math.abs(f(pool.offset[slot]!))<=f(6*f(.15)),`Invalid source spawn lane/${slot}`);
    check(Math.abs(f(pool.target[slot]!))<=f(.9),`Invalid AI target/${slot}`);
    check(pool.ai[slot]!>=1&&pool.ai[slot]!<=3,`Missing selected AI/${slot}`);
    check(pool.side[slot]===0||pool.side[slot]===1,`Invalid arm/${slot}`);
    check(pool.cooldown[slot]!>=0&&pool.cooldown[slot]!<=200,`Invalid evasive cooldown/${slot}`);
  }
}
async function setup(ctx:WorldTestContext,originZ:number,camera:number,arm:0|1,speed=180){
  const {world,input,step}=ctx;
  input.view(1280,720,1);
  input.emit(EnterScene,{scene:'scenes/driving-traffic.scene.json',release:''});await step(2);
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  const data=loadMap01();originalRows(data);
  const center=arm===1?f(sourcePlayerSample(data,camera).gap/1600):0;
  input.emit(DrivingResetRequested,{manual:false,legacySpeed:speed,distance:camera,lateral:f(center+(arm===1?.2:-.2))});
  input.emit(TrafficResetRequested,{mapId:1,population:32,seedLo:9,seedHi:2596069104,originZ});
  // Driver reset resumes driving by design; prepare both owners under a recorded
  // pause in the same tick, then resume only after the initial snapshots.
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  await step(2);expect(world.resource(DrivingState).playing).toBe(false);
  expect(world.count(TrafficPool)).toBe(1);expect(world.count(TerrainDriver)).toBe(1);
  const owner=world.entities(TrafficPool)[0]!,driver=world.entities(TerrainDriver)[0]!,pool=world.get(owner,TrafficPool);
  bounded(pool,data);expect(pool.z[26]).toBe(originZ+75000);expect(pool.z[30]).toBe(originZ+75000);
  expect(pool.side[26]).toBe(1);expect(pool.side[30]).toBe(0);expect(world.events(TrafficPassed).length).toBe(0);
  input.emit(DrivingPauseRequested,{paused:false});await step(1);
  const active=world.get(owner,TrafficPool);
  for(const slot of SLOTS){expect(active.active[slot]).toBe(1);expect(active.parked[slot]).toBe(0);expect(active.speed[slot]).toBe(160);}
  return {data,owner,driver,epoch:active.epoch,generations:SLOTS.map(slot=>active.generation[slot]!)};
}
function controls(ctx:WorldTestContext,state:DrivingStateValue,data:ReadonlySourceBiomeData,arm:0|1,held:Map<string,boolean>){
  // A recorded keyboard controller, not a SIM write: follow the selected source
  // road and accelerate normally. Faster player motion eventually creates real passes.
  const center=arm===1?f(sourcePlayerSample(data,f(state.distance)).gap/1600):0;
  const local=f(f(state.lateral)-center),target=arm===1?.2:-.2;
  const predicted=local+f(f(state.steering)*DT)*5;
  for(const [key,down] of [['ArrowUp',true],['ArrowDown',false],['ArrowLeft',predicted>target+.025],['ArrowRight',predicted<target-.025]] as const){
    if((held.get(key)??false)!==down){ctx.input.key(key,down);held.set(key,down);}
  }
}
function aiAndPasses(ctx:WorldTestContext,before:TrafficPoolValue,after:TrafficPoolValue,
  oldDriver:DrivingStateValue,nextDriver:DrivingStateValue,data:ReadonlySourceBiomeData,arm:0|1,seen:Set<string>,near:number[]){
  const pz=playerZ(oldDriver,data),nextPz=playerZ(nextDriver,data),playerRow=data.segments[index(pz,data)]!;
  const playerSide=Math.abs(f(oldDriver.lateral)*1600)<=Math.abs(f(f(oldDriver.lateral)*1600)-playerRow.gap)?0:1;
  for(let slot=0;slot<32;slot++){
    if(after.parked[slot]!==0||after.generation[slot]!==before.generation[slot])continue;
    const ai=after.ai[slot]!,isNear=Math.abs(index(after.z[slot]!,data)-index(pz,data))<=20;
    if(!isNear)continue;
    near[ai]=(near[ai]??0)+1;
    if(ai===1)check(f(after.offset[slot]!)===f(before.offset[slot]!),`Pacific lane changed/${slot}`);
    if(ai===2)check(Math.abs(f(f(after.offset[slot]!)-f(before.offset[slot]!)))<=f(STEP+f(.0000001)),`Evasive moved too far/${slot}`);
    if(ai===3&&after.side[slot]===playerSide){
      const local=f(f(oldDriver.lateral)-(playerSide===1?f(playerRow.gap/1600):0));
      const target=f(Math.max(-f(.9),Math.min(f(.9),local)));
      check(f(after.target[slot]!)===target,`OBSTACLE must use previous PLAYER row gap/${arm}/${slot}`);
      const offset=f(before.offset[slot]!),expected=f(offset+Math.max(-STEP,Math.min(STEP,f(target-offset))));
      check(f(after.offset[slot]!)===expected,`OBSTACLE bounded approach/${arm}/${slot}`);
      near[4]=(near[4]??0)+1;
    }
  }
  for(const award of ctx.world.events(TrafficPassed)){
    const slot=award.slot,key=`${award.epoch}:${slot}:${award.generation}`;
    check(!seen.has(key),`Duplicate passing lifetime ${key}`);seen.add(key);
    check(award.epoch===before.epoch&&award.generation===before.generation[slot],`Award lost prior lifetime ${key}`);
    check(before.active[slot]===1&&before.parked[slot]===0,'Inactive or parked traffic awarded');
    const advanced=f(f(before.z[slot]!)+f(f(before.speed[slot]!)*60*DT));
    check(advanced<data.lastLine*150,'Endpoint parking cannot award');
    check(f(f(before.z[slot]!)-pz)>=0&&f(advanced-nextPz)<0,`Award without genuine swept crossing ${key}`);
    expect(award.points).toBe(20000);
  }
}

interface Window {name:string;origin:number;camera:number;rows:readonly number[];cap:number;nearAI:boolean;pass:boolean}
const WINDOWS:Window[]=[
  {name:'fork mirror choice and plateau',origin:535000,camera:581000,rows:[4123,4169,4284,4482,4783],cap:1000,nearAI:true,pass:true},
  {name:'return overlap and residual gap',origin:680000,camera:726000,rows:[5070,5782],cap:900,nearAI:true,pass:true},
  {name:'first authored overlap',origin:125000,camera:171000,rows:[1387],cap:180,nearAI:false,pass:false},
];
for(const window of WINDOWS)for(const arm of (window.nearAI?[0,1]:[0]) as (0|1)[]){
  worldTest(`traffic.fork ${window.name} follows live lifetimes on player arm${arm}`,async(ctx)=>{
    const {world,step}=ctx,{data,owner,driver,epoch,generations}=await setup(ctx,window.origin,window.camera,arm);
    const crossed=new Set<string>(),passes=new Set<string>(),near=[0,0,0,0,0],trace:unknown[]=[],held=new Map<string,boolean>();
    let ticks=0,before=world.get(owner,TrafficPool),oldDriver=world.resource(DrivingState);
    for(;ticks<window.cap;ticks++){
      controls(ctx,oldDriver,data,arm,held);await step(1);
      const pool=world.get(owner,TrafficPool),state=world.resource(DrivingState),terrain=world.get(driver,TerrainDriver);
      bounded(pool,data);check(pool.epoch===epoch,'Traversal reseeded traffic');
      check(terrain.roadSide===arm,`Recorded controller left requested player arm${arm} at tick${ticks}`);
      check(!terrain.recentering&&state.legacySpeed>100,'Traversal stalled offroad');
      aiAndPasses(ctx,before,pool,oldDriver,state,data,arm,passes,near);
      for(let selected=0;selected<SLOTS.length;selected++){
        const slot=SLOTS[selected]!;
        for(const row of window.rows){
          const key=`${slot}:${row}`;if(crossed.has(key))continue;
          // Recycling is not continuity; keep the old lifetime until every required boundary.
          check(pool.generation[slot]===generations[selected],`Recycled before required boundary ${key}`);
          check(pool.side[slot]===(slot===26?1:0),`Mirror changed logical side ${slot}`);
          check(pool.active[slot]===1&&pool.parked[slot]===0,`Missing live boundary car ${key}`);
          const z0=f(before.z[slot]!),z1=f(pool.z[slot]!);
          check(z1>z0,`Selected traffic stopped before boundary ${key}`);
          if(z0<row*150&&z1>=row*150){
            const row0=data.segments[index(z0,data)]!,row1=data.segments[index(z1,data)]!;
            const local0=f(f(before.offset[slot]!)*1600),local1=f(f(pool.offset[slot]!)*1600),side=pool.side[slot]!;
            const x0=trafficLogicalX(z0,f(before.offset[slot]!),side,data),x1=trafficLogicalX(z1,f(pool.offset[slot]!),side,data);
            check(x0===f(local0+(side===1?row0.gap:0))&&x1===f(local1+(side===1?row1.gap:0)),`Wrong own-row canonical gap ${key}`);
            if(side===1)check(f(x1-x0)===f(f(local1+row1.gap)-f(local0+row0.gap)),`Right source gap step mismatch ${key}`);
            else check(f(x1-x0)===f(local1-local0),`Left car inherited right gap ${key}`);
            crossed.add(key);trace.push({slot,row,tick:ticks+1,generation:pool.generation[slot],side,z0,z1,gap0:row0.gap,gap1:row1.gap,x0,x1,mirror:row1.mirror});
          }
        }
      }
      before=pool;oldDriver=state;
      if(crossed.size===window.rows.length*2&&(!window.pass||passes.size>0)&&(!window.nearAI||near[4]!>0))break;
    }
    console.log('traffic.fork trace',{window:window.name,arm,ticks:ticks+1,crossed:crossed.size,nearAI:near,passes:[...passes],trace,
      step:world.resource(Time).step,hash:world.hash()});
    expect(crossed.size).toBe(window.rows.length*2);
    if(window.nearAI){for(const ai of [1,2,3,4])expect(near[ai]!).toBeGreaterThan(0);}
    if(window.pass)expect(passes.size).toBeGreaterThan(0);
    expect(ticks).toBeLessThan(window.cap);
    for(const key of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'])ctx.input.key(key,false);
    ctx.input.emit(DrivingPauseRequested,{paused:true});await step(1);
    const paused=world.get(owner,TrafficPool);
    for(let tick=0;tick<5;tick++){
      await step(1);expect(world.get(owner,TrafficPool)).toEqual(paused);
      expect(world.events(TrafficPassed).length).toBe(0);
    }
  });
}
worldTest('traffic.fork bounded endpoint parks both live sides without wrapping or boundary bonus',async(ctx)=>{
  const {world,input,step}=ctx,{data,owner,epoch,generations}=await setup(ctx,800000,846000,0,180);
  // Coast normally behind the cars: a stationary player would legitimately
  // recycle them after they leave its200-row active window before the endpoint.
  let ticks=0,before=world.get(owner,TrafficPool);
  const transitions=new Set<number>();
  for(;ticks<100;ticks++){
    await step(1);const pool=world.get(owner,TrafficPool);bounded(pool,data);
    expect(world.events(TrafficPassed).length).toBe(0);
    const state=world.resource(DrivingState);
    for(let selected=0;selected<SLOTS.length;selected++){
      const slot=SLOTS[selected]!;
      check(pool.generation[slot]===generations[selected],`Endpoint lifetime recycled/${slot}`);
      check(playerZ(state,data)<f(pool.z[slot]!),`Endpoint driver overtook boundary car/${slot}`);
      if(before.parked[slot]===0&&pool.parked[slot]===1){
        check(before.active[slot]===1&&before.generation[slot]===generations[selected],`Endpoint did not park a live original car/${slot}`);
        const advanced=f(f(before.z[slot]!)+f(f(before.speed[slot]!)*60*DT));
        check(f(before.z[slot]!)<882450&&advanced>=882450,`Parked without ordinary endpoint advance/${slot}`);
        transitions.add(slot);
      }
    }
    before=pool;
    if(SLOTS.every(slot=>pool.parked[slot]===1))break;
  }
  expect(ticks).toBeLessThan(100);expect(transitions.size).toBe(2);
  const parked=world.get(owner,TrafficPool),selected=SLOTS.map(slot=>({z:parked.z[slot],previousZ:parked.previousZ[slot],side:parked.side[slot],generation:parked.generation[slot],active:parked.active[slot],speed:parked.speed[slot],moving:parked.moving[slot],cooldown:parked.cooldown[slot],parked:parked.parked[slot]}));
  for(let i=0;i<SLOTS.length;i++){
    expect(selected[i]).toEqual({z:882450,previousZ:882450,side:i===0?1:0,generation:generations[i],active:0,speed:0,moving:0,cooldown:0,parked:1});
  }
  const inspectParkedTick=()=>{
    const after=world.get(owner,TrafficPool);expect(after.epoch).toBe(epoch);
    for(const slot of SLOTS)for(const field of ['z','previousZ','offset','previousOffset','side','ai','generation','passed','active','speed','target','moving','cooldown','parked','motionTicks'] as const)expect(after[field][slot]).toBe(parked[field][slot]);
    // Read every current-step batch: a final-frame check would miss an earlier
    // transient award. Other cars may still move; only these parked lifetimes
    // are the endpoint invariant being established by this continuation.
    for(const award of world.events(TrafficPassed))check(!SLOTS.some(slot=>award.epoch===epoch&&award.slot===slot&&award.generation===parked.generation[slot]),'Parked endpoint lifetime awarded');
  };
  for(let tick=0;tick<20;tick++){await step(1);inspectParkedTick();}
  input.emit(DrivingPauseRequested,{paused:true});
  for(let tick=0;tick<5;tick++){await step(1);inspectParkedTick();}
  expect(world.count(TrafficPool)).toBe(1);
  console.log('traffic.fork endpoint',{ticks:ticks+1,selected,step:world.resource(Time).step,hash:world.hash()});
});

worldTest.replay('tests/replays/traffic_fork_fork_mirror_choice_and_plateau_follows_live_lifetimes_on_player_arm1.greplay');
