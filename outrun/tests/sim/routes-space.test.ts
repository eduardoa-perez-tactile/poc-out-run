import {worldTest,expect} from '@gameengine/test';
import {originalRouteSources} from '../../src/content/route-boot.ts';
import type {SourceBiomeId} from '../../src/content/biome.ts';
import {sampleRouteZ} from '../../src/sim/route-space.ts';

worldTest('routes.space all48 actual profiles sample full tails and positive raw aliases without parking caps',()=>{
  const sources=originalRouteSources();let checked=0;
  for(let id=1;id<=16;id++)for(const gradient of [-1,0,1]as const){
    const data=sources.get(id as SourceBiomeId,gradient),full=data.totalCount*150;
    const afterProof=(data.lastLine+1)*150+17;
    expect(afterProof<full).toBe(true);
    const tail=sampleRouteZ(data,afterProof);
    expect(tail).toEqual({rawZ:afterProof,absoluteRow:data.lastLine+1,row:data.lastLine+1,lap:0,offsetZ:17,fraction:0.1133333370089531,canonicalZ:afterProof});
    for(const lap of [1,2,1000]){
      const rawZ=full*lap+317;expect(rawZ<=0x7fffffff).toBe(true);
      expect(sampleRouteZ(data,rawZ)).toEqual({rawZ,absoluteRow:data.totalCount*lap+2,row:2,lap,offsetZ:17,fraction:0.1133333370089531,canonicalZ:317});checked++;
    }
  }
  expect(checked).toBe(144);
});

worldTest('routes.space exact row lap and player offset wrap retain integer contact coordinates',()=>{
  const data=originalRouteSources().get(16,1),full=451500;
  expect(data.totalCount*150).toBe(full);expect(data.playerOffsetZ).toBe(702);
  expect(sampleRouteZ(data,149)).toEqual({rawZ:149,absoluteRow:0,row:0,lap:0,offsetZ:149,fraction:0.9933333396911621,canonicalZ:149});
  expect(sampleRouteZ(data,150)).toEqual({rawZ:150,absoluteRow:1,row:1,lap:0,offsetZ:0,fraction:0,canonicalZ:150});
  // Same API for camera+source player702 and raw NPC positions. No hidden offset.
  const cameraBefore=450797,cameraAt=450798;
  expect(sampleRouteZ(data,cameraBefore+data.playerOffsetZ)).toEqual({rawZ:451499,absoluteRow:3009,row:3009,lap:0,offsetZ:149,fraction:0.9933333396911621,canonicalZ:451499});
  expect(sampleRouteZ(data,cameraAt+data.playerOffsetZ)).toEqual({rawZ:451500,absoluteRow:3010,row:0,lap:1,offsetZ:0,fraction:0,canonicalZ:0});
  expect(sampleRouteZ(data,full+1)).toEqual({rawZ:451501,absoluteRow:3010,row:0,lap:1,offsetZ:1,fraction:0.006666666828095913,canonicalZ:1});
});

worldTest('routes.space odd raw integers above float24 and int32 maximum are never rounded before modulo',()=>{
  const data=originalRouteSources().get(1,-1);
  expect(sampleRouteZ(data,16777217)).toEqual({rawZ:16777217,absoluteRow:111848,row:2354,lap:18,offsetZ:17,fraction:0.1133333370089531,canonicalZ:353117});
  expect(sampleRouteZ(data,2147483647)).toEqual({rawZ:2147483647,absoluteRow:14316557,row:3258,lap:2353,offsetZ:97,fraction:0.6466666460037231,canonicalZ:488797});
});

worldTest('routes.space raw integer rebase preserves history separation and does not canonicalize the caller',()=>{
  const destination=originalRouteSources().get(2,0),shift=881898;
  const previousRaw=16777199,currentRaw=16777217;
  const previous=sampleRouteZ(destination,previousRaw-shift),current=sampleRouteZ(destination,currentRaw-shift);
  expect(previous.rawZ).toBe(15895301);expect(current.rawZ).toBe(15895319);
  expect(current.rawZ-previous.rawZ).toBe(18);
  expect(previousRaw).toBe(16777199);expect(currentRaw).toBe(16777217);
  // The sample reports an alias, not a rewrite of either raw lifetime/history.
  expect(current.canonicalZ<destination.totalCount*150).toBe(true);expect(current.rawZ>current.canonicalZ).toBe(true);
  expect(()=>sampleRouteZ(destination,100-shift)).toThrow();
});

worldTest('routes.space invalid source Z and malformed full row domains fail rather than clamp wrap or park',()=>{
  const data=originalRouteSources().get(1,0);
  for(const raw of [-1,-.5,.5,NaN,Infinity,-Infinity,2147483648,4294967295,true,'150',null])expect(()=>sampleRouteZ(data,raw as number)).toThrow();
  expect(()=>sampleRouteZ({...data,segmentLength:0},0)).toThrow();
  expect(()=>sampleRouteZ({...data,segmentLength:149},0)).toThrow();
  expect(()=>sampleRouteZ({...data,totalCount:0},0)).toThrow();
  expect(()=>sampleRouteZ({...data,totalCount:data.totalCount+.5},0)).toThrow();
  expect(()=>sampleRouteZ({...data,totalCount:data.totalCount-1},0)).toThrow();
  expect(sampleRouteZ(data,0)).toEqual({rawZ:0,absoluteRow:0,row:0,lap:0,offsetZ:0,fraction:0,canonicalZ:0});
});
