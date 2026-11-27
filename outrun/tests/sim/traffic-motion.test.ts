import {worldTest,expect} from '@gameengine/test';
import {pcg32} from '@gameengine/runtime';
import {loadMap01} from '../../src/content/biome.ts';
import {createEmptyTrafficPool,resetTrafficPool,rebaseTrafficPool,advanceTrafficPool,finalizeTrafficPool,type TrafficPlayerSample} from '../../src/sim/traffic-math.ts';

const player:TrafficPlayerSample={previousZ:45702,z:45702,previousLateral:0,lateral:0,previousSide:0,side:0,playing:true};
function fixture(){
  const pool=createEmptyTrafficPool();pool.initialized=true;pool.population=9;pool.epoch=1;
  for(let slot=0;slot<9;slot++){pool.ai[slot]=1;pool.generation[slot]=1;pool.parked[slot]=1;}
  pool.parked[0]=0;pool.active[0]=1;pool.speed[0]=120;pool.z[0]=45852;pool.previousZ[0]=45852;
  return pool;
}
const noRandom={range:(_lo:number,_hi:number):number=>{throw new Error('A moving Pacific clock must not draw RNG');}};

worldTest('traffic.motion publishes the source three-step pair independently of rendering',()=>{
  let pool=fixture();const phases:number[]=[];
  for(let tick=0;tick<12;tick++){
    pool=finalizeTrafficPool(advanceTrafficPool(pool,player,loadMap01(),1/60,noRandom,{suppressPass:false}),0xffffffff,noRandom).pool;
    phases.push(pool.motionTicks[0]!);
  }
  expect(phases).toEqual([1,2,3,4,5,0,1,2,3,4,5,0]);
  expect(phases.map(value=>Math.floor(value/3))).toEqual([0,0,1,1,1,0,0,0,1,1,1,0]);
  expect(pool.motionTicks.slice(9)).toEqual(Array(23).fill(0));
});

worldTest('traffic.motion freezes across pause and stopped movement then resumes its prior phase',()=>{
  let pool=fixture();pool.motionTicks[0]=4;
  for(let tick=0;tick<17;tick++)pool=advanceTrafficPool(pool,{...player,playing:false},loadMap01(),1/60,noRandom,{suppressPass:false}).pool;
  expect(pool.motionTicks[0]).toBe(4);
  pool=advanceTrafficPool(pool,player,loadMap01(),1/60,noRandom,{suppressPass:false}).pool;
  expect(pool.motionTicks[0]).toBe(5);pool.speed[0]=0;
  for(let tick=0;tick<7;tick++)pool=advanceTrafficPool(pool,player,loadMap01(),1/60,noRandom,{suppressPass:false}).pool;
  expect(pool.motionTicks[0]).toBe(5);
});

worldTest('traffic.motion activation and recycled lifetimes reset their phase without carrying old age',()=>{
  const rng=pcg32(3,4,5,0);let pool=fixture();pool.active[0]=0;pool.motionTicks[0]=5;pool.aiCursor=2;
  pool=advanceTrafficPool(pool,player,loadMap01(),1/60,rng,{suppressPass:false}).pool;
  expect(pool.active[0]).toBe(1);expect(pool.motionTicks[0]).toBe(1);
  pool.z[0]=45000;pool.previousZ[0]=45000;pool.motionTicks[0]=4;
  const advanced=advanceTrafficPool(pool,player,loadMap01(),1/60,rng,{suppressPass:false});
  expect(advanced.recycleSlots).toEqual([0]);
  pool=finalizeTrafficPool(advanced,0xffffffff,rng).pool;
  expect(pool.generation[0]).toBe(2);expect(pool.active[0]).toBe(0);expect(pool.motionTicks[0]).toBe(0);
});

worldTest('traffic.motion full reset clears phase while valid rebasing and parked lifetimes retain it',()=>{
  let pool=fixture();pool.motionTicks[0]=5;
  pool=rebaseTrafficPool(pool,1,500,loadMap01());expect(pool.motionTicks[0]).toBe(5);
  pool=rebaseTrafficPool(pool,1,1000000,loadMap01());expect(pool.parked[0]).toBe(1);
  pool=advanceTrafficPool(pool,player,loadMap01(),1/60,noRandom,{suppressPass:false}).pool;
  expect(pool.motionTicks[0]).toBe(5);
  pool=resetTrafficPool(pool,{mapId:1,population:9,seedLo:1,seedHi:2,originZ:0},player,loadMap01(),pcg32(1,2,3,0));
  expect(pool.motionTicks).toEqual(Array(32).fill(0));
});
