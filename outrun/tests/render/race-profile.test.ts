import {recordedScene} from '../helpers/recorded-scene.ts';
import {renderTest,expect,type RenderStats} from '@gameengine/test';
import {EnterScene} from '@gameengine/runtime';
import {RaceState,RouteDriver,TrafficPool,DrivingState,DrivingInput} from '../../src/schema.gen.ts';
import {COUNTDOWN_TICKS,RacePhase} from '../../src/sim/race-flow-math.ts';

// Launch/UI profile only: real traffic20 and recorded input, not a full winning
// race, residency/allocation measurement or physical-device performance result.
// The fixed frontier is at most7 route mesh slots +1 player mesh +8 UI batches.
const DRAW_FRONTIER=16;
// Authored HUD panel #101820d9. SDK0.1.34 blends UI in linear space: bound
// its darkest observed pixels even over a white underlay, not a gamma-space
// <100 threshold. Glyph contrast remains independently required below.
const panelAlpha=217/255;
const srgbToLinear=(v:number)=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
const linearToSrgb=(v:number)=>v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055;
const PANEL_MAX=[16,24,32].map(v=>Math.ceil(linearToSrgb(srgbToLinear(v/255)*panelAlpha+1-panelAlpha)*255)+1);
function actualFrame(frame:RenderStats){
  expect(frame.drawCalls).toBeGreaterThanOrEqual(6);expect(frame.drawCalls).toBeLessThanOrEqual(DRAW_FRONTIER);
  expect(frame.worldOccluded).toBe(false);expect(frame.pipelinesCreatedThisFrame).toBe(0);
  expect('validationErrors'in frame).toBe(true);
  if('validationErrors'in frame)expect(frame.validationErrors).toEqual([]);
}

renderTest('race.profile recorded normal traffic countdown drive pause and resume',async({input,step,world,render,ui})=>{
  const size={width:1280,height:720};
  input.view(size.width,size.height,1);
  // No scene override: the regression bootstrap and this real scene entry are
  // both in the canonical tape. Production no-override startup is checked apart.
  input.emit(EnterScene,{scene:recordedScene('scenes/original-race.scene.json'),release:''});await step(1);
  const owners=world.entities(RouteDriver);expect(owners.length).toBe(1);const owner=owners[0]!;
  const initial=world.resource(RaceState);
  expect(initial.phase).toBe(RacePhase.Countdown);expect(initial.remainingTicks).toBe(160*60);
  expect(world.get(owner,TrafficPool).population).toBe(20);expect(world.get(owner,TrafficPool).initialized).toBe(true);
  const initialHash=world.hash();
  const settled=render.waitForAssets({...size,timeoutMs:15000});expect(settled.frames).toBeGreaterThan(0);
  actualFrame(render.stats(size));
  const pixels=render.probe({...size,points:[[560,630],[800,650]]}).points;
  const car=pixels[0]!.rgba,road=pixels[1]!.rgba;
  expect(car[3]).toBe(255);expect(car[0]!).toBeGreaterThan(100);
  expect(car[0]!-car[1]!).toBeGreaterThan(40);expect(car[0]!-car[2]!).toBeGreaterThan(40);
  expect(road[3]).toBe(255);expect(road[0]!).toBeGreaterThan(100);expect(road[0]!).toBeLessThan(200);
  expect(Math.abs(road[0]!-road[1]!)).toBeLessThan(5);expect(Math.abs(road[1]!-road[2]!)).toBeLessThan(5);
  // Inspect actual white counter glyphs over their dark HUD panel, not just a
  // model value or a blue world frame with UI geometry missing.
  // Authored1920x1080 HUD time column at this1280x720 viewport. Widget
  // text nodes have CSS classes, not public IDs; probe their actual glyph area.
  expect(ui.rect('race-hud')!==null).toBe(true);
  const counter=render.probe({...size,regions:[[34,49,148,46]]}).regions[0]!;
  for(let channel=0;channel<3;channel++){
    expect(counter.max[channel]!).toBeGreaterThan(220);
    expect(counter.min[channel]!).toBeLessThanOrEqual(PANEL_MAX[channel]!);
    expect(counter.max[channel]!-counter.min[channel]!).toBeGreaterThan(100);
  }
  expect(ui.interactables().some(item=>item.id==='driving-controls.pause'&&item.enabled&&item.hittable)).toBe(true);
  expect(world.hash()).toBe(initialHash);expect(world.resource(RaceState)).toEqual(initial);

  input.key('ArrowUp',true);await step(COUNTDOWN_TICKS-2);
  expect(world.resource(RaceState).countdownTicks).toBe(1);
  expect(world.resource(DrivingState).legacySpeed).toBe(0);expect(world.get(owner,RouteDriver).camera).toBe(45000);
  expect(world.resource(DrivingInput).keyboard&1).toBe(1);
  await step(1);expect(world.resource(RaceState).phase).toBe(RacePhase.Racing);
  await step(360);
  const racing=world.resource(RaceState),driven=world.get(owner,RouteDriver);
  expect(racing.phase).toBe(RacePhase.Racing);expect(racing.totalTicks).toBe(360);
  expect(racing.remainingTicks).toBe(160*60-360);expect(driven.camera>45000).toBe(true);
  expect(world.get(owner,TrafficPool).population).toBe(20);
  render.waitForAssets({...size,timeoutMs:15000});actualFrame(render.stats(size));

  input.key('Space',true);await step(1);
  const paused=world.resource(RaceState),pausedRoute=world.get(owner,RouteDriver);
  expect(paused.phase).toBe(RacePhase.Paused);expect(world.resource(DrivingState).playing).toBe(false);
  input.key('Space',false);input.key('ArrowUp',false);await step(30);
  expect(world.resource(RaceState).remainingTicks).toBe(paused.remainingTicks);
  expect(world.resource(RaceState).totalTicks).toBe(paused.totalTicks);
  expect(world.resource(RaceState).stageTicks).toBe(paused.stageTicks);
  expect(world.get(owner,RouteDriver).camera).toBe(pausedRoute.camera);
  const pauseHash=world.hash(),pauseState=world.resource(RaceState);
  render.waitForAssets({...size,timeoutMs:15000});actualFrame(render.stats(size));
  const resume=ui.interactables().find(item=>item.id==='driving-pause.resume');
  expect(resume!==undefined&&resume.enabled&&resume.hittable).toBe(true);
  const throttle=ui.rect('drive-throttle');expect(throttle!==null).toBe(true);
  expect(ui.interactables().some(item=>item.id==='drive-throttle'&&item.enabled&&item.hittable)).toBe(false);
  render.stats(size);expect(world.hash()).toBe(pauseHash);expect(world.resource(RaceState)).toEqual(pauseState);
  // An actual pointer over the underlying pedal must stay blocked by the modal.
  const x=throttle!.x+throttle!.width/2,y=throttle!.y+throttle!.height/2;
  input.pointer('down',x,y,1);await step(2);input.pointer('up',x,y,1);await step(1);
  expect(world.resource(DrivingInput).ui).toBe(0);expect(world.get(owner,RouteDriver).camera).toBe(pausedRoute.camera);

  input.key('Space',true);await step(1);
  input.key('Space',false);input.key('ArrowUp',true);await step(60);
  expect(world.resource(RaceState).phase).toBe(RacePhase.Racing);
  expect(world.resource(RaceState).totalTicks).toBeGreaterThan(paused.totalTicks);
  expect(world.get(owner,RouteDriver).camera>pausedRoute.camera).toBe(true);
  input.key('ArrowUp',false);await step(1);
  render.waitForAssets({...size,timeoutMs:15000});actualFrame(render.stats(size));
  expect(ui.interactables().some(item=>item.id==='driving-pause.resume')).toBe(false);
  expect(ui.interactables().some(item=>item.id==='driving-controls.pause'&&item.hittable)).toBe(true);
  expect(world.entities(RouteDriver)[0]).toBe(owner);
},{memory:'phone-low'});
