import {defineView,View,Widget} from '@gameengine/ui';

/** Source options art and font, documenting the controls implemented by this port. */
export const ControlsHelpView=defineView<Record<string,never>>({
  name:'ControlsHelp',layer:'overlay',blockInput:true,
  description:'Keyboard and touch driving guide. Intent: back.',
  samples:{guide:{}},
  render:(_model,{intent})=><View id="controls-help" style={{width:'100%',height:'100%'}}>
    <Widget id="controls-help-backdrop" doc="controls-help-backdrop"/>
    <Widget id="controls-help-text" doc="controls-help-screen" onIntent={(_,event)=>{
      if(event.path.at(-1)==='back')intent('back');
    }}/>
  </View>,
});
