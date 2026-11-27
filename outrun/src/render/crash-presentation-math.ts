import type {CrashDriverValue} from '../schema.gen.ts';

export interface CrashVehicleSample {pose:number;sample:number;hidden:boolean}
/** Source body selection from fixed-step recovery state; never a visual clock. */
export function crashVehicleSample(crash:Readonly<Pick<CrashDriverValue,'phase'|'variant'|'advances'|'reactionTick'>>):CrashVehicleSample|null{
  const {phase,variant,advances,reactionTick}=crash;
  if(!Number.isInteger(phase)||phase<0||phase>3||!Number.isInteger(variant)||variant<0||variant>1||
    !Number.isInteger(advances)||advances<0||advances>32||!Number.isInteger(reactionTick)||reactionTick<0||reactionTick>105)
    throw new Error('Invalid crash presentation state');
  if(phase===0)return null;
  if(phase===1){
    if(advances===32||reactionTick!==0)throw new Error('Invalid live spin counters');
    return {pose:variant===0?18:20,sample:advances%8,hidden:false};
  }
  if(phase===2){
    if(reactionTick===105)throw new Error('Reaction completion must enter recenter');
    return {pose:variant===0?19:21,sample:Math.floor(reactionTick/7)%5,hidden:false};
  }
  if(reactionTick!==105)throw new Error('Hidden recenter requires completed reaction');
  return {pose:variant===0?19:21,sample:4,hidden:true};
}
