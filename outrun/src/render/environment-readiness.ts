/** Scheduling state only. Actual GPU controls remain required: headless render
 * status can advance while reporting no pending work without drawing pixels. */
export interface EnvironmentReadiness {
  epoch:number;
  submittedFrame:number;
  observedFrame:number;
  quietFrames:number;
  renderSettled:boolean;
}
export function createEnvironmentReadiness():EnvironmentReadiness {
  return {epoch:0,submittedFrame:-1,observedFrame:-1,quietFrames:0,renderSettled:false};
}
export function resetEnvironmentReadiness(state:EnvironmentReadiness,epoch:number):void {
  state.epoch=epoch;state.submittedFrame=-1;state.observedFrame=-1;
  state.quietFrames=0;state.renderSettled=false;
}
/** Call only after the incoming selection submitted actual nonempty geometry. */
export function submitEnvironmentReadiness(state:EnvironmentReadiness,epoch:number,frame:number):void {
  if(state.epoch!==epoch)resetEnvironmentReadiness(state,epoch);
  if(state.submittedFrame<0){state.submittedFrame=frame;state.observedFrame=frame;}
}
/** One increment per distinct fresh rendered frame, never per LateUpdate call. */
export function observeEnvironmentReadiness(state:EnvironmentReadiness,epoch:number,frame:number,pendingAssets:number,pendingPipelines:number,ioReady:boolean):boolean {
  if(state.epoch!==epoch)resetEnvironmentReadiness(state,epoch);
  if(!ioReady){state.quietFrames=0;state.renderSettled=false;state.submittedFrame=-1;state.observedFrame=-1;return false;}
  if(state.submittedFrame<0||frame<=state.submittedFrame)return false;
  if(frame<=state.observedFrame)return state.renderSettled;
  // An unobserved frame cannot certify that no upload/pipeline work occurred.
  if(frame!==state.observedFrame+1)state.quietFrames=0;
  state.observedFrame=frame;
  state.quietFrames=pendingAssets===0&&pendingPipelines===0?state.quietFrames+1:0;
  state.renderSettled=state.quietFrames>=3;
  return state.renderSettled;
}
