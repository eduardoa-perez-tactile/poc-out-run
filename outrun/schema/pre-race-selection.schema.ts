import {resource,event,u32,i32,bool} from '@gameengine/schema';

// Recorded pre-race choices. Defaults remain inert in legacy proof scenes.
export const PreRaceSelection=resource('PreRaceSelection',{
  enabled:bool(),page:u32(),cursor:u32(),difficulty:u32({default:1}),
  population:u32({default:20}),manual:bool(),car:u32(),launch:bool(),held:u32(),
},{sim:true});
export const PreRaceAction=event('PreRaceAction',{action:u32(),value:i32()},{sim:true});
