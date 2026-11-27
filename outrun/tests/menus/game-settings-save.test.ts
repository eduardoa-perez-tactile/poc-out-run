import {worldTest,expect} from '@gameengine/test';
import {GameSettingsStore,DEFAULT_GAME_SETTINGS,GAME_SETTINGS_KEY} from '../../src/content/game-settings.ts';

worldTest('save.game-settings round-trips choices across reopen without duplicate writes or shared mutations',()=>{
  let saved:unknown=null,writes=0;
  const storage={get:()=>saved,set:(key:string,value:unknown)=>{expect(key).toBe(GAME_SETTINGS_KEY);saved=value;writes++;}};
  const first=new GameSettingsStore(storage);
  expect(first.current()).toEqual(DEFAULT_GAME_SETTINGS);
  first.save({...DEFAULT_GAME_SETTINGS});expect(writes).toBe(0);
  const selected={difficulty:2,population:32,manual:true,car:13};
  expect(first.save(selected)).toBe(true);expect(writes).toBe(1);
  first.save({...selected});expect(writes).toBe(1);
  selected.car=0;
  const reopened=new GameSettingsStore(storage);
  expect(reopened.current()).toEqual({difficulty:2,population:32,manual:true,car:13});
  const snapshot=reopened.current();snapshot.difficulty=0;
  expect(reopened.current().difficulty).toBe(2);
});

worldTest('save.game-settings malformed, unsupported and invalid saves recover source defaults',()=>{
  const valid={version:1,difficulty:0,population:9,manual:false,car:0};
  for(const saved of [null,'{',[],{...valid,version:2},{...valid,difficulty:3},{...valid,population:10},
    {...valid,manual:1},{...valid,car:14},{...valid,car:1.5},{version:1,difficulty:0}]){
    expect(new GameSettingsStore({get:()=>saved,set:()=>{}}).current()).toEqual(DEFAULT_GAME_SETTINGS);
  }
  const parsed=new GameSettingsStore({get:()=>JSON.stringify(valid),set:()=>{}});
  expect(parsed.current()).toEqual({difficulty:0,population:9,manual:false,car:0});
  expect(parsed.save({difficulty:1,population:20,manual:false,car:-1})).toBe(false);
  expect(parsed.current().difficulty).toBe(0);
});

worldTest('save.game-settings denied storage preserves session choices and avoids repeated failing writes',()=>{
  let attempts=0;
  const store=new GameSettingsStore({get(){throw Error('denied');},set(){attempts++;throw Error('denied');}});
  expect(store.storageUnavailable).toBe(true);expect(store.current()).toEqual(DEFAULT_GAME_SETTINGS);
  const chosen={difficulty:0,population:9,manual:true,car:5};
  expect(store.save(chosen)).toBe(false);expect(store.current()).toEqual(chosen);
  expect(store.save({...chosen})).toBe(false);expect(attempts).toBe(1);
});
