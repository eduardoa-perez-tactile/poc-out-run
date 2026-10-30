import { defineSystem, read, write, query, math } from '@gameengine/runtime';
import { DrivingState, DrivingInput, RoadProofState, TerrainDriver, DrivingResetRequested } from '../schema.gen.ts';
import { advanceDriving, LEGACY_UPDATES_PER_SECOND } from './driving-math.ts';

import {loadMap01} from '../content/biome.ts';
import {advanceTerrainDriving,resetTerrainDriver} from './terrain-math.ts';

export const AdvanceDriving = defineSystem({
  name: 'AdvanceDriving',
  after: ['CaptureDrivingInput', 'AdvanceRoadProof'],
  query:query(write(TerrainDriver)),events:[DrivingResetRequested],
  resources: [write(DrivingState), read(DrivingInput), write(RoadProofState)],
  run(ctx,sourceDrivers) {
    const state = ctx.resource(DrivingState);
    if (!state.active[0]) return;
    const distance = state.distance[0]!;
    const lateral = state.lateral[0]!;
    ctx.set(DrivingState, { previousDistance: distance, previousLateral: lateral });
    if(sourceDrivers.count>1)throw new Error('Source driving requires exactly one TerrainDriver');
    if(sourceDrivers.count===1){
      const held=ctx.resource(DrivingInput),bits=held.keyboard[0]!|held.ui[0]!;
      for(const chunk of sourceDrivers.chunks())for(let row=0;row<chunk.length;row++){
        const before=chunk.get(TerrainDriver,row);
        const driver=ctx.events.count(DrivingResetRequested)>0?resetTerrainDriver(before.mapId):before;
        const next=advanceTerrainDriving({
          legacySpeed:state.legacySpeed[0]!,gear:state.gear[0]!,steering:state.steering[0]!,lateral,
          distance,playing:state.playing[0]!==0,manual:state.manual[0]!==0,
        },driver,{
          throttle:(bits&1)!==0,brake:(bits&2)!==0,left:(bits&4)!==0,right:(bits&8)!==0,
          up:held.shiftUp[0]!==0,down:held.shiftDown[0]!==0,
        },ctx.dt,loadMap01());
        ctx.set(DrivingState,next.driving);chunk.set(TerrainDriver,row,next.driver);
      }
    }else if (state.playing[0]) {
      const held = ctx.resource(DrivingInput);
      const bits = held.keyboard[0]! | held.ui[0]!;
      const next = advanceDriving({ legacySpeed: state.legacySpeed[0]!, gear: state.gear[0]!, steering: state.steering[0]!, lateral }, {
        throttle: (bits & 1) !== 0, brake: (bits & 2) !== 0, left: (bits & 4) !== 0, right: (bits & 8) !== 0,
        up: held.shiftUp[0] !== 0, down: held.shiftDown[0] !== 0,
      }, state.manual[0] !== 0, ctx.dt);
      ctx.set(DrivingState, { ...next, distance: math.fround(distance + math.fround(next.legacySpeed * LEGACY_UPDATES_PER_SECOND * ctx.dt)) % 180000 });
    }
    ctx.set(RoadProofState, {
      distance: state.distance[0]!, previousDistance: state.previousDistance[0]!, lateral: state.lateral[0]!,
      speed: math.fround(state.legacySpeed[0]! * LEGACY_UPDATES_PER_SECOND), playing: state.playing[0] !== 0,
    });
  },
});
