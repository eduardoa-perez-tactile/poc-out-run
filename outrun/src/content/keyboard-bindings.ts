import {Keys,keyName} from '@gameengine/runtime';

/** Source MenuControls order. Bindings enter simulation only as recorded input. */
export const BINDING_ACTIONS=['left','right','throttle','brake','up','down'] as const;
export type BindingAction=typeof BINDING_ACTIONS[number];
export type KeyboardBindings=Record<BindingAction,number>;
export const DEFAULT_BINDINGS:Readonly<KeyboardBindings>=Object.freeze({
  left:Keys.ArrowLeft,right:Keys.ArrowRight,throttle:Keys.ArrowUp,brake:Keys.ArrowDown,up:Keys.KeyE,down:Keys.KeyQ,
});
export const KEYBOARD_BINDINGS_KEY='outrun.keyboard-bindings.v1';
export interface BindingsStorage {get(key:string,fallback:unknown):unknown;set(key:string,value:unknown):void;}
function recognized(code:unknown):code is number {return typeof code==='number'&&Number.isInteger(code)&&code>Keys.Unknown&&code<=Keys.PageDown;}
function reserved(code:number):boolean {return code===Keys.Escape||code===Keys.Space||code===Keys.KeyM;}
function copy(value:KeyboardBindings):KeyboardBindings {
  return {left:value.left,right:value.right,throttle:value.throttle,brake:value.brake,up:value.up,down:value.down};
}
/** Zero overrides are default-inert in the simulation resource. */
export function resolveBindings(overrides:Partial<KeyboardBindings>):KeyboardBindings {
  return {left:overrides.left||DEFAULT_BINDINGS.left,right:overrides.right||DEFAULT_BINDINGS.right,
    throttle:overrides.throttle||DEFAULT_BINDINGS.throttle,brake:overrides.brake||DEFAULT_BINDINGS.brake,
    up:overrides.up||DEFAULT_BINDINGS.up,down:overrides.down||DEFAULT_BINDINGS.down};
}
export function validBindings(value:unknown):value is KeyboardBindings {
  if(typeof value!=='object'||value===null||Array.isArray(value))return false;
  const row=value as Record<string,unknown>,codes=BINDING_ACTIONS.map(action=>row[action]);
  return codes.every(code=>recognized(code)&&!reserved(code))&&new Set(codes).size===BINDING_ACTIONS.length;
}
/** Source rejects keys already assigned to any driving action, including itself. */
export function bindingProblem(bindings:KeyboardBindings,action:BindingAction,code:number):string {
  if(!BINDING_ACTIONS.includes(action)||!recognized(code))return 'CHOOSE A RECOGNIZED KEY';
  if(reserved(code))return 'SPACE, M AND ESC ARE RESERVED';
  if(BINDING_ACTIONS.some(name=>bindings[name]===code))return 'KEY ALREADY IN USE';
  return '';
}
export function keyLabel(code:number):string {
  return keyName(code).replace(/^Key/,'').replace(/^Digit/,'').replace(/^Arrow/,'')
    .replace(/([a-z])([A-Z])/g,'$1 $2').toUpperCase();
}
function read(value:unknown):KeyboardBindings|null {
  if(typeof value==='string'){try{value=JSON.parse(value);}catch{return null;}}
  if(typeof value!=='object'||value===null||Array.isArray(value))return null;
  const record=value as Record<string,unknown>;
  return record.version===1&&validBindings(record.bindings)?copy(record.bindings):null;
}
export class KeyboardBindingsStore {
  private bindings=copy(DEFAULT_BINDINGS);
  private unavailable=false;
  private savedBindings=false;
  constructor(private storage:BindingsStorage){
    try{const loaded=read(storage.get(KEYBOARD_BINDINGS_KEY,null));this.savedBindings=loaded!==null;if(loaded)this.bindings=loaded;}
    catch{this.unavailable=true;}
  }
  get hasSavedBindings():boolean{return this.savedBindings;}
  get storageUnavailable():boolean{return this.unavailable;}
  current():KeyboardBindings{return copy(this.bindings);}
  save(value:KeyboardBindings):boolean {
    if(!validBindings(value))return false;
    if(BINDING_ACTIONS.every(action=>this.bindings[action]===value[action]))return !this.unavailable;
    this.bindings=copy(value);
    try{this.storage.set(KEYBOARD_BINDINGS_KEY,{version:1,bindings:copy(this.bindings)});this.unavailable=false;return true;}
    catch{this.unavailable=true;return false;}
  }
}
