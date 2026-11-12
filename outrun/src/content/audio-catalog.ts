// Source audio: OutRun commit 6882721c99bc79365f815f68d389bf5078129e68.
// Duration metadata is read from source Ogg/Vorbis sample counts. Music streams;
// only short effects and the source stereo coastal ambience belong to the resident bank.
export const AUDIO_BANK_KEY='audio/race/core.bank';
export const RACE_SOUNDS={
  "engineStart": "audio/race/sfx/engine-start",
  "engineRun": "audio/race/sfx/engine-run",
  "brake": "audio/race/sfx/brake",
  "skid": "audio/race/sfx/skid",
  "drift": "audio/race/sfx/drift",
  "offRoad": "audio/race/sfx/off-road",
  "gearUp": "audio/race/sfx/gear-up",
  "gearDown": "audio/race/sfx/gear-down",
  "crash": "audio/race/sfx/crash",
  "semaphorePrepare": "audio/race/sfx/semaphore-prepare",
  "semaphoreStart": "audio/race/sfx/semaphore-start",
  "raceStart": "audio/race/sfx/race-start",
  "finishFirst": "audio/race/sfx/finish-first",
  "finishSecond": "audio/race/sfx/finish-second",
  "finishThird": "audio/race/sfx/finish-third",
  "showmanStart": "audio/race/sfx/showman-start",
  "showmanCongratulations": "audio/race/sfx/showman-congratulations",
  "tenSeconds": "audio/race/sfx/ten-seconds",
  "hurryUp": "audio/race/sfx/hurry-up",
  "womanCrash": "audio/race/sfx/woman-crash",
  "womanDie": "audio/race/sfx/woman-die",
  "checkpointAlarm": "audio/race/sfx/checkpoint-alarm",
  "checkpointVoice1": "audio/race/sfx/checkpoint-voice-1",
  "checkpointVoice2": "audio/race/sfx/checkpoint-voice-2",
  "checkpointVoice3": "audio/race/sfx/checkpoint-voice-3",
  "trafficEngine1": "audio/race/sfx/traffic-engine-1",
  "trafficEngine2": "audio/race/sfx/traffic-engine-2",
  "trafficEngine3": "audio/race/sfx/traffic-engine-3",
  "horn1": "audio/race/sfx/horn-1",
  "horn2": "audio/race/sfx/horn-2",
  "horn3": "audio/race/sfx/horn-3",
  "horn4": "audio/race/sfx/horn-4",
  "scoreBonus": "audio/race/sfx/score-bonus",
  "gameOver": "audio/race/sfx/game-over",
  "radioSelect": "audio/race/sfx/radio-select",
  "crowd": "audio/race/sfx/crowd",
  "crowdCongratulations": "audio/race/sfx/crowd-congratulations",
  "radioMove": "audio/race/sfx/radio-move",
  "radioConfirm": "audio/race/sfx/radio-confirm",
  "radioBack": "audio/race/sfx/radio-back",
  "wave": "audio/race/sfx/wave"
} as const;
export type RaceSoundName=keyof typeof RACE_SOUNDS;
export const RACE_SOUND_DURATIONS={
  "engineStart": 1.538917,
  "engineRun": 1.630042,
  "brake": 0.567229,
  "skid": 0.934263,
  "drift": 1.52,
  "offRoad": 0.100091,
  "gearUp": 2.535833,
  "gearDown": 1.868521,
  "crash": 0.70068,
  "semaphorePrepare": 0.734603,
  "semaphoreStart": 1.02195,
  "raceStart": 3.04,
  "finishFirst": 7.607583,
  "finishSecond": 7.798125,
  "finishThird": 8.133917,
  "showmanStart": 5.696531,
  "showmanCongratulations": 4.020458,
  "tenSeconds": 1.347667,
  "hurryUp": 0.900896,
  "womanCrash": 1.353288,
  "womanDie": 1.1235,
  "checkpointAlarm": 0.300295,
  "checkpointVoice1": 2.2022,
  "checkpointVoice2": 1.0275,
  "checkpointVoice3": 2.591995,
  "trafficEngine1": 1.101333,
  "trafficEngine2": 1.301333,
  "trafficEngine3": 1.319977,
  "horn1": 0.286599,
  "horn2": 0.23,
  "horn3": 1.119977,
  "horn4": 0.92,
  "scoreBonus": 1.067687,
  "gameOver": 2.641979,
  "radioSelect": 0.642667,
  "crowd": 3.903896,
  "crowdCongratulations": 4.526667,
  "radioMove": 0.666984,
  "radioConfirm": 0.982993,
  "radioBack": 0.666984,
  "wave": 9.801333
} as const;
export const RADIO_TRACKS=[
  {
    "id": 0,
    "title": "Magical Sound Shower",
    "key": "audio/race/music/magical-sound-shower",
    "durationSeconds": 268.303673
  },
  {
    "id": 1,
    "title": "Passing Breeze",
    "key": "audio/race/music/passing-breeze",
    "durationSeconds": 300.522812
  },
  {
    "id": 2,
    "title": "Splash Wave",
    "key": "audio/race/music/splash-wave",
    "durationSeconds": 220.727438
  },
  {
    "id": 3,
    "title": "Way to My Love",
    "key": "audio/race/music/way-to-my-love",
    "durationSeconds": 273.473175
  },
  {
    "id": 4,
    "title": "Cruising Line",
    "key": "audio/race/music/cruising-line",
    "durationSeconds": 354.053696
  },
  {
    "id": 5,
    "title": "Outride a Crisis",
    "key": "audio/race/music/outride-a-crisis",
    "durationSeconds": 239.12483
  },
  {
    "id": 6,
    "title": "Sprinter",
    "key": "audio/race/music/sprinter",
    "durationSeconds": 236.094649
  },
  {
    "id": 7,
    "title": "Hard Road",
    "key": "audio/race/music/hard-road",
    "durationSeconds": 236.852154
  },
  {
    "id": 8,
    "title": "Winning Run",
    "key": "audio/race/music/winning-run",
    "durationSeconds": 193.619524
  }
] as const;
export const RESULT_MUSIC={finish:'audio/race/music/last-wave',gameOver:'audio/race/music/game-over'} as const;
