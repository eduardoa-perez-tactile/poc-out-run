import {defineView,Widget,View} from '@gameengine/ui';

export interface RadioSelectionModel {titleImage:string;dialImage:string;handImage:string;}
export function radioSelectionModel(index:number):RadioSelectionModel {
  const selected=Math.max(0,Math.min(8,Math.trunc(index)));
  return {titleImage:`textures/radio/soundtrack${selected+1}`,dialImage:`textures/radio/radio${selected+1}`,handImage:`textures/radio/hand${selected%3+1}`};
}
export const RadioSelectionView=defineView<RadioSelectionModel>({
  name:'RadioSelection',layer:'overlay',blockInput:true,
  description:'Original radio art and live music preview. Left/Right choose; Enter starts the race.',
  samples:{first:radioSelectionModel(0),middle:radioSelectionModel(4),last:radioSelectionModel(8)},
  render:(model,{intent})=><View id="radio-screen" style={{width:'100%',height:'100%'}}><Widget id="radio-selection" doc="radio-selection" props={{
    titleImage:()=>model().titleImage,dialImage:()=>model().dialImage,handImage:()=>model().handImage,
  }}/><Widget id="radio-controls" doc="radio-controls" onIntent={(_,event)=>{const name=event.path.at(-1);if(name==='previous'||name==='next'||name==='start'||name==='back')intent(name);}}/></View>,
});
