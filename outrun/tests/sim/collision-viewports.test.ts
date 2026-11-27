import {worldTest,expect,type WorldTestContext} from '@gameengine/test';
import {EnterScene,math,type EntityId} from '@gameengine/runtime';
import {CollisionDriver,ContactAccepted,DrivingState,DrivingResetRequested,DrivingPauseRequested,
  TrafficPool,TrafficResetRequested,TrafficPassed,type ContactAcceptedValue,type DrivingStateValue,type TrafficPoolValue} from '../../src/schema.gen.ts';
import {loadMap01} from '../../src/content/biome.ts';

const f=math.fround;
const VIEWS=[[1280,720],[852,393],[1080,810]] as const;
// The native world-query wire prints shortest f32 decimals. Normalize only f32
// fields; preserve u32 identity/seed values rather than rounding them as floats.
function physicalDriving(value:DrivingStateValue):DrivingStateValue {
  return {...value,legacySpeed:f(value.legacySpeed),steering:f(value.steering),distance:f(value.distance),
    previousDistance:f(value.previousDistance),lateral:f(value.lateral),previousLateral:f(value.previousLateral)};
}
function physicalPool(value:TrafficPoolValue):TrafficPoolValue {
  return {...value,originZ:f(value.originZ),z:value.z.map(f),previousZ:value.previousZ.map(f),
    offset:value.offset.map(f),previousOffset:value.previousOffset.map(f),speed:value.speed.map(f),target:value.target.map(f),
    side:value.side.slice(),ai:value.ai.slice(),active:value.active.slice(),generation:value.generation.slice(),
    passed:value.passed.slice(),moving:value.moving.slice(),cooldown:value.cooldown.slice(),parked:value.parked.slice(),motionTicks:value.motionTicks.slice()};
}
function physicalEvent(value:ContactAcceptedValue):ContactAcceptedValue {
  return {...value,toi:f(value.toi),playerX:f(value.playerX),playerZ:f(value.playerZ),otherX:f(value.otherX),otherZ:f(value.otherZ),
    impactSpeed:f(value.impactSpeed),handlingCap:f(value.handlingCap),collisionDir:f(value.collisionDir),curve:f(value.curve)};
}
async function setup(ctx:WorldTestContext,view:readonly[number,number],distance:number,lateral:number){
  ctx.input.view(view[0],view[1],1);
  ctx.input.emit(EnterScene,{scene:'scenes/driving-contact.scene.json',release:''});await ctx.step(2);
  ctx.input.emit(DrivingPauseRequested,{paused:true});await ctx.step(1);
  ctx.input.emit(DrivingResetRequested,{manual:false,legacySpeed:200,distance,lateral});
  ctx.input.emit(TrafficResetRequested,{mapId:1,population:32,seedLo:9,seedHi:2596069104,originZ:0});
  ctx.input.emit(DrivingPauseRequested,{paused:true});await ctx.step(1);
  expect(ctx.world.count(CollisionDriver)).toBe(1);expect(ctx.world.count(TrafficPool)).toBe(1);
  expect(ctx.world.events(ContactAccepted).length).toBe(0);expect(ctx.world.events(TrafficPassed).length).toBe(0);
  const owner=ctx.world.entities(CollisionDriver)[0]!;
  expect(ctx.world.get(owner,CollisionDriver).ledgerCount).toBe(0);
  expect(ctx.world.get(owner,CollisionDriver).acceptedCount).toBe(0);
  return owner;
}
async function outcome(ctx:WorldTestContext,owner:EntityId,ticks:number,kind:number,id:number){
  const initial=ctx.world.get(owner,TrafficPool);
  const hits:{tick:number;event:ContactAcceptedValue;driving:DrivingStateValue;pool:TrafficPoolValue}[]=[];
  const passes:{tick:number;epoch:number;slot:number;generation:number;points:number}[]=[];
  ctx.input.emit(DrivingPauseRequested,{paused:false});
  for(let tick=0;tick<ticks;tick++){
    await ctx.step(1);
    const awarded=ctx.world.events(TrafficPassed);
    for(const pass of awarded)passes.push({tick,...pass});
    for(const hit of ctx.world.events(ContactAccepted)){
      expect(hit.kind).toBe(kind);expect(hit.id).toBe(id);expect(awarded.length).toBe(0);
      if(kind===2){
        expect(hit.slot).toBe(0);expect(hit.epoch).toBe(initial.epoch);expect(hit.generation).toBe(initial.generation[0]);
        expect(ctx.world.get(owner,TrafficPool).generation[0]).toBe(initial.generation[0]);
      }else{expect(hit.slot).toBe(1);expect(hit.epoch).toBe(0);expect(hit.generation).toBe(0);}
      hits.push({tick,event:physicalEvent(hit),driving:physicalDriving(ctx.world.resource(DrivingState)),pool:physicalPool(ctx.world.get(owner,TrafficPool))});
    }
  }
  expect(hits.length).toBe(1);expect(ctx.world.get(owner,CollisionDriver).acceptedCount).toBe(1);
  return {hits,passes,driving:physicalDriving(ctx.world.resource(DrivingState)),pool:physicalPool(ctx.world.get(owner,TrafficPool))};
}
worldTest('collision.viewports real authored roadside impact has identical contact and physical outcomes at three landscape sizes',async ctx=>{
  const data=loadMap01(),source=data.placements.find(row=>row.id===9451)!;
  expect(source.segment).toBe(1890);expect(data.definitions[source.definition]!.objectId).toBe(57);
  let reference:Awaited<ReturnType<typeof outcome>>|undefined;
  for(const view of VIEWS){
    const owner=await setup(ctx,view,283200-data.playerOffsetZ,f(-1886.494140625/1600));
    const actual=await outcome(ctx,owner,8,1,9451);
    if(reference)expect(actual).toEqual(reference);else reference=actual;
    console.log('collision.viewports roadside',{view,hit:actual.hits[0]!.event,contactTick:actual.hits[0]!.tick});
  }
});
worldTest('collision.viewports real seeded traffic old lifetime has identical contact and physical outcomes at three landscape sizes',async ctx=>{
  const data=loadMap01(),z=28100,gap=data.segments[Math.floor(z/data.segmentLength)]!.gap;
  let reference:Awaited<ReturnType<typeof outcome>>|undefined;
  for(const view of VIEWS){
    const owner=await setup(ctx,view,z-data.playerOffsetZ,f(gap/1600+.5));
    const actual=await outcome(ctx,owner,40,2,0);
    if(reference)expect(actual).toEqual(reference);else reference=actual;
    console.log('collision.viewports traffic',{view,hit:actual.hits[0]!.event,contactTick:actual.hits[0]!.tick});
  }
});
// Scene reentry advances global Time and motionStep, and ViewInfo is SIM input.
// Those are deliberately not equated: contacts, full driving state and every
// physical/lifetime pool field above must agree for the same recorded controls.
