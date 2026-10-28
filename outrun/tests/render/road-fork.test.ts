import {renderTest,expect} from '@gameengine/test';
import {meshes} from '@gameengine/runtime';
import {ForkPreviewRequested,ForkPreviewState,RoadProofState} from '../../src/schema.gen.ts';
const SCENE={scene:'scenes/road-proof.scene.json'};
for(const [side,name] of [[0,'left'],[1,'right']] as const){
  for(const [phase,distance,tick] of [['approach',33000,0],['midpoint',45000,90],['successor',57000,180]] as const){
    for(const [width,height] of [[882,344],[1280,720],[720,540]] as const){
      renderTest(`road.fork ${name} ${phase} at ${width}x${height}`,async({input,step,render,world})=>{
        input.view(width,height,1);
        input.emit(ForkPreviewRequested,{side,distance,tick,configurePlayback:true,playing:false});await step(2);
        const state=world.resource(ForkPreviewState);const road=world.resource(RoadProofState);
        const sky=render.probe({width,height,points:[[Math.floor(width*.9),Math.floor(height*.1)]]}).points[0]!.rgba;
        if(tick===0){expect(sky[0]).toBeLessThan(8);expect(sky[2]).toBeGreaterThan(240);}
        if(side===1&&tick===180){expect(sky[0]).toBeGreaterThan(240);expect(sky[1]).toBeGreaterThan(210);expect(sky[2]).toBeLessThan(8);}
        expect(meshes.list().bytes).toBeLessThanOrEqual(500000);
        render.expectDrawCalls('<=',10,{width,height});render.expectTriangles('<=',3861,{width,height});
        render.expectScreenshot('fork',{width,height});
        expect(world.resource(ForkPreviewState)).toEqual(state);expect(world.resource(RoadProofState)).toEqual(road);
      },SCENE);
    }
  }
}
