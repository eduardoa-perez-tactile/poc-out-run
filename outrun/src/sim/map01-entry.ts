import {defineSystem,EnterScene,write} from '@gameengine/runtime';
import {DrivingState,DrivingInput,TrafficArtPreview} from '../schema.gen.ts';

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
    const driving=scene==='scenes/driving-proof.scene.json'||scene==='scenes/driving-terrain.scene.json'||scene==='scenes/driving-traffic.scene.json'||scene==='scenes/driving-contact.scene.json'||scene==='scenes/driving-crash.scene.json';
    const review=scene==='scenes/traffic-catalog.scene.json'||scene==='scenes/traffic-art.scene.json'||scene==='scenes/map01-data.scene.json'||scene==='scenes/map01-art.scene.json'||scene==='scenes/vehicle-preview.scene.json'||scene==='scenes/road-proof.scene.json'||scene==='scenes/hill-proof.scene.json'||scene==='scenes/fork-left.scene.json'||scene==='scenes/fork-right.scene.json'||scene==='scenes/destination-environment.scene.json'||scene==='scenes/environment-binding-proof.scene.json';
    if(!driving&&!review)return;
    // Write-only presentation reset: cooked scenes may omit default resources.
    ctx.commands.setResource(TrafficArtPreview,{mode:scene==='scenes/traffic-catalog.scene.json'?1:scene==='scenes/traffic-art.scene.json'?2:0,frame:1,caseId:0});
    ctx.setField(DrivingState,'active',driving);
    ctx.set(DrivingInput,{keyboard:0,ui:0,shiftUp:false,shiftDown:false,upHeld:false,downHeld:false,pauseHeld:false,modeHeld:false});
  },
});
