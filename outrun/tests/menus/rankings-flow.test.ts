import {worldTest,expect} from '@gameengine/test';
import {EnterScene} from '@gameengine/runtime';
import {RankingsFlow} from '../../src/ui/rankings-flow.ts';
import {RankingStore} from '../../src/content/rankings.ts';
import {MenuAction,MenuPage} from '../../src/sim/pre-race-selection.ts';
import {PreRaceAction,PreRaceSelection,RaceMode,RaceState,DrivingState} from '../../src/schema.gen.ts';
import {recordedScene} from '../helpers/recorded-scene.ts';
import preRaceScene from '../../scenes/pre-race.scene.json';
const bucket={mode:0,difficulty:1,population:20};

worldTest('rankings.flow explicit three-letter confirmation saves once; timeout and cancel do not save',()=>{
  let saved:unknown=null,closed=0;
  const store=new RankingStore({get:()=>saved,set:(_,value)=>{saved=value;}});
  const candidate={score:100,totalTicks:12345,submissionId:'flow:1'};
  const flow=new RankingsFlow(store,bucket,candidate,1000,()=>{closed++;});
  expect(flow.model().rows[0]!.name).toBe('___');
  flow.input('confirm');expect(closed).toBe(0);expect(saved).toBe(null);
  flow.input('A');flow.input('nextLetter');flow.input('addLetter');flow.input('C');
  expect(flow.model().rows[0]!.name).toBe('ABC');
  flow.input('confirm');flow.input('confirm');
  expect(closed).toBe(1);expect(store.rows(bucket)[0]!.name).toBe('ABC');
  expect(store.rows(bucket).filter(row=>row.score===100).length).toBe(1);
  const expired=new RankingsFlow(store,bucket,{...candidate,score:200,submissionId:'flow:2'},1000,()=>{closed++;});
  for(const key of ['X','Y','Z'])expired.input(key);
  expired.tick(29000);expired.input('confirm');
  expect(closed).toBe(2);expect(store.rows(bucket)[0]!.score).toBe(100);
  const canceled=new RankingsFlow(store,bucket,{...candidate,score:300,submissionId:'flow:3'},1000,()=>{closed++;});
  canceled.input('close');expect(closed).toBe(3);expect(store.rows(bucket)[0]!.score).toBe(100);
  const browser=new RankingsFlow(store,bucket,undefined,0,()=>{});
  browser.input('nextMode');expect(browser.model().rows[0]!.score).toBe('90028512');
});

worldTest('rankings.flow denied storage retains score with visible warning and allows navigation',()=>{
  let closed=false;
  const store=new RankingStore({get(){throw Error('denied');},set(){throw Error('denied');}});
  const flow=new RankingsFlow(store,bucket,{score:100,totalTicks:60,submissionId:'denied:1'},0,()=>{closed=true;});
  for(const key of ['A','B','C'])flow.input(key);
  flow.input('confirm');expect(closed).toBe(false);expect(flow.model().entry).toBe(false);
  expect(flow.model().status).toBe(store.storageWarning);expect(store.rows(bucket)[0]!.score).toBe(100);
  flow.input('confirm');expect(closed).toBe(true);
});

worldTest('rankings.navigation browser keys cannot start race and returning home can start another mode',async ctx=>{
  ctx.input.key('KeyR',true);await ctx.step(1);ctx.input.key('KeyR',false);
  expect(ctx.world.resource(PreRaceSelection).page).toBe(MenuPage.Rankings);
  ctx.input.key('Enter',true);await ctx.step(1);ctx.input.key('Enter',false);
  expect(ctx.world.resource(PreRaceSelection).page).toBe(MenuPage.Rankings);
  ctx.input.emit(PreRaceAction,{action:MenuAction.Back,value:0});await ctx.step(1);
  expect(ctx.world.resource(PreRaceSelection).page).toBe(MenuPage.Home);
  for(const action of [MenuAction.Accept,MenuAction.Accept,MenuAction.Accept,MenuAction.Accept,MenuAction.Launch])ctx.input.emit(PreRaceAction,{action,value:0});
  await ctx.step(1);ctx.input.emit(EnterScene,{scene:recordedScene('scenes/original-race.scene.json'),release:''});await ctx.step(2);
  expect(ctx.world.resource(RaceState).initialized).toBe(true);
  ctx.world.setResource(RaceState,{phase:7,outcome:2});
  await ctx.step(1);
  const manual=ctx.world.resource(DrivingState).manual;
  ctx.input.key('KeyM',true);await ctx.step(1);ctx.input.key('KeyM',false);
  expect(ctx.world.resource(DrivingState).manual).toBe(manual);
  ctx.input.emit(PreRaceAction,{action:MenuAction.Home,value:0});ctx.input.emit(EnterScene,{scene:preRaceScene.guid,release:''});await ctx.step(2);
  expect(ctx.world.resource(DrivingState).active).toBe(false);
  expect(ctx.world.resource(PreRaceSelection).page).toBe(MenuPage.Home);
  expect(ctx.world.resource(PreRaceSelection).launch).toBe(false);
  for(const action of [MenuAction.Accept,MenuAction.Next,MenuAction.Next,MenuAction.Accept,MenuAction.Accept,MenuAction.Accept,MenuAction.Launch])ctx.input.emit(PreRaceAction,{action,value:0});
  await ctx.step(1);ctx.input.emit(EnterScene,{scene:recordedScene('scenes/original-race.scene.json'),release:''});await ctx.step(2);
  expect(ctx.world.resource(RaceMode).value).toBe(2);expect(ctx.world.resource(RaceState).initialized).toBe(true);
},{scene:'scenes/pre-race.scene.json'});
