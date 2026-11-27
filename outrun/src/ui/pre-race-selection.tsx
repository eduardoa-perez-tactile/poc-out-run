import {createEffect,defineUI,emit,onCleanup,untrack,useResource,views,type ViewHandle} from '@gameengine/ui';
import {app,gameengine} from '@gameengine/runtime';
import {MenuAudioController} from '../audio/menu-audio.ts';
import {subscribeRaceAudioSettings} from '../audio/race-audio.ts';
import {GameSettingsStore} from '../content/game-settings.ts';
import {GameSettingsSync} from './game-settings-sync.ts';
import {PreRaceSelection,PreRaceAction} from '../schema.gen.ts';
import {MenuAction,MenuPage} from '../sim/pre-race-selection.ts';
import {showRankings} from './rankings.tsx';
import {PreRaceSelectionView,preRaceSelectionModel,type PreRaceSelectionModel} from '../views/pre-race-selection.view.tsx';
const actions:Record<string,number>={previous:MenuAction.Previous,next:MenuAction.Next,up:MenuAction.Up,down:MenuAction.Down,accept:MenuAction.Accept,back:MenuAction.Back,options:MenuAction.Options,rankings:MenuAction.Rankings,help:MenuAction.Help};
export const PreRaceSelectionOverlay=defineUI({name:'PreRaceSelectionOverlay',root(){
  const menuAudio=new MenuAudioController();menuAudio.activate();
  const unsubscribeAudio=subscribeRaceAudioSettings(()=>menuAudio.settingsChanged());
  const offAudio=app.onLifecycle(value=>menuAudio.setForeground(value==='foreground'));
  const preferences=new GameSettingsSync(new GameSettingsStore({
    get:(key,fallback)=>gameengine.kv.get(key,fallback),set:(key,value)=>gameengine.kv.set(key,value),
  }),value=>emit(PreRaceAction,{action:MenuAction.RestoreSettings,value}));
  const state=useResource(PreRaceSelection);let browserOpen=false;let view:ViewHandle<PreRaceSelectionModel>|null=null;
  const close=()=>{view?.close({immediate:true});view=null;};
  createEffect(()=>{
    const s=state();
    if(s){const snapshot={enabled:s.enabled,page:s.page,launch:s.launch,difficulty:s.difficulty,population:s.population,manual:s.manual,car:s.car};untrack(()=>preferences.observe(snapshot));}
    const active=s?.enabled===true&&s.page<MenuPage.Radio;
    const model=active?preRaceSelectionModel({...s}):null;
    untrack(()=>{
      if(s)menuAudio.observe({...s});
      if(s?.enabled&&s.page===MenuPage.Rankings&&!browserOpen){
        browserOpen=showRankings({mode:s.mode,difficulty:s.difficulty,population:s.population},undefined,()=>{
          browserOpen=false;emit(PreRaceAction,{action:MenuAction.Back,value:0});
        });
      }
      if(!model){close();return;}
      if(view)view.update(model);
      else view=views.push(PreRaceSelectionView,model,{onIntent:name=>{
        const row=name==='primary'?0:name==='secondary'?1:name==='tertiary'?2:-1;
        if(row>=0){emit(PreRaceAction,{action:MenuAction.Select,value:row});emit(PreRaceAction,{action:MenuAction.Accept,value:0});return;}
        const action=actions[name];if(action!==undefined)emit(PreRaceAction,{action,value:0});
      }});
    });
  });
  onCleanup(()=>{close();offAudio();unsubscribeAudio();menuAudio.dispose();});return null;
}});
