import {worldTest,expect} from '@gameengine/test';
import {EnterScene} from '@gameengine/runtime';
import {DrivingState,DrivingInput} from '../../src/schema.gen.ts';
import {loadMap01} from '../../src/content/biome.ts';
import {buildSourceRoad,sourceProjectionStats,sourceProjectionBuffers} from '../../src/render/source-projection.ts';
import {MAP01_PROP_CAPACITY,buildMap01ArtProps,map01AtlasLookup,map01ClippedQuad,map01ArtStats,map01PropSamples} from '../../src/render/map01-art-buffers.ts';
import {buildMap01Panorama,wrapMap01Texels,advanceMap01Parallax} from '../../src/render/map01-art-backgrounds.ts';

worldTest('environment.art recorded entry clears driving holds and the next driving destination wins',async({world,input,step})=>{
  input.key('ArrowUp',true);input.key('ArrowLeft',true);await step(3);
  expect(world.resource(DrivingState).active).toBe(true);
  expect(world.resource(DrivingInput).keyboard).toBe(5);
  world.setResource(DrivingInput,{keyboard:5,ui:10,shiftUp:true,shiftDown:true,upHeld:true,downHeld:true,pauseHeld:true,modeHeld:true});
  input.emit(EnterScene,{scene:'scenes/map01-art.scene.json',release:''});await step(1);
  expect(world.resource(DrivingState).active).toBe(false);
  expect(world.resource(DrivingInput)).toEqual({keyboard:0,ui:0,shiftUp:false,shiftDown:false,upHeld:false,downHeld:false,pauseHeld:false,modeHeld:false});
  input.emit(EnterScene,{scene:'scenes/driving-proof.scene.json',release:''});await step(1);
  expect(world.resource(DrivingState).active).toBe(true);
  input.key('ArrowUp',false);input.key('ArrowLeft',false);await step(1);
  input.key('ArrowUp',true);await step(3);
  expect(world.resource(DrivingState).active).toBe(true);
  expect(world.resource(DrivingInput).keyboard).toBe(1);
  expect(world.resource(DrivingState).legacySpeed).toBeGreaterThan(0);
},{scene:'scenes/driving-proof.scene.json'});

worldTest('environment.art crest removes lower geometry and corresponding lower source texels',()=>{
  const quad=map01ClippedQuad(-2,-1,4,2,.25,[100,200,40,80],[1024,1024]);
  expect(quad.left).toBe(-2);expect(quad.right).toBe(2);expect(quad.top).toBe(1);expect(quad.bottom).toBe(.25);
  expect(quad.fraction).toBe(.375);expect(quad.v0).toBe(200/1024);expect(quad.v1).toBe(230/1024);
  expect(map01ClippedQuad(0,0,1,1,2,[0,0,10,20],[1024,1024]).fraction).toBe(0);
  expect(map01ClippedQuad(0,0,1,1,-2,[0,0,10,20],[1024,1024]).fraction).toBe(1);
});
worldTest('environment.art source placements keep source-scale dimensions and painter order in a fixed pool',()=>{
  const data=loadMap01();
  // Geometry-only oracle: rects deliberately simple; production importer tests
  // separately prove their source bytes and real packed coordinates.
  const images=data.objects.map(object=>({objectId:object.id,sourceSizePx:object.sourceSizePx,atlasRectPx:[0,0,...object.sourceSizePx]}));
  const atlas={sizePx:[2048,2048],byObjectId:map01AtlasLookup(images)};
  let previous:Float32Array|null=null,sawNegativeOffsetOnRightArm=false;
  for(const distance of [45000,54000,1930*150,3910*150,4284*150]){
    buildSourceRoad(data,distance,0,16/9);const result=buildMap01ArtProps(data,1280,16/9,atlas);
    expect(result.positions!.length).toBe(MAP01_PROP_CAPACITY*12);
    expect(result.indices!.length).toBe(MAP01_PROP_CAPACITY*6);
    expect(result.positions!.every(Number.isFinite)).toBe(true);
    expect(result.uvs!.every(Number.isFinite)).toBe(true);
    expect(map01ArtStats.visited).toBeLessThanOrEqual(138);
    expect(map01ArtStats.drawn).toBeLessThanOrEqual(MAP01_PROP_CAPACITY);
    let previousSegment=Infinity,previousSlot=-1;
    for(let q=0;q<map01ArtStats.drawn;q++){
      const placement=data.placements.find(item=>item.id===map01PropSamples.placementId[q])!;
      expect(placement.segment<=previousSegment).toBe(true);
      if(placement.segment===previousSegment)expect(placement.slot>previousSlot).toBe(true);
      previousSegment=placement.segment;previousSlot=placement.slot;
      expect(map01PropSamples.fraction[q]!>0&&map01PropSamples.fraction[q]!<=1).toBe(true);
      const definition=data.definitions[placement.definition]!,object=data.objects[definition.objectId-1]!;
      // Line.cpp source destH, converted from1280×720 screen pixels to Y-up.
      const expectedHeight=object.sourceSizePx[1]!*(.5773502691896257/(placement.segment*150-distance))*640*(.3/170*1600)*3.43*object.scale/360;
      expect(map01PropSamples.fullHeight[q]).toBeCloseTo(expectedHeight,4);
      const n=placement.segment-Math.floor(distance/150),s=sourceProjectionBuffers.scale[n]!;
      const center=(definition.side?sourceProjectionBuffers.right[n]!:sourceProjectionBuffers.left[n]!)+definition.offsetX*1600*(16/9)*s;
      const width=object.sourceSizePx[0]!*s*(16/9)*(.3/170*1600)*object.scale*3.2;
      const pivot=definition.offsetX>=0?object.pivotRight:object.pivotLeft;
      expect(result.positions![q*12]).toBeCloseTo(center-pivot[0]!*width,4);
      if(definition.side&&definition.offsetX<0)sawNegativeOffsetOnRightArm=true;
    }
    if(previous!==null)expect(result.positions===previous).toBe(true);previous=result.positions!;
  }
  expect(sawNegativeOffsetOnRightArm).toBe(true);
  expect(data.placements.length).toBe(1475);expect(sourceProjectionStats.playerSampleZ).toBe(4284*150+702);
});
worldTest('environment.art missing imported source IDs fail instead of silently dropping placements',()=>{
  const data=loadMap01();buildSourceRoad(data,45000,0,16/9);
  let failed=false;try{buildMap01ArtProps(data,1280,16/9,{sizePx:[1024,1024],byObjectId:[]});}catch{failed=true;}
  expect(failed).toBe(true);
});
worldTest('environment.panorama wraps negative and many-cycle offsets without changing screen density',()=>{
  for(const width of [1536,2048])for(const offset of [-width*1000-1,-1,0,width-1,width*1000+71]){
    const phase=wrapMap01Texels(offset,width);
    expect(phase>=0&&phase<width).toBe(true);
    expect(wrapMap01Texels(offset+width*4,width)).toBe(phase);
    const first=buildMap01Panorama(width===1536?0:1,16/9,-.4,offset,[width,256]);
    expect(first.positions!.every(Number.isFinite)).toBe(true);
    expect(first.positions![1]).toBeCloseTo(-.4,5);
    expect(first.positions![7]!-first.positions![1]!).toBeCloseTo(253*2/720,5);
    expect(first.uvs![2]!-first.uvs![0]!).toBeCloseTo(1280/width,5);
  }
});
worldTest('environment.panorama parallax requires motion playing and a nonmirrored player line',()=>{
  expect(advanceMap01Parallax(1000,3,150,150,0,false,true)).toBe(1006);
  expect(advanceMap01Parallax(1000,3,150,150,1,false,true)).toBe(1007.5);
  expect(advanceMap01Parallax(1000,3,150,150,0,true,true)).toBe(1000);
  expect(advanceMap01Parallax(1000,3,150,150,1,false,false)).toBe(1000);
  expect(advanceMap01Parallax(1000,3,0,150,1,false,true)).toBe(1000);
});
