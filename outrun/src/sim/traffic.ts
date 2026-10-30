import {defineSystem,query,read,write,math,pcg32} from '@gameengine/runtime';
import {DrivingState,DrivingResetRequested,TrafficPool,TrafficResetRequested,TrafficRebaseRequested,TrafficPassed,type TrafficResetRequestedValue} from '../schema.gen.ts';
import {loadMap01,sourcePlayerSample} from '../content/biome.ts';
import {nearestTerrainRoad} from './terrain-math.ts';
import {resetTrafficPool,rebaseTrafficPool,advanceTrafficPool,finalizeTrafficPool,type TrafficPlayerSample} from './traffic-math.ts';

// Stable name owns creation, activation, AI ties and recycling in one native,
// hashed RNG stream. Absent-owner worlds never dispatch or seed this system.
export const AdvanceTraffic=defineSystem({
  name:'AdvanceTraffic',after:['AdvanceDriving'],
  runIf:{query:query(read(TrafficPool))},query:query(write(TrafficPool)),
  resources:[read(DrivingState)],events:[TrafficResetRequested,TrafficRebaseRequested,DrivingResetRequested],
  run(ctx,owners){
    if(owners.count!==1)throw new Error('Source traffic requires exactly one TrafficPool');
    const driving=ctx.resource(DrivingState),data=loadMap01();
    const previousDistance=driving.previousDistance[0]!,distance=driving.distance[0]!;
    const previousLateral=driving.previousLateral[0]!,lateral=driving.lateral[0]!;
    const player:TrafficPlayerSample={
      previousZ:math.fround(previousDistance+data.playerOffsetZ),z:math.fround(distance+data.playerOffsetZ),
      previousLateral,lateral,
      previousSide:nearestTerrainRoad(previousLateral,sourcePlayerSample(data,previousDistance).gap),
      side:nearestTerrainRoad(lateral,sourcePlayerSample(data,distance).gap),playing:driving.playing[0]!==0,
    };
    let reset:TrafficResetRequestedValue|undefined;
    for(const request of ctx.events.read(TrafficResetRequested))reset=request;
    const rebases=ctx.events.read(TrafficRebaseRequested);
    const driverReset=ctx.events.count(DrivingResetRequested)>0;
    for(const chunk of owners.chunks())for(let row=0;row<chunk.length;row++){
      let pool=chunk.get(TrafficPool,row);
      if(pool.mapId!==1)throw new Error(`Unsupported traffic map ${pool.mapId}`);
      // Recorded lifecycle requests apply while paused. Full reset dominates all
      // same-step rebases; a driver teleport only suppresses synthetic passes.
      const initialize=!pool.initialized;
      const shouldReset=initialize||reset!==undefined;
      if(shouldReset){
        const request=reset??{mapId:pool.mapId,population:pool.population,seedLo:pool.seedLo,seedHi:pool.seedHi,originZ:pool.originZ};
        if(request.mapId!==1)throw new Error(`Unsupported traffic reset map ${request.mapId}`);
        if(![9,20,32].includes(request.population)||!Number.isFinite(request.originZ))throw new Error('Invalid traffic reset configuration');
        // Mutate the borrowed native words; replacing/retaining the view would
        // disconnect it from the engine's persisted, hashed stream.
        ctx.rng.state.set(pcg32(request.seedLo,request.seedHi,1414676806,0).state);
        pool=resetTrafficPool(pool,request,player,data,ctx.rng);
      }else for(const request of rebases){
        if(request.mapId!==1)throw new Error(`Unsupported traffic rebase map ${request.mapId}`);
        pool=rebaseTrafficPool(pool,request.mapId,request.shift,data);
      }
      if(driverReset){
        // A paused advance returns immediately; synchronize its interpolation
        // history here too, without moving cars or consuming the RNG stream.
        pool.previousZ=pool.z.slice();pool.previousOffset=pool.offset.slice();
      }
      const lifecycle=shouldReset||rebases.length>0||driverReset;
      if(!player.playing&&!lifecycle)continue;
      const advanced=advanceTrafficPool(pool,player,data,ctx.dt,ctx.rng,{suppressPass:lifecycle});
      // #14 inserts collision eligibility here, while previous/current poses
      // and the old lifetime still exist. #16 aggregates the approved events.
      const finalized=finalizeTrafficPool(advanced,0xffffffff,ctx.rng);
      chunk.set(TrafficPool,row,finalized.pool);
      for(const award of finalized.awards)ctx.events.emit(TrafficPassed,award);
    }
  },
});
