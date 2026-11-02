import {component,resource,event,bool,u32} from '@gameengine/schema';

export const RaceOwner=component('RaceOwner',{enabled:bool({default:true})},{sim:true});
export const RaceRestartRequested=event('RaceRestartRequested',{},{sim:true});
export const RaceState=resource('RaceState',{
  initialized:bool(),lastPublishedPlaying:bool(),activeTick:bool(),racingAdmitted:bool(),bonusAwarded:bool(),
  mapTimeSeconds:u32({default:160}),difficulty:u32({default:1}),population:u32({default:20}),mapId:u32({default:1}),
  raceEpoch:u32(),routeEpoch:u32(),phase:u32(),resumePhase:u32(),processedStep:u32(),phaseTicks:u32(),countdownTicks:u32(),remainingTicks:u32(),totalTicks:u32(),stageTicks:u32(),lastStageTicks:u32(),score:u32(),finishScore:u32(),finishRemainingSeconds:u32(),bonusDeciseconds:u32(),resultsHoldTicks:u32(),outcome:u32(),consumedCheckpoints:u32(),consumedPassBatches:u32(),consumedArrivals:u32(),controlMode:u32(),admittedStep:u32(),stage:u32(),
},{sim:true});
