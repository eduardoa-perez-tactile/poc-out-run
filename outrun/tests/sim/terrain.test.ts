import {worldTest,expect} from '@gameengine/test';
import {math} from '@gameengine/runtime';
import {DrivingState,DrivingResetRequested,TerrainDriver,type ReadonlySourceBiomeData} from '../../src/schema.gen.ts';
import {loadMap01} from '../../src/content/biome.ts';
import {advanceDriving,type DrivingControls} from '../../src/sim/driving-math.ts';
import {advanceTerrainDriving,resetTerrainDriver,terrainWheelContact,terrainHandlingCap,nearestTerrainRoad,
  terrainCentrifugalDelta,boundTerrainLateral,terrainSkidding,type TerrainDrivingSample} from '../../src/sim/terrain-math.ts';

const f=math.fround,DT=f(1/60);
const NONE:DrivingControls={throttle:false,brake:false,left:false,right:false,up:false,down:false};
const START:TerrainDrivingSample={legacySpeed:100,gear:1,steering:0,lateral:0,distance:1000,playing:true,manual:false};
function track(gap=0,curve=0,mirror=false,terrain=1,roadTerrain=0):ReadonlySourceBiomeData {
  // A compact logical geometry fixture, not a new cooked map or art fixture.
  return {...loadMap01(),totalCount:100,lastLine:90,terrain,roadTerrain,
    segments:Array.from({length:100},()=>({y0:0,y1:0,gap,curve,mirror,light:0}))};
}
function tick(driving:TerrainDrivingSample,controls:Partial<DrivingControls>={},data=track()){
  return advanceTerrainDriving(driving,resetTerrainDriver(),{...NONE,...controls},DT,data);
}

worldTest('terrain.contact single road distinguishes each wheel and inclusive contact edges',()=>{
  for(const [x,left,right] of [[1,false,false],[1.1,false,true],[1.3,true,true],[-1.1,true,false],[-1.3,true,true]] as const){
    const result=terrainWheelContact(x,0,1);expect(result.leftOutside).toBe(left);expect(result.rightOutside).toBe(right);
  }
  const edge=(1831-210)/1600;
  expect(terrainWheelContact(edge,0,1).rightOutside).toBe(false);
  expect(terrainWheelContact(edge+.0001,0,1).rightOutside).toBe(true);
  expect(terrainWheelContact(-edge,0,1).leftOutside).toBe(false);
  expect(terrainWheelContact(-edge-.0001,0,1).leftOutside).toBe(true);
});
worldTest('terrain.contact split roads use an inclusive union and an open central gap',()=>{
  expect(terrainWheelContact(3662/3200,3662,1).leftOutside).toBe(false);
  expect(terrainWheelContact(3662/3200,3662,1).rightOutside).toBe(false);
  const middle=terrainWheelContact(5000/3200,5000,1);
  expect(middle.leftOutside).toBe(true);expect(middle.rightOutside).toBe(true);
  const leftEdge=terrainWheelContact((1831+210)/1600,5000,1);
  expect(leftEdge.leftOutside).toBe(false);expect(leftEdge.rightOutside).toBe(true);
  const rightEdge=terrainWheelContact((5000-1831-210)/1600,5000,1);
  expect(rightEdge.leftOutside).toBe(true);expect(rightEdge.rightOutside).toBe(false);
  const rightCenter=terrainWheelContact(5000/1600,5000,1);
  expect(rightCenter.leftOutside).toBe(false);expect(rightCenter.rightOutside).toBe(false);
  expect(nearestTerrainRoad(5000/3200,5000)).toBe(0);
  expect(nearestTerrainRoad(5000/3200+.0001,5000)).toBe(1);
});
worldTest('terrain.surfaces all four terrain effects keep road surface separate from physical contact',()=>{
  for(const terrain of [1,2,3,4]){
    const left=terrainWheelContact(-1.1,0,terrain),right=terrainWheelContact(1.1,0,terrain);
    expect(left.leftEffect).toBe(terrain+1);expect(left.rightEffect).toBe(0);
    expect(right.leftEffect).toBe(0);expect(right.rightEffect).toBe(terrain+1);
    const onRoad=tick({...START,legacySpeed:80},{},track(0,0,false,terrain,terrain));
    expect(onRoad.driver.leftOutside).toBe(false);expect(onRoad.driver.rightOutside).toBe(false);
    expect(onRoad.driver.leftEffect).toBe(terrain+1);expect(onRoad.driver.rightEffect).toBe(terrain+1);
    expect(onRoad.driving.legacySpeed).toBeCloseTo(79.80769,4);
  }
  const noEffect=terrainWheelContact(1.1,0,0);
  expect(noEffect.rightOutside).toBe(true);expect(noEffect.rightEffect).toBe(0);
  expect(terrainHandlingCap(1,noEffect,0)).toBe(200);
  expect(terrainHandlingCap(1,terrainWheelContact(1.1,0,1),1)).toBe(75);
  const brakeWithoutTerrain=tick({...START,lateral:1.1},{brake:true},track(0,0,false,0));
  expect(brakeWithoutTerrain.driver.leftEffect).toBe(1);expect(brakeWithoutTerrain.driver.rightEffect).toBe(1);
});
worldTest('terrain.penalty outside throttle coasts rather than accelerating or clamping to75',()=>{
  for(const terrain of [0,1,2,3,4])for(const speed of [50,75,150]){
    const result=tick({...START,legacySpeed:speed,lateral:1.1},{throttle:true},track(0,0,false,terrain));
    expect(result.driving.legacySpeed).toBeCloseTo(speed-.1923077,4);
    if(speed===150)expect(result.driving.legacySpeed).toBeGreaterThan(75);
  }
  const onRoad=tick({...START,legacySpeed:50,gear:0},{throttle:true});
  expect(onRoad.driving.legacySpeed).toBeCloseTo(50.25641,4);
  const braking=tick({...START,legacySpeed:150,lateral:-1.1},{throttle:true,brake:true});
  expect(braking.driving.legacySpeed).toBeCloseTo(149.16667,4);
});
worldTest('terrain.gears offroad rejects throttle shifts and keeps brake coast gear priorities',()=>{
  expect(tick({...START,manual:true,legacySpeed:50,gear:0,lateral:1.1},{throttle:true,up:true}).driving.gear).toBe(0);
  expect(tick({...START,manual:true,legacySpeed:150,lateral:1.1},{throttle:true,down:true}).driving.gear).toBe(1);
  expect(tick({...START,manual:true,legacySpeed:99,lateral:1.1},{throttle:true}).driving.gear).toBe(0);
  const shifted=tick({...START,legacySpeed:99.9,gear:0},{throttle:true},track(0,-3));
  expect(shifted.driving.gear).toBe(1);expect(shifted.driving.legacySpeed).toBe(100);
  expect(shifted.driving.lateral).toBeCloseTo(.02777778,6); // Pre-upshift cap100, not200.
});
worldTest('terrain.drift exact speed gates source coefficient and mirrored right sign',()=>{
  expect(terrainCentrifugalDelta(30.499,100,-3,false,0,DT)).toBe(0);
  expect(terrainCentrifugalDelta(30.5,100,-3,false,0,DT)).toBeCloseTo(.007625,6);
  expect(terrainCentrifugalDelta(99.999,100,-3,false,0,DT)).toBeCloseTo(.02499975,6);
  expect(terrainCentrifugalDelta(100,100,-3,false,0,DT)).toBeCloseTo(.02777778,6);
  expect(terrainCentrifugalDelta(200,200,3,false,0,DT)).toBeCloseTo(-.08333333,6);
  expect(terrainCentrifugalDelta(100,100,-3,true,1,DT)).toBeCloseTo(-.02777778,6);
  expect(terrainCentrifugalDelta(100,100,-3,false,1,DT)).toBeCloseTo(.02777778,6);
});
worldTest('terrain.gap right carriageway carry happens once and shares the30point5 gate',()=>{
  const data=track(5000),rows=[...data.segments];
  for(let i=5;i<rows.length;i++)rows[i]={...rows[i]!,gap:5320};
  const changed={...data,segments:rows};
  const driver={...resetTerrainDriver(),initialized:true,previousGap:5000,roadSide:1};
  const first=advanceTerrainDriving({...START,distance:0,legacySpeed:60,gear:0,lateral:3.125},driver,NONE,DT,changed);
  expect(first.driver.segment).toBe(5);expect(first.driving.lateral).toBeCloseTo(3.325,6);
  expect(first.driver.previousGap).toBe(5320);
  const second=advanceTerrainDriving({...first.driving,manual:false},first.driver,NONE,DT,changed);
  expect(second.driving.lateral).toBe(first.driving.lateral);
  const slow=advanceTerrainDriving({...START,distance:40,legacySpeed:30,gear:0,lateral:3.125},driver,NONE,DT,changed);
  expect(slow.driver.segment).toBe(5);expect(slow.driving.lateral).toBe(3.125);
});
worldTest('terrain.bounds preserve dynamic right road and strict mirrored inner gap rule',()=>{
  expect(boundTerrainLateral(10,16000,false,1)).toBe(10);
  expect(boundTerrainLateral(40,16000,false,1)).toBe(11.5);
  expect(boundTerrainLateral(-5,16000,false,0)).toBe(-1.5);
  expect(boundTerrainLateral(2,6400,true,0)).toBeCloseTo(1.73,6);
  expect(boundTerrainLateral(2,6400,true,1)).toBeCloseTo(2.27,6);
  expect(boundTerrainLateral(1.75,6400,true,0)).toBe(1.75);
  expect(boundTerrainLateral(2.25,6400,true,1)).toBe(2.25);
  expect(boundTerrainLateral(2,6400,false,0)).toBe(2);
});
worldTest('terrain.skid recomputes contact speed steering and curve thresholds without sticky smoke',()=>{
  const road=terrainWheelContact(0,0,1);
  expect(terrainSkidding(70,5,3,DT,road)).toBe(false);
  expect(terrainSkidding(70.001,5,3,DT,road)).toBe(true);
  expect(terrainSkidding(80,f(1.06666672),2.75,DT,road)).toBe(true);
  expect(terrainSkidding(80,1.0665,2.75,DT,road)).toBe(false);
  expect(terrainSkidding(80,5,2.749,DT,road)).toBe(false);
  expect(terrainSkidding(80,5,3,DT,terrainWheelContact(1.1,0,1))).toBe(false);
  const result=advanceTerrainDriving({...START,legacySpeed:80},{...resetTerrainDriver(),skidding:true},NONE,DT,track(0,0,false,1,2));
  expect(result.driver.skidding).toBe(false);expect(result.driver.leftEffect).toBe(3);
});
worldTest('terrain.float32 skid threshold preserves the source float literal boundary',()=>{
  const road=terrainWheelContact(0,0,1);
  // Extracted source C++ arithmetic, not an original gameplay measurement:
  // float(speed*float(1/60))*0.8f rounds one ULP above float1.2/2.4.
  expect(terrainSkidding(90,f(1.2),3,DT,road)).toBe(false);
  expect(terrainSkidding(90,f(1.2000001668930054),3,DT,road)).toBe(true);
  expect(terrainSkidding(180,f(2.4),3,DT,road)).toBe(false);
  expect(terrainSkidding(180,f(2.400000333786011),3,DT,road)).toBe(true);
});
worldTest('terrain.float32 right inner boundary preserves source rounding on a real fork row',()=>{
  const row=loadMap01().segments[4353]!;
  expect(row.gap).toBe(15730);expect(row.mirror).toBe(true);
  // Source float(center-1.73f) for this exact compiled Map1 row.
  expect(boundTerrainLateral(5,row.gap,row.mirror,1)).toBe(8.101249694824219);
});
worldTest('terrain.recenter geometric rest contact latches and completes with pedals locked',()=>{
  for(const [gap,start,target] of [[0,-1.3,0],[0,1.1,0],[0,1.3,0],[10000,7.55,6.25]] as const){
    const data=track(gap);let driving={...START,legacySpeed:0,lateral:f(start)},driver=resetTerrainDriver(),steps=0;
    let first=true;
    do{
      const result=advanceTerrainDriving(driving,driver,{...NONE,throttle:true,left:true},DT,data);
      if(first){expect(result.driver.recentering).toBe(true);expect(Math.abs(result.driving.lateral-driving.lateral)).toBeCloseTo(.012,6);first=false;}
      expect(result.driving.legacySpeed).toBe(0);expect(result.driving.steering).toBe(0);
      expect(result.driving.distance).toBe(START.distance);
      driving={...result.driving,manual:false};driver=result.driver;steps++;
      if(steps>150)throw new Error('Recenter failed to complete');
    }while(driver.recentering);
    expect(Math.abs(driving.lateral-target)).toBeLessThanOrEqual(.05);
    expect(driver.leftOutside).toBe(false);expect(driver.rightOutside).toBe(false);
    expect(driver.leftEffect).toBe(0);expect(driver.rightEffect).toBe(0);
  }
});
worldTest('terrain.pause initializes once then freezes recenter and feedback state',()=>{
  const data=track(),started=tick({...START,legacySpeed:0,lateral:1.3},{},data);
  const frozen=advanceTerrainDriving({...started.driving,playing:false,manual:false},started.driver,{...NONE,throttle:true},DT,data);
  expect(frozen.driver).toEqual(started.driver);
  expect(frozen.driving).toEqual({...started.driving,playing:false});
  const paused=tick({...START,playing:false,lateral:1.1},{},data);
  expect(paused.driver.initialized).toBe(true);expect(paused.driver.rightOutside).toBe(true);
  expect(paused.driver.recentering).toBe(false);
});
worldTest('terrain.endpoint clamps and pauses this proof without finishing a race or wrapping',()=>{
  const data=track(),limit=data.lastLine*data.segmentLength;
  const result=tick({...START,distance:limit-1},{throttle:true},data);
  expect(result.driving.distance).toBe(limit);expect(result.driving.legacySpeed).toBe(0);
  expect(result.driving.playing).toBe(false);expect(result.driver.sectionEnd).toBe(true);
  expect(result.driver.segment).toBe(Math.floor((limit+702)/150));
  const resumed=advanceTerrainDriving({...result.driving,playing:true,manual:false},result.driver,{...NONE,throttle:true},DT,data);
  expect(resumed.driving).toEqual(result.driving);
  expect(resetTerrainDriver().sectionEnd).toBe(false);
  let rejected=false;try{resetTerrainDriver(2);}catch{rejected=true;}expect(rejected).toBe(true);
});
worldTest('terrain.legacy default driving clamp remains exact while optin permits right road',()=>{
  const sample={legacySpeed:100,gear:1,steering:0,lateral:3};
  const legacy=advanceDriving(sample,NONE,false,DT),explicit=advanceDriving(sample,NONE,false,DT,true);
  expect(legacy).toEqual(explicit);expect(legacy.lateral).toBe(1.5);
  expect(advanceDriving(sample,NONE,false,DT,false).lateral).toBe(3);
});

const SOURCE_SCENE={scene:'scenes/driving-terrain.scene.json'};
worldTest('terrain.integration recorded source reset reaches fork beyond legacy distance and bounds',async({world,input,step})=>{
  const data=loadMap01(),distance=640000,row=data.segments[Math.floor((distance+702)/150)]!;
  expect(row.gap).toBeGreaterThan(0);
  input.emit(DrivingResetRequested,{manual:false,legacySpeed:60,distance,lateral:row.gap/1600});await step(1);
  const driving=world.resource(DrivingState),owners=world.entities(TerrainDriver);
  expect(owners.length).toBe(1);expect(driving.distance).toBeGreaterThan(distance);
  expect(driving.lateral).toBeGreaterThan(1.5);
  const driver=world.get(owners[0]!,TerrainDriver);
  expect(driver.segment).toBe(Math.floor((driving.distance+702)/150));expect(driver.initialized).toBe(true);
},SOURCE_SCENE);
worldTest('terrain.integration viewport changes cannot change recorded handling outcomes',async({world,input,step})=>{
  const run=async(width:number,height:number)=>{
    input.view(width,height,1);
    input.emit(DrivingResetRequested,{manual:false,legacySpeed:100,distance:300000,lateral:0});
    input.key('ArrowUp',true);input.key('ArrowLeft',true);await step(24);
    input.key('ArrowUp',false);input.key('ArrowLeft',false);await step(1);
    return {driving:world.resource(DrivingState),terrain:world.get(world.entities(TerrainDriver)[0]!,TerrainDriver)};
  };
  expect(await run(882,344)).toEqual(await run(1280,720));
},SOURCE_SCENE);
