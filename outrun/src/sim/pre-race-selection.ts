import {defineSystem,query,read,write,KeyEvent,Keys} from '@gameengine/runtime';
import {PreRaceSelection,PreRaceAction,RaceOwner,RaceState,RouteDriver,TrafficPool,type PreRaceSelectionValue} from '../schema.gen.ts';

export const MenuPage={Home:0,Options:1,Mode:2,Gears:3,Car:4,Radio:5,Race:6} as const;
export const MenuAction={Previous:0,Next:1,Up:2,Down:3,Accept:4,Back:5,Options:6,Launch:7,Select:8} as const;
const clamp=(n:number,max:number)=>Math.max(0,Math.min(max,n));
/** Pure recorded-input reducer. Unimplemented modes remain selectable but cannot launch. */
export function reducePreRace(before:PreRaceSelectionValue,action:number,value=0):PreRaceSelectionValue {
  const s={...before};if(!s.enabled||s.launch)return s;
  if(action===MenuAction.Select){
    if(s.page===MenuPage.Home||s.page===MenuPage.Options||s.page===MenuPage.Mode)s.cursor=clamp(Math.trunc(value),s.page===MenuPage.Mode?2:1);
    return s;
  }
  const direction=action===MenuAction.Previous?-1:action===MenuAction.Next?1:0;
  if(action===MenuAction.Back){
    s.page=s.page===MenuPage.Radio?MenuPage.Car:s.page===MenuPage.Car?MenuPage.Gears:s.page===MenuPage.Gears?MenuPage.Mode:MenuPage.Home;
    s.cursor=s.page===MenuPage.Car?s.car:s.page===MenuPage.Gears?Number(s.manual):0;return s;
  }
  if(s.page===MenuPage.Radio){if(action===MenuAction.Launch){s.launch=true;s.enabled=false;s.page=MenuPage.Race;s.held=0;}return s;}
  if(action===MenuAction.Options&&s.page===MenuPage.Home){s.page=MenuPage.Options;s.cursor=0;return s;}
  if(s.page===MenuPage.Home){
    if(direction||action===MenuAction.Up||action===MenuAction.Down)s.cursor=1-s.cursor;
    if(action===MenuAction.Accept){s.page=s.cursor===1?MenuPage.Options:MenuPage.Mode;s.cursor=0;}
  }else if(s.page===MenuPage.Options){
    if(action===MenuAction.Up||action===MenuAction.Down)s.cursor=1-s.cursor;
    if(direction||action===MenuAction.Accept){const step=direction||1;
      if(s.cursor===0)s.difficulty=clamp(s.difficulty+step,2);
      else {const choices=[9,20,32];s.population=choices[clamp(choices.indexOf(s.population)+step,2)]!;}
    }
  }else if(s.page===MenuPage.Mode){
    const step=direction||(action===MenuAction.Up?-1:action===MenuAction.Down?1:0);
    if(step)s.cursor=clamp(s.cursor+step,2);
    if(action===MenuAction.Accept&&s.cursor===0){s.page=MenuPage.Gears;s.cursor=Number(s.manual);}
  }else if(s.page===MenuPage.Gears){
    if(direction){s.cursor=clamp(s.cursor+direction,1);s.manual=s.cursor===1;}
    if(action===MenuAction.Accept){s.manual=s.cursor===1;s.page=MenuPage.Car;s.cursor=s.car;}
  }else if(s.page===MenuPage.Car){
    if(direction){s.car=clamp(s.car+direction,13);s.cursor=s.car;}
    if(action===MenuAction.Accept){s.page=MenuPage.Radio;s.cursor=0;}
  }
  return s;
}

export const CapturePreRaceSelection=defineSystem({
  name:'CapturePreRaceSelection',stage:'PreUpdate',skipUnchanged:true,
  resources:[write(PreRaceSelection)],events:[KeyEvent,PreRaceAction],
  run(ctx){
    let state=ctx.get(PreRaceSelection);if(!state.enabled)return;
    const bindings=[[Keys.ArrowLeft,1,MenuAction.Previous],[Keys.ArrowRight,2,MenuAction.Next],
      [Keys.ArrowUp,4,MenuAction.Up],[Keys.ArrowDown,8,MenuAction.Down],[Keys.Enter,16,MenuAction.Accept],[Keys.Escape,32,MenuAction.Back]] as const;
    let changed=false;
    for(const key of ctx.events.read(KeyEvent)){
      const binding=bindings.find(entry=>entry[0]===key.code);if(!binding)continue;
      const [,bit,action]=binding;
      if(state.page===MenuPage.Radio&&action!==MenuAction.Back){if(!key.down){state.held&=~bit;changed=true;}continue;}
      const rising=key.down&&(state.held&bit)===0;
      state.held=key.down?state.held|bit:state.held&~bit;changed=true;
      // Radio owns Left/Right/Enter; Escape remains this recorded menu's Back.
      if(rising&&(state.page!==MenuPage.Radio||action===MenuAction.Back))state=reducePreRace(state,action);
    }
    for(const event of ctx.events.read(PreRaceAction)){state=reducePreRace(state,event.action,event.value);changed=true;}
    if(changed)ctx.set(PreRaceSelection,state);
  }
});

/** Apply the recorded selection only to a newly admitted connected race. */
export const ApplyPreRaceConfiguration=defineSystem({
  name:'ApplyPreRaceConfiguration',before:['AdmitRace','AdvanceRoute'],
  runIf:{query:query(read(RaceOwner))},query:query(read(RaceOwner),read(RouteDriver),write(TrafficPool)),
  resources:[read(PreRaceSelection),write(RaceState)],
  run(ctx,owners){const selection=ctx.get(PreRaceSelection),race=ctx.get(RaceState);
    if(!selection.launch||race.initialized)return;
    ctx.set(RaceState,{difficulty:selection.difficulty,population:selection.population});
    for(const chunk of owners.chunks())for(let row=0;row<chunk.length;row++){
      if(chunk.col(RaceOwner).enabled[row]!==0&&!chunk.get(RouteDriver,row).initialized)chunk.set(TrafficPool,row,{population:selection.population});
    }
  }
});
