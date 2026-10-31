import {worldTest,expect} from '@gameengine/test';
import {math} from '@gameengine/runtime';
import {loadMap01} from '../../src/content/biome.ts';
import {advanceTerrainDriving,resetTerrainDriver} from '../../src/sim/terrain-math.ts';
import {validatePlayerMotion,collisionPose} from '../../src/sim/collision-motion.ts';

const f=math.fround,DT=f(1/60),CONTROLS={throttle:false,brake:false,left:false,right:true,up:false,down:false};
worldTest('collision.terrain authoritative optional stages preserve normal handling and close two-row real fork steps',()=>{
  const data=loadMap01();
  for(const boundary of [4123,4353,4783]){
    const z=boundary*150-1,distance=f(z-data.playerOffsetZ),gap=data.segments[boundary-1]!.gap;
    const start={legacySpeed:200,gear:1,steering:0,lateral:f(f(gap/1600)+f(.2)),distance,playing:true,manual:false};
    const driver=resetTerrainDriver();
    const original=advanceTerrainDriving(start,driver,CONTROLS,DT,data);
    const captured=advanceTerrainDriving(start,driver,CONTROLS,DT,data,true);
    expect(original.motion).toBe(undefined);
    expect(captured.driving).toEqual(original.driving);expect(captured.driver).toEqual(original.driver);
    const motion=captured.motion!;expect(motion.carryApplied).toBe(true);
    expect(Math.floor(motion.z0/150)).toBe(boundary-1);expect(Math.floor(motion.z1/150)).toBe(boundary+1);
    expect(motion.previousGap).toBe(gap);expect(motion.l0).toBe(start.lateral);
    const player={kind:'player' as const,...motion};validatePlayerMotion(player,data);
    const end=collisionPose(player,1,Math.floor(motion.z1/150),data);
    expect(end).toEqual({x:f(captured.driving.lateral*1600),z:f(captured.driving.distance+702)});
    expect(f(motion.lc+motion.drift)).toBe(motion.lr);
  }
});
worldTest('collision.terrain actual inner-gap snap is published separately from raw continuous motion',()=>{
  const data=loadMap01(),distance=4353*150-702;
  // Below the source centrifugal/carry threshold, isolate the actual clamp.
  const start={legacySpeed:20,gear:0,steering:0,lateral:f(7.5),distance,playing:true,manual:false};
  const before={...resetTerrainDriver(),initialized:true,roadSide:1,previousGap:data.segments[4353]!.gap};
  const result=advanceTerrainDriving(start,before,{...CONTROLS,right:false},DT,data,true),motion=result.motion!;
  expect(motion.carryApplied).toBe(false);expect(motion.ls).toBe(7.5);expect(motion.lc).toBe(7.5);
  expect(motion.lr).toBe(7.5);expect(motion.lf).toBe(8.101249694824219);
  validatePlayerMotion({kind:'player',...motion},data);
  expect(result.driving.lateral).toBe(motion.lf);
});
worldTest('collision.terrain stored prior gap is preserved while left-road and low-speed carry gates remain closed',()=>{
  const data=loadMap01(),distance=4353*150-702,gap=data.segments[4353]!.gap;
  for(const [side,speed] of [[0,100],[1,30]] as const){
    const start={legacySpeed:speed,gear:0,steering:0,lateral:side===0?0:f(gap/1600),distance,playing:true,manual:false};
    const before={...resetTerrainDriver(),initialized:true,roadSide:side,previousGap:f(gap+68)};
    const result=advanceTerrainDriving(start,before,{...CONTROLS,right:false},DT,data,true),motion=result.motion!;
    expect(motion.previousGap).toBe(f(gap+68));expect(motion.carryApplied).toBe(false);
    expect(motion.lc).toBe(motion.ls);validatePlayerMotion({kind:'player',...motion},data);
  }
});
worldTest('collision.terrain carry uses exact new-speed30.5 and its adjacent f32 neighbors',()=>{
  const data=loadMap01(),distance=4353*150-702,gap=data.segments[4353]!.gap;
  // Source calibrated coasting at1/60 removes0.192307710647583. These
  // independent starting literals land immediately below/at/above30.5.
  for(const [speed,expected,enabled] of [
    [30.692306518554688,30.499998092651367,false],
    [30.69230842590332,30.5,true],
    [30.692310333251953,30.500001907348633,true],
  ] as const){
    const start={legacySpeed:speed,gear:0,steering:0,lateral:f(f(gap/1600)+f(.2)),distance,playing:true,manual:false};
    const before={...resetTerrainDriver(),initialized:true,roadSide:1,previousGap:f(gap+68)};
    const result=advanceTerrainDriving(start,before,{...CONTROLS,right:false},DT,data,true),motion=result.motion!;
    expect(result.driving.legacySpeed).toBe(expected);expect(motion.carryApplied).toBe(enabled);
    expect(motion.lc).toBe(enabled?f(motion.ls+f(-68/1600)):motion.ls);
    validatePlayerMotion({kind:'player',...motion},data);
  }
});
