import {createEffect,defineUI,emit,onCleanup,untrack,useResource,views,type ViewHandle} from '@gameengine/ui';
import {PreRaceSelection,PreRaceAction} from '../schema.gen.ts';
import {MenuAction,MenuPage} from '../sim/pre-race-selection.ts';
import {PreRaceSelectionView,preRaceSelectionModel,type PreRaceSelectionModel} from '../views/pre-race-selection.view.tsx';
const actions:Record<string,number>={previous:MenuAction.Previous,next:MenuAction.Next,up:MenuAction.Up,down:MenuAction.Down,accept:MenuAction.Accept,back:MenuAction.Back,options:MenuAction.Options};
export const PreRaceSelectionOverlay=defineUI({name:'PreRaceSelectionOverlay',root(){
  const state=useResource(PreRaceSelection);let view:ViewHandle<PreRaceSelectionModel>|null=null;
  const close=()=>{view?.close({immediate:true});view=null;};
  createEffect(()=>{
    const s=state(),active=s?.enabled===true&&s.page<MenuPage.Radio;
    const model=active?preRaceSelectionModel({...s}):null;
    untrack(()=>{
      if(!model){close();return;}
      if(view)view.update(model);
      else view=views.push(PreRaceSelectionView,model,{onIntent:name=>{
        const row=name==='primary'?0:name==='secondary'?1:name==='tertiary'?2:-1;
        if(row>=0){emit(PreRaceAction,{action:MenuAction.Select,value:row});emit(PreRaceAction,{action:MenuAction.Accept,value:0});return;}
        const action=actions[name];if(action!==undefined)emit(PreRaceAction,{action,value:0});
      }});
    });
  });
  onCleanup(close);return null;
}});
