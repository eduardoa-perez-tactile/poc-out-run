import {worldTest,expect} from '@gameengine/test';
import {originalRouteSources} from '../../src/content/route-boot.ts';
import type {SourceBiomeId} from '../../src/content/biome.ts';
import type {CrashDriverValue,TerrainDriverValue} from '../../src/schema.gen.ts';
import {resetTerrainDriver,nearestTerrainRoad,terrainCentrifugalDelta,boundTerrainLateral,type TerrainDrivingSample} from '../../src/sim/terrain-math.ts';
import {resetCrashRecovery,beginCrashRecovery} from '../../src/sim/crash-recovery-math.ts';
import {prepareRoutePlayerTick,finishRoutePlayerTick} from '../../src/sim/route-driving-math.ts';
import type {DrivingControls} from '../../src/sim/driving-math.ts';
import {sampleRouteZ} from '../../src/sim/route-space.ts';
import {sourceRouteTrafficZ} from '../../src/sim/route-math.ts';

const DT=Math.fround(1/60),SCENE={scene:'scenes/map01-data.scene.json'};
const NONE:DrivingControls={throttle:false,brake:false,left:false,right:false,up:false,down:false};
const START:TerrainDrivingSample={distance:45000,lateral:0,legacySpeed:0,gear:0,steering:0,playing:true,manual:true};
function data(id:SourceBiomeId=1){return originalRouteSources().get(id,0);}
function terrain(id:SourceBiomeId=1):TerrainDriverValue{return {...resetTerrainDriver(),mapId:id};}
function crash(id:SourceBiomeId=1):CrashDriverValue{return {...resetCrashRecovery(),mapId:id};}
function spin(speed=200,kind:1|2=1):CrashDriverValue {
  return beginCrashRecovery(crash(),{mapId:1,kind,impactSpeed:speed,handlingCap:200,collisionDir:-.5,curve:2.5},0,1);
}
function reject(fn:()=>unknown){let failed=false;try{fn();}catch{failed=true;}expect(failed).toBe(true);}

worldTest('routes.driving actual source start ramp assigns integer camera once and retains held controls',()=>{
  let driving={...START},driver=terrain(),recovery=crash();
  const held=Object.freeze({...NONE,throttle:true}),before=JSON.stringify(held);
  for(const camera of [45000,45000,45000,45001]){
    const prepared=prepareRoutePlayerTick(driving,driver,recovery,held,DT,data());
    expect(prepared.driving.distance).toBe(camera);
    const result=finishRoutePlayerTick(prepared,data(),null);
    expect(result.driving.distance).toBe(camera);expect(result.motionMode).toBe('sweep');
    expect(result.driver.sectionEnd).toBe(false);expect(result.lockedThisTick).toBe(false);
    driving={...driving,...result.driving};driver=result.driver;recovery=result.crash;
  }
  expect(JSON.stringify(held)).toBe(before);expect(driving.legacySpeed).toBe(Math.fround(1.0256410837173462));
},SCENE);

worldTest('routes.driving source exit movement remains intact until destination finish snaps camera zero',()=>{
  const old=data(),incoming=data(2),camera=(old.lastLine+1)*150-702-1;
  const source={...START,distance:camera,legacySpeed:2,gear:1,lateral:0};
  const prepared=prepareRoutePlayerTick(source,terrain(),crash(),NONE,DT,old);
  expect(prepared.driving.distance).toBe(881898);expect(source.distance).toBe(881897);
  const prior=JSON.stringify(prepared),result=finishRoutePlayerTick(prepared,incoming,{outgoingCamera:prepared.driving.distance});
  expect(result.driving.distance).toBe(0);expect(result.motionMode).toBe('endpoint');expect(result.handoff).toBe(true);
  expect(result.driver.mapId).toBe(2);expect(result.crash.mapId).toBe(2);
  expect(result.driver.previousGap).toBe(0);expect(result.motion!.z0).toBe(702);expect(result.motion!.z1).toBe(702);
  expect(result.driving.legacySpeed).toBe(prepared.driving.legacySpeed);expect(result.driving.gear).toBe(prepared.driving.gear);
  expect(JSON.stringify(prepared)).toBe(prior);expect(result.driver.sectionEnd).toBe(false);
},SCENE);

worldTest('routes.driving all actual maps use outgoing wheel caps and destination terrain without old gap carry',()=>{
  for(let id=1;id<=16;id++){
    const sourceData=data(id as SourceBiomeId),driver=terrain(id as SourceBiomeId);
    const result=finishRoutePlayerTick(prepareRoutePlayerTick({...START,legacySpeed:100,gear:1},driver,crash(id as SourceBiomeId),NONE,DT,sourceData),sourceData,null);
    expect(result.driver.mapId).toBe(id);expect(result.driver.sectionEnd).toBe(false);
    expect(Number.isInteger(result.driving.distance)).toBe(true);expect(Number.isFinite(result.driving.lateral)).toBe(true);
  }
  const source={...START,legacySpeed:100,gear:1,lateral:1.1};
  const prepared=prepareRoutePlayerTick(source,terrain(),crash(),{...NONE,throttle:true},DT,data());
  expect(prepared.cap).toBe(75);expect(prepared.driving.legacySpeed).toBeGreaterThan(75);
  expect(prepared.driving.legacySpeed).toBeLessThan(100); // blocked throttle coasts, no hard cap clamp
  const result=finishRoutePlayerTick(prepared,data(2),{outgoingCamera:prepared.driving.distance});
  expect(result.driver.rightOutside).toBe(true);expect(result.driver.rightEffect).toBe(3);
  expect(result.driver.leftEffect).toBe(0);expect(result.motion!.handlingCap).toBe(75);
  expect(result.motion!.previousGap).toBe(0);expect(result.motion!.lc).toBe(result.motion!.ls);
},SCENE);

worldTest('routes.driving real mirrored source curve uses final row centrifugal stage and bounds',()=>{
  const sourceData=data(),row=sourceData.segments.findIndex(value=>value.mirror&&Math.abs(value.curve)>=1.5&&value.gap>0);
  expect(row).toBeGreaterThan(0);
  const gap=sourceData.segments[row]!.gap,lateral=Math.fround(gap/1600);
  const driver={...terrain(),initialized:true,previousGap:gap,roadSide:1};
  const prepared=prepareRoutePlayerTick({...START,distance:row*150-702,legacySpeed:90,gear:1,lateral},driver,crash(),NONE,DT,sourceData);
  const result=finishRoutePlayerTick(prepared,sourceData,null),landing=sourceData.segments[result.driver.segment]!;
  const delta=terrainCentrifugalDelta(prepared.driving.legacySpeed,prepared.cap,landing.curve,landing.mirror,1,DT);
  expect(result.motion!.drift).toBe(delta);
  expect(result.driving.lateral).toBe(boundTerrainLateral(result.motion!.lr,landing.gap,landing.mirror,1));
  expect(result.motion!.lc).toBe(Math.fround(result.motion!.ls+Math.fround(Math.fround(landing.gap-gap)/1600)));
},SCENE);

worldTest('routes.driving running spin transfers captured state and advances cadence once in destination',()=>{
  const recovery=spin(),source={...START,distance:881897,legacySpeed:200,gear:1,lateral:-.5};
  const prepared=prepareRoutePlayerTick(source,terrain(),recovery,{...NONE,throttle:true,right:true},DT,data());
  expect(prepared.driving.distance).toBe(882097);expect(prepared.crash.cadenceTick).toBe(0);
  const result=finishRoutePlayerTick(prepared,data(3),{outgoingCamera:882097});
  expect(result.driving.distance).toBe(0);expect(result.crash.phase).toBe(1);
  expect(result.crash.cadenceTick).toBe(1);expect(result.crash.advances).toBe(0);
  for(const key of ['variant','kind','impactSpeed','handlingCap','collisionDir','curve','decrement','consumedAcceptedCount'] as const)
    expect(result.crash[key]).toBe(recovery[key]);
  expect(result.crash.mapId).toBe(3);expect(result.lockedThisTick).toBe(true);expect(result.driving.steering).toBe(0);
  expect(result.driver.previousGap).toBe(0);expect(result.motion!.previousGap).toBe(0);
  expect(result.motion!.z0).toBe(702);expect(result.motion!.z1).toBe(702);expect(result.motionMode).toBe('endpoint');
  expect(result.driver.leftEffect).toBe(1);expect(result.driver.rightEffect).toBe(1);
},SCENE);

worldTest('routes.driving traffic crash retreat truncates before zero clamp with no second movement',()=>{
  const recovery=spin(19.230766,2),source={...START,distance:45000,legacySpeed:Math.fround(19.230766),lateral:-.5};
  const prepared=prepareRoutePlayerTick(source,terrain(),recovery,NONE,DT,data());
  expect(prepared.driving.distance).toBe(44990);
  const result=finishRoutePlayerTick(prepared,data(),null);
  expect(result.driving.distance).toBe(44990);expect(result.motion!.z0).toBe(45702);expect(result.motion!.z1).toBe(45692);
  const zero=prepareRoutePlayerTick({...source,distance:0,legacySpeed:.1},terrain(),spin(.1,2),NONE,DT,data());
  expect(zero.driving.distance).toBe(0);expect(finishRoutePlayerTick(zero,data(),null).driving.distance).toBe(0);
},SCENE);

worldTest('routes.driving reaction recenter completion stays locked then held throttle regains control next tick',()=>{
  const waiting={...spin(),phase:2,reactionTick:104},source={...START,legacySpeed:0,gear:0,lateral:0};
  const ready=finishRoutePlayerTick(prepareRoutePlayerTick(source,terrain(),waiting,{...NONE,throttle:true},DT,data()),data(),null);
  expect(ready.crash.phase).toBe(3);expect(ready.crash.reactionTick).toBe(105);expect(ready.lockedThisTick).toBe(true);
  expect(ready.driver.recentering).toBe(true);expect(ready.driver.leftEffect).toBe(0);expect(ready.driver.rightEffect).toBe(0);
  const complete=finishRoutePlayerTick(prepareRoutePlayerTick({...source,...ready.driving},ready.driver,ready.crash,{...NONE,throttle:true},DT,data()),data(),null);
  expect(complete.crash.phase).toBe(0);expect(complete.lockedThisTick).toBe(true);expect(complete.driving.legacySpeed).toBe(0);
  expect(complete.driver.recentering).toBe(false);
  const next=finishRoutePlayerTick(prepareRoutePlayerTick({...source,...complete.driving},complete.driver,complete.crash,{...NONE,throttle:true},DT,data()),data(),null);
  expect(next.lockedThisTick).toBe(false);expect(next.driving.legacySpeed).toBeGreaterThan(0);
},SCENE);

worldTest('routes.driving recenter target follows real destination and paused phases retain counters',()=>{
  const sourceData=data(),row=sourceData.segments.findIndex(value=>value.gap>8000),gap=sourceData.segments[row]!.gap;
  expect(row).toBeGreaterThan(0);
  const source={...START,distance:row*150-702,lateral:Math.fround(gap/1600),legacySpeed:0};
  const recovery={...spin(),phase:3,recenterTarget:Math.fround(gap/1600)};
  const prepared=prepareRoutePlayerTick(source,{...terrain(),roadSide:1,previousGap:gap},recovery,NONE,DT,sourceData);
  const result=finishRoutePlayerTick(prepared,data(2),{outgoingCamera:prepared.driving.distance});
  expect(result.crash.recenterTarget).toBe(0);
  for(const key of ['variant','kind','impactSpeed','handlingCap','curve','collisionDir','decrement','cadenceTick','advances','reactionTick','consumedAcceptedCount'] as const)
    expect(result.crash[key]).toBe(recovery[key]);
  expect(result.driver.roadSide).toBe(nearestTerrainRoad(result.driving.lateral,0));
  expect(result.lockedThisTick).toBe(true);expect(result.motionMode).toBe('endpoint');
  for(const phase of [1,2,3]){
    const held={...spin(),phase,reactionTick:phase===2?3:0};
    const paused=prepareRoutePlayerTick({...START,playing:false},terrain(),held,{...NONE,throttle:true},DT,sourceData);
    const before=JSON.stringify(paused),result=finishRoutePlayerTick(paused,sourceData,null);
    expect(result.crash).toEqual(held);expect(result.driving.distance).toBe(45000);expect(result.motionMode).toBe('none');
    expect(JSON.stringify(paused)).toBe(before);
  }
},SCENE);

worldTest('routes.driving ordinary stopped outside uses latched source recenter and rejects invalid cadence maps',()=>{
  const result=finishRoutePlayerTick(prepareRoutePlayerTick({...START,lateral:1.4},terrain(),crash(),{...NONE,throttle:true},DT,data()),data(),null);
  expect(result.driver.recentering).toBe(true);expect(result.driving.legacySpeed).toBe(0);
  expect(result.driving.lateral).toBeLessThan(1.4);expect(result.driving.distance).toBe(45000);
  reject(()=>prepareRoutePlayerTick(START,terrain(),crash(),NONE,1/30,data()));
  reject(()=>prepareRoutePlayerTick({...START,distance:45000.5},terrain(),crash(),NONE,DT,data()));
  reject(()=>prepareRoutePlayerTick(START,terrain(2),crash(),NONE,DT,data()));
  const prepared=prepareRoutePlayerTick(START,terrain(),crash(),NONE,DT,data());
  reject(()=>finishRoutePlayerTick(prepared,data(2),null));
  reject(()=>finishRoutePlayerTick(prepared,data(2),{outgoingCamera:1}));
},SCENE);

worldTest('routes.driving full camera modulo retains raw forward spin trajectory without a reverse chord',()=>{
  const sourceData=data(),length=sourceData.totalCount*150;
  const source={...START,distance:length-1,legacySpeed:120,gear:1,lateral:-.5};
  const prepared=prepareRoutePlayerTick(source,terrain(),spin(120),NONE,DT,sourceData);
  expect(prepared.unwrappedCamera).toBe(length+119);expect(prepared.driving.distance).toBe(119);
  const result=finishRoutePlayerTick(prepared,sourceData,null);
  expect(result.driving.distance).toBe(119);expect(result.motion!.z0).toBe(length+701);
  expect(result.motion!.z1).toBe(length+821);expect(result.motion!.z1-result.motion!.z0).toBe(120);
  expect(result.motionMode).toBe('sweep');expect(result.crash.cadenceTick).toBe(1);
},SCENE);

worldTest('routes.driving player offset and raw NPC wrap share canonical rows without changing raw motion',()=>{
  const sourceData=data(),length=sourceData.totalCount*150;
  const source={...START,distance:length-750,legacySpeed:100,gear:1};
  const prepared=prepareRoutePlayerTick(source,terrain(),crash(),NONE,DT,sourceData);
  const result=finishRoutePlayerTick(prepared,sourceData,null);
  expect(result.motion!.z0).toBe(length-48);expect(result.motion!.z1).toBe(length+51);
  expect(sampleRouteZ(sourceData,result.motion!.z0).lap).toBe(0);
  expect(sampleRouteZ(sourceData,result.motion!.z1).lap).toBe(1);
  expect(sampleRouteZ(sourceData,result.motion!.z1).canonicalZ).toBe(51);
  const oldNpc=length-50,nextNpc=sourceRouteTrafficZ(oldNpc,120);
  expect(nextNpc).toBe(length+70);expect(nextNpc-oldNpc).toBe(120);
  expect(sampleRouteZ(sourceData,nextNpc).canonicalZ).toBe(70);
  expect(result.motionMode).toBe('sweep');
},SCENE);

worldTest('routes.driving reverse offset wrap and retreat zero clamp retain their raw endpoint stages',()=>{
  const sourceData=data(),length=sourceData.totalCount*150;
  const prepared=prepareRoutePlayerTick({...START,distance:length-700,legacySpeed:20,lateral:-.5},terrain(),spin(20,2),NONE,DT,sourceData);
  const result=finishRoutePlayerTick(prepared,sourceData,null);
  expect(result.motion!.z0).toBe(length+2);expect(result.motion!.z1).toBe(length-8);
  expect(sampleRouteZ(sourceData,result.motion!.z0).lap).toBe(1);
  expect(sampleRouteZ(sourceData,result.motion!.z1).lap).toBe(0);
  expect(result.motion!.z1-result.motion!.z0).toBe(-10);
  const zero=finishRoutePlayerTick(prepareRoutePlayerTick({...START,distance:1,legacySpeed:20},terrain(),spin(20,2),NONE,DT,sourceData),sourceData,null);
  expect(zero.driving.distance).toBe(0);expect(zero.motion!.z0).toBe(703);expect(zero.motion!.z1).toBe(702);
},SCENE);
