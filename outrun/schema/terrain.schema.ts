import {component,bool,f32,u32} from '@gameengine/schema';

// Optional single-player source-track handling. Scene lifetime owns this state;
// legacy proof scenes contain no TerrainDriver and keep their original rules.
export const TerrainDriver=component('TerrainDriver',{
  mapId:u32({default:1}),segment:u32(),roadSide:u32(),previousGap:f32(),initialized:bool(),
  leftOutside:bool(),rightOutside:bool(),leftEffect:u32(),rightEffect:u32(),skidding:bool(),
  recentering:bool(),recenterTarget:f32(),sectionEnd:bool(),
},{sim:true});
// Animation bookkeeping is presentation-only and disappears with the driver.
export const TerrainVisualState=component('TerrainVisualState',{
  lastStep:u32(),animationTicks:u32(),
},{sim:false});
