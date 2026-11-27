import type {RaceStateValue} from '../schema.gen.ts';
import {flaggerObjectId,startSceneFrames,type SceneSpriteFrames} from './scene-sprite-frames.ts';

/** Owned by the live presenter, never simulation. Existing fixed-step clocks
 * provide the nominal60Hz source cadence; repeated renders do not advance it. */
export class SceneSpriteClock {
  private epoch=-1;private map=0;private phase=-1;private phaseTicks=0;private step=0;private paused=false;private goalTicks=0;
  sample(mapId:number,race:Readonly<RaceStateValue>):SceneSpriteFrames|undefined {
    if(!race.initialized)return undefined;
    const phase=race.phase===8?race.resumePhase:race.phase,paused=race.phase===8;
    const reset=this.epoch!==race.raceEpoch||this.map!==mapId;
    if(mapId===16){
      if(reset)this.goalTicks=phase>=2&&phase<=5?race.phaseTicks:0;
      else if(phase>=2&&phase<=5){
        if(phase===this.phase)this.goalTicks+=Math.max(0,race.phaseTicks-this.phaseTicks);
        else this.goalTicks+=paused||this.paused?race.phaseTicks+1:Math.max(0,race.processedStep-this.step);
      }
    }
    this.epoch=race.raceEpoch;this.map=mapId;this.phase=phase;this.phaseTicks=race.phaseTicks;this.step=race.processedStep;this.paused=paused;
    if(mapId===1)return startSceneFrames(race.countdownTicks,race.totalTicks);
    if(mapId===16)return {flagger:flaggerObjectId(this.goalTicks),semaphore:39};
    return undefined;
  }
}
