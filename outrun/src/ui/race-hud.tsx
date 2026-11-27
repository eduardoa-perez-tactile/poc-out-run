import {createEffect,defineUI,defineView,emit,onCleanup,untrack,useResource,views,Widget,type ViewHandle} from '@gameengine/ui';
import {scenes,gameengine} from '@gameengine/runtime';
import {routeTreeArt} from '../content/race-hud-art.ts';
import {showRankings} from './rankings.tsx';
import {MenuAction} from '../sim/pre-race-selection.ts';
import {RaceState,RaceMode,DrivingState,RaceRestartRequested,PreRaceAction} from '../schema.gen.ts';
import {createRouteHudFeedback,raceHudModel,raceResultsModel,type RaceHudModel,type RaceResultsModel} from './race-hud-model.ts';

const starting:RaceHudModel={routeTree:routeTreeArt(1),checkpointLap:'',showCheckpoint:false,time:'155',score:'0',lap:'00:00.00',speed:'0',gear:'AUTO · LOW',stage:'STAGE 1/5',notice:'READY',bonus:'',showNotice:true,showBonus:false,urgent:false};
export const RaceHudView=defineView<RaceHudModel>({
  name:'RaceHud',layer:'overlay',blockInput:false,
  description:'Live race time, score, lap, speed, gear, stage and countdown; keeps the road clear.',
  samples:{start:starting,checkpoint:{...starting,notice:'',showNotice:false,showCheckpoint:true,checkpointLap:"00 '42 ''36"},racing:{...starting,time:'98',score:'1,250,000',lap:'00:57.25',speed:'288',gear:'AUTO · HIGH',notice:'',showNotice:false},
    urgent:{...starting,time:'9',score:'36,256,000',speed:'330',notice:'',showNotice:false,urgent:true},
    goal:{...starting,time:'42',score:'88,512,000',stage:'GOAL',notice:'GOAL!',bonus:'TIME BONUS 41.5 S',showBonus:true}},
  render:model=><Widget id="race-hud" doc="race-hud" props={{
    routeTree:()=>model().routeTree,checkpointLap:()=>model().checkpointLap,showCheckpoint:()=>model().showCheckpoint,
    time:()=>model().time,score:()=>model().score,lap:()=>model().lap,speed:()=>model().speed,gear:()=>model().gear,stage:()=>model().stage,
    notice:()=>model().notice,bonus:()=>model().bonus,showNotice:()=>model().showNotice,showBonus:()=>model().showBonus,urgent:()=>model().urgent,
  }}/>,
});
export const RaceResultsView=defineView<RaceResultsModel>({
  name:'RaceResults',blockInput:true,dims:true,
  description:'Final race score and a recorded restart action. Intent: restart.',
  samples:{win:{title:'FINISH!',score:'148,360,000',summary:'TIME BONUS 42 S'},timeout:{title:'TIME UP',score:'26,250,000',summary:'STAGE 3 · TRY AGAIN'}},
  render:(model,{intent})=><Widget id="race-results" doc="race-hud-results" props={{title:()=>model().title,score:()=>model().score,summary:()=>model().summary}}
    onIntent={(_,event)=>{const name=event.path.at(-1);if(name)intent(name);}}/>,
});
export const RaceHudOverlay=defineUI({
  name:'RaceHudOverlay',
  root(){
    const mode=useResource(RaceMode),race=useResource(RaceState),driving=useResource(DrivingState);
    let handledWin=0;
    const routeFeedback=createRouteHudFeedback();
    const home=()=>{emit(PreRaceAction,{action:MenuAction.Home,value:0});scenes.enter('scenes/pre-race.scene.json');};
    let hud:ViewHandle<RaceHudModel>|null=null,results:ViewHandle<RaceResultsModel>|null=null;
    createEffect(()=>{
      const current=race(),driver=driving(),active=current?.initialized===true&&driver?.active===true;
      const model=active&&driver?raceHudModel(current,driver,mode()?.value??0,routeFeedback(current)):null;
      const terminal=active&&(current.phase===6||current.phase===7),result=terminal?raceResultsModel(current,mode()?.value??0):null;
      untrack(()=>{
        if(model&&!hud)hud=views.push(RaceHudView,model);else if(!model&&hud){hud.close({immediate:true});hud=null;}
        if(model)hud?.update(model);
        if(result&&!results)results=views.push(RaceResultsView,result,{onIntent:name=>{
          if(name==='restart')emit(RaceRestartRequested,{});
          else if(name==='home')home();
          else if(name==='rankings')showRankings({mode:mode()?.value??0,difficulty:current.difficulty,population:current.population});
        }});
        else if(!result&&results){results.close({immediate:true});results=null;}
        if(result)results?.update(result);
        if(result&&current.outcome===1&&current.raceEpoch!==handledWin){
          const opened=showRankings({mode:mode()?.value??0,difficulty:current.difficulty,population:current.population},
            {score:current.score,totalTicks:current.totalTicks,submissionId:`${gameengine.clock.wallNow()}:${current.raceEpoch}:${current.score}`},home);
          if(opened)handledWin=current.raceEpoch;
        }
      });
    });
    onCleanup(()=>{hud?.close({immediate:true});results?.close({immediate:true});});
    return null;
  },
});
