import {worldTest,expect} from '@gameengine/test';
import {pcg32} from '@gameengine/runtime';
import type {SourceBiomeId} from '../../src/content/biome.ts';
import {originalRouteSources} from '../../src/content/route-boot.ts';
import {advanceRouteState,emptyRouteDriver,resetRouteDriver,type RouteRandom} from '../../src/sim/route-math.ts';

worldTest('continuous.route traverses all fifteen source stages with strict boundaries and clean restart',()=>{
  const content=originalRouteSources(1),native=pcg32(0,0,0,0);
  // Source Continuous appends straight tails and never draws fork gradients.
  const rng:RouteRandom={state:native.state,range(){throw new Error('Continuous drew a fork gradient');}};
  const request={seedLo:9,seedHi:2596069104};let step=1;
  const start=resetRouteDriver(emptyRouteDriver(),request,content,rng,step++,1);
  const seeded=Array.from(rng.state);let route=start.route;
  expect(route.camera).toBe(45000);expect(route.gradient).toBe(0);expect(route.rangeCalls).toBe(0);
  for(let id=1;id<=15;id++){
    const data=content.get(id as SourceBiomeId,0);
    expect(route.mapId).toBe(id);expect(route.stage).toBe(id-1);
    expect(data.totalCount).toBe(data.authoredCount+1200);
    expect(data.swapLine).toBe(data.authoredCount+301);
    expect(data.lastLine).toBe(data.totalCount-200);
    if(id>1){
      let result=advanceRouteState(route,data.checkpointLine*150-702,1,true,content,rng,step++,1);
      expect(result.route.checkpointCount).toBe(id-2);
      result=advanceRouteState(result.route,(data.checkpointLine+1)*150-702,1,true,content,rng,step++,1);
      route=result.route;
      expect(result.events.map(event=>event.kind)).toEqual(['checkpoint']);
      expect(route.checkpointCount).toBe(id-1);
      expect(route.checkpointBonusSeconds).toBe(Math.trunc(Math.fround(Math.fround(data.timeSeconds)*Math.fround(.52))));
      result=advanceRouteState(route,(data.checkpointLine+2)*150-702,0,true,content,rng,step++,1);
      expect(result.events).toEqual([]);route=result.route;
    }
    let result=advanceRouteState(route,data.swapLine*150-702,1,true,content,rng,step++,1);
    expect(result.route.choiceLatched).toBe(false);
    result=advanceRouteState(result.route,(data.swapLine+1)*150-702,1,true,content,rng,step++,1);
    expect(result.route.nextMapId).toBe(id+1);expect(result.route.chosenSide).toBe(0);
    expect(result.events.map(event=>event.kind)).toEqual(['choice']);
    result=advanceRouteState(result.route,data.lastLine*150-702,0,true,content,rng,step++,1);
    expect(result.entry).toBe(null);
    result=advanceRouteState(result.route,(data.lastLine+1)*150-702,1,true,content,rng,step++,1);
    route=result.route;
    expect(route.mapId).toBe(id+1);expect(route.camera).toBe(0);expect(route.mapEpoch).toBe(id+1);
    expect(route.choiceLatched).toBe(false);expect(route.gradient).toBe(0);
    expect(result.events.map(event=>event.kind)).toEqual(id===15?['entry','goal']:['entry']);
  }
  expect(route.stage).toBe(15);expect(route.entryCount).toBe(16);expect(route.checkpointCount).toBe(14);
  expect(route.goalEntered).toBe(true);expect(route.arrivalCount).toBe(1);expect(route.rangeCalls).toBe(0);
  expect(Array.from(rng.state)).toEqual(seeded);
  const held=advanceRouteState(route,45000,1,true,content,rng,step++,1);
  expect(held.route).toEqual(route);expect(held.events).toEqual([]);
  const restarted=resetRouteDriver(route,request,content,rng,step++,1).route;
  expect(restarted.routeEpoch).toBe(2);expect(restarted.mapEpoch).toBe(1);expect(restarted.mapId).toBe(1);
  expect(restarted.stage).toBe(0);expect(restarted.camera).toBe(45000);expect(restarted.checkpointCount).toBe(0);
  expect(restarted.goalEntered).toBe(false);expect(restarted.arrivalCount).toBe(0);expect(restarted.rangeCalls).toBe(0);
  expect(Array.from(rng.state)).toEqual(seeded);
},{scene:'scenes/map01-data.scene.json'});
