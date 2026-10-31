import {defineSystem,query,read,write,EnterScene} from '@gameengine/runtime';
import {CrashDriver,CollisionDriver,TerrainDriver,DrivingState,DrivingResetRequested,
  TrafficResetRequested,TrafficRebaseRequested,type CrashDriverValue} from '../schema.gen.ts';
import {loadMap01,sourcePlayerSample} from '../content/biome.ts';
import {nearestTerrainRoad,terrainWheelContact} from './terrain-math.ts';
import {resetCrashRecovery,beginCrashRecovery} from './crash-recovery-math.ts';

// All lifecycle barriers apply even while paused; the ordinary input reducer
// still owns requested driver pose/speed and pause precedence after this system.
export const ResetCrashLifecycle=defineSystem({
  name:'ResetCrashLifecycle',after:['ResetMap01Driving'],before:['CaptureDrivingInput','AdvanceDriving'],
  runOn:[EnterScene,DrivingResetRequested,TrafficResetRequested,TrafficRebaseRequested],
  runIf:{query:query(read(CrashDriver))},
  query:query(write(CrashDriver),write(CollisionDriver),write(TerrainDriver)),
  resources:[write(DrivingState)],
  run(ctx,owners){
    if(owners.count!==1)throw new Error('Crash lifecycle requires one matching terrain/contact owner');
    const state=ctx.resource(DrivingState),data=loadMap01();
    const distance=state.distance[0]!,lateral=state.lateral[0]!;
    const sample=sourcePlayerSample(data,distance),contact=terrainWheelContact(lateral,sample.gap,data.terrain,data.roadTerrain);
    for(const chunk of owners.chunks())for(let row=0;row<chunk.length;row++){
      const mapId=chunk.col(CrashDriver).mapId[row]!;
      if(mapId!==data.id||chunk.col(CollisionDriver).mapId[row]!==mapId||chunk.col(TerrainDriver).mapId[row]!==mapId)
        throw new Error('Crash lifecycle owner maps must match');
      chunk.set(CrashDriver,row,resetCrashRecovery(mapId));
      chunk.set(CollisionDriver,row,{initialized:false,motionValid:false,motionStep:ctx.step,locked:false,acceptedCount:0,
        ledgerCount:0,ledgerKind:Array(64).fill(0),ledgerId:Array(64).fill(0),
        ledgerEpoch:Array(64).fill(0),ledgerGeneration:Array(64).fill(0)});
      chunk.set(TerrainDriver,row,{segment:sample.index,
        roadSide:nearestTerrainRoad(lateral,sample.gap),previousGap:sample.gap,
        leftOutside:contact.leftOutside,rightOutside:contact.rightOutside,leftEffect:0,rightEffect:0,
        skidding:false,recentering:false,recenterTarget:0});
    }
    ctx.set(DrivingState,{steering:0,previousDistance:distance,previousLateral:lateral});
  },
});

// Event commands apply after all SIM stages, so this native RNG owner uses
// the producer's immediate physical latch. Persisted count/step guards reject
// stale latches before any RNG draw; no decoded event or invented witness.
/** Validate the immediate producer latch before accessing the native RNG. */
export function hasNewCrashImpact(crash:CrashDriverValue,count:number,step:number,mapId:number,locked:boolean):boolean {
  if(mapId!==crash.mapId||mapId!==1)throw new Error('Crash/contact owner maps must match');
  if(count===crash.consumedAcceptedCount)return false;
  if(count!==crash.consumedAcceptedCount+1||crash.phase!==0||locked||crash.pendingStep!==step)
    throw new Error('Incoherent crash acceptance sequence');
  if((crash.kind!==1&&crash.kind!==2)||![75,100,200].includes(crash.handlingCap)||
    !Number.isFinite(crash.impactSpeed)||crash.impactSpeed<0||crash.impactSpeed>200||
    !Number.isFinite(crash.collisionDir)||!Number.isFinite(crash.curve))
    throw new Error('Invalid latched crash impact');
  return true;
}
export const BeginCrashRecovery=defineSystem({
  name:'BeginCrashRecovery',after:['AdvanceTraffic'],
  runIf:{query:query(read(CrashDriver))},
  queries:{owners:query(write(CrashDriver),write(TerrainDriver)),contacts:query(write(CollisionDriver))},
  resources:[read(DrivingState)],
  run(ctx,{owners,contacts}){
    if(owners.count!==1||contacts.count!==1)throw new Error('Crash recovery requires one matching collision owner');
    for(const chunk of owners.chunks())for(let row=0;row<chunk.length;row++){
      const crash=chunk.get(CrashDriver,row);
      for(const collisions of contacts.chunks())for(let index=0;index<collisions.length;index++){
        if(collisions.entity(index)!==chunk.entity(row))throw new Error('CrashDriver must belong to the collision/terrain driver');
        const collision=collisions.col(CollisionDriver),count=collision.acceptedCount[index]!;
        if(!hasNewCrashImpact(crash,count,ctx.step,collision.mapId[index]!,collision.locked[index]!==0))return;
        const state=ctx.resource(DrivingState);
        if(!state.active[0]||!state.playing[0])throw new Error('Crash acceptance requires a running driver');

        const variant=ctx.rng.range(0,2);
        if(variant!==0&&variant!==1)throw new Error('Invalid crash variant');
        chunk.set(CrashDriver,row,beginCrashRecovery(crash,crash,variant,count));
        // Diagnostics apply on the accepted tick too; preserve its completed
        // physical pose while removing ordinary terrain's hide/skid effects.
        const smoke=crash.impactSpeed>0?1:0;
        chunk.set(TerrainDriver,row,{recentering:false,recenterTarget:0,skidding:false,leftEffect:smoke,rightEffect:smoke});
        collisions.setField(CollisionDriver,index,'locked',true);
      }
    }
  },
});
