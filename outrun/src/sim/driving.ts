import { defineSystem, read, write, query, math } from '@gameengine/runtime';
import { DrivingState, DrivingInput, RoadProofState, TerrainDriver, CollisionDriver, CrashDriver, DrivingResetRequested } from '../schema.gen.ts';
import { advanceDriving, LEGACY_UPDATES_PER_SECOND } from './driving-math.ts';

import {loadMap01} from '../content/biome.ts';
import {advanceTerrainDriving,resetTerrainDriver} from './terrain-math.ts';
import {advanceCrashRecovery,resetCrashRecovery} from './crash-recovery-math.ts';

export const AdvanceDriving = defineSystem({
  name: 'AdvanceDriving',
  after: ['CaptureDrivingInput', 'AdvanceRoadProof'],
  queries:{sourceDrivers:query(write(TerrainDriver)),collisions:query(write(CollisionDriver)),crashes:query(write(CrashDriver))},events:[DrivingResetRequested],
  resources: [write(DrivingState), read(DrivingInput), write(RoadProofState)],
  run(ctx,{sourceDrivers,collisions,crashes}) {
    const state = ctx.resource(DrivingState);
    if (!state.active[0]) return;
    const distance = state.distance[0]!;
    const lateral = state.lateral[0]!;
    ctx.set(DrivingState, { previousDistance: distance, previousLateral: lateral });
    if(sourceDrivers.count>1)throw new Error('Source driving requires exactly one TerrainDriver');
    if(collisions.count>1||collisions.count>sourceDrivers.count)throw new Error('Collision detection requires one matching TerrainDriver');
    if(crashes.count>1||crashes.count>collisions.count)throw new Error('Crash recovery requires one matching collision owner');
    if(sourceDrivers.count===1){
      const held=ctx.resource(DrivingInput),bits=held.keyboard[0]!|held.ui[0]!;
      for(const chunk of sourceDrivers.chunks())for(let row=0;row<chunk.length;row++){
        const before=chunk.get(TerrainDriver,row),data=loadMap01();
        const driver=ctx.events.count(DrivingResetRequested)>0?resetTerrainDriver(before.mapId):before;
        let crashBefore:import('../schema.gen.ts').CrashDriverValue|undefined;
        if(crashes.count===1)for(const recoveries of crashes.chunks())for(let index=0;index<recoveries.length;index++){
          if(recoveries.entity(index)!==chunk.entity(row))throw new Error('CrashDriver must belong to the terrain/contact driver');
          crashBefore=recoveries.get(CrashDriver,index);
          if(crashBefore.mapId!==before.mapId)throw new Error('CrashDriver map must match the terrain driver');
        }
        const sample={
          legacySpeed:state.legacySpeed[0]!,gear:state.gear[0]!,steering:state.steering[0]!,lateral,
          distance,playing:state.playing[0]!==0,manual:state.manual[0]!==0,
        };
        // Choose exactly one physical integrator. The completion tick retains
        // recovery's lock even when its resulting phase has become idle.
        const recovery=crashBefore&&(crashBefore.phase!==0||driver.sectionEnd||distance>=data.lastLine*data.segmentLength)
          ?advanceCrashRecovery(crashBefore,sample,driver,data,ctx.dt):undefined;
        const next=recovery??advanceTerrainDriving(sample,driver,{
          throttle:(bits&1)!==0,brake:(bits&2)!==0,left:(bits&4)!==0,right:(bits&8)!==0,
          up:held.shiftUp[0]!==0,down:held.shiftDown[0]!==0,
        },ctx.dt,data,collisions.count===1);
        ctx.set(DrivingState,next.driving);chunk.set(TerrainDriver,row,next.driver);
        if(crashBefore)for(const recoveries of crashes.chunks())for(let index=0;index<recoveries.length;index++){
          if(next.driver.sectionEnd){
            recoveries.set(CrashDriver,index,resetCrashRecovery(crashBefore.mapId));
            ctx.setField(DrivingState,'gear',0);
          }
          else if(recovery)recoveries.set(CrashDriver,index,recovery.crash);
        }
        if(collisions.count===1)for(const contacts of collisions.chunks())for(let index=0;index<contacts.length;index++){
          if(contacts.entity(index)!==chunk.entity(row))throw new Error('CollisionDriver must belong to the terrain driver');
          if(contacts.col(CollisionDriver).mapId[index]!==before.mapId)throw new Error('CollisionDriver map must match the terrain driver');
          if(crashBefore&&next.driver.sectionEnd){
            const ended=contacts.col(CollisionDriver);
            if(crashBefore.phase!==0||ended.locked[index]!==0||ended.motionValid[index]!==0||ended.acceptedCount[index]!==0||ended.ledgerCount[index]!==0)
              contacts.set(CollisionDriver,index,{locked:false,acceptedCount:0,initialized:false,motionValid:false,motionStep:ctx.step,
              ledgerCount:0,ledgerKind:Array(64).fill(0),ledgerId:Array(64).fill(0),
              ledgerEpoch:Array(64).fill(0),ledgerGeneration:Array(64).fill(0)});
            continue;
          }
          if(!next.driving.playing&&ctx.events.count(DrivingResetRequested)===0)continue;
          if(crashBefore)contacts.setField(CollisionDriver,index,'locked',recovery?.lockedThisTick??false);
          const motion=next.motion,valid=motion!==undefined&&ctx.events.count(DrivingResetRequested)===0;
          contacts.setField(CollisionDriver,index,'motionValid',valid);
          contacts.setField(CollisionDriver,index,'motionStep',ctx.step);
          if(valid){
            for(const field of ['z0','z1','l0','ls','lc','lr','lf','drift','previousGap','handlingCap'] as const)
              contacts.setField(CollisionDriver,index,field,motion[field]);
            contacts.setField(CollisionDriver,index,'carryApplied',motion.carryApplied);
          }
        }
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
