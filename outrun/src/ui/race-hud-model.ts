import type {RaceStateValue,DrivingStateValue} from '../schema.gen.ts';

export interface RaceHudModel {
  time:string;score:string;lap:string;speed:string;gear:string;stage:string;
  notice:string;bonus:string;showNotice:boolean;showBonus:boolean;urgent:boolean;
}
export interface RaceResultsModel {title:string;score:string;summary:string;}
export function formatRaceScore(score:number):string{return String(Math.trunc(score)).replace(/\B(?=(\d{3})+(?!\d))/g,',');}
export function formatRaceTime(ticks:number):string{
  const hundredths=Math.floor(Math.max(0,ticks)*100/60);
  return `${String(Math.floor(hundredths/6000)).padStart(2,'0')}:${String(Math.floor(hundredths/100)%60).padStart(2,'0')}.${String(hundredths%100).padStart(2,'0')}`;
}
/** Source Globals.h HUD_SPEED_FACTOR1.65f; UI never feeds displayed values back. */
export function raceHudModel(race:Readonly<RaceStateValue>,driving:Readonly<DrivingStateValue>):RaceHudModel{
  const finishing=race.phase>=2&&race.phase<=5;
  const notice=race.phase===0?(race.countdownTicks>180?'READY':String(Math.max(1,Math.ceil(race.countdownTicks/60)))):
    race.phase===1&&race.phaseTicks<45?'GO!':finishing?'GOAL!':race.phase===8?'PAUSED':'';
  return {time:String(Math.ceil(race.remainingTicks/60)),score:formatRaceScore(race.score),lap:formatRaceTime(race.stageTicks),
    speed:String(Math.trunc(Math.fround(Math.fround(driving.legacySpeed)*Math.fround(1.65)))),
    gear:`${driving.manual?'MANUAL':'AUTO'} · ${driving.gear===0?'LOW':'HIGH'}`,
    stage:race.mapId===16?'GOAL':`STAGE ${Math.min(5,race.stage+1)}/5`,notice,
    bonus:`TIME BONUS ${Math.floor(race.bonusDeciseconds/10)}.${race.bonusDeciseconds%10} S`,
    showNotice:notice.length>0,showBonus:finishing,urgent:race.remainingTicks<=10*60&&race.phase===1};
}
export function raceResultsModel(race:Readonly<RaceStateValue>):RaceResultsModel{
  return {title:race.outcome===1?'FINISH!':'TIME UP',score:formatRaceScore(race.score),
    summary:race.outcome===1?`TIME BONUS ${race.finishRemainingSeconds} S`:`STAGE ${Math.min(5,race.stage+1)} · TRY AGAIN`};
}
