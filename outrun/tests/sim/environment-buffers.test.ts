import {worldTest,expect} from '@gameengine/test';
import type {ReadonlySourceBiomeData} from '../../src/schema.gen.ts';
import {loadSourceBiome,type SourceBiomeId} from '../../src/content/biome.ts';
import type {EnvironmentArtManifest} from '../../src/content/environments/environment-art.ts';
import {createEnvironmentBuffers,ENVIRONMENT_BYTES,type EnvironmentTrafficSnapshot} from '../../src/render/environment-buffers.ts';
import {sourceProjectionBuffers,sourceProjectionStats} from '../../src/render/source-projection.ts';
import {TRAFFIC_SOURCE} from '../../src/content/vehicles/traffic-source.manifest.ts';
const SCENE={scene:'scenes/map01-data.scene.json'};
const VIEW={cameraOriginZ:45000,lateral:0,viewWidth:1280,aspect:16/9};
// Metadata-only UV selector fixture, not packed art or a GPU/source-pixel claim.
// Full actual source dimensions/provenance stay intact; overlapping rectangles
// deliberately isolate geometry from the independent importer/packing tests.
function manifest(data:ReadonlySourceBiomeData):EnvironmentArtManifest{
  const panorama={sourcePath:'fixture',image:'fixture',sizePx:[2048,256] as const,sha256:'fixture',sourceProbe:{kind:'opaque' as const,pixelPx:[0,0] as const,rgba:[255,255,255,255] as const}};
  return {assetId:'geometry-only',mapId:data.id as Exclude<SourceBiomeId,1>,sourceCommit:data.sourceCommit,
    pages:[0,1].map(i=>({image:`fixture-${i}`,sizePx:[1024,1280] as const,extrudePx:2 as const,sha256:'fixture'})),
    images:data.objects.map(o=>({objectId:o.id,sourcePath:o.sourcePath,image:'fixture',sourceSizePx:[o.sourceSizePx[0]!,o.sourceSizePx[1]!] as const,sha256:o.sha256,page:(o.id%2) as 0|1,
      atlasRectPx:[2,2,o.sourceSizePx[0]!,o.sourceSizePx[1]!] as const,sourceProbe:panorama.sourceProbe})),back:panorama,front:panorama};
}
function bytes(arrays:ReturnType<ReturnType<typeof createEnvironmentBuffers>['build']>){return arrays.positions.byteLength+arrays.normals!.byteLength+arrays.tangents!.byteLength+arrays.uvs!.byteLength+arrays.uvs1!.byteLength+arrays.colors!.byteLength+arrays.indices!.byteLength;}
function rejected(fn:()=>unknown){let failed=false;try{fn();}catch{failed=true;}expect(failed).toBe(true);}

worldTest('environment.geometry actual destination data reuse fixed storage and preserve source inputs',()=>{
  const renderer=createEnvironmentBuffers();let previous:Float32Array|undefined;
  for(let id=2;id<=16;id++){
    const data=loadSourceBiome(id as SourceBiomeId),art=manifest(data),before=JSON.stringify(data);let emitted=0;
    for(const camera of [30450,100000,data.authoredCount*150]){
      const mesh=renderer.build(data,{...VIEW,cameraOriginZ:camera},art,[]);
      expect(bytes(mesh)).toBe(ENVIRONMENT_BYTES);expect(bytes(mesh)).toBe(260064);
      expect(mesh.positions.length).toBe(1032*12);expect(mesh.uvs1!.length).toBe(1032*8);
      expect(mesh.positions.every(Number.isFinite)).toBe(true);expect(mesh.uvs!.every(Number.isFinite)).toBe(true);
      if(previous)expect(mesh.positions===previous).toBe(true);previous=mesh.positions;
      expect(renderer.stats.queriedWindow).toBeLessThanOrEqual(1000);
      expect(renderer.stats.visited).toBeLessThanOrEqual(renderer.stats.sourceEligible);
      expect(renderer.stats.props+renderer.stats.hidden+renderer.stats.outside).toBe(renderer.stats.visited);
      expect(renderer.stats.total).toBe(renderer.stats.props);expect(renderer.stats.roadQuads).toBeGreaterThan(0);
      emitted+=renderer.stats.props;
      expect(mesh.indices!.subarray(renderer.stats.total*6).every(v=>v===0)).toBe(true);
    }
    expect(emitted).toBeGreaterThan(0);expect(JSON.stringify(data)).toBe(before);
  }
},SCENE);

worldTest('environment.geometry Map4 real1000 window distinguishes near exclusion from projection and draw',()=>{
  const data=loadSourceBiome(4),art=manifest(data),renderer=createEnvironmentBuffers();
  // First actual full-five-slot source window begins row203; not synthetic props.
  for(const fraction of [0,149.999]){
    renderer.build(data,{...VIEW,cameraOriginZ:30450+fraction},art,[]);
    expect(renderer.stats.queriedWindow).toBe(1000);
    expect(renderer.stats.sourceEligible).toBe(fraction===0?980:975);
    expect(renderer.stats.visited).toBeLessThanOrEqual(renderer.stats.sourceEligible);
    expect(renderer.stats.props).toBeGreaterThan(0);
    expect(renderer.stats.props+renderer.stats.hidden+renderer.stats.outside).toBe(renderer.stats.visited);
  }
},SCENE);

worldTest('environment.geometry unsorted32 controlled traffic use stable slots and source global page order',()=>{
  const data=loadSourceBiome(2),art=manifest(data),renderer=createEnvironmentBuffers();
  const traffic:EnvironmentTrafficSnapshot[]=Array.from({length:32},(_,i)=>({slot:31-i,modelId:32-i,z:50000+Math.floor((31-i)/4)*150,offset:((31-i)%4-1.5)*.3,side:0,motionTicks:(31-i)%6}));
  const before=JSON.stringify(traffic),mesh=renderer.build(data,VIEW,art,traffic);
  expect(renderer.stats.trafficVisible).toBe(32);expect(renderer.stats.trafficSelected).toBe(32);
  let previous=Infinity,lastSlot=-1,seenTraffic=false;
  for(let q=0;q<renderer.stats.total;q++){
    const row=renderer.samples.segment[q]!,kind=renderer.samples.kind[q]!,slot=renderer.samples.slot[q]!;
    expect(row).toBeLessThanOrEqual(previous);
    if(row!==previous){lastSlot=-1;seenTraffic=false;}
    if(kind===2){expect(slot).toBeGreaterThan(lastSlot);lastSlot=slot;seenTraffic=true;expect(renderer.samples.frame[q]).toBeGreaterThan(0);}
    else{
      expect(seenTraffic).toBe(false);expect(kind).toBe(renderer.samples.objectId[q]!%2);
      expect(renderer.samples.placementId[q]!>=row*5&&renderer.samples.placementId[q]!<row*5+5).toBe(true);
    }
    for(let v=0;v<4;v++){
      expect(mesh.uvs1![q*8+v*2]).toBe(kind);expect(mesh.uvs1![q*8+v*2+1]).toBe(0);
      for(let c=0;c<4;c++)expect(mesh.colors![q*16+v*4+c]).toBe(255);
    }
    previous=row;
  }
  expect(JSON.stringify(traffic)).toBe(before);
  const copy=Array.from(mesh.positions);renderer.build(data,VIEW,art,traffic.slice().reverse());expect(Array.from(mesh.positions)).toEqual(copy);
},SCENE);

worldTest('environment.geometry page selectors retain source slot ordering instead of atlas sorting',()=>{
  const data=loadSourceBiome(10),art=manifest(data),renderer=createEnvironmentBuffers();let page01=false,page10=false;
  for(const camera of [45000,100000,169350,250000]){
    renderer.build(data,{...VIEW,cameraOriginZ:camera},art,[]);
    for(let q=1;q<renderer.stats.total;q++){
      const prior=renderer.samples.kind[q-1]!,kind=renderer.samples.kind[q]!;
      if(prior===0&&kind===1)page01=true;if(prior===1&&kind===0)page10=true;
      if(renderer.samples.segment[q]===renderer.samples.segment[q-1])expect(renderer.samples.placementId[q]!).toBeGreaterThan(renderer.samples.placementId[q-1]!);
    }
  }
  expect(page01).toBe(true);expect(page10).toBe(true);
},SCENE);

worldTest('environment.geometry fractional far traffic consumes its exact201st endpoint and source UV scale',()=>{
  const data=loadSourceBiome(2),renderer=createEnvironmentBuffers(),art=manifest(data),aspect=16/9;
  const z=199.75*150,traffic=[{slot:0,modelId:1,z,offset:.25,side:0,motionTicks:0}];
  const mesh=renderer.build(data,{...VIEW,cameraOriginZ:0},art,traffic);
  expect(renderer.stats.trafficVisible).toBe(1);
  const q=renderer.samples.kind.indexOf(2);expect(q>=0).toBe(true);expect(renderer.samples.segment[q]).toBe(199);
  const b=sourceProjectionBuffers,t=.75,s=b.scale[199]!+(b.farScale[199]!-b.scale[199]!)*t;
  const image=TRAFFIC_SOURCE.models[0]!.frames[renderer.samples.frame[q]!-1]!,model=TRAFFIC_SOURCE.models[0]!;
  const height=image.sourceSizePx[1]*s*aspect*(.3/170*1600)*model.scale*3.43;
  const center=b.left[199]!+(b.farLeft[199]!-b.left[199]!)*t+.25*1600*aspect*s;
  expect((mesh.positions[q*12]!+mesh.positions[q*12+3]!)/2).toBeCloseTo(center,6);
  expect(renderer.samples.fullHeight[q]).toBeCloseTo(height,6);
  expect(renderer.samples.fraction[q]).toBe(1);
  expect(mesh.uvs![q*8+1]!-mesh.uvs![q*8+5]!).toBeCloseTo(image.sourceSizePx[1]/TRAFFIC_SOURCE.atlas.sizePx[1],6);
  expect(sourceProjectionStats.playerSampleZ).toBe(702);
},SCENE);

worldTest('environment.geometry actual hills and fork arms preserve crest crop and mirrored road samples',()=>{
  const renderer=createEnvironmentBuffers();let partial=false;
  for(const id of [2,3,6,10] as const){
    const data=loadSourceBiome(id),art=manifest(data);
    for(const camera of [1435*150,1870*150,2900*150,data.authoredCount*150,(data.swapLine+1)*150-702]){
      for(const lateral of [0,8]){
        const mesh=renderer.build(data,{...VIEW,cameraOriginZ:camera,lateral},art,[]);
        for(let q=0;q<renderer.stats.total;q++){
          const row=renderer.samples.segment[q]!,fraction=renderer.samples.fraction[q]!;
          if(fraction>0&&fraction<1){
            partial=true;const object=data.objects[renderer.samples.objectId[q]!-1]!;
            expect(mesh.uvs![q*8+1]!-mesh.uvs![q*8+5]!).toBeCloseTo(object.sourceSizePx[1]!*fraction/1280,5);
            expect(mesh.positions[q*12+7]!-mesh.positions[q*12+1]!).toBeCloseTo(renderer.samples.fullHeight[q]!*fraction,5);
          }
        }
      }
    }
  }
  // Authored sprite records stop before the appended mirror fork: requiring
  // a mirrored PROP would invent content. Verify both real road arms and two
  // controlled cars against the actual mirrored tail instead.
  const data=loadSourceBiome(2),camera=data.authoredCount*150;
  const mesh=renderer.build(data,{...VIEW,cameraOriginZ:camera},manifest(data),[
    {slot:0,modelId:1,z:camera+40.5*150,offset:0,side:0,motionTicks:0},
    {slot:1,modelId:1,z:camera+40.5*150,offset:0,side:1,motionTicks:0},
  ]);
  expect(renderer.stats.trafficVisible).toBe(2);
  for(const n of [40,199]){
    expect(data.segments[data.authoredCount+n]!.mirror).toBe(true);
    expect(Math.abs(sourceProjectionBuffers.left[n]!)).toBeGreaterThan(.001);
    expect(sourceProjectionBuffers.left[n]!+sourceProjectionBuffers.right[n]!).toBeCloseTo(sourceProjectionStats.playerGap*VIEW.aspect*sourceProjectionBuffers.scale[n]!,6);
    expect(sourceProjectionBuffers.farLeft[n]!+sourceProjectionBuffers.farRight[n]!).toBeCloseTo(sourceProjectionStats.playerGap*VIEW.aspect*sourceProjectionBuffers.farScale[n]!,6);
  }
  expect(mesh.positions.every(Number.isFinite)).toBe(true);
  console.log('ENVIRONMENT_GEOMETRY_CREST '+JSON.stringify({partial,mirrorTraffic:renderer.stats.trafficVisible}));
  expect(partial).toBe(true);
},SCENE);

worldTest('environment.geometry invalid source manifest and controlled snapshots reject visibly',()=>{
  const data=loadSourceBiome(2),art=manifest(data);
  const build=(d:ReadonlySourceBiomeData,m:EnvironmentArtManifest,t:readonly EnvironmentTrafficSnapshot[]=[])=>createEnvironmentBuffers().build(d,VIEW,m,t);
  rejected(()=>build(loadSourceBiome(1),art));
  rejected(()=>build(data,{...art,mapId:3}));rejected(()=>build(data,{...art,sourceCommit:'bad'}));
  rejected(()=>build(data,{...art,pages:[]}));
  rejected(()=>build(data,{...art,images:art.images.slice(1)}));
  for(const replacement of [{...art.images[0]!,objectId:256},{...art.images[0]!,sourcePath:'bad'}, {...art.images[0]!,sha256:'bad'}, {...art.images[0]!,sourceSizePx:[1,1] as const}, {...art.images[0]!,atlasRectPx:[0,0,40,128] as const}]){
    rejected(()=>build(data,{...art,images:[replacement,...art.images.slice(1)]}));
  }
  const one={slot:0,modelId:1,z:50000,offset:0,side:0,motionTicks:0};
  rejected(()=>build(data,art,[one,one]));rejected(()=>build(data,art,[{...one,slot:32}]));
  rejected(()=>build(data,art,[{...one,modelId:33}]));rejected(()=>build(data,art,[{...one,z:NaN}]));
  rejected(()=>build(data,art,[{...one,side:2}]));rejected(()=>build(data,art,[{...one,motionTicks:-1}]));
  rejected(()=>build(data,art,Array(33).fill(one)));
  rejected(()=>createEnvironmentBuffers().build(data,{...VIEW,aspect:NaN},art,[]));
},SCENE);
