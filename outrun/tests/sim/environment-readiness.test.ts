import {worldTest,expect} from '@gameengine/test';
import {createEnvironmentReadiness,resetEnvironmentReadiness,submitEnvironmentReadiness,observeEnvironmentReadiness} from '../../src/render/environment-readiness.ts';

worldTest('environment.readiness requires submitted geometry and three distinct later quiet frames',()=>{
  const state=createEnvironmentReadiness();
  expect(observeEnvironmentReadiness(state,1,40,0,0,true)).toBe(false);
  submitEnvironmentReadiness(state,1,40);
  expect(observeEnvironmentReadiness(state,1,40,0,0,true)).toBe(false);
  expect(observeEnvironmentReadiness(state,1,41,0,0,true)).toBe(false);
  for(let i=0;i<10;i++)expect(observeEnvironmentReadiness(state,1,41,0,0,true)).toBe(false);
  expect(state.quietFrames).toBe(1);
  expect(observeEnvironmentReadiness(state,1,42,1,0,true)).toBe(false);
  expect(state.quietFrames).toBe(0);
  expect(observeEnvironmentReadiness(state,1,43,0,0,true)).toBe(false);
  expect(observeEnvironmentReadiness(state,1,44,0,0,true)).toBe(false);
  expect(observeEnvironmentReadiness(state,1,45,0,0,true)).toBe(true);
});
worldTest('environment.readiness resets on selection failure reentry and fresh pending pipelines',()=>{
  const state=createEnvironmentReadiness();submitEnvironmentReadiness(state,1,1);
  for(let frame=2;frame<5;frame++)observeEnvironmentReadiness(state,1,frame,0,0,true);
  expect(state.renderSettled).toBe(true);
  expect(observeEnvironmentReadiness(state,1,8,0,0,true)).toBe(false);
  expect(state.quietFrames).toBe(1);
  expect(observeEnvironmentReadiness(state,1,9,0,1,true)).toBe(false);
  expect(observeEnvironmentReadiness(state,2,6,0,0,true)).toBe(false);
  expect(state.submittedFrame).toBe(-1);
  submitEnvironmentReadiness(state,2,6);
  expect(observeEnvironmentReadiness(state,2,7,0,0,false)).toBe(false);
  expect(state.submittedFrame).toBe(-1);
  resetEnvironmentReadiness(state,3);expect(state.renderSettled).toBe(false);expect(state.quietFrames).toBe(0);
});
