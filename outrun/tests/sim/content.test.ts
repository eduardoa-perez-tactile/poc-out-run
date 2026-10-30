import {worldTest,expect} from '@gameengine/test';
import {EnterScene} from '@gameengine/runtime';
import {Map01Preview,DrivingState,DrivingInput,RoadProofState} from '../../src/schema.gen.ts';
import {loadMap01,trackHeight,sourcePlayerSample} from '../../src/content/biome.ts';
import {buildSourceRoad,buildSourceProps,sourceProjectionStats,sourceProjectionBuffers} from '../../src/render/source-projection.ts';
const SCENE={scene:'scenes/map01-data.scene.json'};
for(const sameStep of [false,true])worldTest(`content.map01 ${sameStep?'same-step':'adjacent'} recorded entries preserve the later driving destination`,async({world,input,step})=>{
  input.emit(EnterScene,{scene:'scenes/map01-data.scene.json',release:''});if(!sameStep)await step(1);
  input.emit(EnterScene,{scene:'scenes/driving-proof.scene.json',release:''});await step(1);
  expect(world.resource(DrivingState).active).toBe(true);
  input.key('ArrowUp',true);await step(3);
  expect(world.resource(DrivingState).active).toBe(true);
  expect(world.resource(DrivingInput).keyboard).toBe(1);
  expect(world.resource(DrivingState).legacySpeed).toBeGreaterThan(0);
},SCENE);
worldTest('content.map01 recorded reentry clears driving activation and every stale hold',async({world,input,step})=>{
  input.emit(EnterScene,{scene:'scenes/driving-proof.scene.json',release:''});await step(2);
  input.key('ArrowUp',true);input.key('ArrowLeft',true);await step(3);
  expect(world.resource(DrivingState).active).toBe(true);
  expect(world.resource(DrivingInput).keyboard).toBe(5);
  // Include every held latch in this transition fixture, even one-frame shifts.
  world.setResource(DrivingInput,{keyboard:5,ui:10,shiftUp:true,shiftDown:true,upHeld:true,downHeld:true,pauseHeld:true,modeHeld:true});
  input.emit(EnterScene,{scene:'scenes/map01-data.scene.json',release:''});await step(2);
  expect(world.resource(DrivingState).active).toBe(false);
  expect(world.resource(DrivingInput)).toEqual({keyboard:0,ui:0,shiftUp:false,shiftDown:false,upHeld:false,downHeld:false,pauseHeld:false,modeHeld:false});
  const road={...world.resource(RoadProofState)},driving={...world.resource(DrivingState)};
  input.key('ArrowUp',false);input.key('ArrowLeft',false);await step(1);
  input.key('ArrowUp',true);input.key('ArrowLeft',true);await step(5);
  expect(world.resource(RoadProofState)).toEqual(road);
  expect(world.resource(DrivingState)).toEqual(driving);
},SCENE);
worldTest('content.map01 dense canonical recorded startup',async({input,step,world})=>{
  input.view(1280,720,1);
  input.emit(EnterScene,{scene:'scenes/map01-data.scene.json',release:''});await step(1);
  input.key('Digit9',true);await step(1);input.key('Digit9',false);await step(120);
  expect(world.resource(Map01Preview).enabled).toBe(true);
  expect(loadMap01().placements.length).toBe(1475);
  // The matching T1 dense case proves that the presentation selector ran and
  // rendered nonempty geometry. This hash test alone makes no upload claim.
});
worldTest('content.map01 cooked typed record preserves all boundaries and last-write winners',()=>{
  const data=loadMap01();
  expect(data.authoredCount).toBe(4123);expect(data.totalCount).toBe(6083);
  expect(data.swapLine).toBe(4284);expect(data.lastLine).toBe(5883);
  expect(data.links.left).toBe(2);expect(data.links.right).toBe(3);
  expect(data.placements.length).toBe(1475);expect(data.overwritten.length).toBe(866);
  expect(data.objects.length).toBe(71);expect(data.candidatePlacements).toBe(2341);
  expect(Object.isFrozen(data)).toBe(true);expect(Object.isFrozen(data.segments[0])).toBe(true);
  const slot=data.placements.find(p=>p.segment===308&&p.slot===4)!;
  expect(data.definitions[slot.definition]!.objectId).toBe(25);
},SCENE);
worldTest('content.player sample is camera-origin plus702 and camera height uses that terrain',()=>{
  const data=loadMap01(),camera=54000,player=sourcePlayerSample(data,camera);
  expect(player.playerZ).toBe(camera+702);expect(player.index).toBe(Math.floor((camera+702)/150));
  expect(player.height).toBe(trackHeight(data,camera+702));expect(player.cameraY).toBe(800+Math.trunc(player.height));
  // This negative fractional sample distinguishes source int truncation from
  // both retaining the fraction and incorrectly rounding toward minus infinity.
  expect(player.height).toBeCloseTo(-27.91913,4);expect(player.cameraY).toBe(773);
  expect(Math.abs(player.height-trackHeight(data,camera))).toBeGreaterThan(1);
  const before={...player};buildSourceRoad(data,camera,0,16/9);buildSourceRoad(data,camera,0,4/3);
  expect(sourcePlayerSample(data,camera)).toEqual(before);
},SCENE);
worldTest('content.projection source views stay finite bounded and reuse the shared buffers',()=>{
  const data=loadMap01();let previous:Float32Array|null=null;
  for(const distance of [0,149.999,45000,54000,1930*150,4123*150,4284*150,5883*150]) {
    const road=buildSourceRoad(data,distance,0,16/9);const props=buildSourceProps(data,1280,16/9);
    expect(road.positions.every(Number.isFinite)).toBe(true);expect(props.positions.every(Number.isFinite)).toBe(true);
    expect(road.positions.length).toBe(200*9*12);expect(props.positions.length).toBe(256*12);
    expect(sourceProjectionStats.visitedProps).toBeLessThanOrEqual(138);
    expect(sourceProjectionStats.drawnProps).toBeLessThanOrEqual(256);
    if(previous!==null)expect(road.positions===previous).toBe(true);previous=road.positions;
  }
},SCENE);
worldTest('content.fork projection uses player gap at the strict swap boundary and mirrored curve signs',()=>{
  const data=loadMap01();
  for(const line of [data.swapLine,data.swapLine+1]) {
    const camera=line*150-702,base=Math.floor(camera/150),fraction=camera/150-base;
    buildSourceRoad(data,camera,0,16/9);
    const player=sourcePlayerSample(data,camera);
    expect(player.index).toBe(line);expect(player.index>data.swapLine).toBe(line===data.swapLine+1);
    expect(sourceProjectionStats.playerGap).toBe(player.gap);
    expect(data.segments[base+40]!.gap===player.gap).toBe(false);
    let x=0,dx=-data.segments[base]!.curve*fraction;
    for(let n=0;n<60;n++) {
      const row=data.segments[base+n]!;
      if(n>0) {
        const scale=sourceProjectionBuffers.scale[n]!;
        expect(sourceProjectionBuffers.right[n]).toBeCloseTo((player.gap+(row.mirror?-x:x))*16/9*scale,4);
      }
      x+=dx;dx+=row.curve;
    }
  }
},SCENE);
worldTest('content.diagnostic markers cap drawn size without altering full image or collision metadata',()=>{
  const data=loadMap01(),wall=data.objects[50]!;
  expect(wall.sourceSizePx[0]).toBe(1000);expect(wall.collisionWidthSourcePx).toBe(1000);
  buildSourceRoad(data,1930*150,0,16/9);const marker=buildSourceProps(data,1280,16/9);
  for(let q=0;q<sourceProjectionStats.drawnProps;q++) {
    const p=q*12,width=marker.positions[p+3]!-marker.positions[p]!,height=marker.positions[p+7]!-marker.positions[p+1]!;
    expect(width).toBeLessThanOrEqual(8*2/720+.00001);
    expect(height).toBeLessThanOrEqual(40*2/720+.00001);
  }
  expect(wall.sourceSizePx[0]).toBe(1000);expect(wall.collisionWidthSourcePx).toBe(1000);
},SCENE);
