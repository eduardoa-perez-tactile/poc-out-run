import {expect,worldTest,type WorldTestContext} from '@gameengine/test';
import {EnterScene} from '@gameengine/runtime';
import {CollisionDriver,CrashDriver,DrivingState,RouteBiomeEntered,RouteCheckpointPassed,RouteDriver,
  RouteGoalEntered,RouteResetRequested,RouteTrafficCoordinates,TerrainDriver,TrafficPool} from '../../src/schema.gen.ts';
import left from '../fixtures/routes/original-all-left.inputs.json';
import right from '../fixtures/routes/original-right-first.inputs.json';

const KEYS=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'] as const;
const SCENE={scene:'scenes/original-route-sim.scene.json'};
type Plan=typeof left;
function requirePlan(ok:boolean,message:string):asserts ok {if(!ok)throw new Error(`Invalid fixed route plan: ${message}`);}

/** Validate the recorded plan before touching input. Playback never consults actor state. */
function validate(plan:Plan,steps:number,commands:number):void {
  requirePlan(plan.format==='outrun-original-fixed-inputs-v1','format');
  requirePlan(plan.sourceCommit==='6882721c99bc79365f815f68d389bf5078129e68','source pin');
  requirePlan(plan.engineVersion==='0.1.21'&&plan.scene===SCENE.scene,'engine/scene');
  requirePlan(JSON.stringify(plan.keys)===JSON.stringify(KEYS),'key table');
  requirePlan(JSON.stringify(plan.view)==='[1280,720,1]','landscape view');
  requirePlan(JSON.stringify(plan.reset)==='{"seedLo":9,"seedHi":2596069104,"population":9,"manual":false}','recorded reset');
  requirePlan(plan.steps===steps&&plan.expected.runnerSteps===steps,'step bound');
  requirePlan(plan.commands.length===commands&&plan.provenance.commands===commands,'command count');
  for(const hash of [plan.expected.observedFinalHash,plan.expected.runnerFinalHash])requirePlan(/^[0-9a-f]{16}$/.test(hash),'hash');
  for(const hash of [plan.provenance.authoringResultSha256,plan.provenance.sourceInventorySha256,plan.provenance.authoringCodeSha256])requirePlan(/^[0-9a-f]{64}$/.test(hash),'provenance');
  let previous=1;
  const held=[0,0,0,0];
  for(const command of plan.commands){
    requirePlan(Array.isArray(command)&&command.length===3,'command tuple');
    const [at,key,down]=command;
    requirePlan(Number.isInteger(at)&&at!>=2&&at!<=steps&&at!>=previous,'application-step order');
    requirePlan(Number.isInteger(key)&&key!>=0&&key!<KEYS.length,'key index');
    requirePlan(down===0||down===1,'down bit');
    requirePlan(held[key!]!==down,'redundant key transition');
    held[key!]=down!;previous=at!;
  }
  let entryStep=0;
  for(const entry of plan.expected.entries){
    requirePlan(Number.isInteger(entry.step)&&entry.step>entryStep&&entry.step<=steps,'entry observation');entryStep=entry.step;
  }
  requirePlan(plan.expected.entries[0]?.step===1,'initial entry');
  requirePlan(JSON.stringify(plan.expected.entries.map(entry=>entry.mapId))===JSON.stringify(plan.expected.visited),'visited sequence');
  let checkpointStep=0;
  for(const checkpoint of plan.expected.checkpoints){
    requirePlan(Number.isInteger(checkpoint.step)&&checkpoint.step>checkpointStep&&checkpoint.step<=steps,'checkpoint observation');
    requirePlan(checkpoint.producerStep===checkpoint.step-1,'checkpoint producer step');checkpointStep=checkpoint.step;
  }
}

async function playback({world,step,input}:WorldTestContext,plan:Plan,steps:number,commands:number,offset:0|1):Promise<void> {
    validate(plan,steps,commands);
    input.view(1280,720,1);
    let owner:ReturnType<typeof world.entities>[number]|undefined;
    if(offset===1){
      input.emit(EnterScene,{scene:SCENE.scene,release:''});
      await step(1);
      const bootstrapOwners=world.entities(RouteDriver);expect(bootstrapOwners.length).toBe(1);
      owner=bootstrapOwners[0]!;
      for(const component of [TerrainDriver,TrafficPool,RouteTrafficCoordinates,CollisionDriver,CrashDriver]){
        const entities=world.entities(component);expect(entities.length).toBe(1);expect(entities[0]).toBe(owner);
      }
      const bootstrap=world.get(owner,RouteDriver);
      expect(bootstrap.initialized).toBe(true);expect(bootstrap.routeEpoch).toBe(1);
      expect(bootstrap.mapId).toBe(1);expect(bootstrap.camera).toBe(45000);
      expect(world.get(owner,RouteTrafficCoordinates).routeEpoch).toBe(1);
    }
    input.emit(RouteResetRequested,plan.reset);
    // EnterScene initializes an epoch before the explicit plan reset in canonical
    // playback. That reset deterministically starts epoch 2; direct playback uses 1.
    const routeEpoch=1+offset;
    // Commands are applied immediately BEFORE their named simulation step. Observation
    // targets are fixed in the saved plan; no state read can select an input or target.
    const targets=new Set<number>([1,steps]);
    for(const command of plan.commands)targets.add(command[0]!);
    for(const entry of plan.expected.entries)targets.add(entry.step);
    for(const checkpoint of plan.expected.checkpoints)targets.add(checkpoint.step);
    let current=0,commandIndex=0;
    let checkedEntries=0,checkedCheckpoints=0;
    for(const target of [...targets].sort((a,b)=>a-b)){
      if(target-current>1){await step(target-current-1);current=target-1;}
      while(plan.commands[commandIndex]?.[0]===target){
        const command=plan.commands[commandIndex++]!;
        input.key(KEYS[command[1]!]!,command[2]===1);
      }
      await step(1);current=target;
      const entry=plan.expected.entries.find(value=>value.step===target);
      const checkpoint=plan.expected.checkpoints.find(value=>value.step===target);
      if(!entry&&!checkpoint&&target!==steps)continue;
      const owners=world.entities(RouteDriver);expect(owners.length).toBe(1);
      if(owner===undefined)owner=owners[0]!;
      expect(owners[0]).toBe(owner);
      for(const component of [TerrainDriver,TrafficPool,RouteTrafficCoordinates,CollisionDriver,CrashDriver]){
        const entities=world.entities(component);expect(entities.length).toBe(1);expect(entities[0]).toBe(owner);
      }
      const route=world.get(owner,RouteDriver),pool=world.get(owner,TrafficPool);
      const coordinates=world.get(owner,RouteTrafficCoordinates);
      expect(pool.population).toBe(9);expect(pool.initialized).toBe(true);expect(pool.mapId).toBe(route.mapId);
      expect(coordinates.routeEpoch).toBe(route.routeEpoch);expect(coordinates.mapEpoch).toBe(route.mapEpoch);
      expect(world.get(owner,CrashDriver).consumedAcceptedCount).toBe(world.get(owner,CollisionDriver).acceptedCount);
      if(entry){
        for(const key of ['mapId','stage','mapEpoch','gradient','camera','rangeCalls'] as const)expect(route[key]).toBe(entry[key]);
        expect(route.entryCount).toBe(++checkedEntries);expect(route.routeEpoch).toBe(routeEpoch);
        const event=world.events(RouteBiomeEntered).filter(value=>value.mapEpoch===entry.mapEpoch&&value.routeEpoch===routeEpoch);
        expect(event.length).toBe(1);expect(event[0]!.mapId).toBe(entry.mapId);
        expect(event[0]!.gradient).toBe(entry.gradient);expect(event[0]!.stage).toBe(entry.stage);
        expect(event[0]!.routeEpoch).toBe(routeEpoch);
        if(entry.mapId===16){
          expect(route.goalEntered).toBe(true);expect(route.arrivalCount).toBe(1);expect(route.arrivalStep).toBe(target-1+offset);
          const arrival=world.events(RouteGoalEntered);expect(arrival.length).toBe(1);
          expect(arrival[0]).toEqual({routeEpoch,mapEpoch:entry.mapEpoch,mapId:16,stage:5,gradient:entry.gradient});
        }
      }
      if(checkpoint){
        expect(route.mapId).toBe(checkpoint.mapId);expect(route.mapEpoch).toBe(checkpoint.mapEpoch);
        expect(route.checkpointCount).toBe(checkpoint.count);expect(route.checkpointCount).toBe(++checkedCheckpoints);
        expect(route.checkpointStep).toBe(checkpoint.producerStep+offset);expect(route.checkpointBonusSeconds).toBe(checkpoint.bonusSeconds);
        expect(route.checkpointAwarded).toBe(true);
        const events=world.events(RouteCheckpointPassed);expect(events.length).toBe(1);
        expect(events[0]!.mapId).toBe(checkpoint.mapId);expect(events[0]!.mapEpoch).toBe(checkpoint.mapEpoch);
        expect(events[0]!.bonusSeconds).toBe(checkpoint.bonusSeconds);expect(events[0]!.routeEpoch).toBe(routeEpoch);
      }
    }
    expect(current).toBe(steps);expect(commandIndex).toBe(commands);
    expect(checkedEntries).toBe(plan.expected.entries.length);expect(checkedCheckpoints).toBe(plan.expected.checkpoints.length);
    expect(owner===undefined).toBe(false);
    const actor=owner!;
    const expectedRoute={...plan.expected.route,routeEpoch};
    // Zero remains the absence sentinel. Only producer-step fields shift; stage,
    // gradients, cameras, pass amounts and all other physical state stay exact.
    for(const field of ['checkpointStep','arrivalStep','passAwardStep','processedStep','pendingStep'] as const){
      if(expectedRoute[field]>0)expectedRoute[field]+=offset;
    }
    expect(world.get(actor,RouteDriver)).toEqual(expectedRoute);
    expect(world.resource(DrivingState)).toEqual(plan.expected.driving);
    expect(world.get(actor,CollisionDriver).acceptedCount).toBe(plan.expected.acceptedCount);
    expect(world.get(actor,CrashDriver).consumedAcceptedCount).toBe(plan.expected.acceptedCount);
    expect(world.get(actor,RouteDriver).passAwardCount).toBe(plan.expected.passAwardCount);
    // The framework finalizes the runner after this body; its separate footer hash is
    // deliberately not the in-body observation captured by the authoring trial.
    if(offset===0)expect(world.hash()).toBe(plan.expected.observedFinalHash);
    console.log('ROUTE_FIXED_TRAVERSAL',JSON.stringify({name:plan.name,steps:steps+offset,planSteps:steps,bootstrapSteps:offset,commands,
      visited:plan.expected.visited,entries:checkedEntries,checkpoints:checkedCheckpoints,
      accepted:plan.expected.acceptedCount,passBatches:plan.expected.passAwardCount,observedHash:world.hash()}));
}

function traversal(name:string,plan:Plan,steps:number,commands:number):void {
  worldTest(name,ctx=>playback(ctx,plan,steps,commands,0),SCENE);
}
function canonical(name:string,plan:Plan,steps:number,commands:number):void {
  // No scene option: the replay verifier can reproduce this recorded startup
  // from the actual default project world without an SDK scene override.
  worldTest(name,ctx=>playback(ctx,plan,steps,commands,1));
}

traversal('routes.traversal fixed all-left inputs reach genuine goal after five ordinary maps and natural impacts',left,35878,29526);
traversal('routes.traversal fixed right-first inputs enter genuine Map3 with normal traffic',right,7332,5182);

canonical('routes.canonical recorded startup and fixed all-left inputs reach genuine goal',left,35878,29526);
canonical('routes.canonical recorded startup and fixed right-first inputs enter genuine Map3',right,7332,5182);
