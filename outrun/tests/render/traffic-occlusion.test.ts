import {renderTest,expect,type WorldTestContext} from '@gameengine/test';
import {assets,ViewInfo} from '@gameengine/runtime';
import {DrivingState,TrafficArtPreview,TrafficPool} from '../../src/schema.gen.ts';
import {loadMap01} from '../../src/content/biome.ts';
import {sourceProjectionStats} from '../../src/render/source-projection.ts';
import {makeTrafficArtFixture} from '../../src/render/traffic-art-fixtures.ts';
import {trafficCompositeSamples,trafficCompositeStats} from '../../src/render/traffic-buffers.ts';
const SCENE={scene:'scenes/traffic-art.scene.json',memory:'phone-low' as const};
async function ready(step:WorldTestContext['step']){
  await step(1);
  for(let frame=0;frame<120&&(assets.progress('map01-environment')<1||assets.progress('traffic-source')<1);frame++)await step(1);
  expect(assets.progress('map01-environment')).toBe(1);expect(assets.progress('traffic-source')).toBe(1);
}
for(const [name,caseId,frontCase,backCase] of [['near palm over far car',0,2,3],['near car over far palm',1,4,5]] as const){
  renderTest(`traffic.art occlusion ${name} uses actual compositor painter order`,async({world,input,step,render})=>{
    input.view(1280,720,1);await ready(step);
    expect(world.count(TrafficPool)).toBe(0); // All geometry is an explicit presentation fixture.
    const driving=world.resource(DrivingState),fixture=makeTrafficArtFixture(loadMap01(),caseId),point:[number,number]=[...fixture.probe];
    const sample=async(id:number)=>{
      world.setResource(TrafficArtPreview,{mode:2,caseId:id,frame:1});await step(1);
      return render.probe({width:1280,height:720,points:[point]}).points[0]!.rgba;
    };
    const composite=await sample(caseId);
    expect(trafficCompositeStats.visible).toBe(1);expect(trafficCompositeStats.props).toBe(1);
    const lastKind=trafficCompositeSamples.kind[trafficCompositeStats.total-1];
    expect(lastKind).toBe(caseId===0?0:1);
    const front=await sample(frontCase),back=await sample(backCase);
    console.log('traffic.art controlled overlap diagnostics',{caseId,point,composite,front,back,
      view:world.resource(ViewInfo),projection:{...sourceProjectionStats},
      carBounds:[trafficCompositeSamples.left[0],trafficCompositeSamples.right[0],trafficCompositeSamples.bottom[0],trafficCompositeSamples.top[0]],
      propSegment:fixture.propSegment,carSegment:fixture.carSegment});
    const carPixel=caseId===0?back:front;
    expect(carPixel[3]).toBe(255);expect(Math.max(...carPixel.slice(0,3))).toBeGreaterThan(20);
    for(const background of [loadMap01().palette[0]!,loadMap01().palette[3]!,loadMap01().palette[4]!])
      expect(Math.max(...carPixel.slice(0,3).map((channel,i)=>Math.abs(channel-background[i]!)))).toBeGreaterThan(10);
    // Both original PNGs are opaque at the shared sample; compare the actual
    // isolated GPU paths so linear filtering/color conversion cannot fake proof.
    expect(composite).toEqual(front);
    expect(Math.max(...front.slice(0,3).map((channel,i)=>Math.abs(channel-back[i]!)))).toBeGreaterThan(10);
    expect(world.count(TrafficPool)).toBe(0);expect(world.resource(DrivingState)).toEqual(driving);
    console.log('traffic.art controlled overlap',{caseId,point,composite,front,back,propSegment:fixture.propSegment,carSegment:fixture.carSegment});
    await sample(caseId);render.expectScreenshot('overlap',{width:1280,height:720});
  },SCENE);
}
