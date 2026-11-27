/** Versioned local preferences. Simulation receives these through recorded menu
 * input; this module never reads or writes the race world or audio settings. */
export interface GameSettings {difficulty:number;population:number;manual:boolean;car:number;}
export interface GameSettingsStorage {get(key:string,fallback:unknown):unknown;set(key:string,value:unknown):void;}
export const GAME_SETTINGS_KEY='outrun.game-settings.v1';
export const DEFAULT_GAME_SETTINGS:Readonly<GameSettings>=Object.freeze({difficulty:1,population:20,manual:false,car:0});

export function validGameSettings(value:unknown):value is GameSettings {
  if(typeof value!=='object'||value===null||Array.isArray(value))return false;
  const settings=value as Record<string,unknown>;
  return [0,1,2].includes(settings.difficulty as number)&&[9,20,32].includes(settings.population as number)&&
    typeof settings.manual==='boolean'&&typeof settings.car==='number'&&Number.isInteger(settings.car)&&settings.car>=0&&settings.car<=13;
}
function copy(settings:GameSettings):GameSettings {
  return {difficulty:settings.difficulty,population:settings.population,manual:settings.manual,car:settings.car};
}
function read(value:unknown):GameSettings|null {
  if(typeof value==='string'){try{value=JSON.parse(value);}catch{return null;}}
  if(!validGameSettings(value)||(value as GameSettings&{version?:unknown}).version!==1)return null;
  return copy(value);
}
function equal(left:GameSettings,right:GameSettings):boolean {
  return left.difficulty===right.difficulty&&left.population===right.population&&left.manual===right.manual&&left.car===right.car;
}
export class GameSettingsStore {
  private settings:GameSettings=copy(DEFAULT_GAME_SETTINGS);
  private unavailable=false;
  private savedSettings=false;
  constructor(private storage:GameSettingsStorage){
    try{const saved=read(storage.get(GAME_SETTINGS_KEY,null));this.savedSettings=saved!==null;this.settings=saved??copy(DEFAULT_GAME_SETTINGS);}
    catch{this.unavailable=true;}
  }
  get storageUnavailable():boolean{return this.unavailable;}
  /** A valid persisted payload was read when this owner was created. */
  get hasSavedSettings():boolean{return this.savedSettings;}
  current():GameSettings{return copy(this.settings);}
  /** Returns durability status. Identical preferences never write again, even
   * after denial; the in-session choice remains usable in that case. */
  save(value:GameSettings):boolean {
    if(!validGameSettings(value))return false;
    if(equal(this.settings,value))return !this.unavailable;
    this.settings=copy(value);
    try{this.storage.set(GAME_SETTINGS_KEY,{version:1,...this.settings});this.unavailable=false;return true;}
    catch{this.unavailable=true;return false;}
  }
}
