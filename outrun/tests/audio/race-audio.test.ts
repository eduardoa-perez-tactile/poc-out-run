import {worldTest,expect} from '@gameengine/test';
import type {AudioVoice} from '@gameengine/runtime';
import {RaceAudioController,type RaceAudioBackend,type RaceAudioSample,type RaceAudioSettings} from '../../src/audio/race-audio.ts';
import {RACE_SOUNDS,RADIO_TRACKS} from '../../src/content/audio-catalog.ts';

worldTest('audio.race cues once, holds bounded loops, pauses without repeating GO and changes streamed radio without changing sim',({world})=>{
  const before=world.hash();
  const started:{key:string;loop:boolean;stopped:boolean;volume:number}[]=[],tracks:{key:string;volume:number}[]=[];
  let musicStops=0;
  const backend:RaceAudioBackend={
    voice(key,options){const row={key,loop:options.loop===true,stopped:false,volume:options.volume??1};started.push(row);
      return {set(change){if(change.volume!==undefined)row.volume=change.volume;},stop(){row.stopped=true;}} as AudioVoice;},
    music(key,options){tracks.push({key,volume:options.volume});},stopMusic(){musicStops++;}
  };
  const prefs:RaceAudioSettings={radio:0,muted:false,musicVolume:0.6,sfxVolume:0.8};
  const controller=new RaceAudioController(backend,()=>prefs);
  const sample:RaceAudioSample={active:true,raceEpoch:1,phase:0,resumePhase:0,countdownTicks:240,remainingTicks:9600,
    checkpoints:0,passes:0,speed:0,gear:0,held:0,crashPhase:0,impacts:0,skidding:false,offRoad:false,traffic:0,trafficPan:0};
  const count=(key:string)=>started.filter(x=>x.key===key).length;
  controller.sample(sample,0);controller.sample({...sample,countdownTicks:120},2);controller.sample({...sample,countdownTicks:60},3);
  expect(count(RACE_SOUNDS.semaphorePrepare)).toBe(2);expect(tracks[0]!.key).toBe(RADIO_TRACKS[0]!.key);
  const driving={...sample,phase:1,countdownTicks:0,speed:80,held:1};
  controller.sample(driving,4);controller.sample(driving,4.1);
  expect(count(RACE_SOUNDS.semaphoreStart)).toBe(1);expect(count(RACE_SOUNDS.engineRun)).toBe(1);
  controller.sample({...driving,phase:8,resumePhase:1},4.2);expect(controller.voiceCount).toBe(0);
  expect(tracks.at(-1)!.key).toBe(RADIO_TRACKS[0]!.key);expect(tracks.at(-1)!.volume).toBe(0);
  controller.sample({...driving,held:0},4.3);
  expect(count(RACE_SOUNDS.semaphoreStart)).toBe(1);expect(count(RACE_SOUNDS.engineRun)).toBe(2);
  expect(tracks.at(-1)!.key).toBe(RADIO_TRACKS[0]!.key);expect(tracks.at(-1)!.volume).toBe(prefs.musicVolume);
  prefs.radio=1;controller.settingsChanged(true);expect(tracks.at(-1)!.key).toBe(RADIO_TRACKS[1]!.key);
  prefs.muted=true;controller.settingsChanged();expect(controller.voiceCount).toBe(0);expect(tracks.at(-1)!.volume).toBe(0);
  prefs.muted=false;controller.settingsChanged();controller.sample({...driving,checkpoints:1},4.4);
  expect(count(RACE_SOUNDS.checkpointAlarm)).toBe(1);controller.sample({...driving,checkpoints:1},4.5);expect(count(RACE_SOUNDS.checkpointAlarm)).toBe(1);
  controller.setForeground(false);expect(controller.voiceCount).toBe(0);controller.setForeground(true);
  for(let i=0;i<12;i++)controller.sample({...driving,checkpoints:2+i,gear:i%2,passes:i,crashPhase:i%2,impacts:i,skidding:true,offRoad:true,traffic:2},5+i/100);
  expect(controller.voiceCount).toBeLessThanOrEqual(10);
  controller.sample({...sample,raceEpoch:2},6);expect(musicStops).toBeGreaterThan(0);
  controller.dispose();expect(controller.voiceCount).toBe(0);expect(started.every(x=>x.stopped)).toBe(true);
  expect(world.hash()).toBe(before);
});

worldTest('audio.race source hurry countdown and finish variants stay edge triggered and presentation only',({world})=>{
  const before=world.hash(),started:string[]=[];
  const backend:RaceAudioBackend={
    voice(key){started.push(key);return {set(){},stop(){}} as AudioVoice;},music(){},stopMusic(){}
  };
  const prefs:RaceAudioSettings={radio:0,muted:false,musicVolume:0.6,sfxVolume:0.8};
  const controller=new RaceAudioController(backend,()=>prefs);
  const sample:RaceAudioSample={active:true,raceEpoch:1,phase:1,resumePhase:1,countdownTicks:0,remainingTicks:601,
    checkpoints:0,passes:0,speed:0,gear:0,held:0,crashPhase:0,impacts:0,skidding:false,offRoad:false,traffic:0,trafficPan:0};
  const count=(key:string)=>started.filter(x=>x===key).length;
  controller.sample(sample,0);
  controller.sample({...sample,remainingTicks:600},1);controller.sample({...sample,remainingTicks:599},1.01);
  expect(count(RACE_SOUNDS.tenSeconds)).toBe(1);
  controller.sample({...sample,remainingTicks:540},2);controller.sample({...sample,remainingTicks:539},2.01);
  expect(count(RACE_SOUNDS.countdown)).toBe(1);
  controller.sample({...sample,remainingTicks:480},3);expect(count(RACE_SOUNDS.countdown)).toBe(2);
  controller.sample({...sample,remainingTicks:301},6.99);controller.sample({...sample,remainingTicks:300},7);
  expect(count(RACE_SOUNDS.hurryUp)).toBe(1);
  const countdowns=count(RACE_SOUNDS.countdown);
  controller.sample({...sample,remainingTicks:300,phase:8},7.1);
  controller.sample({...sample,remainingTicks:300},8);
  expect(count(RACE_SOUNDS.hurryUp)).toBe(1);expect(count(RACE_SOUNDS.countdown)).toBe(countdowns);
  prefs.muted=true;controller.settingsChanged();controller.sample({...sample,remainingTicks:240},9);
  expect(count(RACE_SOUNDS.countdown)).toBe(countdowns);
  prefs.muted=false;controller.settingsChanged();controller.sample({...sample,remainingTicks:180},10);
  expect(count(RACE_SOUNDS.countdown)).toBe(countdowns+1);
  controller.sample({...sample,phase:7,remainingTicks:0},13);
  expect(count(RACE_SOUNDS.countdown)).toBe(countdowns+1);
  for(const mode of [0,1])for(let raceEpoch=1;raceEpoch<=(mode===0?3:2);raceEpoch++){
    controller.sample({...sample,active:false},20);
    controller.sample({...sample,mode,raceEpoch},30+raceEpoch*10);
    controller.sample({...sample,mode,raceEpoch,phase:3},31+raceEpoch*10);
    controller.sample({...sample,mode,raceEpoch,phase:3},31.1+raceEpoch*10);
  }
  for(const key of [RACE_SOUNDS.finishFirst,RACE_SOUNDS.finishSecond,RACE_SOUNDS.finishThird,
    RACE_SOUNDS.continuousFinishFirst,RACE_SOUNDS.continuousFinishSecond])expect(count(key)).toBe(1);
  controller.dispose();expect(controller.voiceCount).toBe(0);expect(world.hash()).toBe(before);
});
