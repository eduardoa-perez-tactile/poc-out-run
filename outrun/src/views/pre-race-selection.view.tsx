import {defineView,Widget,View} from '@gameengine/ui';
import type {PreRaceSelectionValue} from '../schema.gen.ts';
import {MAIN_MENU_ART,GEAR_ART,CAR_MENU_ART,CAR_PREVIEW_KEYS,OPTIONS_ART} from '../content/pre-race-art.ts';
import {MenuPage} from '../sim/pre-race-selection.ts';
export interface PreRaceSelectionModel {
  screen:string;backgroundImage:string;logoImage:string;carImage:string;gearLeftImage:string;gearRightImage:string;
  heading:string;primaryLabel:string;secondaryLabel:string;detailLabel:string;availabilityLabel:string;
  showLogo:boolean;showCar:boolean;showGears:boolean;selectedRow:number;
}
export function preRaceSelectionModel(s:PreRaceSelectionValue):PreRaceSelectionModel {
  const screen=['home','options','mode','gears','car'][s.page]??'home';
  const labels=s.page===MenuPage.Options?[`DIFFICULTY  ${['EASY','NORMAL','HARD'][s.difficulty]}`,`TRAFFIC  ${s.population===9?'LOW':s.population===32?'HIGH':'MEDIUM'}`]
    :s.page===MenuPage.Mode?['ORIGINAL','CONTINUOUS']:s.page===MenuPage.Gears?['AUTOMATIC','MANUAL']:s.page===MenuPage.Car?[`FERRARI ${s.car+1} / 14`,'']:['START','OPTIONS'];
  return {screen,backgroundImage:s.page===MenuPage.Car?CAR_MENU_ART.background:s.page===MenuPage.Options?OPTIONS_ART.background:MAIN_MENU_ART.background,
    logoImage:MAIN_MENU_ART.logos[0],carImage:CAR_PREVIEW_KEYS[Math.max(0,Math.min(13,s.car))]![0]!,
    gearLeftImage:s.manual?GEAR_ART.automaticIdle:GEAR_ART.automaticSelected,gearRightImage:s.manual?GEAR_ART.manualSelected:GEAR_ART.manualIdle,
    heading:s.page===MenuPage.Home?'':s.page===MenuPage.Options?'OPTIONS':s.page===MenuPage.Mode?'SELECT MODE':s.page===MenuPage.Gears?'SELECT GEARS':'SELECT VEHICLE',
    primaryLabel:labels[0]!,secondaryLabel:labels[1]!,detailLabel:s.page===MenuPage.Mode?'SURVIVAL':'',
    availabilityLabel:s.page===MenuPage.Mode&&s.cursor!==0?'NOT AVAILABLE IN THIS PORT':'',
    showLogo:s.page===MenuPage.Home||s.page===MenuPage.Mode,showCar:s.page===MenuPage.Car,showGears:s.page===MenuPage.Gears,selectedRow:s.cursor};
}
const sampleState:PreRaceSelectionValue={enabled:true,page:0,cursor:0,difficulty:1,population:20,manual:false,car:0,launch:false,held:0};
export const PreRaceSelectionView=defineView<PreRaceSelectionModel>({
  name:'PreRaceSelection',layer:'overlay',blockInput:true,
  description:'Original main menu, options, mode, gears and vehicle selection.',
  samples:{home:preRaceSelectionModel(sampleState),options:preRaceSelectionModel({...sampleState,page:1}),mode:preRaceSelectionModel({...sampleState,page:2}),gears:preRaceSelectionModel({...sampleState,page:3}),car:preRaceSelectionModel({...sampleState,page:4})},
  render:(model,{intent})=><View id="pre-race-screen" style={{width:'100%',height:'100%'}}>
    <Widget id="pre-race-art" doc="pre-race-art" props={{
      screen:()=>model().screen,backgroundImage:()=>model().backgroundImage,logoImage:()=>model().logoImage,
      carImage:()=>model().carImage,gearLeftImage:()=>model().gearLeftImage,gearRightImage:()=>model().gearRightImage,
      showLogo:()=>model().showLogo,showCar:()=>model().showCar,showGears:()=>model().showGears,
    }}/>
    <Widget id="pre-race-controls" doc="pre-race-controls" props={{
      screen:()=>model().screen,heading:()=>model().heading,primaryLabel:()=>model().primaryLabel,
      secondaryLabel:()=>model().secondaryLabel,detailLabel:()=>model().detailLabel,
      availabilityLabel:()=>model().availabilityLabel,selectedRow:()=>model().selectedRow,
    }} onIntent={(_,event)=>{const name=event.path.at(-1);if(name)intent(name);}}/>
  </View>,
});
