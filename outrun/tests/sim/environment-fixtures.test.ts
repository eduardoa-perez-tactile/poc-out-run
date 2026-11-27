import {worldTest,expect} from '@gameengine/test';
import {assets} from '@gameengine/runtime';
import type {ReadonlySourceBiomeData} from '../../src/schema.gen.ts';
import {loadSourceBiome,type SourceBiomeId} from '../../src/content/biome.ts';
import type {EnvironmentArtManifest} from '../../src/content/environments/environment-art.ts';
import {createEnvironmentTrafficFixture} from '../../src/render/environment-fixtures.ts';
import {createEnvironmentBuffers} from '../../src/render/environment-buffers.ts';
const SCENE={scene:'scenes/map01-data.scene.json'};
function prime(id:Exclude<SourceBiomeId,1>){
  // Test callback is outside SIM/LateUpdate. Public data request + prime is
  // explicit; no deferred frame read is used to manufacture art readiness.
  assets.load(id===16?'biome-goal-data':`biome-map${String(id).padStart(2,'0')}-data`);
  return loadSourceBiome(id);
}
function metadataOnly(data:ReadonlySourceBiomeData):EnvironmentArtManifest{
  const panorama={sourcePath:'geometry-fixture',image:'geometry-fixture',sizePx:[2048,256] as const,sha256:'geometry-fixture',sourceProbe:{kind:'opaque' as const,pixelPx:[0,0] as const,rgba:[255,255,255,255] as const}};
  return {assetId:'geometry-fixture',mapId:data.id as Exclude<SourceBiomeId,1>,sourceCommit:data.sourceCommit,
    pages:[0,1].map(i=>({image:`geometry-page-${i}`,sizePx:[1024,1280] as const,extrudePx:2 as const,sha256:'geometry-fixture'})),
    images:data.objects.map(o=>({objectId:o.id,sourcePath:o.sourcePath,image:'geometry-fixture',sourceSizePx:[o.sourceSizePx[0]!,o.sourceSizePx[1]!] as const,sha256:o.sha256,page:(o.id%2) as 0|1,atlasRectPx:[2,2,o.sourceSizePx[0]!,o.sourceSizePx[1]!] as const,sourceProbe:panorama.sourceProbe})),back:panorama,front:panorama};
}
function rejects(fn:()=>unknown){let error='';try{fn();}catch(value){error=String(value);}expect(error.length).toBeGreaterThan(0);}

worldTest('environment.fixture Map4 authentic dense view projects all32 controlled art snapshots',()=>{
  const data=prime(4),before=JSON.stringify(data),fixture=createEnvironmentTrafficFixture(),renderer=createEnvironmentBuffers();
  const poses=fixture.sample(data,30450,32),poseCopy=JSON.stringify(poses);
  renderer.build(data,{cameraOriginZ:30450,lateral:0,viewWidth:1280,aspect:16/9},metadataOnly(data),poses);
  expect(renderer.stats.queriedWindow).toBe(1000);expect(renderer.stats.sourceEligible).toBe(980);
  expect(renderer.stats.trafficSelected).toBe(32);expect(renderer.stats.trafficVisible).toBe(32);expect(renderer.stats.trafficHidden).toBe(0);
  expect(renderer.stats.props).toBeGreaterThan(0);
  let cars=0;
  for(let q=0;q<renderer.stats.total;q++)if(renderer.samples.kind[q]===2){cars++;expect(renderer.samples.frame[q]).toBeGreaterThan(0);}
  expect(cars).toBe(32);expect(JSON.stringify(poses)).toBe(poseCopy);expect(JSON.stringify(data)).toBe(before);
},SCENE);

worldTest('environment.fixture fixed scratch identities and poses have no animation clock or cumulative motion',()=>{
  const data=prime(4),fixture=createEnvironmentTrafficFixture(),first=fixture.sample(data,30450,32),objects=first.slice(),initial=JSON.stringify(first);
  for(let i=0;i<10;i++){
    const next=fixture.sample(data,30450,32);expect(next===first).toBe(true);expect(JSON.stringify(next)).toBe(initial);
    for(let slot=0;slot<32;slot++){
      const p=next[slot]!;expect(p===objects[slot]).toBe(true);expect(p.slot).toBe(slot);expect(p.modelId).toBe(slot+1);
      expect(p.z).toBe(30450+(20+slot*3+.5)*150);expect(p.side).toBe(slot%2);expect(p.offset).toBe((slot%3-1)*.5);expect(p.motionTicks).toBe(slot%6);
    }
  }
  expect(fixture.sample(data,40000,9)===first).toBe(true);expect(first.length).toBe(9);
  const restored=fixture.sample(data,30450,32);expect(restored===first).toBe(true);
  for(let slot=0;slot<32;slot++)expect(restored[slot]===objects[slot]).toBe(true);
  expect(JSON.stringify(restored)).toBe(initial);
  expect(fixture.sample(data,30450,0)===first).toBe(true);expect(first.length).toBe(0);
},SCENE);

worldTest('environment.fixture source camera clamp keeps all slots bounded at every real destination end',()=>{
  const fixture=createEnvironmentTrafficFixture();
  for(let id=2;id<=16;id++){
    const data=prime(id as Exclude<SourceBiomeId,1>),end=(data.totalCount-200)*150;
    for(const camera of [-100,0,end,end+100000]){
      const poses=fixture.sample(data,camera,32),clamped=Math.max(0,Math.min(end,camera));
      expect(poses[0]!.z).toBe(clamped+20.5*150);expect(poses[31]!.z).toBe(clamped+113.5*150);
      expect(poses.every(p=>p.z>=0&&p.z<data.totalCount*150)).toBe(true);
    }
  }
},SCENE);

worldTest('environment.fixture invalid count camera and source geometry fail without producing fake cars',()=>{
  const data=prime(4),fixture=createEnvironmentTrafficFixture();
  for(const count of [-1,.5,33,NaN,Infinity])rejects(()=>fixture.sample(data,30450,count));
  for(const camera of [NaN,Infinity,-Infinity])rejects(()=>fixture.sample(data,camera,32));
  rejects(()=>fixture.sample({...data,id:1},30450,32));
  rejects(()=>fixture.sample({...data,totalCount:199},30450,32));
  rejects(()=>fixture.sample({...data,segmentLength:0},30450,32));
},SCENE);
