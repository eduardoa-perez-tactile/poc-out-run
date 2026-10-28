import {defineSystem,read,write,KeyEvent,Keys} from '@gameengine/runtime';
import {ForkPreviewState,ForkPreviewRequested,RoadProofState,RoadFixtureRequested,DrivingState} from '../schema.gen.ts';
const DURATION=180;
export const ForkPreviewInput=defineSystem({
  name:'ForkPreviewInput',after:['RoadProofInput'],resources:[read(DrivingState)],runOn:[KeyEvent],
  run(ctx){
    if(ctx.resource(DrivingState).active[0])return;
    let side:number|undefined;let exiting=false;
    for(const key of ctx.events.read(KeyEvent))if(key.down){
      if(key.code===Keys.Digit5)side=0;
      else if(key.code===Keys.Digit6)side=1;
      else if(key.code>=Keys.Digit1&&key.code<=Keys.Digit4)exiting=true;
    }
    // Existing fixture selection wins if both kinds arrive in one input frame.
    // Keyboard selection never carries a stale copy of playback/pause state.
    if(side!==undefined&&!exiting)ctx.events.emit(ForkPreviewRequested,{side});
  },
});
export const ForkPreviewControl=defineSystem({
  name:'ForkPreviewControl',after:['SelectRoadFixture'],before:['RoadProofInput','AdvanceRoadProof'],
  resources:[write(ForkPreviewState),write(RoadProofState),read(DrivingState)],runOn:[ForkPreviewRequested,RoadFixtureRequested],
  run(ctx){
    if(ctx.resource(DrivingState).active[0])return;
    if(ctx.events.count(RoadFixtureRequested)>0){
      if(ctx.resource(ForkPreviewState).active[0]!==0)ctx.set(ForkPreviewState,{active:false,side:0,previousTick:0,tick:0,durationTicks:DURATION});
      return;
    }
    for(const request of ctx.events.read(ForkPreviewRequested)){
      const distance=((request.distance%180000)+180000)%180000;
      const tick=Math.min(DURATION,request.tick);
      ctx.set(ForkPreviewState,{active:true,side:request.side<=1?request.side:0,previousTick:tick,tick,durationTicks:DURATION});
      ctx.set(RoadProofState,{fixtureId:3,distance,previousDistance:distance,speed:7200,lateral:0});
      if(request.configurePlayback)ctx.setField(RoadProofState,'playing',request.playing);
    }
  },
});
export const AdvanceForkTransition=defineSystem({
  name:'AdvanceForkTransition',after:['ForkPreviewControl','ForkPreviewInput','RoadProofInput'],
  resources:[write(ForkPreviewState),read(RoadProofState),read(DrivingState)],
  run(ctx){
    if(ctx.resource(DrivingState).active[0])return;
    const state=ctx.resource(ForkPreviewState);
    if(state.active[0]===0)return; // Leave the complete default row untouched.
    const tick=state.tick[0]!;
    if(state.previousTick[0]!==tick)ctx.setField(ForkPreviewState,'previousTick',tick);
    if(ctx.resource(RoadProofState).playing[0]!==0&&tick<state.durationTicks[0]!)ctx.setField(ForkPreviewState,'tick',tick+1);
  },
});
