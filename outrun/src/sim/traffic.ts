import {defineSystem,query,read,write,math,pcg32} from '@gameengine/runtime';
import {DrivingState,DrivingInput,RoadProofState,DrivingResetRequested,TrafficPool,TrafficResetRequested,TrafficRebaseRequested,TrafficPassed,CollisionDriver,CrashDriver,ContactAccepted,
  RouteDriver,RouteTrafficCoordinates,TerrainDriver,RouteResetRequested,RouteTrafficPassed,RouteContactAccepted,type TrafficResetRequestedValue} from '../schema.gen.ts';
import {loadMap01,sourcePlayerSample} from '../content/biome.ts';
import {nearestTerrainRoad} from './terrain-math.ts';
import {resetTrafficPool,rebaseTrafficPool,advanceTrafficPool,finalizeTrafficPool,type TrafficPlayerSample} from './traffic-math.ts';
import {evaluateCollisionDriver} from './collision-state.ts';
import {commitRouteActors} from './route-transaction.ts';
import {originalRouteSources} from '../content/route-boot.ts';

// Stable name owns creation, activation, AI ties and recycling in one native,
// hashed RNG stream. Absent-owner worlds never dispatch or seed this system.
export const AdvanceTraffic=defineSystem({
  name:'AdvanceTraffic',after:['AdvanceDriving'],
  runIf:{query:query(read(TrafficPool))},queries:{owners:query(write(TrafficPool)),collisions:query(write(CollisionDriver)),crashes:query(write(CrashDriver)),
    routes:query(write(RouteDriver),write(TerrainDriver),write(RouteTrafficCoordinates))},
  resources:[write(DrivingState),read(DrivingInput),write(RoadProofState)],events:[TrafficResetRequested,TrafficRebaseRequested,DrivingResetRequested,RouteResetRequested],
  run(ctx,{owners,collisions,crashes,routes}){
    if(owners.count!==1)throw new Error('Source traffic requires exactly one TrafficPool');
    if(collisions.count>1)throw new Error('Source traffic supports one collision owner');
    if(crashes.count>1||crashes.count>collisions.count)throw new Error('Crash recovery requires one matching collision/traffic owner');
    if(routes.count!==0){
      if(routes.count!==1||collisions.count!==1||crashes.count!==1)throw new Error('Route transaction requires one complete actor owner');
      const r=routes.chunks().find(chunk=>chunk.length>0)!,t=owners.chunks().find(chunk=>chunk.length>0)!,
        c=collisions.chunks().find(chunk=>chunk.length>0)!,k=crashes.chunks().find(chunk=>chunk.length>0)!;
      if(r.entity(0)!==t.entity(0)||c.entity(0)!==t.entity(0)||k.entity(0)!==t.entity(0))throw new Error('Route actors must share the same entity');
      const route=r.get(RouteDriver,0);
      if(!route.pending)return;
      if(route.pendingStep!==ctx.step)throw new Error('Stale route transaction');
      const state=ctx.resource(DrivingState),held=ctx.resource(DrivingInput),bits=held.keyboard[0]!|held.ui[0]!;
      let request:import('../schema.gen.ts').RouteResetRequestedValue|undefined;
      for(const event of ctx.events.read(RouteResetRequested))request=event;
      if(route.pendingReset)ctx.rng.state.set(pcg32(route.seedLo,route.seedHi,1414676806,0).state);
      const result=commitRouteActors({route,coordinates:r.get(RouteTrafficCoordinates,0),pool:t.get(TrafficPool,0),
        terrain:r.get(TerrainDriver,0),collision:c.get(CollisionDriver,0),crash:k.get(CrashDriver,0),
        driving:{active:state.active[0]!==0,playing:state.playing[0]!==0,manual:state.manual[0]!==0,
          distance:state.distance[0]!,previousDistance:state.previousDistance[0]!,lateral:state.lateral[0]!,previousLateral:state.previousLateral[0]!,
          legacySpeed:state.legacySpeed[0]!,gear:state.gear[0]!,steering:state.steering[0]!}},
        {throttle:(bits&1)!==0,brake:(bits&2)!==0,left:(bits&4)!==0,right:(bits&8)!==0,
          up:held.shiftUp[0]!==0,down:held.shiftDown[0]!==0},originalRouteSources(),ctx.dt,ctx.step,ctx.rng,
        request?.population??t.col(TrafficPool).population[0]!);
      r.set(RouteDriver,0,result.route);r.set(TerrainDriver,0,result.terrain);r.set(RouteTrafficCoordinates,0,result.coordinates);
      t.set(TrafficPool,0,result.pool);c.set(CollisionDriver,0,result.collision);k.set(CrashDriver,0,result.crash);
      ctx.set(DrivingState,result.driving);
      ctx.set(RoadProofState,{distance:result.driving.distance,previousDistance:result.driving.previousDistance,
        lateral:result.driving.lateral,speed:math.fround(result.driving.legacySpeed*60),playing:result.driving.playing});
      if(result.hit){
        ctx.events.emit(ContactAccepted,result.hit);
        ctx.events.emit(RouteContactAccepted,{...result.hit,routeEpoch:route.routeEpoch,mapEpoch:route.mapEpoch,routeStage:route.stage});
      }
      for(const award of result.awards){
        ctx.events.emit(TrafficPassed,{epoch:award.epoch,slot:award.slot,generation:award.generation,points:award.points});
        ctx.events.emit(RouteTrafficPassed,{routeEpoch:route.routeEpoch,mapEpoch:route.pendingOldMapEpoch,mapId:route.pendingFromMapId,
          stage:route.stage-(route.pendingHandoff?1:0),poolEpoch:award.epoch,slot:award.slot,generation:award.generation,points:award.points});
      }
      return;
    }
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
      const advanced=advanceTrafficPool(pool,player,data,ctx.dt,ctx.rng,{suppressPass:lifecycle,captureContact:collisions.count===1});
      // Keep this system name/stream and old-life advance/finalize ordering.
      // Ownerless worlds perform no detector work and retain the original mask.
      let eligibilityMask=0xffffffff;
      if(collisions.count===1)for(const contacts of collisions.chunks())for(let index=0;index<contacts.length;index++){
        if(contacts.entity(index)!==chunk.entity(row))throw new Error('CollisionDriver must belong to the traffic/terrain driver');
        const evaluation=evaluateCollisionDriver(contacts.get(CollisionDriver,index),{
          active:driving.active[0]!==0,playing:driving.playing[0]!==0,manual:driving.manual[0]!==0,
          legacySpeed:driving.legacySpeed[0]!,gear:driving.gear[0]!,steering:driving.steering[0]!,
          distance,previousDistance,lateral,previousLateral,
        },advanced,data,ctx.step,lifecycle);
        contacts.set(CollisionDriver,index,evaluation.driver);eligibilityMask=evaluation.eligibilityMask;
        if(evaluation.hit){
          // Event commands become visible at end of step. Publish the actual
          // accepted physical operands immediately so the separate crash RNG
          // owner can latch recovery after this producer on the SAME hit tick.
          if(crashes.count===1)for(const recovery of crashes.chunks())for(let crashIndex=0;crashIndex<recovery.length;crashIndex++){
            if(recovery.entity(crashIndex)!==chunk.entity(row))throw new Error('CrashDriver must belong to the traffic/contact driver');
            const crash=recovery.col(CrashDriver),hit=evaluation.hit;
            if(crash.mapId[crashIndex]!==hit.mapId||crash.phase[crashIndex]!==0||evaluation.driver.locked)
              throw new Error('Incoherent crash producer owner');
            recovery.set(CrashDriver,crashIndex,{pendingStep:ctx.step,kind:hit.kind,impactSpeed:hit.impactSpeed,
              handlingCap:hit.handlingCap,collisionDir:hit.collisionDir,curve:hit.curve});
          }
          ctx.events.emit(ContactAccepted,evaluation.hit);
        }
      }
      const finalized=finalizeTrafficPool(advanced,eligibilityMask,ctx.rng);
      chunk.set(TrafficPool,row,finalized.pool);
      for(const award of finalized.awards)ctx.events.emit(TrafficPassed,award);
    }
  },
});
