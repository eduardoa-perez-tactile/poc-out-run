import {resource,u32,bool} from '@gameengine/schema';

// Recorded menu keyboard transport only. Race simulation never reads it.
// Default outside the menu, so legacy race/proof hashes are unchanged.
export const RadioSelectionInput=resource('RadioSelectionInput',{
  enabled:bool(),left:u32(),right:u32(),confirm:u32(),held:u32(),
},{sim:true});
