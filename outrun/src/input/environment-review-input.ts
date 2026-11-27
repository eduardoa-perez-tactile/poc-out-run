import {defineSystem,write,query,KeyEvent,Keys} from '@gameengine/runtime';
import {EnvironmentReviewIsolation} from '../schema.gen.ts';

export interface EnvironmentReviewInputState {
  held:number;sequence:number;mapId:number;mapSequence:number;mode:number;modeSequence:number;
}
/** Pure ordered key accumulator. Version0 means no command, never an authored
 * map reset. Native schema owns this state; presentation consumes versions only. */
export function accumulateEnvironmentReviewKey(state:EnvironmentReviewInputState,code:number,down:boolean):void{
  const bit=code===Keys.Digit2?1:code===Keys.Digit3?2:code===Keys.Digit4?4:code===Keys.Digit0?8:code===Keys.KeyG?16:code===Keys.KeyC?32:code===Keys.KeyV?64:code===Keys.KeyR?128:0;
  if(bit===0)return;
  const rising=down&&(state.held&bit)===0;
  const held=down?state.held|bit:state.held&~bit;
  if(!rising){state.held=held;return;}
  if(state.sequence>=0xffffffff)throw new Error('Environment review input sequence overflow');
  const next=state.sequence+1;state.held=held;state.sequence=next;
  if(bit<32){
    state.mapId=bit===1?2:bit===2?3:bit===4?4:bit===8?10:16;
    state.mapSequence=next;state.mode=0;state.modeSequence=next;
  }else{state.mode=bit===32?1:bit===64?2:0;state.modeSequence=next;}
}

/** Fixed-step input transport only. No presentation resources, asset IO,
 * actors, RNG or frame clocks participate; ownerless scenes are a no-op. */
export const CaptureEnvironmentReviewInput=defineSystem({
  name:'CaptureEnvironmentReviewInput',stage:'PreUpdate',runOn:[KeyEvent],
  query:query(write(EnvironmentReviewIsolation)),
  run(ctx,owners){
    if(owners.count===0)return;
    for(const chunk of owners.chunks())for(let row=0;row<chunk.length;row++){
      const fields=chunk.col(EnvironmentReviewIsolation);
      const state:EnvironmentReviewInputState={held:fields.held[row]!,sequence:fields.sequence[row]!,mapId:fields.mapId[row]!,mapSequence:fields.mapSequence[row]!,mode:fields.mode[row]!,modeSequence:fields.modeSequence[row]!};
      for(const key of ctx.events.read(KeyEvent))accumulateEnvironmentReviewKey(state,key.code,key.down);
      chunk.setField(EnvironmentReviewIsolation,row,'held',state.held);chunk.setField(EnvironmentReviewIsolation,row,'sequence',state.sequence);
      chunk.setField(EnvironmentReviewIsolation,row,'mapId',state.mapId);chunk.setField(EnvironmentReviewIsolation,row,'mapSequence',state.mapSequence);
      chunk.setField(EnvironmentReviewIsolation,row,'mode',state.mode);chunk.setField(EnvironmentReviewIsolation,row,'modeSequence',state.modeSequence);
    }
  },
});
