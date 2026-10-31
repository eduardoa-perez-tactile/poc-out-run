import {defineSystem,query,read,write} from '@gameengine/runtime';
import {RouteDriver,RouteTrafficCoordinates,RouteResetRequested,RouteForkChosen,RouteBiomeEntered,
  RouteCheckpointPassed,RouteGoalEntered,TerrainDriver,CrashDriver,TrafficPool,CollisionDriver,DrivingState,DrivingInput,
  type RouteDriverValue} from '../schema.gen.ts';
import {originalRouteSources} from '../content/route-boot.ts';
import {resetRouteDriver,advanceRouteState,type RouteDriverState,type RouteGradient} from './route-math.ts';
import {prepareRoutePlayerTick} from './route-driving-math.ts';

function state(value:RouteDriverValue):RouteDriverState{
  if(value.gradient!==-1&&value.gradient!==0&&value.gradient!==1)throw new Error('Invalid persisted route gradient');
  return {...value,gradient:value.gradient as RouteGradient};
}
/** The stable native ROUT stream owns only recorded reset and accepted entries.
 * Physical owners are committed together by the following AdvanceTraffic call.
 */
export const AdvanceRoute=defineSystem({
  name:'AdvanceRoute',after:['AdvanceDriving'],before:['AdvanceTraffic'],
  runIf:{query:query(read(RouteDriver))},
  query:query(write(RouteDriver),read(TerrainDriver),read(CrashDriver),read(TrafficPool),read(CollisionDriver),read(RouteTrafficCoordinates)),
  resources:[write(DrivingState),write(DrivingInput)],events:[RouteResetRequested],
  run(ctx,owners){
    if(owners.count!==1)throw new Error('Route requires one co-owned terrain/traffic/contact/crash/integer-coordinate entity');
    let request:import('../schema.gen.ts').RouteResetRequestedValue|undefined;
    for(const event of ctx.events.read(RouteResetRequested))request=event;
    const driving=ctx.resource(DrivingState),held=ctx.resource(DrivingInput),content=originalRouteSources();
    for(const chunk of owners.chunks())for(let row=0;row<chunk.length;row++){
      const before=chunk.get(RouteDriver,row),terrain=chunk.get(TerrainDriver,row),crash=chunk.get(CrashDriver,row);
      const reset=!before.initialized||request!==undefined;
      if(reset){
        if(request&&![9,20,32].includes(request.population))throw new Error('Invalid recorded route population');
        const transition=resetRouteDriver(state(before),request??before,content,ctx.rng,ctx.step);
        // Full lifecycle cancellation is recorded; ordinary handoffs never clear holds.
        ctx.set(DrivingInput,{keyboard:0,ui:0,shiftUp:false,shiftDown:false,upHeld:false,downHeld:false,pauseHeld:false,modeHeld:false});
        // A fresh scene uses source auto mode; inherited resource defaults may
        // differ between loose patches and cooked full rows. Recorded resets
        // remain the explicit configuration boundary, including while paused.
        ctx.set(DrivingState,{active:true,manual:request?.manual??false,legacySpeed:0,gear:0,steering:0,
          distance:45000,previousDistance:45000,lateral:0,previousLateral:0});
        chunk.set(RouteDriver,row,{...transition.route,pending:true,pendingStep:ctx.step,pendingReset:true,pendingHandoff:false,
          pendingFromMapId:1,pendingFromGradient:transition.route.gradient,pendingOldMapEpoch:1,
          pendingPreviousCamera:45000,pendingOutgoingCamera:45000,pendingRawCamera:45000});
        ctx.events.emit(RouteBiomeEntered,{routeEpoch:transition.route.routeEpoch,mapEpoch:1,mapId:1,stage:0,
          fromMapId:0,gradient:transition.route.gradient,outgoingCamera:0});
        continue;
      }
      if(before.pending)throw new Error('Previous route actor transaction was not committed');
      if(!driving.active[0]||!driving.playing[0]||before.goalEntered)continue;
      if(terrain.mapId!==before.mapId||crash.mapId!==before.mapId)throw new Error('Route physical owner map mismatch');
      const old=state(before),data=content.get(old.mapId as import('../content/biome.ts').SourceBiomeId,old.gradient);
      const bits=held.keyboard[0]!|held.ui[0]!;
      const prepared=prepareRoutePlayerTick({distance:old.camera,lateral:driving.lateral[0]!,legacySpeed:driving.legacySpeed[0]!,
        gear:driving.gear[0]!,steering:driving.steering[0]!,playing:true,manual:driving.manual[0]!==0},terrain,crash,
        {throttle:(bits&1)!==0,brake:(bits&2)!==0,left:(bits&4)!==0,right:(bits&8)!==0,
          up:held.shiftUp[0]!==0,down:held.shiftDown[0]!==0},ctx.dt,data);
      if(terrain.roadSide!==0&&terrain.roadSide!==1)throw new Error('Invalid prior canonical road side');
      const transition=advanceRouteState(old,prepared.driving.distance,terrain.roadSide,true,content,ctx.rng,ctx.step);
      ctx.set(DrivingState,{previousDistance:old.camera,previousLateral:driving.lateral[0]!});
      chunk.set(RouteDriver,row,{...transition.route,pending:true,pendingStep:ctx.step,pendingReset:false,
        pendingHandoff:transition.entry!==null,pendingFromMapId:old.mapId,pendingFromGradient:old.gradient,
        pendingOldMapEpoch:old.mapEpoch,pendingPreviousCamera:old.camera,
        pendingOutgoingCamera:prepared.driving.distance,pendingRawCamera:prepared.unwrappedCamera});
      for(const event of transition.events){
        const identity={routeEpoch:event.routeEpoch,mapEpoch:event.mapEpoch,mapId:event.mapId,stage:event.stage};
        if(event.kind==='choice')ctx.events.emit(RouteForkChosen,{...identity,side:event.side,nextMapId:event.nextMapId,gradient:event.gradient});
        else if(event.kind==='entry')ctx.events.emit(RouteBiomeEntered,{...identity,fromMapId:event.fromMapId,gradient:event.gradient,
          outgoingCamera:transition.entry!.outgoingCamera});
        else if(event.kind==='checkpoint')ctx.events.emit(RouteCheckpointPassed,{...identity,checkpointLine:event.checkpointLine,bonusSeconds:event.bonusSeconds});
        else ctx.events.emit(RouteGoalEntered,{...identity,gradient:event.gradient});
      }
    }
  },
});
