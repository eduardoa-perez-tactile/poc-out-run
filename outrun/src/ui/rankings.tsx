import {playMenuCue,stopHallOfFame} from '../audio/menu-audio.ts';
import {defineSystem,KeyEvent,Keys,gameengine} from '@gameengine/runtime';
import {defineUI,onCleanup,views,type ViewHandle} from '@gameengine/ui';
import {RankingStore,type RankingBucket} from '../content/rankings.ts';
import {RankingsView,type RankingsModel} from '../views/rankings.view.tsx';
import {RankingsFlow,type RankingCandidate} from './rankings-flow.ts';

interface RankingsOwner {
  open(bucket:RankingBucket,candidate:RankingCandidate|undefined,onClose:()=>void):void;
  frame(keys:Iterable<{code:number;down:boolean}>,now:number):void;
}
let owner:RankingsOwner|null=null;
export function showRankings(bucket:RankingBucket,candidate?:RankingCandidate,onClose:()=>void=()=>{}):boolean {
  if(!owner)return false;owner.open(bucket,candidate,onClose);return true;
}
export const RankingsOverlay=defineUI({name:'RankingsOverlay',root(){
  const store=new RankingStore({get:(key,fallback)=>gameengine.kv.get(key,fallback),set:(key,value)=>gameengine.kv.set(key,value)});
  let view:ViewHandle<RankingsModel>|null=null,flow:RankingsFlow|null=null;
  const update=()=>{if(flow?.isOpen)view?.update(flow.model());};
  const action=(name:string)=>{
    flow?.tick(gameengine.clock.wallNow());if(!flow?.isOpen)return;
    const before=flow.model();flow.input(name);const after=flow?.model();
    if(name==='close')playMenuCue('back');
    else if(name==='confirm')playMenuCue(before.entry&&before.draft.slice(0,3).includes('_')?'error':'confirm');
    else if(after&&(after.draft!==before.draft||after.subtitle!==before.subtitle))playMenuCue(name==='previousLetter'||name==='nextLetter'?'move':'choose');
    update();
  };
  const held=new Set<number>();
  const current:RankingsOwner={
    open(bucket,candidate,onClose){
      if(view)return;
      held.clear();
      flow=new RankingsFlow(store,bucket,candidate,gameengine.clock.wallNow(),()=>{
        stopHallOfFame();view?.close({immediate:true});view=null;flow=null;held.clear();onClose();
      });
      view=views.push(RankingsView,flow.model(),{onIntent:action});
      playMenuCue('hallOfFame');
    },
    frame(keys,now){
      if(!view||!flow)return;
      if(flow.tick(now))update();
      for(const key of keys){
        if(!view||!flow)break;
        if(!key.down){held.delete(key.code);continue;}
        if(held.has(key.code))continue;held.add(key.code);
        if(key.code>=Keys.KeyA&&key.code<=Keys.KeyZ)action(String.fromCharCode(65+key.code-Keys.KeyA));
        else if(key.code===Keys.Enter)action('confirm');
        else if(key.code===Keys.Escape)action('close');
        else if(key.code===Keys.Backspace)action('erase');
        else if(key.code===Keys.ArrowLeft)action('previousLetter');
        else if(key.code===Keys.ArrowRight)action('nextLetter');
        else if(key.code===Keys.ArrowUp||key.code===Keys.Space)action('addLetter');
      }
    },
  };
  owner=current;
  onCleanup(()=>{stopHallOfFame();view?.close({immediate:true});view=null;flow=null;if(owner===current)owner=null;});
  return null;
}});
export const RankingsPresentation=defineSystem({
  name:'RankingsPresentation',stage:'LateUpdate',after:['RankingsOverlay'],events:[KeyEvent],
  run(ctx){owner?.frame(ctx.events.read(KeyEvent),gameengine.clock.wallNow());},
});
