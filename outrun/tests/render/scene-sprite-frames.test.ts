import {worldTest,expect} from '@gameengine/test';
import {flaggerObjectId,startSceneFrames} from '../../src/render/scene-sprite-frames.ts';

worldTest('scene-sprites.countdown uses original semaphore order and two raising calls',()=>{
  for(const [remaining,flagger,semaphore]of [[240,1,39],[181,1,39],[180,1,39],[121,1,39],
    [120,2,40],[61,2,40],[60,2,41],[1,2,41],[0,3,42]]as const){
    expect(startSceneFrames(remaining,0)).toEqual({flagger,semaphore});
  }
  expect(startSceneFrames(0,5)).toEqual({flagger:3,semaphore:42});
  expect(startSceneFrames(0,6)).toEqual({flagger:4,semaphore:42});
  // Restart returns the first source images from reset race counters.
  expect(startSceneFrames(240,0)).toEqual({flagger:1,semaphore:39});
});

worldTest('scene-sprites.flagger follows original raising flag hand and retreat cadence through frame14',()=>{
  for(const [calls,objectId]of [[0,1],[1,2],[2,3],[7,3],[8,4],[44,10],[50,4],
    [428,10],[438,10],[439,11],[450,12],[461,11],[659,4],[1079,10],
    [1310,4],[1730,10],[1961,13],[1981,13],[1982,14],[1983,14],[100000,14]]as const){
    expect(flaggerObjectId(calls)).toBe(objectId);
  }
  const seen=new Set<number>();
  for(let call=0;call<=1983;call++)seen.add(flaggerObjectId(call));
  expect([...seen].sort((a,b)=>a-b)).toEqual(Array.from({length:14},(_,i)=>i+1));
  expect(startSceneFrames(0,1980).flagger).toBe(14);
});
