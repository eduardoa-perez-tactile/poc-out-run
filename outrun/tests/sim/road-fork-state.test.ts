import {worldTest,expect} from '@gameengine/test';
import {ForkPreviewRequested,ForkPreviewState,RoadProofState,RoadFixtureRequested,DrivingState} from '../../src/schema.gen.ts';
const SCENE={scene:'scenes/road-proof.scene.json'};
worldTest('road.fork inactive defaults stay untouched by old controls',async({input,step,world})=>{
  const before=world.resource(ForkPreviewState);
  input.emit(RoadFixtureRequested,{fixtureId:1,distance:45000,speed:7200,playing:true});
  await step(10);
  expect(world.resource(ForkPreviewState)).toEqual(before);
},SCENE);
worldTest('road.fork transition freezes resumes and clamps completion',async({input,step,world})=>{
  input.emit(ForkPreviewRequested,{side:1,distance:42000,tick:90,configurePlayback:true,playing:false});
  await step(20);
  expect(world.resource(ForkPreviewState).tick).toBe(90);
  expect(world.resource(ForkPreviewState).previousTick).toBe(90);
  expect(world.resource(RoadProofState).distance).toBe(42000);
  input.key('Space',true);await step(1);input.key('Space',false);
  expect(world.resource(ForkPreviewState).tick).toBe(91);
  await step(120);
  expect(world.resource(ForkPreviewState).tick).toBe(180);
  expect(world.resource(ForkPreviewState).previousTick).toBe(180);
},SCENE);
for(const order of [['Digit5','Space'],['Space','Digit6']] as const){
  worldTest(`road.fork ${order.join(' then ')} preserves paused playback on following tick`,async({input,step,world})=>{
    for(const key of order)input.key(key,true);
    await step(1);for(const key of order)input.key(key,false);await step(3);
    expect(world.resource(ForkPreviewState).active).toBe(true);
    expect(world.resource(ForkPreviewState).tick).toBe(0);
    expect(world.resource(RoadProofState).playing).toBe(false);
    expect(world.resource(RoadProofState).distance).toBe(33000);
  },SCENE);
}
worldTest('road.fork fixture exit restores inactive transition defaults',async({input,step,world})=>{
  const defaults=world.resource(ForkPreviewState);
  input.key('Digit6',true);await step(3);input.key('Digit6',false);
  expect(world.resource(ForkPreviewState).active).toBe(true);
  input.emit(RoadFixtureRequested,{fixtureId:0,distance:45000,speed:7200,playing:false});await step(2);
  expect(world.resource(ForkPreviewState)).toEqual(defaults);
  expect(world.resource(RoadProofState).fixtureId).toBe(0);
},SCENE);
for(const side of [0,1]){
  worldTest(`road.fork ${side===0?'left':'right'} preview reaches successor without changing proof speed`,async({world,step,input})=>{
    input.emit(ForkPreviewRequested,{side,distance:33000,tick:0,configurePlayback:true,playing:true});
    await step(180);
    expect(world.resource(ForkPreviewState).tick).toBe(180);
    expect(world.resource(ForkPreviewState).side).toBe(side);
    expect(world.resource(RoadProofState).speed).toBe(7200);
    expect(world.resource(RoadProofState).distance).toBeCloseTo(54600,1);
  });
}

for(const request of ['keyboard','explicit'] as const){
  worldTest(`road.fork driving ignores ${request} preview requests while driving owns motion`,async({input,step,world})=>{
    const defaults=world.resource(ForkPreviewState);
    const fixture=world.resource(RoadProofState).fixtureId;
    input.key('ArrowUp',true);
    if(request==='keyboard'){
      input.key('Digit5',true);await step(2);input.key('Digit5',false);
      input.key('Digit6',true);await step(2);input.key('Digit6',false);
    }else{
      input.emit(ForkPreviewRequested,{side:1,distance:42000,tick:90,configurePlayback:true,playing:false});
      await step(4);
    }
    await step(2); // Include queued requests and the following simulation tick.
    const car=world.resource(DrivingState);
    const road=world.resource(RoadProofState);
    expect(world.resource(ForkPreviewState)).toEqual(defaults);
    expect(road.fixtureId).toBe(fixture);
    expect(car.playing).toBe(true);
    expect(car.distance>45000).toBe(true);
    expect(road.distance).toBe(car.distance);
    expect(road.previousDistance).toBe(car.previousDistance);
    expect(road.speed).toBeCloseTo(car.legacySpeed*60,4);
    expect(road.playing).toBe(car.playing);
  },{scene:'scenes/driving-proof.scene.json'});
}
