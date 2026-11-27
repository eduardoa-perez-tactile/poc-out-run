import {renderTest,worldTest,expect,type UIRect} from '@gameengine/test';
import {DrivingState,DrivingInput,DrivingControlChanged,DrivingControlsCancelled,DrivingPauseRequested,RaceState} from '../../src/schema.gen.ts';
import {TouchShift} from '../../src/input/driving-input.ts';
const center=(r:UIRect):[number,number]=>[r.x+r.width/2,r.y+r.height/2];

renderTest('controls.touch-shift manual buttons shift on press with held throttle and never repeat while held',async({world,input,step,render,ui})=>{
  input.view(852,393,1,[59,0,0,34]);await step(2);
  world.setResource(DrivingState,{manual:true,legacySpeed:100,gear:0});await step(2);
  render.stats({width:852,height:393});
  const up=ui.rect('drive-gear-up')!,down=ui.rect('drive-gear-down')!,throttle=ui.rect('drive-throttle')!;
  expect(up.width>=44&&up.height>=44&&down.width>=44&&down.height>=44).toBe(true);
  input.pointer('down',...center(throttle),1);await step(3);
  expect(world.resource(DrivingState).gear).toBe(0);
  input.pointer('down',...center(up),2);await step(3);
  expect(world.resource(DrivingState).gear).toBe(1);
  // Gear-up stays held while a separate gear-down press wins. A held button
  // must not emit another pulse on following frames.
  input.pointer('down',...center(down),3);await step(3);
  expect(world.resource(DrivingState).gear).toBe(0);
  await step(3);expect(world.resource(DrivingState).gear).toBe(0);
  expect(world.resource(DrivingInput).shiftUp).toBe(false);expect(world.resource(DrivingInput).shiftDown).toBe(false);
  input.pointer('up',...center(up),2);input.pointer('up',...center(down),3);
  input.pointer('cancel',...center(throttle),1);await step(2);
  world.setResource(DrivingState,{manual:false});await step(2);render.stats({width:852,height:393});
  expect(ui.interactables().filter(row=>row.id==='drive-gear-up'||row.id==='drive-gear-down').length).toBe(0);
},{scene:'scenes/driving-proof.scene.json'});

worldTest('controls.touch-shift rejects countdown, pause, automatic and cancelled pulses',async({world,input,step})=>{
  await step(1);world.setResource(DrivingState,{manual:true});
  const shift=()=>input.emit(DrivingControlChanged,{control:TouchShift.Up,source:1,down:true});
  shift();await step(1);expect(world.resource(DrivingInput).shiftUp).toBe(false);
  world.setResource(RaceState,{countdownTicks:1});await step(2);
  expect(world.resource(RaceState).phase).toBe(1);
  shift();await step(1);expect(world.resource(DrivingInput).shiftUp).toBe(true);
  shift();input.emit(DrivingControlsCancelled,{});await step(1);expect(world.resource(DrivingInput).shiftUp).toBe(false);
  world.setResource(DrivingState,{manual:false});shift();await step(1);expect(world.resource(DrivingInput).shiftUp).toBe(false);
  world.setResource(DrivingState,{manual:true});shift();input.emit(DrivingPauseRequested,{paused:true});await step(1);
  expect(world.resource(RaceState).phase).toBe(8);expect(world.resource(DrivingInput).shiftUp).toBe(false);
  shift();await step(1);expect(world.resource(DrivingInput).shiftUp).toBe(false);
},{scene:'scenes/original-race.scene.json'});
