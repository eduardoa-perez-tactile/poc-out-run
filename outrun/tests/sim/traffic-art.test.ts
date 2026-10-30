import {worldTest,expect} from '@gameengine/test';
import type {ReadonlySourceBiomeData} from '../../src/schema.gen.ts';
import {loadMap01} from '../../src/content/biome.ts';
import {TRAFFIC_SOURCE} from '../../src/content/vehicles/traffic-source.manifest.ts';
import {createEmptyTrafficPool} from '../../src/sim/traffic-math.ts';
import {buildSourceRoad,sourceProjectionBuffers,sourceProjectionStats} from '../../src/render/source-projection.ts';
import {map01AtlasLookup,buildMap01ArtProps,map01ArtStats,map01PropSamples} from '../../src/render/map01-art-buffers.ts';
import {trafficSourceFrame,trafficProjection} from '../../src/render/traffic-sprites.ts';
import {buildTrafficComposite,trafficCompositeStats,trafficCompositeSamples,TRAFFIC_COMPOSITE_BYTES} from '../../src/render/traffic-buffers.ts';

function flat():ReadonlySourceBiomeData{
  const data=loadMap01();return{...data,totalCount:1000,lastLine:900,placements:[],definitions:[],objects:[],objectOffsets:Array(1001).fill(0),
    segments:Array.from({length:1000},()=>({y0:0,y1:0,curve:0,gap:0,mirror:false,light:0}))};
}
function atlasFor(data:ReadonlySourceBiomeData){return{sizePx:[2048,2048],byObjectId:map01AtlasLookup(data.objects.map(object=>({objectId:object.id,sourceSizePx:object.sourceSizePx,atlasRectPx:[0,0,...object.sourceSizePx]})))};}

worldTest('traffic.art source semantic pairs use canonical perspective elevation and movement phase',()=>{
  const data=flat(),z=50000,segment=Math.floor(z/150),rows=[...data.segments];
  for(const [y0,y1,rightClose,leftClose,rightFar,leftFar] of [[0,0,1,3,13,15],[0,1,5,7,5,7],[1,0,9,11,9,11]] as const){
    rows[segment]={...rows[segment]!,y0,y1};const track={...data,segments:rows};
    for(const phase of [0,1,2,3,4,5]){
      const second=phase>=3?1:0;
      expect(trafficSourceFrame(track,z,0,0,z,0,phase)).toBe(rightClose+second);
      expect(trafficSourceFrame(track,z,.5,0,z,0,phase)).toBe(leftClose+second);
      expect(trafficSourceFrame(track,z,0,0,z-21*150,0,phase)).toBe(rightFar+second);
      expect(trafficSourceFrame(track,z,.5,0,z-21*150,0,phase)).toBe(leftFar+second);
    }
  }
  rows[segment]={...rows[segment]!,y0:.1,y1:.9,gap:5000};const split={...data,segments:rows};
  expect(trafficSourceFrame(split,z,0,1,z,0,0)).toBe(15); // Own-gap X, not overlapping screen arms.
  expect(trafficSourceFrame(split,z,1.25,0,z-20*150,0,0)).toBe(3); // Inclusive2000 and20segments.
  expect(trafficSourceFrame(split,z,1.25001,0,z,0,0)).toBe(15);
  expect(trafficSourceFrame(split,z,0,0,z,0,0)).toBe(1); // Truncated equal elevation, equalX RIGHT.
  for(let id=1;id<=32;id++)for(let frame=1;frame<=16;frame++){
    const model=TRAFFIC_SOURCE.models[id-1]!,image=model.frames[frame-1]!;
    expect(model.id).toBe(id);expect(image.sourceFrame).toBe(frame);
    expect(image.groundAnchorPx).toEqual([image.sourceSizePx[0]/2,image.sourceSizePx[1]]);
    expect(model.scale).toBe(id%6===1&&id<=25?.9:1.3);
  }
});

worldTest('traffic.art fractional projection preserves source scale anchor far endpoint and crest UV crop',()=>{
  const data=flat(),aspect=16/9,image=TRAFFIC_SOURCE.models[0]!.frames[0]!;
  buildSourceRoad(data,45000,0,aspect);
  const z=50025,n=Math.floor(z/150)-300,t=z/150-Math.floor(z/150);
  const result=trafficProjection(data,z,.25,0,image,.9,aspect,TRAFFIC_SOURCE.atlas.sizePx)!;
  expect(result!==null).toBe(true);
  const s=sourceProjectionBuffers.scale[n]!+(sourceProjectionBuffers.farScale[n]!-sourceProjectionBuffers.scale[n]!)*t;
  const height=image.sourceSizePx[1]*s*aspect*(.3/170*1600)*.9*3.43;
  const ground=sourceProjectionBuffers.ground[n]!+(sourceProjectionBuffers.farGround[n]!-sourceProjectionBuffers.ground[n]!)*t;
  expect(result.height).toBeCloseTo(height,8);expect(result.bottom).toBeCloseTo(ground,8);
  expect((result.left+result.right)/2).toBeCloseTo(.25*1600*aspect*s,8);
  sourceProjectionBuffers.clip[n]=ground+height*.25;
  const cropped=trafficProjection(data,z,.25,0,image,.9,aspect,TRAFFIC_SOURCE.atlas.sizePx)!;
  expect(cropped.fraction).toBeCloseTo(.75,5);
  expect(cropped.top-cropped.bottom).toBeCloseTo(height*.75,6);
  expect(cropped.v1-cropped.v0).toBeCloseTo(image.sourceSizePx[1]*.75/2048,6);
  expect(trafficProjection(data,sourceProjectionStats.playerSampleZ-.01,0,0,image,.9,aspect,TRAFFIC_SOURCE.atlas.sizePx)).toBe(null);
  buildSourceRoad(data,45000,0,aspect);
  expect(trafficProjection(data,(300+199.75)*150,0,0,image,.9,aspect,TRAFFIC_SOURCE.atlas.sizePx)!==null).toBe(true);
  // A row's own far endpoint wins over the next row's near center at mirror seams.
  const splitN=40;sourceProjectionBuffers.right[splitN]=.2;sourceProjectionBuffers.farRight[splitN]=.4;
  sourceProjectionBuffers.right[splitN+1]=99;
  const seam=trafficProjection(data,(300+splitN+.5)*150,0,1,image,.9,aspect,TRAFFIC_SOURCE.atlas.sizePx)!;
  expect((seam.left+seam.right)/2).toBeCloseTo(.3,6);
});

worldTest('traffic.art composite is fixed capacity stable far segment order and leaves simulation untouched',()=>{
  const data=loadMap01(),atlas=atlasFor(data),aspect=16/9,pool=createEmptyTrafficPool();
  pool.initialized=true;pool.population=32;
  for(let slot=0;slot<32;slot++){
    pool.active[slot]=1;pool.generation[slot]=1;pool.motionTicks[slot]=slot%6;
    pool.z[slot]=pool.previousZ[slot]=50000+Math.floor(slot/4)*150;
    pool.offset[slot]=pool.previousOffset[slot]=(slot%4-1.5)*.3;
  }
  const before=JSON.stringify(pool);
  buildSourceRoad(data,45000,0,aspect);
  const original=buildMap01ArtProps(data,1280,aspect,atlas),count=map01ArtStats.drawn;
  const expected=Array.from({length:count},(_,q)=>({positions:Array.from(original.positions.subarray(q*12,q*12+12)),uvs:Array.from(original.uvs!.subarray(q*8,q*8+8)),segment:map01PropSamples.segment[q]}));
  const result=buildTrafficComposite(data,1280,aspect,atlas,pool,.5,true);
  expect(trafficCompositeStats.visible).toBe(32);expect(trafficCompositeStats.props).toBe(count);
  expect(result.positions.length).toBe(288*12);expect(result.uvs1!.length).toBe(288*8);
  expect(result.positions.byteLength+result.normals!.byteLength+result.tangents!.byteLength+result.uvs!.byteLength+result.uvs1!.byteLength+result.colors!.byteLength+result.indices!.byteLength).toBe(TRAFFIC_COMPOSITE_BYTES);
  let prop=0,previous=Infinity,lastKind=0,lastSlot=-1;
  for(let q=0;q<trafficCompositeStats.total;q++){
    const segment=trafficCompositeSamples.segment[q]!,kind=trafficCompositeSamples.kind[q]!,slot=trafficCompositeSamples.slot[q]!;
    expect(segment).toBeLessThanOrEqual(previous);
    if(segment!==previous){lastKind=0;lastSlot=-1;}else expect(kind).toBeGreaterThanOrEqual(lastKind);
    if(kind){expect(slot).toBeGreaterThan(lastSlot);lastSlot=slot;}
    else{expect(Array.from(result.positions.subarray(q*12,q*12+12))).toEqual(expected[prop]!.positions);expect(Array.from(result.uvs!.subarray(q*8,q*8+8))).toEqual(expected[prop]!.uvs);prop++;}
    for(let vertex=0;vertex<4;vertex++){expect(result.uvs1![q*8+vertex*2]).toBe(kind);expect(result.uvs1![q*8+vertex*2+1]).toBe(0);expect(result.colors![q*16+vertex*4+3]).toBe(255);}
    previous=segment;lastKind=kind;
  }
  expect(prop).toBe(count);expect(JSON.stringify(pool)).toBe(before);
  expect(result.indices!.subarray(trafficCompositeStats.total*6).every(index=>index===0)).toBe(true);
  const stable=buildTrafficComposite(data,1280,aspect,atlas,pool,.5,true);expect(stable.positions===result.positions).toBe(true);
});

worldTest('traffic.art full composite capacity emits 256 props and 32 cars without truncation',()=>{
  const source=loadMap01(),base=flat(),placements=Array.from({length:256},(_,id)=>({id,segment:330+Math.floor(id/2),slot:id%2,definition:id%2}));
  const offsets=Array(1001).fill(0);for(const placement of placements)offsets[placement.segment+1]++;
  for(let i=1;i<offsets.length;i++)offsets[i]+=offsets[i-1];
  const data:ReadonlySourceBiomeData={...base,placements,objectOffsets:offsets,
    objects:[{...source.objects[0]!,id:1,sourceSizePx:[2,2],scale:.1,pivotLeft:[.5,1],pivotRight:[.5,1]}],
    definitions:[0,1].map(id=>({...source.definitions[0]!,id,objectId:1,offsetX:id?.25:-.25,offsetY:0,viewportYFactor:0,side:false}))};
  const pool=createEmptyTrafficPool();pool.initialized=true;pool.population=32;
  for(let slot=0;slot<32;slot++){
    pool.active[slot]=1;pool.generation[slot]=1;pool.z[slot]=pool.previousZ[slot]=52000+slot*30;
    pool.offset[slot]=pool.previousOffset[slot]=(slot%4-1.5)*.3;
  }
  buildSourceRoad(data,45000,0,16/9);
  const buffers=buildTrafficComposite(data,1280,16/9,{sizePx:[1024,1024],byObjectId:map01AtlasLookup([{objectId:1,sourceSizePx:[2,2],atlasRectPx:[2,2,2,2]}])},pool,1,true);
  expect(trafficCompositeStats.props).toBe(256);expect(trafficCompositeStats.visible).toBe(32);expect(trafficCompositeStats.total).toBe(288);
  expect(buffers.indices![288*6-1]).toBe(288*4-1);
});
