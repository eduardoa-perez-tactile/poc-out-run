import {audio,type AudioVoice} from '@gameengine/runtime';
import {MENU_SOUNDS} from '../content/audio-catalog.ts';
import {getRaceAudioSettings,musicOwners,type RaceAudioBackend,type RaceAudioSettings} from './race-audio.ts';
import {MenuPage} from '../sim/pre-race-selection.ts';
import type {PreRaceSelectionValue} from '../schema.gen.ts';
export type MenuCue=Exclude<keyof typeof MENU_SOUNDS,'wind'>;
type MenuSnapshot=Pick<PreRaceSelectionValue,'enabled'|'page'|'cursor'|'difficulty'|'population'|'car'|'manual'>;
let owner:MenuAudioController|null=null;
export function playMenuCue(name:MenuCue):void {owner?.cue(name);}
export function stopHallOfFame():void {owner?.stopHall();}

/** Menu presentation owns its wind and two replaceable channels; never writes input or race state. */
export class MenuAudioController {
  private last:MenuSnapshot|null=null;
  private windVolume=-1;
  private feedback:AudioVoice|null=null;
  private hall:AudioVoice|null=null;
  private foreground=true;
  constructor(private backend:RaceAudioBackend=audio,private preferences:()=>Readonly<RaceAudioSettings>=getRaceAudioSettings){}
  activate():void {owner=this;}
  private level():number {const s=this.preferences();return s.muted?0:s.sfxVolume;}
  private stopWind():void {
    if(musicOwners.get(this.backend)===this){this.backend.stopMusic({fade:0});musicOwners.delete(this.backend);}
    this.windVolume=-1;
  }
  private refreshWind():void {
    const enabled=this.last?.enabled&&(this.last.page===MenuPage.Home||this.last.page===MenuPage.Mode);
    if(!enabled||!this.foreground||this.level()<=0){this.stopWind();return;}
    const volume=this.level()*0.3;
    if(this.windVolume!==volume||musicOwners.get(this.backend)!==this){
      this.backend.music(MENU_SOUNDS.wind,{volume,fade:0});musicOwners.set(this.backend,this);this.windVolume=volume;
    }
  }
  cue(name:MenuCue):void {
    if(!this.foreground||this.level()<=0)return;
    const channel=name==='hallOfFame'?'hall':'feedback';
    this[channel]?.stop();
    this[channel]=this.backend.voice(MENU_SOUNDS[name],{bus:name==='hallOfFame'?'Voice':'UI',volume:this.level(),maxVoices:1,priority:60});
  }
  stopHall():void {this.hall?.stop();this.hall=null;}
  private stop():void {this.stopWind();this.feedback?.stop();this.feedback=null;this.stopHall();}
  settingsChanged():void {
    if(this.level()<=0)this.stop();
    else {this.feedback?.set({volume:this.level()});this.hall?.set({volume:this.level()});}
    this.refreshWind();
  }
  setForeground(value:boolean):void {this.foreground=value;if(!value)this.stop();else this.refreshWind();}
  observe(snapshot:MenuSnapshot):void {
    const before=this.last;this.last={...snapshot};
    if(before?.enabled&&!snapshot.enabled)this.stop();
    this.refreshWind();
    if(!before?.enabled||!snapshot.enabled)return;
    // Radio owns its own selection/confirmation; bindings and ranking own their inner controls.
    if(before.page===MenuPage.Help||before.page===MenuPage.Rankings)return;
    if(before.page!==snapshot.page){
      if(snapshot.page===MenuPage.Race)return;
      this.cue(snapshot.page<before.page?'back':before.page===MenuPage.Car?'confirm':'choose');return;
    }
    if(snapshot.page>=MenuPage.Radio)return;
    if(snapshot.cursor!==before.cursor){this.cue('move');return;}
    if(snapshot.page===MenuPage.Options&&(snapshot.difficulty!==before.difficulty||snapshot.population!==before.population))this.cue('choose');
  }
  dispose():void {this.stop();this.last=null;if(owner===this)owner=null;}
}
