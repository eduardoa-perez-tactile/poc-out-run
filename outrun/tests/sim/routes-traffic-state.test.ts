import {worldTest,expect} from '@gameengine/test';
import type {RouteTrafficCoordinatesValue,TrafficPoolValue} from '../../src/schema.gen.ts';
import {originalRouteSources} from '../../src/content/route-boot.ts';
import type {SourceBiomeId} from '../../src/content/biome.ts';
import {createEmptyTrafficPool,resetTrafficPool} from '../../src/sim/traffic-math.ts';
import {hydrateRouteTrafficPool,packRouteTrafficPool,type RouteTrafficIdentity} from '../../src/sim/route-traffic-state.ts';

const ID:RouteTrafficIdentity={mapId:1,routeEpoch:7,mapEpoch:3},RNG={range:(lo:number,_hi:number)=>lo};
const PLAYER={previousZ:45702,z:45702,previousLateral:0,lateral:0,previousSide:0,side:0,playing:true};
function source(){return originalRouteSources().get(1,0);}
function pool(population=32,data=source()):TrafficPoolValue {
  return resetTrafficPool(createEmptyTrafficPool(),{mapId:data.id,population,seedLo:123,seedHi:456,originZ:0},PLAYER,data,RNG,{kind:'source-route',routeEpoch:7,mapEpoch:3});
}
function clone<T>(value:T):T{return JSON.parse(JSON.stringify(value))as T;}

worldTest('routes.trafficState all48 real profiles and each population roundtrip all32 integer lanes without touching life or input arrays',()=>{
  let cases=0;
  for(let mapId=1;mapId<=16;mapId++)for(const gradient of [-1,0,1]as const){
    const data=originalRouteSources().get(mapId as SourceBiomeId,gradient),identity={...ID,mapId};
    for(const population of [9,20,32]){
      const raw=pool(population,data);raw.z[0]=16777217;raw.previousZ[0]=16777199;
      const before=JSON.stringify(raw),packed=packRouteTrafficPool(raw,identity,data);
      expect(hydrateRouteTrafficPool(packed.pool,packed.coordinates,identity,data)).toEqual(raw);
      expect(packed.coordinates.rawZ.length).toBe(32);expect(packed.coordinates.previousRawZ.length).toBe(32);
      expect(packed.coordinates.rawZ[0]).toBe(16777217);expect(packed.coordinates.previousRawZ[0]).toBe(16777199);
      expect(JSON.stringify(raw)).toBe(before);cases++;
    }
  }
  expect(cases).toBe(144);
});

worldTest('routes.trafficState literal odd int32 extrema and own wrap endpoint mirrors preserve authoritative histories and signed origin',()=>{
  const raw=pool(),data=source(),length=912450;
  raw.originZ=2147483647;raw.z[0]=16777217;raw.previousZ[0]=2147483647;
  raw.z[31]=length+149;raw.previousZ[31]=length-1;
  const packed=packRouteTrafficPool(raw,ID,data);
  expect(packed.pool.z[0]).toBe(353117);expect(packed.pool.previousZ[0]).toBe(488797);
  expect(packed.pool.z[31]).toBe(149);expect(packed.pool.previousZ[31]).toBe(912449);
  expect(packed.pool.originZ).toBe(2147483648);expect(packed.coordinates.originZ).toBe(2147483647);
  expect(packed.coordinates.rawZ[31]).toBe(912599);expect(packed.coordinates.previousRawZ[31]).toBe(912449);
  expect(hydrateRouteTrafficPool(packed.pool,packed.coordinates,ID,data)).toEqual(raw);
  raw.originZ=-2147483648;const negative=packRouteTrafficPool(raw,ID,data);
  expect(negative.coordinates.originZ).toBe(-2147483648);expect(hydrateRouteTrafficPool(negative.pool,negative.coordinates,ID,data).originZ).toBe(-2147483648);
});

worldTest('routes.trafficState parked presentation mirrors are zero without rewriting raw lifetime state phase or generation',()=>{
  const raw=pool();raw.parked[31]=1;raw.z[31]=20000001;raw.previousZ[31]=19999999;raw.motionTicks[31]=5;raw.generation[31]=17;raw.passed[31]=1;
  const packed=packRouteTrafficPool(raw,ID,source());
  expect(packed.pool.z[31]).toBe(0);expect(packed.pool.previousZ[31]).toBe(0);expect(packed.coordinates.rawZ[31]).toBe(20000001);
  expect(packed.pool.generation[31]).toBe(17);expect(packed.pool.motionTicks[31]).toBe(5);expect(packed.pool.passed[31]).toBe(1);
  expect(hydrateRouteTrafficPool(packed.pool,packed.coordinates,ID,source())).toEqual(raw);
});

worldTest('routes.trafficState stale uninitialized map and altered f32 mirrors fail without recovering authority from mirrors',()=>{
  const packed=packRouteTrafficPool(pool(),ID,source()),before=JSON.stringify(packed);
  const corruptions:((coordinates:RouteTrafficCoordinatesValue)=>void)[]=[
    c=>{c.initialized=false;},c=>{c.routeEpoch++;},c=>{c.mapEpoch++;},c=>{c.rawZ.pop();},
    c=>{c.previousRawZ.pop();},c=>{c.rawZ[0]=-1;},c=>{c.previousRawZ[0]=2147483648;},
    c=>{c.rawZ[31]=.5;},c=>{c.originZ=2147483648;},c=>{c.rawZ[0]=c.rawZ[0]!+1;},
  ];
  for(const corrupt of corruptions){const coordinates=clone(packed.coordinates);corrupt(coordinates);expect(()=>hydrateRouteTrafficPool(packed.pool,coordinates,ID,source())).toThrow();}
  for(const field of ['z','previousZ']as const){const mirrors=clone(packed.pool);mirrors[field][0]=mirrors[field][0]!+1;expect(()=>hydrateRouteTrafficPool(mirrors,packed.coordinates,ID,source())).toThrow();}
  const origin=clone(packed.pool);origin.originZ=1;expect(()=>hydrateRouteTrafficPool(origin,packed.coordinates,ID,source())).toThrow();
  expect(()=>hydrateRouteTrafficPool(packed.pool,packed.coordinates,{...ID,mapId:2},source())).toThrow();
  expect(()=>hydrateRouteTrafficPool(packed.pool,packed.coordinates,{...ID,routeEpoch:8},source())).toThrow();
  expect(JSON.stringify(packed)).toBe(before);
});

worldTest('routes.trafficState packing rejects noninteger negative overflow and uninitialized raw state before any caller mutation',()=>{
  const original=pool();
  for(const value of [-1,.5,NaN,Infinity,2147483648]){
    const raw=clone(original);raw.z[31]=value;
    expect(()=>packRouteTrafficPool(raw,ID,source())).toThrow();
    if(Number.isNaN(value))expect(Number.isNaN(raw.z[31]!)).toBe(true);else expect(raw.z[31]).toBe(value);
  }
  const uninitialized=clone(original);uninitialized.initialized=false;expect(()=>packRouteTrafficPool(uninitialized,ID,source())).toThrow();
  const badGeneration=clone(original);badGeneration.generation[0]=0;expect(()=>packRouteTrafficPool(badGeneration,ID,source())).toThrow();
  const badParked=clone(original);badParked.parked[0]=2;expect(()=>packRouteTrafficPool(badParked,ID,source())).toThrow();
  const badOrigin=clone(original);badOrigin.originZ=.5;expect(()=>packRouteTrafficPool(badOrigin,ID,source())).toThrow();
  expect(()=>packRouteTrafficPool(original,{...ID,mapEpoch:0},source())).toThrow();
});

worldTest('routes.trafficState each returned coordinate and pool array is owned without leaking writes across pack hydrate or raw caller',()=>{
  const raw=pool(),packed=packRouteTrafficPool(raw,ID,source()),hydrated=hydrateRouteTrafficPool(packed.pool,packed.coordinates,ID,source());
  const z=raw.z[0]!,offset=raw.offset[0]!;
  hydrated.z[0]=123;hydrated.offset[0]=.75;
  expect(raw.z[0]).toBe(z);expect(raw.offset[0]).toBe(offset);expect(packed.coordinates.rawZ[0]).toBe(z);expect(packed.pool.offset[0]).toBe(offset);
  packed.coordinates.rawZ[0]=456;packed.pool.offset[0]=.5;
  expect(raw.z[0]).toBe(z);expect(raw.offset[0]).toBe(offset);expect(hydrated.z[0]).toBe(123);expect(hydrated.offset[0]).toBe(.75);
});
