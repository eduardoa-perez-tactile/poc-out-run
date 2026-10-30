import {renderTest,expect} from '@gameengine/test';
import {EnterScene,meshes} from '@gameengine/runtime';
import {Map01Preview,Map01VisualSlot,DrivingState,DrivingInput,RoadProofState} from '../../src/schema.gen.ts';
import {sourceProjectionStats} from '../../src/render/source-projection.ts';
const SCENE={scene:'scenes/map01-data.scene.json',memory:'phone-low' as const};
for(const [name,distance] of [['start',45000],['hill',54000],['dense',1930*150],['fork',4284*150]] as const) {
  renderTest(`content.map01 ${name}`,async({world,input,step,render})=>{
    input.view(1280,720,1);
    if(name==='dense'){
      // Match the budget tape's configured-start-scene path, including the actual
      // recorded selector. T0 playback alone cannot prove LateUpdate readiness.
      input.emit(EnterScene,{scene:'scenes/map01-data.scene.json',release:''});await step(1);
      input.key('Digit9',true);await step(1);input.key('Digit9',false);await step(120);
    }else {world.setResource(Map01Preview,{cameraOriginZ:distance});await step(2);}
    expect(sourceProjectionStats.playerSampleZ).toBe(distance+702);
    expect(sourceProjectionStats.visibleRoadSegments).toBeGreaterThan(0);
    if(name!=='fork')expect(sourceProjectionStats.drawnProps).toBeGreaterThan(0);
    expect(sourceProjectionStats.drawnProps).toBeLessThanOrEqual(256);
    render.expectDrawCalls('<=',4,{width:1280,height:720});
    render.expectTriangles('<=',4113,{width:1280,height:720});
    render.expectScreenshot('data',{width:1280,height:720});
  },name==='dense'?{memory:'phone-low' as const}:SCENE);
}
renderTest('content.map01 dense narrow landscape keeps logical metadata unchanged',async({world,input,step,render})=>{
  world.setResource(Map01Preview,{cameraOriginZ:1930*150});input.view(882,344,1,[44,0,0,21]);await step(2);
  expect(sourceProjectionStats.visitedProps).toBeLessThanOrEqual(138);
  render.expectScreenshot('data',{width:882,height:344});
},SCENE);
renderTest('content.lifecycle disable and slot loss release both diagnostic meshes',async({world,input,step})=>{
  input.view(1280,720,1);await step(2);
  expect(meshes.info('map01-road')!==null).toBe(true);expect(meshes.info('map01-props')!==null).toBe(true);
  world.setResource(Map01Preview,{enabled:false});await step(1);
  expect(meshes.info('map01-road')).toBe(null);expect(meshes.info('map01-props')).toBe(null);
  world.setResource(Map01Preview,{enabled:true});await step(1);
  expect(meshes.info('map01-road')!==null).toBe(true);expect(meshes.info('map01-props')!==null).toBe(true);
  for(const entity of world.entities(Map01VisualSlot))world.despawn(entity);
  await step(1);
  expect(world.resource(Map01Preview).enabled).toBe(false);
  expect(meshes.info('map01-road')).toBe(null);expect(meshes.info('map01-props')).toBe(null);
},SCENE);
for(const scene of ['scenes/road-proof.scene.json','scenes/driving-proof.scene.json']){
  renderTest(`content.lifecycle EnterScene exit to ${scene} ignores selectors and reentry restores ownership`,async({world,input,step,render,ui})=>{
    input.view(1280,720,1);await step(2);
    expect(sourceProjectionStats.drawnProps).toBeGreaterThan(0);
    input.emit(EnterScene,{scene,release:''});await step(2);
    expect(world.count(Map01VisualSlot)).toBe(0);expect(world.resource(Map01Preview).enabled).toBe(false);
    expect(meshes.info('map01-road')).toBe(null);expect(meshes.info('map01-props')).toBe(null);
    const previous=world.resource(Map01Preview).cameraOriginZ;
    input.key('Digit9',true);await step(1);input.key('Digit9',false);await step(1);
    expect(world.resource(Map01Preview).cameraOriginZ).toBe(previous);
    expect(meshes.info('map01-road')).toBe(null);expect(meshes.info('map01-props')).toBe(null);
    if(scene==='scenes/driving-proof.scene.json'){
      render.stats({width:1280,height:720});
      const throttle=ui.rect('drive-throttle')!;
      expect(throttle!==null).toBe(true);
      input.pointer('down',throttle.x+throttle.width/2,throttle.y+throttle.height/2,7);
      for(const key of ['ArrowUp','ArrowLeft','KeyE','KeyQ','KeyM'])input.key(key,true);
      await step(3);
      expect(world.resource(DrivingInput).keyboard).toBe(5);
      expect(world.resource(DrivingInput).ui).toBe(1);
      expect(world.resource(DrivingState).legacySpeed).toBeGreaterThan(0);
    }
    input.emit(EnterScene,{scene:'scenes/map01-data.scene.json',release:''});await step(2);
    expect(world.count(Map01VisualSlot)).toBe(1);expect(world.resource(Map01Preview).enabled).toBe(true);
    expect(world.resource(DrivingState).active).toBe(false);
    const controls=world.resource(DrivingInput);
    expect(controls.keyboard).toBe(0);expect(controls.ui).toBe(0);
    for(const field of ['shiftUp','shiftDown','upHeld','downHeld','pauseHeld','modeHeld'] as const)expect(controls[field]).toBe(false);
    render.stats({width:1280,height:720});
    expect(ui.rect('driving-controls.pause')).toBe(null);
    expect(ui.rect('drive-throttle')).toBe(null);
    const mapBefore={...world.resource(Map01Preview)},roadBefore={...world.resource(RoadProofState)},drivingBefore={...world.resource(DrivingState)};
    for(const key of ['ArrowUp','ArrowLeft','KeyE','KeyQ','KeyM'])input.key(key,false);
    await step(1);
    for(const key of ['ArrowUp','ArrowLeft','KeyE','KeyQ','KeyM'])input.key(key,true);
    await step(5);
    for(const key of ['ArrowUp','ArrowLeft','KeyE','KeyQ','KeyM'])input.key(key,false);
    await step(1);
    expect(world.resource(Map01Preview)).toEqual(mapBefore);
    expect(world.resource(RoadProofState)).toEqual(roadBefore);
    expect(world.resource(DrivingState)).toEqual(drivingBefore);
    expect(world.resource(DrivingInput).keyboard).toBe(0);
    input.key('Digit9',true);await step(1);input.key('Digit9',false);await step(1);
    expect(sourceProjectionStats.playerSampleZ).toBe(1930*150+702);
    expect(sourceProjectionStats.drawnProps).toBeGreaterThan(0);
    expect(meshes.info('map01-road')!==null).toBe(true);expect(meshes.info('map01-props')!==null).toBe(true);
  },SCENE);
}
