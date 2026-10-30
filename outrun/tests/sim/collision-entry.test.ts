import {worldTest,expect,type WorldTestContext} from '@gameengine/test';
import {EnterScene} from '@gameengine/runtime';
import {CollisionDriver,DrivingState,DrivingInput,DrivingControlChanged,TrafficArtPreview} from '../../src/schema.gen.ts';

const CONTACT='scenes/driving-contact.scene.json';
async function enter(ctx:WorldTestContext,scene:string){ctx.input.emit(EnterScene,{scene,release:''});await ctx.step(2);}
function cleanContact(ctx:WorldTestContext){
  expect(ctx.world.count(CollisionDriver)).toBe(1);
  expect(ctx.world.resource(DrivingInput)).toEqual({keyboard:0,ui:0,shiftUp:false,shiftDown:false,upHeld:false,downHeld:false,pauseHeld:false,modeHeld:false});
  expect(ctx.world.resource(DrivingState)).toEqual({active:true,playing:true,manual:false,legacySpeed:0,gear:0,steering:0,distance:45000,previousDistance:45000,lateral:0,previousLateral:0});
}
async function dirtyHolds(ctx:WorldTestContext){
  // Real recorded holds remain pressed across entry. No reset, pause, release,
  // cancellation or direct resource mutation may clean the destination for us.
  ctx.input.key('ArrowUp',true);ctx.input.key('ArrowLeft',true);
  ctx.input.key('KeyE',true);ctx.input.key('KeyQ',true);ctx.input.key('KeyM',true);
  ctx.input.emit(DrivingControlChanged,{control:3,source:1,down:true});
  await ctx.step(2); // Move the key-event rows out of the entry step's event batch.
  const held=ctx.world.resource(DrivingInput),driving=ctx.world.resource(DrivingState);
  expect(held.keyboard).toBe(5);expect(held.ui).toBe(8);
  expect(held.upHeld).toBe(true);expect(held.downHeld).toBe(true);expect(held.modeHeld).toBe(true);
  expect(driving.manual).toBe(true);expect(driving.legacySpeed).toBeGreaterThan(0);
}
worldTest('collision.entry recorded traffic and same-contact reentry clear every hold and preserve authored rest state',async ctx=>{
  await enter(ctx,'scenes/driving-traffic.scene.json');
  await dirtyHolds(ctx);
  await enter(ctx,CONTACT);cleanContact(ctx);
  await dirtyHolds(ctx);
  await enter(ctx,CONTACT);cleanContact(ctx);
  // Another ordinary step must stay at rest rather than reuse the old holds.
  await ctx.step(1);cleanContact(ctx);
});
worldTest('collision.entry recorded catalog and art transitions reset review mode and honor the last destination',async ctx=>{
  for(const [scene,mode] of [['scenes/traffic-catalog.scene.json',1],['scenes/traffic-art.scene.json',2]] as const){
    await enter(ctx,scene);
    expect(ctx.world.resource(TrafficArtPreview)).toEqual({mode,frame:1,caseId:0});
    await enter(ctx,CONTACT);cleanContact(ctx);
    expect(ctx.world.resource(TrafficArtPreview)).toEqual({mode:0,frame:1,caseId:0});
    // Both directions exercise actual recorded last-entry ownership; reads
    // follow two steps so write-only presentation commands have flushed.
    ctx.input.emit(EnterScene,{scene:CONTACT,release:''});
    ctx.input.emit(EnterScene,{scene,release:''});await ctx.step(2);
    expect(ctx.world.count(CollisionDriver)).toBe(0);
    expect(ctx.world.resource(DrivingState).active).toBe(false);
    expect(ctx.world.resource(TrafficArtPreview)).toEqual({mode,frame:1,caseId:0});
    ctx.input.emit(EnterScene,{scene,release:''});
    ctx.input.emit(EnterScene,{scene:CONTACT,release:''});await ctx.step(2);
    cleanContact(ctx);
    expect(ctx.world.resource(TrafficArtPreview)).toEqual({mode:0,frame:1,caseId:0});
  }
});
