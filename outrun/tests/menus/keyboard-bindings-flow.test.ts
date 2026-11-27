import {worldTest,expect} from '@gameengine/test';
import {EnterScene,Keys} from '@gameengine/runtime';
import {DrivingBindings,KeyboardBindingsRequested,PreRaceSelection,PreRaceAction,DrivingState,DrivingInput,RaceState} from '../../src/schema.gen.ts';
import {DEFAULT_BINDINGS,resolveBindings,KeyboardBindingsStore} from '../../src/content/keyboard-bindings.ts';
import {BindingsEditor,KeyboardBindingsSync} from '../../src/ui/keyboard-bindings-flow.ts';
import {MenuAction,MenuPage,encodeGameSettings} from '../../src/sim/pre-race-selection.ts';
import {recordedScene} from '../helpers/recorded-scene.ts';

worldTest('bindings.editor captures a key, rejects duplicates and reserved keys, saves and reopens',()=>{
  let saved:unknown=null,closed=false;
  const storage={get:()=>saved,set:(_key:string,value:unknown)=>{saved=value;}};
  const store=new KeyboardBindingsStore(storage);
  const editor=new BindingsEditor({...DEFAULT_BINDINGS},bindings=>{store.save(bindings);},()=>{closed=true;});
  editor.intent('bind-throttle');editor.key(Keys.ArrowLeft);expect(editor.model().status).toBe('KEY ALREADY IN USE');
  editor.key(Keys.Space);expect(editor.model().capturing).toBe(true);
  editor.key(Keys.KeyW);expect(editor.model().throttle).toBe('ACCELERATE : W');
  expect(new KeyboardBindingsStore(storage).current().throttle).toBe(Keys.KeyW);
  let restored:unknown=null;
  const sync=new KeyboardBindingsSync(new KeyboardBindingsStore(storage),bindings=>{restored=bindings;});
  sync.observe(true,MenuPage.Home,{...DEFAULT_BINDINGS});expect((restored as typeof DEFAULT_BINDINGS|null)?.throttle).toBe(Keys.KeyW);
  sync.observe(true,MenuPage.Home,{...DEFAULT_BINDINGS});expect(store.current().throttle).toBe(Keys.KeyW);
  editor.key(Keys.Escape);expect(closed).toBe(true);
});

worldTest('bindings.recorded atomic restore drives all six actions and preserves fixed pause',async({world,input,step})=>{
  const custom={...DEFAULT_BINDINGS,left:Keys.ArrowRight,right:Keys.ArrowLeft,throttle:Keys.KeyW,brake:Keys.KeyS,up:Keys.KeyR,down:Keys.KeyF};
  input.emit(KeyboardBindingsRequested,custom);await step(1);
  expect(resolveBindings(world.resource(DrivingBindings))).toEqual(custom);
  input.emit(PreRaceAction,{action:MenuAction.RestoreSettings,value:encodeGameSettings({difficulty:1,population:20,manual:true,car:0})});
  for(const action of [MenuAction.Accept,MenuAction.Accept,MenuAction.Accept,MenuAction.Accept,MenuAction.Launch])input.emit(PreRaceAction,{action,value:0});
  await step(1);input.emit(EnterScene,{scene:recordedScene('scenes/original-race.scene.json'),release:''});await step(1);
  world.setResource(RaceState,{countdownTicks:1});await step(2);
  expect(world.resource(DrivingState).manual).toBe(true);
  input.key('ArrowUp',true);await step(1);expect(world.resource(DrivingInput).keyboard&1).toBe(0);input.key('ArrowUp',false);
  world.setResource(DrivingState,{legacySpeed:100,gear:0});
  input.key('KeyW',true);input.key('ArrowRight',true);input.key('KeyR',true);await step(1);
  expect(world.resource(DrivingInput).keyboard).toBe(5);expect(world.resource(DrivingState).gear).toBe(1);
  input.key('KeyR',false);input.key('ArrowRight',false);input.key('KeyF',true);await step(1);
  expect(world.resource(DrivingState).gear).toBe(0);
  input.key('KeyF',false);input.key('KeyW',false);input.key('KeyS',true);input.key('ArrowLeft',true);await step(1);
  expect(world.resource(DrivingInput).keyboard).toBe(10);
  input.key('Space',true);await step(1);expect(world.resource(RaceState).phase).toBe(8);
  // Reconfiguration during a live/paused race cannot change the active bindings.
  input.emit(KeyboardBindingsRequested,{...DEFAULT_BINDINGS});await step(1);
  expect(resolveBindings(world.resource(DrivingBindings))).toEqual(custom);
},{scene:'scenes/pre-race.scene.json'});

worldTest('bindings.help keyboard selection changes the live labels through recorded input',async({world,input,step})=>{
  input.emit(PreRaceAction,{action:MenuAction.Help,value:0});await step(1);
  const key=async(name:keyof typeof Keys)=>{input.key(name,true);await step(1);input.key(name,false);await step(1);};
  await key('ArrowDown');await key('ArrowDown');await key('Enter');await key('KeyW');
  expect(resolveBindings(world.resource(DrivingBindings)).throttle).toBe(Keys.KeyW);
  await key('Escape');expect(world.resource(PreRaceSelection).page).toBe(MenuPage.Home);
},{scene:'scenes/pre-race.scene.json'});
