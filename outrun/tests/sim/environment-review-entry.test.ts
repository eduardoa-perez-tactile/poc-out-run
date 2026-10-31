import {worldTest,expect} from '@gameengine/test';
import {EnterScene} from '@gameengine/runtime';
import {DrivingState,DrivingInput} from '../../src/schema.gen.ts';
import {destinationEnvironment,destinationDataGroup,DESTINATION_ENVIRONMENT_IDS} from '../../src/content/environments/destination-environments.ts';

worldTest('environment.review explicit destination resolver preserves local source identity and rejects unsupported IDs',()=>{
  for(const id of DESTINATION_ENVIRONMENT_IDS){
    const manifest=destinationEnvironment(id);expect(manifest.mapId).toBe(id);
    expect(destinationDataGroup(id)).toBe(id===16?'biome-goal-data':`biome-map${String(id).padStart(2,'0')}-data`);
  }
  for(const id of [0,1,17,2.5,NaN,Infinity,'2',null,undefined]){
    let failed=false;try{destinationEnvironment(id as number);}catch{failed=true;}expect(failed).toBe(true);
  }
});
for(const scene of ['scenes/destination-environment.scene.json','scenes/environment-binding-proof.scene.json']){
  worldTest(`environment.review entering ${scene} clears prior driving and held controls`,async({input,world,step})=>{
    input.key('ArrowUp',true);input.key('ArrowLeft',true);await step(3);
    expect(world.resource(DrivingState).active).toBe(true);
    world.setResource(DrivingInput,{keyboard:5,ui:10,shiftUp:true,shiftDown:true,upHeld:true,downHeld:true,pauseHeld:true,modeHeld:true});
    input.emit(EnterScene,{scene,release:''});await step(1);
    expect(world.resource(DrivingState).active).toBe(false);
    expect(world.resource(DrivingInput)).toEqual({keyboard:0,ui:0,shiftUp:false,shiftDown:false,upHeld:false,downHeld:false,pauseHeld:false,modeHeld:false});
  },{scene:'scenes/driving-proof.scene.json'});
}
