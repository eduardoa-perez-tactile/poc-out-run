import {worldTest,expect} from '@gameengine/test';
import {createRouteHudFeedback} from '../../src/ui/race-hud-model.ts';
import {createRaceFlow} from '../../src/sim/race-flow-math.ts';

worldTest('hud.route checkpoint tree, completed lap, blink and restart are presentation only',()=>{
  const feedback=createRouteHudFeedback();
  const initial={...createRaceFlow({mapTimeSeconds:160,difficulty:1,population:9},1,1),phase:1,mapId:1};
  const start=feedback(initial);
  const fork={...initial,mapId:3};
  expect(feedback(fork).routeTree).toBe(start.routeTree);
  const crossed={...fork,consumedCheckpoints:1,stageTicks:0,lastStageTicks:2542};
  const visible=feedback(crossed);
  expect(visible.routeTree!==start.routeTree).toBe(true);
  expect(visible.showCheckpoint).toBe(true);
  expect(visible.checkpointLap).toBe("00 '42 ''36");
  expect(feedback({...crossed,stageTicks:21}).showCheckpoint).toBe(false);
  expect(feedback({...crossed,stageTicks:42}).showCheckpoint).toBe(true);
  expect(feedback({...crossed,phase:8}).showCheckpoint).toBe(false);
  expect(feedback(crossed).showCheckpoint).toBe(true);
  expect(feedback({...crossed,stageTicks:315}).showCheckpoint).toBe(false);
  expect(feedback({...crossed,mapId:5}).showCheckpoint).toBe(false);
  expect(feedback({...crossed,mapId:16}).routeTree).toBe(visible.routeTree);
  const restart=feedback({...initial,raceEpoch:2});
  expect(restart.routeTree).toBe(start.routeTree);
  expect(restart.showCheckpoint).toBe(false);
  expect(crossed.remainingTicks).toBe(initial.remainingTicks);
});
