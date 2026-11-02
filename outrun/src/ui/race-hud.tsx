import {createEffect,defineUI,defineView,emit,onCleanup,untrack,useResource,views,Widget,type ViewHandle} from '@gameengine/ui';
import {RaceState,DrivingState,RaceRestartRequested} from '../schema.gen.ts';
import {raceHudModel,raceResultsModel,type RaceHudModel,type RaceResultsModel} from './race-hud-model.ts';

const starting:RaceHudModel={time:'155',score:'0',lap:'00:00.00',speed:'0',gear:'AUTO · LOW',stage:'STAGE 1/5',notice:'READY',bonus:'',showNotice:true,showBonus:false,urgent:false};
export const RaceHudView=defineView<RaceHudModel>({
  name:'RaceHud',layer:'overlay',blockInput:false,
  description:'Live race time, score, lap, speed, gear, stage and countdown; keeps the road clear.',
  samples:{start:starting,racing:{...starting,time:'98',score:'1,250,000',lap:'00:57.25',speed:'288',gear:'AUTO · HIGH',notice:'',showNotice:false},
    urgent:{...starting,time:'9',score:'36,256,000',speed:'330',notice:'',showNotice:false,urgent:true},
    goal:{...starting,time:'42',score:'88,512,000',stage:'GOAL',notice:'GOAL!',bonus:'TIME BONUS 41.5 S',showBonus:true}},
  render:model=><Widget id="race-hud" doc="race-hud" props={{
    time:()=>model().time,score:()=>model().score,lap:()=>model().lap,speed:()=>model().speed,gear:()=>model().gear,stage:()=>model().stage,
    notice:()=>model().notice,bonus:()=>model().bonus,showNotice:()=>model().showNotice,showBonus:()=>model().showBonus,urgent:()=>model().urgent,
  }}/>,
});
export const RaceResultsView=defineView<RaceResultsModel>({
  name:'RaceResults',blockInput:true,dims:true,
  description:'Final race score and a recorded restart action. Intent: restart.',
  samples:{win:{title:'FINISH!',score:'148,360,000',summary:'TIME BONUS 42 S'},timeout:{title:'TIME UP',score:'26,250,000',summary:'STAGE 3 · TRY AGAIN'}},
  render:(model,{intent})=><Widget id="race-results" doc="race-hud-results" props={{title:()=>model().title,score:()=>model().score,summary:()=>model().summary}}
    onIntent={(_,event)=>{if(event.path.at(-1)==='restart')intent('restart');}}/>,
});
export const RaceHudOverlay=defineUI({
  name:'RaceHudOverlay',
  root(){
    const race=useResource(RaceState),driving=useResource(DrivingState);
    let hud:ViewHandle<RaceHudModel>|null=null,results:ViewHandle<RaceResultsModel>|null=null;
    createEffect(()=>{
      const current=race(),driver=driving(),active=current?.initialized===true;
      const model=active&&driver?raceHudModel(current,driver):null;
      const terminal=active&&(current.phase===6||current.phase===7),result=terminal?raceResultsModel(current):null;
      untrack(()=>{
        if(model&&!hud)hud=views.push(RaceHudView,model);else if(!model&&hud){hud.close({immediate:true});hud=null;}
        if(model)hud?.update(model);
        if(result&&!results)results=views.push(RaceResultsView,result,{onIntent:name=>{if(name==='restart')emit(RaceRestartRequested,{});}});
        else if(!result&&results){results.close({immediate:true});results=null;}
        if(result)results?.update(result);
      });
    });
    onCleanup(()=>{hud?.close({immediate:true});results?.close({immediate:true});});
    return null;
  },
});
