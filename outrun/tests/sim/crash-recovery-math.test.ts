import {worldTest,expect} from '@gameengine/test';
import {math} from '@gameengine/runtime';
import type {ContactAcceptedValue,CrashDriverValue,ReadonlySourceBiomeData} from '../../src/schema.gen.ts';
import {loadMap01} from '../../src/content/biome.ts';
import {resetTerrainDriver,type TerrainDrivingSample} from '../../src/sim/terrain-math.ts';
import {validatePlayerMotion} from '../../src/sim/collision-motion.ts';
import {resetCrashRecovery,beginCrashRecovery,advanceCrashRecovery,crashLapCount,crashCadence} from '../../src/sim/crash-recovery-math.ts';
const q=math.fround,DT=q(1/60);
function driving(v=20,distance=45000,lateral=0):TerrainDrivingSample{return{legacySpeed:q(v),distance:q(distance),lateral:q(lateral),steering:.5,gear:v>=100?1:0,playing:true,manual:false};}
function terrain(state:TerrainDrivingSample,data=loadMap01()){
  const segment=Math.floor(q(state.distance+data.playerOffsetZ)/150);
  return {...resetTerrainDriver(),initialized:true,segment,previousGap:data.segments[segment]!.gap};
}
function contact(v=20,kind=1,cap=200,dir=0,curve=0):ContactAcceptedValue{
  return {kind,mapId:1,id:1525,epoch:0,generation:0,slot:0,toi:.5,stage:0,playerX:0,playerZ:45702,otherX:0,otherZ:45702,
    impactSpeed:q(v),handlingCap:cap,collisionDir:q(dir),curve:q(curve)};
}
function begin(v=20,kind=1,cap=200,dir=0,curve=0,variant:0|1=0){return beginCrashRecovery(resetCrashRecovery(),contact(v,kind,cap,dir,curve),variant,1);}
function advance(crash:CrashDriverValue,state:TerrainDrivingSample,driver=terrain(state),data:ReadonlySourceBiomeData=loadMap01()){
  return advanceCrashRecovery(crash,state,driver,data,DT);
}
worldTest('collision.recovery.math source severity and current-speed cadence have exact f32 threshold neighbors',()=>{
  const table=[
    [0,1],[19.999998092651367,1],[20,1],[20.000001907348633,2],
    [59.999996185302734,2],[60,2],[60.000003814697266,3],
    [119.99999237060547,3],[120,3],[120.00000762939453,4],[200,4],
  ] as const;
  for(const [v,laps] of table)expect(crashLapCount(v)).toBe(laps);
  for(const [v,period] of [[19.999998092651367,6],[20,5],[20.000001907348633,5],[59.999996185302734,5],[60,4],[60.000003814697266,4],[99.99999237060547,4],[100,3],[100.00000762939453,3],[200,3]] as const)expect(crashCadence(v)).toBe(period);
  let invalid=false;try{crashCadence(0);}catch{invalid=true;}expect(invalid).toBe(true);
});
worldTest('collision.recovery.math begin only latches a fresh phase without consuming motion or reaction time',()=>{
  const prior=resetCrashRecovery(),event=contact(120,2,75,-.25,.9),before=JSON.stringify({prior,event});
  const crash=beginCrashRecovery(prior,event,1,1);
  expect([crash.phase,crash.variant,crash.kind,crash.totalAdvances,crash.decrement,crash.advances,crash.cadenceTick]).toEqual([1,1,2,24,5,0,0]);
  expect(crash.handlingCap).toBe(75);expect(JSON.stringify({prior,event})).toBe(before);
  const zero=begin(0);expect(zero.phase).toBe(2);expect(zero.reactionTick).toBe(0);expect(zero.totalAdvances).toBe(0);expect(zero.decrement).toBe(0);
  for(const bad of [0,2]){let failed=false;try{beginCrashRecovery(prior,event,0,bad);}catch{failed=true;}expect(failed).toBe(true);}
});
worldTest('collision.recovery.math independent full spin schedules force the final stop with no residual lap',()=>{
  // Independently audited fixed60Hz f32 tables; these are not outputs of the helper under test.
  for(const [v,total,ticks,distance] of [[20,8,47,45520],[60,16,84,47546.25],[100,24,113,50379.16796875],[120,24,105,50810],[200,32,123,55968.75]] as const){
    let crash=begin(v),state=driving(v),driver=terrain(state),count=0;
    while(crash.phase===1&&count<200){
      const next=advance(crash,state,driver);crash=next.crash;state={...state,...next.driving};driver=next.driver;count++;
      validatePlayerMotion({kind:'player',...next.motion!},loadMap01());
    }
    expect(count).toBe(ticks);expect(crash.advances).toBe(total);expect(crash.phase).toBe(2);expect(crash.reactionTick).toBe(0);
    expect(state.distance).toBe(distance);expect(state.legacySpeed).toBe(0);expect(state.gear).toBe(0);expect(state.steering).toBe(0);
    expect(crash.collisionDir).toBe(0);expect(crash.curve).toBe(0);expect(driver.leftEffect).toBe(0);expect(driver.rightEffect).toBe(0);
  }
});
worldTest('collision.recovery.math dynamic cadence uses tick-entry speed across every band',()=>{
  let crash=begin(200),state=driving(200),driver=terrain(state),tick=0;
  const observed:number[]=[];
  while(crash.phase===1&&tick<150){const old=crash.advances,next=advance(crash,state,driver);crash=next.crash;state={...state,...next.driving};driver=next.driver;tick++;if(crash.advances!==old)observed.push(tick);}
  expect([observed[0],observed[16],observed[17],observed[22],observed[23],observed[28],observed[29],observed[31]]).toEqual([3,51,55,75,80,105,111,123]);
});
worldTest('collision.recovery.math longitudinal movement uses pre-decrement speed and exact port multiplication association',()=>{
  const state=driving(20),crash={...begin(20),cadenceTick:4},next=advance(crash,state);
  expect(next.driving.distance).toBe(45020);expect(next.driving.legacySpeed).toBe(17.5);
  const association=advance(begin(q(129.12345)),driving(q(129.12345),0));
  expect(association.driving.distance).toBe(129.12344360351562);
  // An extraq(speed*60) changes that delta to129.1234588623047 and is forbidden.
  const backward=advance(begin(20,2),driving(20,10));
  expect(backward.driving.distance).toBe(0);expect(backward.crash.phase).toBe(1);expect(backward.crash.cadenceTick).toBe(1);
  expect(backward.driver.leftEffect).toBe(1);expect(backward.driver.rightEffect).toBe(1);
});
worldTest('collision.recovery.math real source curve combines post-speed collision drift and row CF with captured cap',()=>{
  const data=loadMap01(),distance=2353*150-702+10;
  expect(data.segments[2353]!.curve).toBe(3);expect(data.segments[2353]!.mirror).toBe(false);
  const state=driving(100,distance,-.2),left=advance(begin(100,1,200,-.2,.9),state);
  expect(left.motion!.ls).toBe(-0.19850000739097595);expect(left.motion!.drift).toBe(-0.01388888992369175);expect(left.motion!.lr).toBe(-0.21238890290260315);
  const cap75=advance(begin(100,1,75,-.2,.9),state);
  expect(cap75.motion!.ls).toBe(-0.19699999690055847);expect(cap75.motion!.drift).toBe(-0.0277777798473835);expect(cap75.motion!.lr).toBe(-0.22477777302265167);
  const offroad=advance(begin(100,1,200,-1.49,.9),driving(100,distance,-1.49));
  expect(offroad.driving.legacySpeed).toBe(100);expect(offroad.motion!.handlingCap).toBe(200);expect(offroad.driving.lateral).toBe(-1.5);
  validatePlayerMotion({kind:'player',...offroad.motion!},data);
});
worldTest('collision.recovery.math controlled mirrored-curve fixture reverses CF while preserving collision drift sign',()=>{
  const data=loadMap01(),distance=2353*150-702+10,lateral=q(q(3192/1600)+q(.2)),state=driving(100,distance,lateral);
  const normal=advance(begin(100,1,200,lateral,.9),state);
  // Explicit mathematical fixture isolates mirror sign on the same+3row.
  // The separate real fork test covers actual mirrored curve−2; no asset/world is patched.
  const rows=[...data.segments];rows[2353]={...rows[2353]!,mirror:true};const mirrored={...data,segments:rows};
  const other=advance(begin(100,1,200,lateral,.9),state,terrain(state),mirrored);
  expect(normal.motion!.ls).toBe(2.19350004196167);expect(other.motion!.ls).toBe(normal.motion!.ls);
  expect(normal.motion!.lr).toBe(2.1796112060546875);expect(other.motion!.drift).toBe(0.01388888992369175);expect(other.motion!.lr).toBe(2.2073888778686523);
  expect(other.driving.lateral).toBeGreaterThan(state.lateral);expect(normal.driving.lateral).toBeLessThan(state.lateral);
  expect(data.segments[2353]!.mirror).toBe(false);
});
worldTest('collision.recovery.math post-decrement30.5 neighbors control actual own-row carry and close raw stages',()=>{
  const data=loadMap01(),distance=4353*150-712,lateral=9.988749504089355;
  expect(data.segments[4353]!.curve).toBe(-2);expect(data.segments[4353]!.mirror).toBe(true);
  for(const [before,after,gate,lc,cf,raw] of [[34.312496185302734,30.499996185302734,false,9.987900733947754,0,9.987900733947754],[34.3125,30.5,true,10.030400276184082,-0.0025416668504476547,10.02785873413086],[34.312503814697266,30.500003814697266,true,10.030400276184082,-0.0025416670832782984,10.02785873413086]] as const){
    const state=driving(before,distance,lateral),crash={...begin(122),advances:23,cadenceTick:4},driver=terrain(state);
    expect(driver.previousGap).toBe(15662);const next=advance(crash,state,driver);
    expect(next.driving.distance).toBe(q(distance+q(before*60*DT)));expect(next.driving.legacySpeed).toBe(after);
    expect(next.driver.previousGap).toBe(15730);expect(next.motion!.carryApplied).toBe(gate);
    expect(next.motion!.ls).toBe(9.987900733947754);expect(next.motion!.lc).toBe(lc);expect(next.motion!.drift).toBe(cf);expect(next.motion!.lr).toBe(raw);
    validatePlayerMotion({kind:'player',...next.motion!},data);
  }
});
worldTest('collision.recovery.math stored previous gap is the actual carry operand before final bounds',()=>{
  const state=driving(100,4353*150-712,9.988749504089355),driver={...terrain(state),previousGap:1000};
  const next=advance(begin(100),state,driver);
  expect(next.motion!.previousGap).toBe(1000);expect(next.motion!.carryApplied).toBe(true);
  expect(next.motion!.lc).toBeGreaterThan(19);expect(next.driving.lateral).toBe(q(11.33125));
  validatePlayerMotion({kind:'player',...next.motion!},loadMap01());
});
worldTest('collision.recovery.math zero impact cleans stopped diagnostics on first following reaction tick and holds105ticks',()=>{
  let crash=begin(0,1,100,.5,.9),state={...driving(0,45000,.5),manual:true,gear:1,steering:.75},driver={...terrain(state),leftEffect:1,rightEffect:1,skidding:true};
  const untouched=JSON.stringify({crash,state,driver}),first=advance(crash,state,driver);
  expect(JSON.stringify({crash,state,driver})).toBe(untouched);expect(first.driving.gear).toBe(0);expect(first.driving.steering).toBe(0);
  expect(first.driver.leftEffect).toBe(0);expect(first.driver.rightEffect).toBe(0);expect(first.driver.skidding).toBe(false);expect(first.crash.reactionTick).toBe(1);
  crash=first.crash;state={...state,...first.driving};driver=first.driver;
  for(let tick=2;tick<=105;tick++){
    const next=advance(crash,state,driver);crash=next.crash;state={...state,...next.driving};driver=next.driver;
    expect(crash.reactionTick).toBe(tick);expect(crash.phase).toBe(tick<105?2:3);expect(state.distance).toBe(45000);expect(state.lateral).toBe(.5);
    expect(next.lockedThisTick).toBe(true);validatePlayerMotion({kind:'player',...next.motion!},loadMap01());
  }
  expect(driver.recentering).toBe(true);expect(crash.recenterTarget).toBe(0);
});
worldTest('collision.recovery.math recenter latches canonical center with left tie and unlocks only after a pre-move tolerance check',()=>{
  const gap=loadMap01().segments[304]!.gap,tie=q(gap/3200),state=driving(0,45000,tie);
  const entered=advance({...begin(0),reactionTick:104},state);
  expect(entered.crash.phase).toBe(3);expect(entered.crash.recenterTarget).toBe(0);expect(entered.driving.lateral).toBe(tie);
  let crash={...begin(0),phase:3,reactionTick:105,recenterTarget:0},s=driving(0,45000,q(.051));
  const move=advance(crash,s);expect(move.crash.phase).toBe(3);expect(move.driver.recentering).toBe(true);expect(move.driving.lateral).toBe(0.038999997079372406);
  const complete=advance(move.crash,{...s,...move.driving},move.driver);
  expect(complete.crash.phase).toBe(0);expect(complete.lockedThisTick).toBe(true);expect(complete.driver.recentering).toBe(false);expect(complete.driving.lateral).toBe(move.driving.lateral);
  const idle=advance(complete.crash,{...s,...complete.driving},complete.driver);
  expect(idle.lockedThisTick).toBe(false);expect(idle.motion).toBe(undefined);
  const right=advance({...begin(0),reactionTick:104},driving(0,45000,3.8));
  const latched=advance(right.crash,{...s,...right.driving},{...right.driver,roadSide:0,recenterTarget:0});
  expect(latched.crash.recenterTarget).toBe(q(gap/1600));expect(latched.driving.lateral).toBeLessThan(right.driving.lateral);
});
worldTest('collision.recovery.math pause freezes every phase and bounded endpoint cancels even while paused',()=>{
  for(const phase of [1,2,3]){
    const crash={...begin(20),phase,reactionTick:phase===3?105:0},state={...driving(20),playing:false},driver=terrain(state),before=JSON.stringify({crash,state,driver});
    const next=advance(crash,state,driver);
    expect(next.crash).toEqual(crash);expect(next.driver).toEqual(driver);expect(next.motion).toBe(undefined);expect(next.lockedThisTick).toBe(true);
    expect(JSON.stringify({crash,state,driver})).toBe(before);
  }
  const end=advance({...begin(200),phase:3,reactionTick:105},{...driving(200,882450),playing:false});
  expect(end.crash).toEqual(resetCrashRecovery());expect(end.driving.playing).toBe(false);expect(end.driving.legacySpeed).toBe(0);
  expect(end.driver.sectionEnd).toBe(true);expect(end.driver.recentering).toBe(false);expect(end.driver.leftEffect).toBe(0);expect(end.motion).toBe(undefined);expect(end.lockedThisTick).toBe(false);
  const crossing=advance(begin(200),driving(200,882400));expect(crossing.driving.distance).toBe(882450);expect(crossing.driver.sectionEnd).toBe(true);expect(crossing.crash.phase).toBe(0);
});
worldTest('collision.recovery.math both latched visual variants have identical physics and timers',()=>{
  let a=begin(60,2,100,.4,0,0),b=begin(60,2,100,.4,0,1),s=driving(60),driver=terrain(s);
  for(let tick=0;tick<90;tick++){
    const left=advance(a,s,driver),right=advance(b,s,driver);
    expect(right.driving).toEqual(left.driving);expect(right.driver).toEqual(left.driver);expect(right.motion).toEqual(left.motion);
    expect({...right.crash,variant:0}).toEqual(left.crash);a=left.crash;b=right.crash;s={...s,...left.driving};driver=left.driver;
  }
});
