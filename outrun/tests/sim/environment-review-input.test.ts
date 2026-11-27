import {worldTest,expect,type WorldTestContext} from '@gameengine/test';
import {Keys,EnterScene,entityIndex,entityGen} from '@gameengine/runtime';
import {EnvironmentReviewIsolation,EnvironmentReview,EnvironmentResidency,DrivingState,RoadProofState} from '../../src/schema.gen.ts';
import {accumulateEnvironmentReviewKey,type EnvironmentReviewInputState} from '../../src/input/environment-review-input.ts';
const SCENE={scene:'scenes/destination-environment.scene.json'};
function empty():EnvironmentReviewInputState{return {held:0,sequence:0,mapId:0,mapSequence:0,mode:0,modeSequence:0};}
function state(world:WorldTestContext['world']){
  const owners=world.entities(EnvironmentReviewIsolation);expect(owners.length).toBe(1);
  return world.get(owners[0]!,EnvironmentReviewIsolation);
}

worldTest('environment.reviewRelay mode-only input preserves unspecified and manually selected map',async({world,input,step})=>{
  world.setResource(EnvironmentReview,{mapId:10,mode:0});await step(1);
  const driver=world.resource(DrivingState),road=world.resource(RoadProofState);
  input.key('KeyC',true);await step(1);
  expect(state(world)).toEqual({held:32,sequence:1,mapId:0,mapSequence:0,mode:1,modeSequence:1});
  expect(world.resource(EnvironmentReview).mapId).toBe(10);expect(world.resource(EnvironmentReview).mode).toBe(1);
  input.key('KeyC',false);await step(1);
  expect(state(world)).toEqual({held:0,sequence:1,mapId:0,mapSequence:0,mode:1,modeSequence:1});
  await step(5);expect(state(world).sequence).toBe(1);expect(state(world).modeSequence).toBe(1);
  expect(world.resource(DrivingState)).toEqual(driver);expect(world.resource(RoadProofState)).toEqual(road);
},SCENE);

for(const modeFirst of [false,true])worldTest(`environment.reviewRelay coalesced ${modeFirst?'mode then map':'map then mode'} preserves command order`,async({world,input,step})=>{
  if(modeFirst){input.key('KeyC',true);input.key('Digit4',true);}
  else{input.key('Digit4',true);input.key('KeyC',true);}
  await step(1);
  expect(state(world)).toEqual({held:36,sequence:2,mapId:4,mapSequence:modeFirst?2:1,mode:modeFirst?0:1,modeSequence:2});
  expect(world.resource(EnvironmentReview).mapId).toBe(4);expect(world.resource(EnvironmentReview).mode).toBe(modeFirst?0:1);
  input.key('KeyC',false);input.key('Digit4',false);await step(1);
  const snapshot=state(world);await step(5);expect(state(world)).toEqual(snapshot);
},SCENE);

worldTest('environment.reviewRelay recorded held repeat release and repress change versions exactly once',async({world,input,step})=>{
  input.key('Digit4',true);await step(1);expect(state(world).sequence).toBe(1);
  input.key('Digit4',true);await step(1);await step(4);expect(state(world).sequence).toBe(1);
  expect(state(world).held).toBe(4);expect(state(world).mapSequence).toBe(1);
  input.key('Digit4',false);await step(1);expect(state(world).held).toBe(0);expect(state(world).sequence).toBe(1);
  input.key('Digit4',true);await step(1);expect(state(world).sequence).toBe(2);expect(state(world).mapSequence).toBe(2);expect(state(world).modeSequence).toBe(2);
  input.key('Digit4',false);input.key('KeyV',true);await step(1);
  expect(state(world).sequence).toBe(3);expect(state(world).mapSequence).toBe(2);expect(state(world).modeSequence).toBe(3);expect(state(world).mode).toBe(2);
  input.key('KeyV',false);await step(1);await step(5);
  expect(state(world).sequence).toBe(3);expect(state(world).held).toBe(0);
},SCENE);

worldTest('environment.reviewRelay pure accumulator pins selector mode precedence held edges and overflow',()=>{
  const value=empty();
  for(const [code,id] of [[Keys.Digit2,2],[Keys.Digit3,3],[Keys.Digit4,4],[Keys.Digit0,10],[Keys.KeyG,16]] as const){
    const previous=value.sequence;accumulateEnvironmentReviewKey(value,code,true);
    expect(value.mapId).toBe(id);expect(value.sequence).toBe(previous+1);expect(value.mapSequence).toBe(value.sequence);
    expect(value.mode).toBe(0);expect(value.modeSequence).toBe(value.sequence);
    accumulateEnvironmentReviewKey(value,code,true);expect(value.sequence).toBe(previous+1);
    accumulateEnvironmentReviewKey(value,code,false);expect(value.held).toBe(0);
  }
  for(const [code,mode] of [[Keys.KeyC,1],[Keys.KeyV,2],[Keys.KeyR,0]] as const){
    const mapVersion=value.mapSequence;accumulateEnvironmentReviewKey(value,code,true);accumulateEnvironmentReviewKey(value,code,false);
    expect(value.mode).toBe(mode);expect(value.mapId).toBe(16);expect(value.mapSequence).toBe(mapVersion);expect(value.modeSequence).toBe(value.sequence);
  }
  const before={...value};accumulateEnvironmentReviewKey(value,Keys.ArrowUp,true);expect(value).toEqual(before);
  const exhausted={...empty(),sequence:0xffffffff};let threw=false;
  try{accumulateEnvironmentReviewKey(exhausted,Keys.KeyC,true);}catch{threw=true;}
  expect(threw).toBe(true);expect(exhausted).toEqual({...empty(),sequence:0xffffffff});
});

worldTest('environment.reviewRelay ownerless legacy scenes do not create relay state',async({world,input,step})=>{
  expect(world.count(EnvironmentReviewIsolation)).toBe(0);
  input.key('KeyC',true);input.key('Digit4',true);await step(5);
  input.key('KeyC',false);input.key('Digit4',false);await step(1);
  expect(world.count(EnvironmentReviewIsolation)).toBe(0);
},{scene:'scenes/road-proof.scene.json'});


worldTest('environment.reviewRelay same-scene recorded reentry resets owner identity and consumed versions',async({world,input,step})=>{
  input.key('Digit4',true);await step(1);input.key('Digit4',false);await step(1);
  input.key('KeyC',true);await step(1);input.key('KeyC',false);await step(1);
  expect(state(world)).toEqual({held:0,sequence:2,mapId:4,mapSequence:1,mode:1,modeSequence:2});
  expect(world.resource(EnvironmentReview).mapId).toBe(4);expect(world.resource(EnvironmentReview).mode).toBe(1);
  const oldOwner=world.entities(EnvironmentReviewIsolation)[0]!,oldCursor=world.resource(EnvironmentResidency);
  expect(oldCursor.inputOwned).toBe(true);expect(oldCursor.inputOwnerIndex).toBe(entityIndex(oldOwner));expect(oldCursor.inputOwnerGeneration).toBe(entityGen(oldOwner));
  expect(oldCursor.appliedMapSequence).toBe(1);expect(oldCursor.appliedModeSequence).toBe(2);
  input.emit(EnterScene,{scene:'scenes/destination-environment.scene.json',release:''});await step(2);
  const nextOwner=world.entities(EnvironmentReviewIsolation)[0]!,cursor=world.resource(EnvironmentResidency);
  expect(entityIndex(nextOwner)!==entityIndex(oldOwner)||entityGen(nextOwner)!==entityGen(oldOwner)).toBe(true);
  expect(state(world)).toEqual(empty());expect(cursor.inputOwned).toBe(true);
  expect(cursor.inputOwnerIndex).toBe(entityIndex(nextOwner));expect(cursor.inputOwnerGeneration).toBe(entityGen(nextOwner));
  expect(cursor.appliedMapSequence).toBe(0);expect(cursor.appliedModeSequence).toBe(0);
  expect(world.resource(EnvironmentReview).mapId).toBe(2);expect(world.resource(EnvironmentReview).mode).toBe(0);
  expect(world.resource(EnvironmentReview).cameraOriginZ).toBe(45000);
  await step(5);expect(state(world)).toEqual(empty());
  expect(world.resource(EnvironmentReview).mapId).toBe(2);expect(world.resource(EnvironmentReview).mode).toBe(0);
  expect(world.resource(EnvironmentResidency).appliedMapSequence).toBe(0);expect(world.resource(EnvironmentResidency).appliedModeSequence).toBe(0);
},SCENE);

worldTest('environment.reviewRelay consumed held selector preserves manual camera until real release and repress',async({world,input,step})=>{
  input.key('Digit4',true);await step(1);
  expect(world.resource(EnvironmentReview).cameraOriginZ).toBe(30450);
  expect(state(world).sequence).toBe(1);expect(world.resource(EnvironmentResidency).appliedMapSequence).toBe(1);
  world.setResource(EnvironmentReview,{cameraOriginZ:45123});await step(1);
  input.key('Digit4',true);await step(1);await step(3);
  expect(state(world).held).toBe(4);expect(state(world).sequence).toBe(1);
  expect(world.resource(EnvironmentResidency).appliedMapSequence).toBe(1);
  expect(world.resource(EnvironmentReview).cameraOriginZ).toBe(45123);
  input.key('Digit4',false);await step(1);expect(state(world).held).toBe(0);
  expect(world.resource(EnvironmentReview).cameraOriginZ).toBe(45123);
  input.key('Digit4',true);await step(1);
  expect(state(world).sequence).toBe(2);expect(state(world).mapSequence).toBe(2);
  expect(world.resource(EnvironmentResidency).appliedMapSequence).toBe(2);expect(world.resource(EnvironmentResidency).appliedModeSequence).toBe(2);
  expect(world.resource(EnvironmentReview).mapId).toBe(4);expect(world.resource(EnvironmentReview).mode).toBe(0);
  expect(world.resource(EnvironmentReview).cameraOriginZ).toBe(30450);
  input.key('Digit4',false);await step(1);
},SCENE);
