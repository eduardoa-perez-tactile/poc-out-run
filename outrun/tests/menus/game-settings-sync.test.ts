import {worldTest,expect} from '@gameengine/test';
import {EnterScene} from '@gameengine/runtime';
import {GameSettingsStore,DEFAULT_GAME_SETTINGS} from '../../src/content/game-settings.ts';
import {GameSettingsSync} from '../../src/ui/game-settings-sync.ts';
import {MenuAction,MenuPage,encodeGameSettings,reducePreRace} from '../../src/sim/pre-race-selection.ts';
import {PreRaceSelection,PreRaceAction,RaceState,DrivingState} from '../../src/schema.gen.ts';
import {recordedScene} from '../helpers/recorded-scene.ts';

worldTest('save.game-settings recorded restore reaches actual race and final launch choices survive reopening',async ctx=>{
  const chosen={difficulty:2,population:32,manual:true,car:13};
  let saved:unknown={version:1,...chosen},writes=0;
  const storage={get:()=>saved,set:(_key:string,value:unknown)=>{saved=value;writes++;}};
  const sync=new GameSettingsSync(new GameSettingsStore(storage),value=>ctx.input.emit(PreRaceAction,{action:MenuAction.RestoreSettings,value}));
  sync.observe({...ctx.world.resource(PreRaceSelection)});
  // A second presentation observation before the recorded input lands cannot
  // overwrite valid saved preferences with the initial menu defaults.
  sync.observe({...ctx.world.resource(PreRaceSelection)});expect(writes).toBe(0);
  await ctx.step(1);
  let selection=ctx.world.resource(PreRaceSelection);
  for(const key of ['difficulty','population','manual','car'] as const)expect(selection[key]).toBe(chosen[key]);
  sync.observe({...selection});expect(writes).toBe(0);
  for(const action of [MenuAction.Accept,MenuAction.Accept,MenuAction.Accept,MenuAction.Previous,MenuAction.Accept,MenuAction.Launch])ctx.input.emit(PreRaceAction,{action,value:0});
  await ctx.step(1);selection=ctx.world.resource(PreRaceSelection);sync.observe({...selection});
  expect(writes).toBe(1);expect(new GameSettingsStore(storage).current()).toEqual({...chosen,car:12});
  ctx.input.emit(EnterScene,{scene:recordedScene('scenes/original-race.scene.json'),release:''});await ctx.step(2);
  expect(ctx.world.resource(RaceState).difficulty).toBe(2);expect(ctx.world.resource(RaceState).population).toBe(32);
  expect(ctx.world.resource(DrivingState).manual).toBe(true);expect(ctx.world.resource(PreRaceSelection).car).toBe(12);
},{scene:'scenes/pre-race.scene.json'});

worldTest('save.game-settings restore stays on Home, validates payload and never saves menu navigation',()=>{
  const before={...DEFAULT_GAME_SETTINGS,enabled:true,page:MenuPage.Home,launch:false,cursor:0,mode:0,held:0};
  const saved={difficulty:0,population:9,manual:true,car:5};
  const value=encodeGameSettings(saved);
  const restored=reducePreRace(before,MenuAction.RestoreSettings,value);
  expect(restored).toEqual({...before,...saved});
  for(const invalid of [-1,252,1.5,NaN])expect(reducePreRace(before,MenuAction.RestoreSettings,invalid)).toEqual(before);
  const racing={...before,enabled:false,launch:true,page:MenuPage.Race};
  expect(reducePreRace(racing,MenuAction.RestoreSettings,value)).toEqual(racing);
  let writes=0;
  const sync=new GameSettingsSync(new GameSettingsStore({get:()=>null,set:()=>{writes++;}}),()=>{throw Error('defaults need no restore');});
  sync.observe(before);sync.observe({...before,page:MenuPage.Options});sync.observe({...before,page:MenuPage.Mode});
  expect(writes).toBe(0);
});
