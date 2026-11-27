import {defineView,Widget,View} from '@gameengine/ui';

export interface RankingsModel {
  subtitle:string;
  rows:{rank:string;score:string;name:string;time:string}[];
  draft:string;
  status:string;
  countdown:string;
  entry:boolean;
}
const sample:RankingsModel={
  subtitle:'ORIGINAL / NORMAL / MEDIUM TRAFFIC',
  rows:[['70','ZGZ','05:13.10'],['60','SUB','05:43.18'],['50','ADD','06:52.29'],['40','SER','06:25.44'],['30','GOG','06:37.53'],['20','CAT','07:19.31'],['10','RMF','07:42.49']].map(([score,name,time],i)=>({rank:String(i+1),score:score!,name:name!,time:time!})),
  draft:'INITIALS ___  LETTER A',status:'CHOOSE A MODE, DIFFICULTY AND TRAFFIC LEVEL',countdown:'',entry:false,
};
const actions:Record<string,string>={
  'previous-letter':'previousLetter','next-letter':'nextLetter','add-letter':'addLetter',
  'next-mode':'nextMode','next-difficulty':'nextDifficulty','next-traffic':'nextTraffic',
};
/** Source ranking art and live seven-row data; presentation emits intents only. */
export const RankingsView=defineView<RankingsModel>({
  name:'Rankings',layer:'overlay',blockInput:true,
  description:'Original BEST OUTRUNNERS board with three-letter entry and local mode rankings.',
  samples:{browse:sample,entry:{...sample,entry:true,draft:'INITIALS AB_  LETTER C',status:'ENTER THREE LETTERS, THEN SAVE',countdown:'28'}},
  render:(model,{intent})=><View id="rankings-screen" style={{width:'100%',height:'100%'}}>
    <Widget id="rankings-backdrop" doc="rankings-backdrop"/>
    <Widget id="rankings" doc="rankings-screen" props={{
    subtitle:()=>model().subtitle,
    rows:()=>model().rows.map((row,i)=>({key:String(i),...row})),
    draft:()=>model().draft,status:()=>model().status,countdown:()=>model().countdown,entry:()=>model().entry,
  }} onIntent={(_,event)=>{const name=event.path.at(-1);if(name)intent(actions[name]??name);}}/>
  </View>,
});
