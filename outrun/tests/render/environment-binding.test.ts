import {renderTest,expect} from '@gameengine/test';
import {meshes} from '@gameengine/runtime';

renderTest('environment.bindings three actual textures preserve both page and traffic overlap orders',async({input,step,render})=>{
  input.view(1280,720,1);await step(2);
  const points:[[number,number],...([number,number])[]]=[[150,150],[300,150],[450,150],[610,150],[640,150],[680,150],[810,150],[840,150],[880,150]];
  const actual=render.probe({width:1280,height:720,points}).points;
  const red=[255,0,0,255],green=[0,255,0,255],blue=[0,0,255,255];
  expect(actual.map(point=>point.rgba)).toEqual([red,green,blue,green,blue,red,red,blue,green]);
  expect(meshes.info('environment-binding-proof')!.vertices).toBe(36);
},{scene:'scenes/environment-binding-proof.scene.json',memory:'phone-low'});
