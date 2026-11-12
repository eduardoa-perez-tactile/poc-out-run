import {app,audio,gameengine,defineSystem,query,read,type AudioVoice,type SoundOptions} from '@gameengine/runtime';
import {createEffect,defineUI,onCleanup,useResource} from '@gameengine/ui';
import {RaceState,DrivingState,DrivingInput,RouteDriver,RouteTrafficCoordinates,TerrainDriver,CrashDriver,TrafficPool} from '../schema.gen.ts';
import {originalRouteSources} from '../content/route-boot.ts';
import type {SourceBiomeId} from '../content/biome.ts';
import {RADIO_TRACKS,RESULT_MUSIC,RACE_SOUNDS,RACE_SOUND_DURATIONS,type RaceSoundName} from '../content/audio-catalog.ts';

export interface RaceAudioSettings {radio:number;muted:boolean;musicVolume:number;sfxVolume:number;}
export interface RaceAudioSample {
  active:boolean;raceEpoch:number;phase:number;resumePhase:number;countdownTicks:number;remainingTicks:number;
  checkpoints:number;passes:number;speed:number;gear:number;held:number;crashPhase:number;impacts:number;
  skidding:boolean;offRoad:boolean;traffic:number;trafficPan:number;
}
export interface RaceAudioBackend {
  voice(key:string,options:SoundOptions&{loop?:boolean}):AudioVoice;
  music(key:string,options:{volume:number;fade:number}):void;
  stopMusic(options:{fade:number}):void;
}
const defaults:RaceAudioSettings={radio:0,muted:false,musicVolume:0.65,sfxVolume:0.8};
let settings:RaceAudioSettings={...defaults};
const listeners=new Set<(settings:Readonly<RaceAudioSettings>)=>void>();
const musicOwners=new WeakMap<RaceAudioBackend,object>();
let activeController:RaceAudioController|null=null;
const SETTINGS_KEY='outrun.audio.v1';
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
function cleanSettings(value:Partial<RaceAudioSettings>):RaceAudioSettings {
  return {radio:Number.isInteger(value.radio)?clamp(value.radio!,0,RADIO_TRACKS.length-1):settings.radio,
    muted:typeof value.muted==='boolean'?value.muted:settings.muted,
    musicVolume:typeof value.musicVolume==='number'&&Number.isFinite(value.musicVolume)?clamp(value.musicVolume,0,1):settings.musicVolume,
    sfxVolume:typeof value.sfxVolume==='number'&&Number.isFinite(value.sfxVolume)?clamp(value.sfxVolume,0,1):settings.sfxVolume};
}
export function getRaceAudioSettings():Readonly<RaceAudioSettings>{return {...settings};}
export function subscribeRaceAudioSettings(listener:(settings:Readonly<RaceAudioSettings>)=>void):()=>void {
  listeners.add(listener);listener(getRaceAudioSettings());return()=>{listeners.delete(listener);};
}
export function setRaceAudioSettings(value:Partial<RaceAudioSettings>):void {
  const next=cleanSettings(value),radioChanged=next.radio!==settings.radio;
  if(next.radio===settings.radio&&next.muted===settings.muted&&next.musicVolume===settings.musicVolume&&next.sfxVolume===settings.sfxVolume)return;
  settings=next;
  // Storage denial must not prevent a user changing the sound in this session.
  try{gameengine.kv.set(SETTINGS_KEY,settings);}catch{/* Session settings still work. */}
  activeController?.settingsChanged(radioChanged);
  for(const listener of listeners)listener(getRaceAudioSettings());
}
export function nextRadio(direction=1):void {setRaceAudioSettings({radio:clamp(settings.radio+(direction<0?-1:1),0,RADIO_TRACKS.length-1)});}
export function toggleMute():void {setRaceAudioSettings({muted:!settings.muted});}
export function setVolumes(musicVolume:number,sfxVolume:number):void {setRaceAudioSettings({musicVolume,sfxVolume});}

const voices=new Set<RaceSoundName>(['showmanStart','showmanCongratulations','tenSeconds','hurryUp','womanCrash','womanDie','checkpointVoice1','checkpointVoice2','checkpointVoice3','crowd','crowdCongratulations']);
type LoopName='engineRun'|'brake'|'skid'|'drift'|'offRoad'|'scoreBonus'|'trafficEngine1'|'trafficEngine2'|'trafficEngine3';
interface HeldVoice {voice:AudioVoice;volume:number;pitch:number;}
interface Shot {voice:AudioVoice;until:number;priority:number;ui:boolean;}
const MAX_SHOTS=6;
const logicalPhase=(sample:RaceAudioSample)=>sample.phase===8?sample.resumePhase:sample.phase;

/** Owns presentation voices only. It never emits an input/event or writes race state.
 * The fake backend used by the compact behavior test follows this same public boundary. */
export class RaceAudioController {
  private last:RaceAudioSample|null=null;
  private loops=new Map<LoopName,HeldVoice>();
  private shots:Shot[]=[];
  private musicKey='';
  private musicVolume=-1;
  private foreground=true;
  private now=0;
  constructor(private backend:RaceAudioBackend=audio,private preferences:()=>Readonly<RaceAudioSettings>=()=>settings){}
  get voiceCount():number{return this.loops.size+this.shots.length;}
  private level():number {const p=this.preferences();return p.muted?0:p.sfxVolume;}
  private stopSounds(keepUi=false):void {
    for(const loop of this.loops.values())loop.voice.stop();this.loops.clear();
    this.shots=this.shots.filter(shot=>{if(keepUi&&shot.ui)return true;shot.voice.stop();return false;});
  }
  private cue(name:RaceSoundName,priority=40,volume=1,pan=0):void {
    const level=this.level();if(!this.foreground||level<=0)return;
    this.shots=this.shots.filter(shot=>{if(shot.until>this.now)return true;shot.voice.stop();return false;});
    if(this.shots.length>=MAX_SHOTS){
      let oldest=0;for(let i=1;i<this.shots.length;i++)if(this.shots[i]!.priority<this.shots[oldest]!.priority)oldest=i;
      if(this.shots[oldest]!.priority>priority)return;
      this.shots[oldest]!.voice.stop();this.shots.splice(oldest,1);
    }
    const voice=this.backend.voice(RACE_SOUNDS[name],{bus:name==='radioSelect'?'UI':voices.has(name)?'Voice':'SFX',volume:volume*level,priority,maxVoices:1,pan,loop:false});
    this.shots.push({voice,priority,until:this.now+RACE_SOUND_DURATIONS[name]+0.1,ui:name==='radioSelect'});
  }
  private loop(name:LoopName,enabled:boolean,volume:number,pitch=1):void {
    const old=this.loops.get(name),level=this.level()*volume;
    if(!enabled||!this.foreground||level<=0){if(old){old.voice.stop();this.loops.delete(name);}return;}
    if(!old){const voice=this.backend.voice(RACE_SOUNDS[name],{bus:'SFX',volume:level,pitch,loop:true,maxVoices:1,priority:name==='engineRun'?50:20});this.loops.set(name,{voice,volume:level,pitch});}
    else if(Math.abs(old.volume-level)>0.005||Math.abs(old.pitch-pitch)>0.005){old.voice.set({volume:level,pitch});old.volume=level;old.pitch=pitch;}
  }
  private music(sample:RaceAudioSample):void {
    const prefs=this.preferences(),phase=logicalPhase(sample);
    const key=phase===6?RESULT_MUSIC.finish:phase===7?RESULT_MUSIC.gameOver:RADIO_TRACKS[prefs.radio]!.key;
    const volume=prefs.muted||sample.phase===8?0:prefs.musicVolume;
    if(this.foreground&&(key!==this.musicKey||volume!==this.musicVolume)){
      // Reissuing the same streamed track changes its gain without restarting it.
      this.backend.music(key,{volume,fade:key===this.musicKey?0:0.35});musicOwners.set(this.backend,this);this.musicKey=key;this.musicVolume=volume;
    }
  }
  settingsChanged(radioChanged=false):void {
    if(!this.last?.active)return;
    this.stopSounds();
    this.music(this.last);
  }
  setForeground(foreground:boolean):void {
    this.foreground=foreground;
    if(!foreground)this.stopSounds();
    // The platform suspends/resumes its mixer. Keep the music request/position;
    // the next observed frame restores SFX only from current gameplay state.
  }
  deactivate():void {
    this.stopSounds();if(this.musicKey&&musicOwners.get(this.backend)===this){this.backend.stopMusic({fade:0.1});musicOwners.delete(this.backend);}
    this.musicKey='';this.musicVolume=-1;this.last=null;
  }
  dispose():void {this.deactivate();}
  sample(sample:RaceAudioSample,nowSeconds:number):void {
    this.now=nowSeconds;
    if(!sample.active){if(this.last)this.deactivate();return;}
    if(this.last&&sample.raceEpoch!==this.last.raceEpoch)this.deactivate();
    const previous=this.last,phase=logicalPhase(sample),previousPhase=previous?logicalPhase(previous):-1;
    this.music(sample);
    this.shots=this.shots.filter(shot=>{if(shot.until>this.now)return true;shot.voice.stop();return false;});
    const paused=sample.phase===8||!this.foreground;
    if(paused){this.stopSounds(true);this.last={...sample};return;}
    if(!previous&&phase===0)this.cue('showmanStart',70,0.9);
    if(phase===0){
      const count=Math.ceil(sample.countdownTicks/60),oldCount=previous?Math.ceil(previous.countdownTicks/60):4;
      if(count<oldCount&&(count===2||count===1))this.cue('semaphorePrepare',75,0.8);
    }
    if(phase===1&&previousPhase===0){this.cue('semaphoreStart',80,0.9);this.cue('raceStart',65,0.75);this.cue('crowd',20,0.35);}
    if(previous&&sample.checkpoints>previous.checkpoints){
      this.cue('checkpointAlarm',80,0.8);
      const names:RaceSoundName[]=['checkpointVoice1','checkpointVoice2','checkpointVoice3'];
      this.cue(names[(sample.checkpoints-1)%3]!,75,0.9);
    }
    if(previous&&sample.remainingTicks<=600&&sample.remainingTicks>0&&previous.remainingTicks>600)this.cue('tenSeconds',80,0.9);
    if(previous&&sample.gear!==previous.gear&&sample.speed>0&&sample.crashPhase===0)this.cue(sample.gear>previous.gear?'gearUp':'gearDown',35,0.4);
    if(sample.crashPhase!==0&&(!previous||previous.crashPhase===0||sample.impacts>previous.impacts)){
      this.cue('crash',90,0.9);this.cue('womanCrash',75,0.7);
    }
    if(previous&&sample.passes>previous.passes)this.cue('horn1',25,0.25,sample.trafficPan);
    if(phase>=2&&phase<=4&&previousPhase<2){this.cue('finishFirst',80,0.7);this.cue('showmanCongratulations',75,0.9);}
    if(phase===6&&previousPhase!==6)this.cue('crowdCongratulations',60,0.5);
    if(phase===7&&previousPhase!==7){this.stopSounds();this.cue('womanDie',80,0.8);this.cue('gameOver',70,0.65);}
    const driving=phase>=1&&phase<=4&&sample.speed>0,crashing=sample.crashPhase!==0;
    const braking=(sample.held&2)!==0,accelerating=(sample.held&1)!==0;
    if(driving&&accelerating&&(!previous||previous.speed<=0))this.cue('engineStart',50,0.5);
    const pitch=clamp(0.75+sample.speed/360+(sample.gear?0:0.1),0.75,1.9);
    this.loop('engineRun',driving&&!crashing&&!braking,accelerating?0.38:0.24,pitch);
    this.loop('brake',driving&&!crashing&&braking,0.35,pitch);
    this.loop('skid',driving&&!crashing&&sample.skidding,0.4);
    this.loop('offRoad',driving&&!crashing&&sample.offRoad,0.25);
    this.loop('drift',driving&&crashing,0.45);
    this.loop('scoreBonus',phase===5,0.35);
    this.loop('trafficEngine1',driving&&sample.traffic>0&&sample.traffic%3===1,0.12,pitch);
    this.loop('trafficEngine2',driving&&sample.traffic>0&&sample.traffic%3===2,0.12,pitch);
    this.loop('trafficEngine3',driving&&sample.traffic>0&&sample.traffic%3===0,0.12,pitch);
    this.last={...sample};
  }
}

/** Source radio preview owns only its wave/feedback and streamed music. */
export class RadioAudioPreview {
  private wave:AudioVoice|null=null;
  private feedback:AudioVoice[]=[];
  private key='';
  private volume=-1;
  private disposed=false;
  private foreground=true;
  private unsubscribe:()=>void;
  constructor(private backend:RaceAudioBackend=audio){
    setRaceAudioSettings({radio:0});
    this.unsubscribe=subscribeRaceAudioSettings(()=>this.refresh());
    this.feedback.push(this.backend.voice(RACE_SOUNDS.radioSelect,{bus:'UI',volume:settings.muted?0:settings.sfxVolume,maxVoices:1}));
  }
  private refresh():void {
    if(this.disposed||!this.foreground)return;
    const track=RADIO_TRACKS[settings.radio]!,volume=settings.muted?0:settings.musicVolume,sfx=settings.muted?0:settings.sfxVolume;
    if(this.key!==track.key||this.volume!==volume){this.backend.music(track.key,{volume,fade:0});musicOwners.set(this.backend,this);this.key=track.key;this.volume=volume;}
    if(!this.wave)this.wave=this.backend.voice(RACE_SOUNDS.wave,{loop:true,bus:'SFX',volume:sfx*0.2,maxVoices:1,priority:10});
    else this.wave.set({volume:sfx*0.2});
  }
  move(direction:number):void {
    if(this.disposed)return;
    const next=clamp(settings.radio+(direction<0?-1:1),0,RADIO_TRACKS.length-1);
    if(next===settings.radio)return;
    setRaceAudioSettings({radio:next});
    // Keep only the latest selection feedback, as the source sound channel does.
    for(const voice of this.feedback)voice.stop();
    this.feedback=[this.backend.voice(RACE_SOUNDS.radioMove,{bus:'UI',volume:settings.muted?0:settings.sfxVolume,maxVoices:1})];
  }
  setForeground(foreground:boolean):void {
    this.foreground=foreground;
    if(!foreground){this.wave?.stop();this.wave=null;for(const voice of this.feedback)voice.stop();this.feedback=[];}
    else this.refresh();
  }
  confirm():void {
    if(this.disposed)return;
    this.dispose();
    if(!settings.muted)audio.play(RACE_SOUNDS.radioConfirm,{bus:'UI',volume:settings.sfxVolume,maxVoices:1});
  }
  dispose():void {
    if(this.disposed)return;this.disposed=true;this.unsubscribe();this.wave?.stop();this.wave=null;
    for(const voice of this.feedback)voice.stop();this.feedback=[];
    // A direct scene change can already have handed music to the race sampler.
    if(musicOwners.get(this.backend)===this){this.backend.stopMusic({fade:0});musicOwners.delete(this.backend);}
  }
}

/** A boot/world owns its controller. UI disposal handles scene/editor/test rebuilds. */
export const RaceAudioLifecycle=defineUI({name:'RaceAudioLifecycle',root(){
  let restored=false;
  try{const saved=gameengine.kv.get<Partial<RaceAudioSettings>|null>(SETTINGS_KEY,null);if(saved&&typeof saved==='object'){settings=cleanSettings(saved);restored=true;}}catch{/* Denied storage uses defaults/session values. */}
  // Controls can mount first. Publish restored preferences directly to their
  // observers; do not route this initialization through a UI intent or save.
  if(restored)for(const listener of listeners)listener(getRaceAudioSettings());
  const controller=new RaceAudioController();activeController=controller;
  const race=useResource(RaceState);
  createEffect(()=>{if(race()?.initialized!==true)controller.deactivate();});
  const off=app.onLifecycle(state=>controller.setForeground(state==='foreground'));
  onCleanup(()=>{off();controller.dispose();if(activeController===controller)activeController=null;});
  return null;
}});

// Existing sim data is observed after the transaction; no audio completion can
// admit a race tick, choose a route, advance RNG or delay a score/timer outcome.
const source=originalRouteSources();
export const RaceAudioPresentation=defineSystem({
  name:'RaceAudioPresentation',stage:'LateUpdate',after:['RaceAudioLifecycle'],
  query:query(read(RouteDriver),read(RouteTrafficCoordinates),read(TerrainDriver),read(CrashDriver),read(TrafficPool)),
  runIf:{any:[{query:query(read(RouteDriver))},{resource:RaceState,field:'initialized',value:true}]},
  resources:[read(RaceState),read(DrivingState),read(DrivingInput)],
  run(ctx,q){
    if(!activeController||ctx.step===0)return;
    const race=ctx.get(RaceState),driving=ctx.get(DrivingState),held=ctx.get(DrivingInput);
    if(!race.initialized||q.count!==1){activeController.deactivate();return;}
    for(const chunk of q.chunks())for(let row=0;row<chunk.length;row++){
      const route=chunk.get(RouteDriver,row),coordinates=chunk.get(RouteTrafficCoordinates,row),terrain=chunk.get(TerrainDriver,row),crash=chunk.get(CrashDriver,row),pool=chunk.get(TrafficPool,row);
      const playerZ=route.camera+source.get(route.mapId as SourceBiomeId,route.gradient as -1|0|1).playerOffsetZ;
      let nearest=-1,gap=2000;
      for(let slot=0;slot<pool.population;slot++)if(pool.active[slot]&&pool.moving[slot]){
        const distance=Math.abs(coordinates.rawZ[slot]!-playerZ);if(distance<gap){gap=distance;nearest=slot;}
      }
      activeController.sample({active:route.initialized,raceEpoch:race.raceEpoch,phase:race.phase,resumePhase:race.resumePhase,
        countdownTicks:race.countdownTicks,remainingTicks:race.remainingTicks,checkpoints:race.consumedCheckpoints,passes:route.passAwardCount,
        speed:driving.legacySpeed,gear:driving.gear,held:held.keyboard|held.ui,crashPhase:crash.phase,impacts:crash.consumedAcceptedCount,
        skidding:terrain.skidding,offRoad:terrain.leftOutside||terrain.rightOutside,traffic:nearest<0?0:nearest+1,
        trafficPan:nearest<0?0:clamp(pool.offset[nearest]!-driving.lateral,-1,1)},gameengine.clock.wallNow()/1000);
    }
  }
});
