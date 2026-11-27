import {worldTest,expect} from '@gameengine/test';
import type {KeyboardBindings} from '../../src/content/keyboard-bindings.ts';
import {Keys} from '@gameengine/runtime';
import {KeyboardBindingsStore,DEFAULT_BINDINGS,KEYBOARD_BINDINGS_KEY,validBindings,bindingProblem,resolveBindings,keyLabel} from '../../src/content/keyboard-bindings.ts';

worldTest('save.keyboard-bindings round-trips six choices without repeated writes or shared mutation',()=>{
  let saved:unknown=null,writes=0;
  const storage={get:()=>saved,set:(key:string,value:unknown)=>{expect(key).toBe(KEYBOARD_BINDINGS_KEY);saved=value;writes++;}};
  const store=new KeyboardBindingsStore(storage);
  expect(store.hasSavedBindings).toBe(false);expect(store.current()).toEqual(DEFAULT_BINDINGS);
  const selected:KeyboardBindings={left:Keys.KeyA,right:Keys.KeyD,throttle:Keys.KeyW,brake:Keys.KeyS,up:Keys.KeyR,down:Keys.KeyF};
  expect(store.save(selected)).toBe(true);store.save({...selected});expect(writes).toBe(1);
  const reopened=new KeyboardBindingsStore(storage);
  expect(reopened.hasSavedBindings).toBe(true);expect(reopened.current()).toEqual(selected);
  selected.left=Keys.KeyZ;const snapshot=reopened.current();snapshot.right=Keys.KeyX;
  expect(reopened.current().left).toBe(Keys.KeyA);expect(reopened.current().right).toBe(Keys.KeyD);
});

worldTest('save.keyboard-bindings source duplicate rules and reserved controls retain valid defaults',()=>{
  expect(resolveBindings({left:0,right:0,throttle:0,brake:0,up:0,down:0})).toEqual(DEFAULT_BINDINGS);
  expect(bindingProblem({...DEFAULT_BINDINGS},'left',Keys.ArrowRight)).toBe('KEY ALREADY IN USE');
  expect(bindingProblem({...DEFAULT_BINDINGS},'left',Keys.ArrowLeft)).toBe('KEY ALREADY IN USE');
  for(const code of [Keys.Space,Keys.KeyM,Keys.Escape])expect(bindingProblem({...DEFAULT_BINDINGS},'left',code).length>0).toBe(true);
  expect(bindingProblem({...DEFAULT_BINDINGS},'left',Keys.KeyA)).toBe('');
  expect(validBindings({...DEFAULT_BINDINGS,left:Keys.ArrowRight})).toBe(false);
  expect(keyLabel(Keys.KeyW)).toBe('W');expect(keyLabel(Keys.ArrowLeft)).toBe('LEFT');expect(keyLabel(Keys.Digit1)).toBe('1');
});

worldTest('save.keyboard-bindings corrupt or denied storage stays playable with session bindings',()=>{
  for(const value of [null,'{',[],{version:2,bindings:DEFAULT_BINDINGS},{version:1,bindings:{left:Keys.KeyA}},
    {version:1,bindings:{...DEFAULT_BINDINGS,left:0}},{version:1,bindings:{...DEFAULT_BINDINGS,left:Keys.Space}},
    {version:1,bindings:{...DEFAULT_BINDINGS,left:Keys.ArrowRight}}]){
    const store=new KeyboardBindingsStore({get:()=>value,set:()=>{}});
    expect(store.hasSavedBindings).toBe(false);expect(store.current()).toEqual(DEFAULT_BINDINGS);
  }
  let attempts=0;
  const denied=new KeyboardBindingsStore({get(){throw Error('denied');},set(){attempts++;throw Error('denied');}});
  const chosen={...DEFAULT_BINDINGS,left:Keys.KeyA};
  expect(denied.storageUnavailable).toBe(true);expect(denied.save(chosen)).toBe(false);
  expect(denied.current()).toEqual(chosen);denied.save({...chosen});expect(attempts).toBe(1);
});
