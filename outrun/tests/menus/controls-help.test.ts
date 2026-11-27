import {worldTest,expect} from '@gameengine/test';
import {EnterScene} from '@gameengine/runtime';
import {PreRaceSelection,PreRaceAction,DrivingState,RaceState} from '../../src/schema.gen.ts';
import {MenuAction,MenuPage,reducePreRace} from '../../src/sim/pre-race-selection.ts';
import {recordedScene} from '../helpers/recorded-scene.ts';

worldTest('menus.controls-help keyboard and touch navigation preserve choices and can launch afterward',async ctx=>{
  await ctx.step(1);
  ctx.input.key('KeyH',true);await ctx.step(1);ctx.input.key('KeyH',false);
  expect(ctx.world.resource(PreRaceSelection).page).toBe(MenuPage.Help);
  const choices={...ctx.world.resource(PreRaceSelection)};
  ctx.input.key('Enter',true);ctx.input.key('ArrowRight',true);ctx.input.key('Space',true);await ctx.step(1);
  ctx.input.key('Enter',false);ctx.input.key('ArrowRight',false);ctx.input.key('Space',false);
  expect(ctx.world.resource(PreRaceSelection).page).toBe(MenuPage.Help);
  expect(ctx.world.resource(DrivingState).active).toBe(false);
  ctx.input.key('Escape',true);await ctx.step(2);ctx.input.key('Escape',false);
  expect(ctx.world.resource(PreRaceSelection).page).toBe(MenuPage.Home);
  // Touch uses the same recorded menu actions as the help/back document buttons.
  ctx.input.emit(PreRaceAction,{action:MenuAction.Help,value:0});await ctx.step(1);
  expect(ctx.world.resource(PreRaceSelection).page).toBe(MenuPage.Help);
  ctx.input.emit(PreRaceAction,{action:MenuAction.Back,value:0});await ctx.step(1);
  ctx.input.key('KeyH',true);await ctx.step(1);ctx.input.key('KeyH',false);
  expect(ctx.world.resource(PreRaceSelection).page).toBe(MenuPage.Help);
  ctx.input.emit(PreRaceAction,{action:MenuAction.Back,value:0});await ctx.step(1);
  const returned=ctx.world.resource(PreRaceSelection);
  for(const key of ['mode','difficulty','population','manual','car'] as const)expect(returned[key]).toBe(choices[key]);
  for(const action of [MenuAction.Accept,MenuAction.Accept,MenuAction.Accept,MenuAction.Accept,MenuAction.Launch])ctx.input.emit(PreRaceAction,{action,value:0});
  await ctx.step(1);ctx.input.emit(EnterScene,{scene:recordedScene('scenes/original-race.scene.json'),release:''});await ctx.step(2);
  expect(ctx.world.resource(RaceState).initialized).toBe(true);
  expect(ctx.world.resource(DrivingState).active).toBe(true);
},{scene:'scenes/pre-race.scene.json'});

worldTest('menus.controls-help cannot open over radio or an active race',()=>{
  const before={enabled:true,page:MenuPage.Radio,cursor:0,mode:2,difficulty:0,population:9,manual:true,car:13,held:0,launch:false};
  expect(reducePreRace(before,MenuAction.Help)).toEqual(before);
  const racing={...before,page:MenuPage.Race,enabled:false,launch:true};
  expect(reducePreRace(racing,MenuAction.Help)).toEqual(racing);
});
