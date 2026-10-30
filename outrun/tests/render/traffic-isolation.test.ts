import {renderTest,expect} from '@gameengine/test';
import {EnterScene,assets} from '@gameengine/runtime';
import {DrivingState,DrivingResetRequested,TrafficPool,TrafficResetRequested} from '../../src/schema.gen.ts';

renderTest('traffic.view viewport and repeated presentation renders preserve fixed-input simulation',async({world,input,step,render})=>{
  input.emit(EnterScene,{scene:'scenes/driving-traffic.scene.json',release:''});await step(2);
  for(let frame=0;frame<120&&(assets.progress('map01-environment')<1||assets.progress('player-ferrari1')<1);frame++)await step(1);
  expect(assets.progress('map01-environment')).toBe(1);
  expect(assets.progress('player-ferrari1')).toBe(1);
  const owner=world.entities(TrafficPool)[0]!;
  const trial=async(width:number,height:number,rendersPerStep:number)=>{
    input.view(width,height,1);
    input.emit(TrafficResetRequested,{mapId:1,population:32,seedLo:305419896,seedHi:2596069104,originZ:0});
    input.emit(DrivingResetRequested,{manual:false,legacySpeed:80,distance:45000,lateral:0});await step(1);
    input.key('ArrowUp',true);
    for(let tick=0;tick<12;tick++){
      await step(1);
      const pool=world.get(owner,TrafficPool),driving=world.resource(DrivingState);
      // probe renders the current world synchronously; it is not step(). These
      // are real LateUpdate/GPU draws, with a nonblack sky pixel, not mock calls.
      for(let frame=0;frame<rendersPerStep;frame++){
        const probe=render.probe({width,height,points:[[Math.floor(width/2),10]]});
        expect(probe.points[0]!.rgba.slice(0,3).some(channel=>channel>0)).toBe(true);
        expect(world.get(owner,TrafficPool)).toEqual(pool);
        expect(world.resource(DrivingState)).toEqual(driving);
      }
    }
    input.key('ArrowUp',false);await step(1);
    const pool=world.get(owner,TrafficPool);
    return{pool:{...pool,epoch:0},driving:world.resource(DrivingState)};
  };
  const wide=await trial(1280,720,1),narrow=await trial(852,393,3);
  expect(narrow).toEqual(wide);
  // No traffic pixels are claimed: #54 supplies traffic sprite composition.
},{memory:'phone-low'});
