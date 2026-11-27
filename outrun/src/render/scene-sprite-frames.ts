/** Original Logger.cpp2180–2310, at nominal60Hz. These IDs address existing
 * MapStartGoal art only; no simulation data or authored placements are changed.
 */
export interface SceneSpriteFrames {flagger:number;semaphore:number;}

function flaggerTimeline():Uint8Array {
  const frames:number[]=[1];
  let image=0,status=0,iterations=0,attempts=0,totalTimes=0,done=false;
  // Source counters terminate after1983 updates. Keep a bootstrap safety bound
  // rather than doing any animation generation or catch-up work while drawing.
  while(!done&&frames.length<=2048){
    if(status===0){
      image++;
      if(image===2)status=1;
    }else if(status===1){
      if(image<9){
        if(iterations!==5)iterations++;
        else {iterations=0;image++;}
      }else if(iterations!==5)iterations++;
      else {
        attempts++;
        if(attempts===10){status=2;image=9;attempts=0;}
        else image=3;
        iterations=0;
      }
    }else if(status===2){
      if(image<11){
        if(iterations!==10)iterations++;
        else {iterations=0;image++;}
      }else if(iterations!==10)iterations++;
      else {
        attempts++;
        if(attempts===10){
          totalTimes++;
          if(totalTimes===3){status=3;image=12;}
          else {status=1;image=3;attempts=0;}
        }else image=10;
        iterations=0;
      }
    }else if(image<13){
      if(iterations!==20)iterations++;
      else {iterations=0;image++;}
    }else done=true;
    frames.push(image+1);
  }
  if(!done||frames.length!==1984||frames[1982]!==14)throw new Error('Invalid source flagger timeline');
  return Uint8Array.from(frames);
}
const FLAGGER_FRAMES=flaggerTimeline();

/** Calls, not a linear frame rate: source pauses and repeats unevenly. */
export function flaggerObjectId(updateCalls:number):number {
  if(!Number.isSafeInteger(updateCalls)||updateCalls<0)throw new Error('Invalid flagger update count');
  return FLAGGER_FRAMES[Math.min(updateCalls,FLAGGER_FRAMES.length-1)]!;
}

/** Countdown j3..0 updates semaphore once each second. It advances the flagger
 * only at seconds2 and4; ordinary Racing then advances it once per fixed tick.
 * Passing frozen race counters naturally preserves the pose while paused.
 */
export function startSceneFrames(countdownTicks:number,totalTicks:number):SceneSpriteFrames {
  if(!Number.isInteger(countdownTicks)||countdownTicks<0||countdownTicks>240||
    !Number.isSafeInteger(totalTicks)||totalTicks<0)throw new Error('Invalid start-scene clock');
  const completed=Math.floor((240-countdownTicks)/60);
  const countdownCalls=Number(completed>=2)+Number(completed>=4);
  return {flagger:flaggerObjectId(countdownCalls+totalTicks),semaphore:39+Math.max(0,completed-1)};
}
