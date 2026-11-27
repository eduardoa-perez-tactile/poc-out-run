import {Keys} from '@gameengine/runtime';
import {BINDING_ACTIONS,DEFAULT_BINDINGS,bindingProblem,keyLabel,KeyboardBindingsStore,type BindingAction,type KeyboardBindings} from '../content/keyboard-bindings.ts';
import {MenuPage} from '../sim/pre-race-selection.ts';
import type {ControlsHelpModel} from '../views/controls-help.view.tsx';
const names:Record<BindingAction,string>={left:'TURN LEFT',right:'TURN RIGHT',throttle:'ACCELERATE',brake:'BRAKE',up:'GEAR UP',down:'GEAR DOWN'};
const equal=(a:KeyboardBindings,b:KeyboardBindings)=>BINDING_ACTIONS.every(action=>a[action]===b[action]);

export class BindingsEditor {
  private selected=0;
  private capturing=false;
  private status='ARROWS SELECT · ENTER OR TAP A CONTROL TO CHANGE ITS KEY';
  constructor(private bindings:KeyboardBindings,private request:(bindings:KeyboardBindings)=>void,private back:()=>void){}
  update(bindings:KeyboardBindings):void {this.bindings={...bindings};}
  model():ControlsHelpModel {
    const rows={} as Record<BindingAction,string>;
    for(const action of BINDING_ACTIONS)rows[action]=`${names[action]} : ${keyLabel(this.bindings[action])}`;
    return {...rows,status:this.status,selected:this.selected,capturing:this.capturing};
  }
  intent(name:string):void {
    if(name==='back'){this.back();return;}
    if(name==='defaults'){
      this.bindings={...DEFAULT_BINDINGS};this.request({...this.bindings});this.capturing=false;this.status='DEFAULT KEYS RESTORED';return;
    }
    const action=name.replace(/^bind-/,'') as BindingAction;
    const index=BINDING_ACTIONS.indexOf(action);if(index<0)return;
    this.selected=index;this.capturing=true;this.status=`PRESS A KEY FOR ${names[action]} · ESC GOES BACK`;
  }
  key(code:number):void {
    if(code===Keys.Escape){this.back();return;}
    if(this.capturing){
      const action=BINDING_ACTIONS[this.selected]!,problem=bindingProblem(this.bindings,action,code);
      if(problem){this.status=problem;return;}
      this.bindings={...this.bindings,[action]:code};this.request({...this.bindings});this.capturing=false;this.status='BINDING UPDATED';return;
    }
    if(code===Keys.ArrowUp)this.selected=Math.max(0,this.selected-1);
    else if(code===Keys.ArrowDown)this.selected=Math.min(5,this.selected+1);
    else if(code===Keys.Enter)this.intent(`bind-${BINDING_ACTIONS[this.selected]}`);
  }
}
/** Storage stays on the UI side; whole snapshots are recorded before Start. */
export class KeyboardBindingsSync {
  private started=false;
  private pending:KeyboardBindings|null=null;
  constructor(private store:KeyboardBindingsStore,private restore:(bindings:KeyboardBindings)=>void){}
  observe(enabled:boolean,page:number,bindings:KeyboardBindings):void {
    if(!this.started){
      if(!enabled||page!==MenuPage.Home)return;
      this.started=true;
      const saved=this.store.current();
      if(this.store.hasSavedBindings&&!equal(saved,bindings)){this.pending=saved;this.restore({...saved});return;}
    }
    if(!this.started)return;
    if(this.pending){if(equal(this.pending,bindings)||!enabled||page!==MenuPage.Home)this.pending=null;else return;}
    this.store.save(bindings);
  }
}
