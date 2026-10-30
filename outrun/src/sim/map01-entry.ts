import {defineSystem,EnterScene,write} from '@gameengine/runtime';
import {DrivingState,DrivingInput} from '../schema.gen.ts';

// Cooked scenes omit resource rows equal to schema defaults. Reset explicitly
// on the recorded entry input so loose and cooked reentry clear the same holds.
export const ResetMap01Driving=defineSystem({
  name:'ResetMap01Driving',runOn:[EnterScene],
  before:['CaptureDrivingInput','AdvanceDriving'],
  resources:[write(DrivingState),write(DrivingInput)],
  run(ctx){
    // Events expose previous and current rows: the last entry owns this step.
    let scene:string|undefined;
    for(const entry of ctx.events.read(EnterScene))scene=entry.scene;
    if(scene!=='scenes/map01-data.scene.json'&&scene!=='scenes/map01-art.scene.json')return;
    ctx.setField(DrivingState,'active',false);
    ctx.set(DrivingInput,{keyboard:0,ui:0,shiftUp:false,shiftDown:false,upHeld:false,downHeld:false,pauseHeld:false,modeHeld:false});
  },
});
