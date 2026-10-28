import { renderTest, expect } from '@gameengine/test';
import { meshes } from '@gameengine/runtime';
import { RoadFixtureRequested, RoadProofState } from '../../src/schema.gen.ts';
const SCENE={scene:'scenes/road-proof.scene.json'};
for(const [name,distance] of [['approach',33000],['crest',45000],['descent',54000],['valley',114000]] as const) {
  for(const [width,height] of [[882,344],[1280,720],[720,540]] as const) {
    renderTest(`road.clipping ${name} at ${width}x${height}`,async({input,step,render,world,ui})=>{
      input.view(width,height,1);
      input.emit(RoadFixtureRequested,{fixtureId:3,distance,speed:7200,lateral:0,playing:false});
      await step(2);
      const before=world.resource(RoadProofState);
      // Establish the capture viewport before querying painted UI geometry.
      render.probe({width,height,points:[[0,0]]});
      const orderStrip=ui.rect('hill-proof-order.order');
      expect(orderStrip !== null).toBe(true);
      const strip=orderStrip!;
      const sample=render.probe({width,height,points:[
        [Math.floor(strip.x+strip.width/2),Math.floor(strip.y+strip.height/2)],
        [Math.floor(width/2),Math.floor(height*.87)],
        [Math.floor(width*.95),Math.floor(height*.1)],
      ]});
      // UI strip covers the player's dark foot; the player covers road/objects.
      const uiColor=sample.points[0]!.rgba; const player=sample.points[1]!.rgba;
      expect(uiColor[0]).toBeGreaterThan(240);expect(uiColor[1]).toBeGreaterThan(210);expect(uiColor[2]).toBeLessThan(8);
      expect(player[0]).toBeGreaterThan(210);expect(player[1]).toBeLessThan(100);
      expect(sample.points[2]!.rgba[2]).toBeGreaterThan(240);
      if(name==='crest') {
        const overlap=render.probe({width,height,points:[[Math.floor(width*450/1280),Math.floor(height*400/720)]]}).points[0]!.rgba;
        // Near half-alpha blue over far red traffic produces purple, not either solid color.
        expect(overlap[0]).toBeGreaterThan(80);expect(overlap[0]).toBeLessThan(200);
        expect(overlap[2]).toBeGreaterThan(150);
      }
      expect(meshes.list().bytes).toBeLessThanOrEqual(250000);
      render.expectDrawCalls('<=',8,{width,height});
      // 2000 road + 128 objects + 2 player + 2 backdrop + 2 UI + 1 clear.
      render.expectTriangles('<=',2135,{width,height});
      render.expectScreenshot('hill',{width,height});
      expect(world.resource(RoadProofState)).toEqual(before);
    },SCENE);
  }
}

for(const insets of [[44,0,0,21],[0,0,44,21]] as const) {
  renderTest(`road.clipping order strip respects landscape insets ${insets.join('-')}`,async({input,step,ui,render})=>{
    input.view(882,344,1,[...insets]);
    input.emit(RoadFixtureRequested,{fixtureId:3,distance:45000,speed:7200,lateral:0,playing:false});
    await step(2);
    render.probe({width:882,height:344,points:[[0,0]]});
    const rect=ui.rect('hill-proof-order.order');
    expect(rect!==null).toBe(true);
    expect(rect!.x).toBeGreaterThanOrEqual(insets[0]);
    expect(rect!.x+rect!.width).toBeLessThanOrEqual(882-insets[2]);
    expect(rect!.y+rect!.height).toBeLessThanOrEqual(344-insets[3]);
    const pixel=render.probe({width:882,height:344,points:[[Math.floor(rect!.x+rect!.width/2),Math.floor(rect!.y+rect!.height/2)]]}).points[0]!.rgba;
    expect(pixel[0]).toBeGreaterThan(240);expect(pixel[2]).toBeLessThan(8);
  },SCENE);
}

renderTest('road.clipping startup waits for recorded viewport before projecting',async({input,step,render,world})=>{
  // Before any fixed step there is no mesh using the engine's portrait defaults.
  expect(meshes.info('road-proof')).toBe(null);
  expect(meshes.info('hill-objects')).toBe(null);
  const initial=render.probe({width:882,height:344,points:[[5,300],[877,300]]});
  expect(initial.points[0]!.rgba[0]).toBeLessThan(8);
  expect(initial.points[1]!.rgba[0]).toBeLessThan(8);
  input.view(882,344,1);
  input.emit(RoadFixtureRequested,{fixtureId:3,distance:33000,speed:7200,lateral:0,playing:false});
  await step(2);
  expect(world.resource(RoadProofState).distance).toBe(33000);
  expect(meshes.info('road-proof')!==null).toBe(true);
  const ready=render.probe({width:882,height:344,points:[[5,300],[877,300]]});
  expect(ready.points[0]!.rgba[0]).toBeGreaterThan(140);
  expect(ready.points[1]!.rgba[0]).toBeGreaterThan(140);
},SCENE);
