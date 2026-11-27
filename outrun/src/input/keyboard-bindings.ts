import {defineSystem,read,write} from '@gameengine/runtime';
import {DrivingBindings,KeyboardBindingsRequested,DrivingInput,PreRaceSelection} from '../schema.gen.ts';
import {BINDING_ACTIONS,DEFAULT_BINDINGS,resolveBindings,validBindings,type KeyboardBindings} from '../content/keyboard-bindings.ts';
import {MenuPage} from '../sim/pre-race-selection.ts';

/** Only recorded snapshots enter simulation, never storage or UI state. Apply
 * before menu navigation so a restored set is ready for same-tick Start input. */
export const CaptureKeyboardBindings=defineSystem({
  name:'CaptureKeyboardBindings',stage:'PreUpdate',before:['CapturePreRaceSelection'],
  resources:[write(DrivingBindings),write(DrivingInput),read(PreRaceSelection)],events:[KeyboardBindingsRequested],
  run(ctx){
    const menu=ctx.get(PreRaceSelection);
    if(!menu.enabled||menu.launch||(menu.page!==MenuPage.Home&&menu.page!==MenuPage.Help))return;
    for(const request of ctx.events.read(KeyboardBindingsRequested)){
      if(!validBindings(request))continue;
      const previous=resolveBindings(ctx.get(DrivingBindings));
      if(BINDING_ACTIONS.every(action=>previous[action]===request[action]))continue;
      const overrides={} as KeyboardBindings;
      for(const action of BINDING_ACTIONS)overrides[action]=request[action]===DEFAULT_BINDINGS[action]?0:request[action];
      ctx.set(DrivingBindings,overrides);
      ctx.set(DrivingInput,{keyboard:0,shiftUp:false,shiftDown:false,upHeld:false,downHeld:false});
    }
  },
});
