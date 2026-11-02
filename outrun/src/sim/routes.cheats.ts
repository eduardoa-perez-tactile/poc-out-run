import {query,write,math} from '@gameengine/runtime';
import {defineCheat} from '@gameengine/runtime/cheats';
import {RouteDriver,RouteTrafficCoordinates,TerrainDriver,TrafficPool,CollisionDriver,CrashDriver,DrivingState,RoadProofState} from '../schema.gen.ts';
import {originalRouteSources} from '../content/route-boot.ts';
import type {SourceBiomeId} from '../content/biome.ts';
import {sampleRouteZ} from './route-space.ts';
import {terrainWheelContact,nearestTerrainRoad} from './terrain-math.ts';
import {beginRouteCrashRecovery} from './crash-recovery-math.ts';
import {hydrateRouteTrafficPool,packRouteTrafficPool} from './route-traffic-state.ts';

/** Recorded current-map boundary supplement, never a normal traversal replay.
 * No map/stage/gradient/RNG/route-choice authoring: native reducers cross it. */
export const RouteLandmark=defineCheat({
  id:'routes.landmark',group:'Route QA',title:'Current route landmark',
  description:'Current-map boundary supplement; optional synthetic spin physics is not a natural contact/variant-RNG proof.',
  params:{
    landmark:{type:'enum',values:['fork-at','fork-after','exit-at','exit-before','checkpoint-at','checkpoint-after'],default:'exit-before'},
    side:{type:'int',min:0,max:1,default:0},speed:{type:'number',min:0,max:200,default:100},
    quietTraffic:{type:'bool',default:false},
    passFixture:{type:'enum',values:['none','eligible','colliding'],default:'none',doc:'Synthetic old slot0 near the actual exit, for native pass/mask transaction coverage only.'},
    recovery:{type:'enum',values:['preserve','spin-fixture'],default:'preserve',doc:'spin-fixture is synthetic captured physics, not a natural collision or native variant draw.'},
  },
  query:query(write(RouteDriver),write(RouteTrafficCoordinates),write(TerrainDriver),write(TrafficPool),write(CollisionDriver),write(CrashDriver)),
  resources:[write(DrivingState),write(RoadProofState)],
  run(ctx,{landmark,side,speed,quietTraffic,recovery,passFixture},owners){
    if(owners.count!==1)throw new Error('Route landmark requires one co-owned initialized route actor');
    for(const chunk of owners.chunks())for(let row=0;row<chunk.length;row++){
      const route=chunk.get(RouteDriver,row),terrain=chunk.get(TerrainDriver,row),collision=chunk.get(CollisionDriver,row),crash=chunk.get(CrashDriver,row);
      if(!route.initialized||route.pending||route.goalEntered||route.mapId<1||route.mapId>15)throw new Error('Route landmark requires an active ordinary route map');
      if(route.gradient!==-1&&route.gradient!==0&&route.gradient!==1)throw new Error('Invalid current route profile');
      if(terrain.mapId!==route.mapId||collision.mapId!==route.mapId||crash.mapId!==route.mapId)throw new Error('Route landmark owner map mismatch');
      if(collision.acceptedCount!==crash.consumedAcceptedCount)throw new Error('Route landmark cannot hide an unconsumed impact');
      if(recovery==='spin-fixture'&&(crash.phase!==0||speed!==200||collision.acceptedCount===0xffffffff))
        throw new Error('Synthetic spin fixture requires idle coherent200-speed actor');
      if(passFixture!=='none'&&(landmark!=='exit-before'||!quietTraffic||speed!==200||recovery!=='preserve'||crash.phase!==0))
        throw new Error('Synthetic pass fixture requires quiet idle200-speed exit-before');
      const initialPool=chunk.get(TrafficPool,row);
      if(passFixture!=='none'&&(!initialPool.initialized||initialPool.generation[0]===0||initialPool.passed[0]!==0))
        throw new Error('Synthetic pass fixture requires an unconsumed initialized old slot0 life');
      const data=originalRouteSources().get(route.mapId as SourceBiomeId,route.gradient);
      let index:number;
      if(landmark==='fork-at'||landmark==='fork-after')index=data.swapLine+(landmark==='fork-after'?1:0);
      else if(landmark==='exit-at')index=data.lastLine;
      else if(landmark==='exit-before')index=data.lastLine+1;
      else {if(data.checkpointLine<0)throw new Error('Current source map has no checkpoint');index=data.checkpointLine+(landmark==='checkpoint-after'?1:0);}
      const camera=index*150-data.playerOffsetZ-(landmark==='exit-before'?1:0);
      if(!Number.isInteger(camera)||camera<0||camera>=data.totalCount*150)throw new Error('Invalid source landmark camera');
      const point=sampleRouteZ(data,camera+data.playerOffsetZ),gap=data.segments[point.row]!.gap;
      const lateral=side===0?0:math.fround(gap/1600),contact=terrainWheelContact(lateral,gap,data.terrain,data.roadTerrain);
      chunk.set(RouteDriver,row,{camera,previousCamera:camera});
      ctx.set(DrivingState,{distance:camera,previousDistance:camera,lateral,previousLateral:lateral,
        legacySpeed:math.fround(speed),gear:speed>100?1:0,steering:0});
      ctx.set(RoadProofState,{distance:camera,previousDistance:camera,lateral,speed:math.fround(speed*60)});
      chunk.set(TerrainDriver,row,{initialized:true,segment:point.row,roadSide:nearestTerrainRoad(lateral,gap),previousGap:gap,
        sectionEnd:false,leftOutside:contact.leftOutside,rightOutside:contact.rightOutside,
        leftEffect:crash.phase===1&&speed>0?1:0,rightEffect:crash.phase===1&&speed>0?1:0,
        skidding:false,recentering:crash.phase===3});
      chunk.set(CollisionDriver,row,{initialized:true,motionValid:false,motionStep:ctx.step,
        ledgerCount:0,ledgerKind:Array(64).fill(0),ledgerId:Array(64).fill(0),ledgerEpoch:Array(64).fill(0),ledgerGeneration:Array(64).fill(0)});
      if(recovery==='spin-fixture'){
        const count=collision.acceptedCount+1;
        const seeded=beginRouteCrashRecovery(crash,{mapId:route.mapId,kind:1,impactSpeed:200,handlingCap:200,
          collisionDir:lateral,curve:math.fround(1.67)},0,count);
        chunk.set(CrashDriver,row,seeded);chunk.set(CollisionDriver,row,{acceptedCount:count,locked:true});
        chunk.set(TerrainDriver,row,{leftEffect:1,rightEffect:1});
        // Explicit fixture: no ContactAccepted emission and no native variant draw.
      }
      // A current-map coordinate/ledger fixture does not cancel or reseed recovery.
      if(quietTraffic){
        const identity={mapId:route.mapId,routeEpoch:route.routeEpoch,mapEpoch:route.mapEpoch};
        const raw=hydrateRouteTrafficPool(chunk.get(TrafficPool,row),chunk.get(RouteTrafficCoordinates,row),identity,data);
        for(let slot=0;slot<32;slot++){
          raw.z[slot]=0;raw.previousZ[slot]=0;raw.parked[slot]=1;raw.active[slot]=0;raw.speed[slot]=0;
          raw.moving[slot]=0;raw.cooldown[slot]=0;raw.target[slot]=0;raw.previousOffset[slot]=raw.offset[slot]!;
        }
        if(passFixture!=='none'){
          // Keep native pool/route epoch, source AI and old generation. This
          // explicit fixture does not rearm a passed life or consume RNG.
          const z=camera+data.playerOffsetZ+10;
          if(z<0||z>0x7fffffff)throw new Error('Invalid source pass landmark Z');
          raw.z[0]=z;raw.previousZ[0]=z;raw.parked[0]=0;raw.active[0]=1;raw.speed[0]=0;raw.side[0]=0;
          raw.offset[0]=math.fround(passFixture==='eligible'?.8:0);raw.previousOffset[0]=raw.offset[0]!;
        }
        const packed=packRouteTrafficPool(raw,identity,data);chunk.set(TrafficPool,row,packed.pool);chunk.set(RouteTrafficCoordinates,row,packed.coordinates);
      }
    }
  },
});
