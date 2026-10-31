import {worldTest,expect,type WorldTestContext} from '@gameengine/test';
import {EnterScene,math} from '@gameengine/runtime';
import {CrashDriver,CollisionDriver,TerrainDriver,TrafficPool,TrafficPassed,ContactAccepted,DrivingState,DrivingInput,
  DrivingResetRequested,DrivingPauseRequested,TrafficResetRequested,DrivingControlsCancelled,DrivingControlChanged,
  type ContactAcceptedValue} from '../../src/schema.gen.ts';
import {loadMap01} from '../../src/content/biome.ts';

const q=math.fround;
const SEED={mapId:1,population:32,seedLo:9,seedHi:2596069104,originZ:0};
type Controls='held'|'released'|'cancelled'|'fresh';
interface Fixture {name:string;kind:1|2;z:number;speed:number;controls:Controls}
const fixtures:readonly Fixture[]=[
  {name:'low roadside',kind:1,z:283400,speed:20,controls:'released'},
  {name:'high roadside',kind:1,z:283200,speed:200,controls:'held'},
  {name:'low seeded rear traffic',kind:2,z:28750,speed:20,controls:'fresh'},
  {name:'high seeded traffic',kind:2,z:28100,speed:200,controls:'cancelled'},
];
function cadence(speed:number){return speed>=100?3:speed>=60?4:speed>=20?5:6;}
function physicalHit(hit:ContactAcceptedValue){return {...hit,toi:q(hit.toi),playerX:q(hit.playerX),playerZ:q(hit.playerZ),otherX:q(hit.otherX),otherZ:q(hit.otherZ),impactSpeed:q(hit.impactSpeed),handlingCap:q(hit.handlingCap),collisionDir:q(hit.collisionDir),curve:q(hit.curve)};}
async function run(ctx:WorldTestContext,fixture:Fixture,view:readonly[number,number]=[1280,720]){
  const {world,input,step}=ctx,data=loadMap01();
  input.view(view[0],view[1],1);
  input.emit(EnterScene,{scene:'scenes/driving-crash.scene.json',release:''});await step(2);
  input.emit(DrivingPauseRequested,{paused:true});await step(1);
  const lateral=fixture.kind===1?q(-1886.494140625/1600):q(data.segments[Math.floor(fixture.z/150)]!.gap/1600+.5);
  input.emit(DrivingResetRequested,{manual:false,legacySpeed:fixture.speed,distance:fixture.z-data.playerOffsetZ,lateral});
  input.emit(TrafficResetRequested,SEED);input.emit(DrivingPauseRequested,{paused:true});await step(1);
  expect(world.count(CrashDriver)).toBe(1);
  const owner=world.entities(CrashDriver)[0]!,initialPool=world.get(owner,TrafficPool);
  expect(world.get(owner,CrashDriver).phase).toBe(0);
  input.emit(DrivingPauseRequested,{paused:false});
  let hit:ContactAcceptedValue|undefined,contactTick=-1;
  for(let tick=0;tick<50&&!hit;tick++){
    await step(1);const events=world.events(ContactAccepted);
    if(!events.length)continue;
    expect(events.length).toBe(1);hit=physicalHit(events[0]!);contactTick=tick;
    const driving=world.resource(DrivingState),motion=world.get(owner,CollisionDriver),crash=world.get(owner,CrashDriver);
    expect(hit.kind).toBe(fixture.kind);expect(hit.id).toBe(fixture.kind===1?9451:0);
    expect(q(driving.distance)).toBe(q(q(motion.z1)-data.playerOffsetZ));
    expect(q(driving.lateral)).toBe(q(motion.lf));expect(q(driving.legacySpeed)).toBe(hit.impactSpeed);
    expect(crash.phase).toBe(1);expect(crash.pendingStep).toBe(0);expect(crash.advances).toBe(0);expect(crash.cadenceTick).toBe(0);
    expect(crash.consumedAcceptedCount).toBe(motion.acceptedCount);expect(motion.locked).toBe(true);
    const impactTerrain=world.get(owner,TerrainDriver);
    expect(impactTerrain.leftEffect).toBe(hit.impactSpeed>0?1:0);expect(impactTerrain.rightEffect).toBe(hit.impactSpeed>0?1:0);
    expect(impactTerrain.skidding).toBe(false);expect(impactTerrain.recentering).toBe(false);
    expect(world.events(TrafficPassed).length).toBe(0);
    if(fixture.kind===2){expect(hit.epoch).toBe(initialPool.epoch);expect(hit.generation).toBe(initialPool.generation[0]);}
    expect(fixture.speed<=20?hit.impactSpeed<=20:hit.impactSpeed>120).toBe(true);
  }
  expect(hit!==undefined).toBe(true);if(!hit)throw new Error(`Missing authentic ${fixture.name} contact`);
  const accepted=world.get(owner,CollisionDriver).acceptedCount,variant=world.get(owner,CrashDriver).variant;
  expect(variant===0||variant===1).toBe(true);
  let reactions=0,sawRecenter=false,prunedWhileLocked=false,changedControls=false,finished=false;
  const trace:number[][]=[];
  for(let tick=0;tick<1200;tick++){
    const before=world.get(owner,CrashDriver),physical=world.resource(DrivingState);
    if(tick===0&&fixture.controls!=='fresh'){
      input.key('ArrowUp',true);input.key('ArrowLeft',true);input.key('ArrowDown',true);
      if(fixture.controls==='cancelled')input.emit(DrivingControlChanged,{source:1,control:0,down:true});
    }
    if(tick===3&&fixture.controls!=='fresh')input.key('ArrowDown',false);
    if(before.phase===2&&before.reactionTick===7&&!changedControls){
      if(fixture.controls==='released'){input.key('ArrowUp',false);input.key('ArrowLeft',false);}
      if(fixture.controls==='cancelled')input.emit(DrivingControlsCancelled,{});
      changedControls=true;
    }
    await step(1);
    const after=world.get(owner,CrashDriver),driving=world.resource(DrivingState),terrain=world.get(owner,TerrainDriver),detector=world.get(owner,CollisionDriver);
    expect(world.events(ContactAccepted).length).toBe(0);expect(world.events(TrafficPassed).length).toBe(0);
    expect(detector.acceptedCount).toBe(accepted);expect(after.consumedAcceptedCount).toBe(accepted);expect(after.pendingStep).toBe(0);expect(after.variant).toBe(variant);
    expect(detector.locked).toBe(true);expect(terrain.skidding).toBe(false);
    if(detector.ledgerCount===0)prunedWhileLocked=true;
    if(before.phase===1){
      const v=q(physical.legacySpeed),full=q(v*60*q(1/60));
      const expectedDistance=q(Math.max(0,Math.min(data.lastLine*150,q(q(physical.distance)+(fixture.kind===1?full:-q(full*q(.5)))))));
      expect(q(driving.distance)).toBe(expectedDistance);
      const advance=before.cadenceTick+1===cadence(v);
      expect(after.advances).toBe(before.advances+(advance?1:0));
      const expectedSpeed=advance?(after.advances===before.totalAdvances?0:q(Math.max(0,q(v-q(before.decrement))))):v;
      expect(q(driving.legacySpeed)).toBe(expectedSpeed);
      if(after.phase===2){expect(after.advances).toBe(after.totalAdvances);expect(after.reactionTick).toBe(0);}
    }
    if(before.phase===2){
      reactions++;expect(after.reactionTick).toBe(before.reactionTick+1);
      expect(q(driving.distance)).toBe(q(physical.distance));expect(q(driving.lateral)).toBe(q(physical.lateral));
      expect(driving.legacySpeed).toBe(0);expect(driving.gear).toBe(0);expect(driving.steering).toBe(0);
      if(reactions<105)expect(after.phase).toBe(2);else{expect(reactions).toBe(105);expect(after.phase).toBe(3);}
    }
    if(after.phase===1&&driving.legacySpeed>0){expect(terrain.leftEffect).toBe(1);expect(terrain.rightEffect).toBe(1);}
    else{expect(terrain.leftEffect).toBe(0);expect(terrain.rightEffect).toBe(0);}
    if(after.phase===3){sawRecenter=true;expect(terrain.recentering).toBe(true);}
    if(before.phase===3&&after.phase===3){
      const error=q(q(physical.lateral)-q(before.recenterTarget)),amount=q(Math.min(Math.abs(error),q(q(.72)*q(1/60))));
      expect(q(driving.lateral)).toBe(q(q(physical.lateral)+(error<0?amount:-amount)));
    }
    trace.push([after.phase,after.advances,after.cadenceTick,after.reactionTick,q(driving.distance),q(driving.lateral),q(driving.legacySpeed)]);
    if(after.phase===0){
      expect(before.phase).toBe(3);expect(terrain.recentering).toBe(false);
      expect(Math.abs(q(driving.lateral)-q(before.recenterTarget))).toBeLessThanOrEqual(q(.05));finished=true;break;
    }
  }
  expect(finished).toBe(true);expect(reactions).toBe(105);expect(sawRecenter).toBe(true);expect(prunedWhileLocked).toBe(true);
  // Complete recovery trace is captured before ordinary controls can differ.
  const control=world.resource(DrivingInput);
  if(fixture.controls==='held')expect(control.keyboard&5).toBe(5);
  else expect(control.keyboard).toBe(0);
  if(fixture.controls==='cancelled')expect(control.ui).toBe(0);
  await step(1);expect(world.get(owner,CollisionDriver).locked).toBe(false);
  if(fixture.controls==='held')expect(world.resource(DrivingState).legacySpeed).toBeGreaterThan(0);
  else{expect(world.resource(DrivingState).legacySpeed).toBe(0);input.key('ArrowUp',true);await step(1);expect(world.resource(DrivingState).legacySpeed).toBeGreaterThan(0);}
  console.log('collision.recovery authentic',{fixture:fixture.name,view,hit,contactTick,recoveryTicks:trace.length,reactionTicks:reactions,variant,hash:world.hash()});
  return {hit,trace};
}
for(const fixture of fixtures)worldTest(`collision.recovery.integration ${fixture.name} reaches exact reactions recenter and returned control`,async ctx=>{await run(ctx,fixture);});
worldTest('collision.recovery.integration landscape viewport inputs preserve physical phase outcomes',async ctx=>{
  const fixture:Fixture={name:'viewport traffic',kind:2,z:28100,speed:200,controls:'fresh'};
  let reference:Awaited<ReturnType<typeof run>>|undefined;
  for(const view of [[1280,720],[852,393],[1080,810]] as const){const result=await run(ctx,fixture,view);if(reference)expect(result).toEqual(reference);else reference=result;}
  // ViewInfo/global Time and the independently advancing crash variant RNG can
  // differ across these serial setups; compare physical traces, not world hash.
});

// Full recorded recovery:252steps; authoritative final hash58be6f66b0a1a872.
// The earlier in-test log precedes the runner final tick; it is not the tape hash.
worldTest.replay('tests/replays/collision_recovery_integration_high_seeded_traffic_reaches_exact_reactions_recenter_and_returned_control.greplay');
