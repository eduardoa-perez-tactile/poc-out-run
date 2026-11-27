import {defineView,View,Widget} from '@gameengine/ui';

export interface ControlsHelpModel {
  left:string;right:string;throttle:string;brake:string;up:string;down:string;
  status:string;selected:number;capturing:boolean;
}
const guide:ControlsHelpModel={left:'TURN LEFT : LEFT',right:'TURN RIGHT : RIGHT',throttle:'ACCELERATE : UP',brake:'BRAKE : DOWN',
  up:'GEAR UP : E',down:'GEAR DOWN : Q',status:'SELECT A CONTROL, PRESS ENTER, THEN PRESS A KEY',selected:0,capturing:false};
/** Source controls art with editable keyboard bindings and touch guidance. */
export const ControlsHelpView=defineView<ControlsHelpModel>({
  name:'ControlsHelp',layer:'overlay',blockInput:true,
  description:'Keyboard bindings and touch driving guide. Intents: bind-left/right/throttle/brake/up/down, back.',
  samples:{guide,capturing:{...guide,left:'TURN LEFT : A',capturing:true,status:'PRESS A KEY FOR TURN LEFT · ESC CANCELS'}},
  render:(model,{intent})=><View id="controls-help" style={{width:'100%',height:'100%'}}>
    <Widget id="controls-help-backdrop" doc="controls-help-backdrop"/>
    <Widget id="controls-help-text" doc="controls-help-screen" props={{
      left:()=>model().left,right:()=>model().right,throttle:()=>model().throttle,brake:()=>model().brake,
      up:()=>model().up,down:()=>model().down,status:()=>model().status,selected:()=>model().selected,capturing:()=>model().capturing,
    }} onIntent={(_,event)=>{const name=event.path.at(-1);if(name)intent(name);}}/>
  </View>,
});
