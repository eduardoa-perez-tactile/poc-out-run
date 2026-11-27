import {defineSystem,KeyEvent,gameengine} from '@gameengine/runtime';
import {createEffect,defineUI,emit,onCleanup,untrack,useResource,views,type ViewHandle} from '@gameengine/ui';
import {DrivingBindings,KeyboardBindingsRequested,PreRaceSelection,PreRaceAction} from '../schema.gen.ts';
import {KeyboardBindingsStore,resolveBindings} from '../content/keyboard-bindings.ts';
import {MenuAction,MenuPage} from '../sim/pre-race-selection.ts';
import {ControlsHelpView,type ControlsHelpModel} from '../views/controls-help.view.tsx';
import {BindingsEditor,KeyboardBindingsSync} from './keyboard-bindings-flow.ts';
let keyboardOwner:((keys:Iterable<{code:number;down:boolean}>)=>void)|null=null;
export const KeyboardBindingsOverlay=defineUI({name:'KeyboardBindingsOverlay',root(){
  const config=useResource(DrivingBindings),menu=useResource(PreRaceSelection);
  const request=(bindings:import('../content/keyboard-bindings.ts').KeyboardBindings)=>emit(KeyboardBindingsRequested,bindings);
  const sync=new KeyboardBindingsSync(new KeyboardBindingsStore({get:(key,fallback)=>gameengine.kv.get(key,fallback),set:(key,value)=>gameengine.kv.set(key,value)}),request);
  let view:ViewHandle<ControlsHelpModel>|null=null,editor:BindingsEditor|null=null;
  const held=new Set<number>();
  const back=()=>emit(PreRaceAction,{action:MenuAction.Back,value:0});
  const update=()=>{if(editor)view?.update(editor.model());};
  const input=(keys:Iterable<{code:number;down:boolean}>)=>{
    for(const key of keys){
      if(!editor)break;
      if(!key.down){held.delete(key.code);continue;}
      if(held.has(key.code))continue;held.add(key.code);editor.key(key.code);update();
    }
  };
  keyboardOwner=input;
  createEffect(()=>{
    const state=menu(),raw=config(),bindings=raw?resolveBindings({...raw}):null;
    const enabled=state?.enabled===true,page=state?.page??0;
    untrack(()=>{
      if(bindings)sync.observe(enabled,page,bindings);
      if(enabled&&page===MenuPage.Help&&bindings){
        if(!view){
          held.clear();editor=new BindingsEditor(bindings,request,back);
          view=views.push(ControlsHelpView,editor.model(),{onIntent:name=>{editor?.intent(name);update();}});
        }else editor?.update(bindings);
        update();
      }else {view?.close({immediate:true});view=null;editor=null;held.clear();}
    });
  });
  onCleanup(()=>{view?.close({immediate:true});editor=null;held.clear();if(keyboardOwner===input)keyboardOwner=null;});
  return null;
}});
export const KeyboardBindingsPresentation=defineSystem({
  name:'KeyboardBindingsPresentation',stage:'LateUpdate',after:['KeyboardBindingsOverlay'],events:[KeyEvent],
  run(ctx){keyboardOwner?.(ctx.events.read(KeyEvent));},
});
