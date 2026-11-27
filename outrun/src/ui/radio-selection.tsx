import {app,defineSystem,write,read,KeyEvent,Keys,scenes} from '@gameengine/runtime';
import {createEffect,defineUI,onCleanup,emit,untrack,useResource,views,type ViewHandle} from '@gameengine/ui';
import {RadioSelectionInput,PreRaceSelection,PreRaceAction} from '../schema.gen.ts';
import {getRaceAudioSettings,subscribeRaceAudioSettings,RadioAudioPreview} from '../audio/race-audio.ts';
import {MenuPage,MenuAction} from '../sim/pre-race-selection.ts';
import {RadioSelectionView,radioSelectionModel,type RadioSelectionModel} from '../views/radio-selection.view.tsx';

/** Recorded keyboard transport. Defaults outside this menu preserve existing race tapes. */
export const CaptureRadioSelectionInput=defineSystem({
  name:'CaptureRadioSelectionInput',stage:'PreUpdate',after:['CapturePreRaceSelection'],skipUnchanged:true,
  resources:[write(RadioSelectionInput),read(PreRaceSelection)],events:[KeyEvent],
  run(ctx){
    const state=ctx.get(RadioSelectionInput);
    const menu=ctx.get(PreRaceSelection);
    if(!state.enabled&&!(menu.enabled&&menu.page===MenuPage.Radio)){
      if(state.left||state.right||state.confirm||state.held)ctx.set(RadioSelectionInput,{left:0,right:0,confirm:0,held:0});
      return;
    }
    let changed=false;
    for(const key of ctx.events.read(KeyEvent)){
      const bit=key.code===Keys.ArrowLeft?1:key.code===Keys.ArrowRight?2:key.code===Keys.Enter?4:0;
      if(!bit)continue;
      const rising=key.down&&(state.held&bit)===0;
      state.held=key.down?state.held|bit:state.held&~bit;changed=true;
      if(rising&&!(bit===4&&menu.enabled&&(menu.held&16)!==0)){if(bit===1)state.left++;else if(bit===2)state.right++;else state.confirm++;}
    }
    if(changed)ctx.set(RadioSelectionInput,state);
  }
});

export const RadioSelectionOverlay=defineUI({name:'RadioSelectionOverlay',root(){
  const input=useResource(RadioSelectionInput),menu=useResource(PreRaceSelection);
  let view:ViewHandle<RadioSelectionModel>|null=null,preview:RadioAudioPreview|null=null,confirmed=false;
  let seen={left:0,right:0,confirm:0};
  const update=()=>view?.update(radioSelectionModel(getRaceAudioSettings().radio));
  const close=()=>{view?.close({immediate:true});view=null;preview?.dispose();preview=null;};
  const choose=(direction:number)=>{if(confirmed)return;preview?.move(direction);update();};
  const start=()=>{
    if(confirmed||!preview)return;
    confirmed=true;preview.confirm();view?.close({immediate:true});view=null;
    // Public scene entry records the confirmation's transition as normal input.
    if(menu()?.enabled)emit(PreRaceAction,{action:MenuAction.Launch,value:0});
    scenes.enter('scenes/original-race.scene.json');
  };
  const unsubscribe=subscribeRaceAudioSettings(update);
  const off=app.onLifecycle(state=>preview?.setForeground(state==='foreground'));
  createEffect(()=>{
    const raw=input(),selection=menu(),enabled=raw?.enabled===true||(selection?.enabled===true&&selection.page===MenuPage.Radio);
    const keys=raw?{left:raw.left,right:raw.right,confirm:raw.confirm}:null;
    untrack(()=>{
    if(!enabled){close();confirmed=false;return;}
    if(!preview&&!confirmed){
      seen=keys??{left:0,right:0,confirm:0};preview=new RadioAudioPreview();
      view=views.push(RadioSelectionView,radioSelectionModel(0),{onIntent:name=>{if(name==='previous')choose(-1);else if(name==='next')choose(1);else if(name==='start')start();else if(name==='back'&&menu()?.enabled)emit(PreRaceAction,{action:MenuAction.Back,value:0});}});
    }
    if(!keys||confirmed)return;
    for(let n=0;n<Math.min(32,Math.max(0,keys.left-seen.left));n++)choose(-1);
    for(let n=0;n<Math.min(32,Math.max(0,keys.right-seen.right));n++)choose(1);
    if(keys.confirm>seen.confirm)start();
    seen={left:keys.left,right:keys.right,confirm:keys.confirm};
    });
  });
  onCleanup(()=>{unsubscribe();off();close();});
  return null;
}});
