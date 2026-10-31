import {worldTest,expect} from '@gameengine/test';
import {assets,listData} from '@gameengine/runtime';
import {DrivingState,SourceBiome,SourceBiomeCatalog,type ReadonlySourceBiomeData} from '../../src/schema.gen.ts';
import {loadSourceBiome,loadSourceBiomeCatalog,type SourceBiomeId} from '../../src/content/biome.ts';

worldTest('content.catalog boot requests only Map1 and catalog before the first source step',async({world,step})=>{
  const groups=assets.stats().groups;
  expect(groups['biome-map01-data']?.status??'missing').toBe('loaded');
  expect(groups['biome-catalog-data']?.status??'missing').toBe('loaded');
  for(let id=2;id<=16;id++){
    const name=id===16?'biome-goal-data':`biome-map${String(id).padStart(2,'0')}-data`;
    expect(groups[name]?.status??'missing').toBe('unloaded');
  }
  expect(world.resource(DrivingState).distance).toBe(300000);
  await step(1);
  expect(world.resource(DrivingState).distance).toBeGreaterThan(300000);
  expect(Number.isFinite(world.resource(DrivingState).legacySpeed)).toBe(true);
},{scene:'scenes/driving-terrain.scene.json'});

const SCENE={scene:'scenes/map01-data.scene.json'};
// Count/header/palette literals come directly from the pinned original maps.
// Geometry fingerprints come from all C++ source rows plus ONLY the separately
// captured exact compatibility pairs (remaining-catalog-numeric.json).
// IEEE zero signs are normalized, matching the numeric oracle's value equality.
const cases=[{"authored":4420,"total":6380,"swap":4581,"last":6180,"checkpoint":202,"objects":48,"properties":46,"winners":20989,"density":1000,"id":4,"geometry":2102649180,"mapSha":"33793e5f988101a8d09166364c9578f0cc15534ad111eaefd86377d742f1cd3b","palette":[[0,0,255,255],[206,201,133,255],[239,234,167,255],[214,197,181,255],[222,206,189,255],[214,197,181,255],[222,206,189,255],[214,197,181,255],[222,206,189,255],[214,197,181,255],[222,206,189,255]],"time":160,"terrain":1,"roadTerrain":1,"definitions":97},{"authored":4220,"total":6180,"swap":4381,"last":5980,"checkpoint":202,"objects":53,"properties":41,"winners":9329,"density":660,"id":5,"geometry":156930700,"mapSha":"efa70b4a4694af25491627edcc74a490b7a1f115de86212eecf2c8c239108220","palette":[[0,90,255,255],[179,231,255,255],[230,247,255,255],[19,19,19,255],[17,17,17,255],[19,19,19,255],[246,246,246,255],[19,19,19,255],[246,246,246,255],[246,246,246,255],[19,19,19,255]],"time":160,"terrain":3,"roadTerrain":0,"definitions":118},{"authored":4190,"total":6150,"swap":4351,"last":5950,"checkpoint":202,"objects":51,"properties":44,"winners":2121,"density":120,"id":6,"geometry":1537036543,"mapSha":"cc98e434fc3552bb796bef7119b21aefadd2c3a19316548fa022f50eb3e8c2f0","palette":[[247,223,0,255],[230,158,0,255],[213,135,0,255],[68,68,68,255],[68,68,68,255],[67,35,32,255],[246,246,246,255],[68,68,68,255],[246,246,246,255],[246,246,246,255],[68,68,68,255]],"time":170,"terrain":1,"roadTerrain":0,"definitions":107},{"authored":4520,"total":6480,"swap":4681,"last":6280,"checkpoint":202,"objects":38,"properties":29,"winners":1832,"density":167,"id":7,"geometry":431569641,"mapSha":"7f415cdaddcfa09e169449afbcd39e5ba0dfa19ae10835a9fe903eb2b3664032","palette":[[118,66,253,255],[108,76,56,255],[102,67,48,255],[106,88,88,255],[101,82,82,255],[106,88,88,255],[246,246,246,255],[106,88,88,255],[246,246,246,255],[246,246,246,255],[101,82,82,255]],"time":165,"terrain":4,"roadTerrain":0,"definitions":137},{"authored":3930,"total":5890,"swap":4091,"last":5690,"checkpoint":202,"objects":35,"properties":29,"winners":7619,"density":416,"id":8,"geometry":1296142815,"mapSha":"4217aa4e18ee91607a40dde6fe411f7afe162cba9193ca2fb0d0e76157833e82","palette":[[248,192,96,255],[152,120,8,255],[144,112,0,255],[34,34,34,255],[34,34,34,255],[34,34,34,255],[246,246,246,255],[34,34,34,255],[246,246,246,255],[246,246,246,255],[34,34,34,255]],"time":180,"terrain":2,"roadTerrain":0,"definitions":64},{"authored":4250,"total":6210,"swap":4411,"last":6010,"checkpoint":202,"objects":33,"properties":27,"winners":4006,"density":327,"id":9,"geometry":2897522681,"mapSha":"c3b0f0714f61c8ea139681cf1505ac610bf3f622af9fe8f355e1f7f17c975734","palette":[[0,12,225,255],[0,0,102,255],[0,0,179,255],[0,0,26,255],[0,0,26,255],[0,0,26,255],[246,246,246,255],[0,0,26,255],[246,246,246,255],[246,246,246,255],[0,0,26,255]],"time":165,"terrain":2,"roadTerrain":0,"definitions":97},{"authored":4080,"total":6040,"swap":4241,"last":5840,"checkpoint":202,"objects":51,"properties":39,"winners":8365,"density":494,"id":10,"geometry":3606711344,"mapSha":"9278abe969160f9fcc5b6c73970a109180dd340edd57fb43599e449a6f34d6c6","palette":[[91,222,204,255],[23,176,0,255],[23,147,0,255],[148,96,40,255],[148,96,40,255],[5,1,0,255],[246,246,246,255],[148,96,40,255],[148,96,40,255],[246,246,246,255],[148,96,40,255]],"time":160,"terrain":2,"roadTerrain":4,"definitions":178},{"authored":4260,"total":6220,"swap":4421,"last":6020,"checkpoint":202,"objects":27,"properties":27,"winners":1801,"density":136,"id":11,"geometry":3676205849,"mapSha":"97a440d5736e0d99638c8641cc26f7c9ce06c0e0941e935aeef5e38475cb12d1","palette":[[192,192,176,255],[240,224,208,255],[248,232,216,255],[168,168,168,255],[160,160,160,255],[168,168,168,255],[246,246,246,255],[168,168,168,255],[246,246,246,255],[246,246,246,255],[160,160,160,255]],"time":165,"terrain":1,"roadTerrain":0,"definitions":95},{"authored":4300,"total":6260,"swap":4461,"last":6060,"checkpoint":202,"objects":41,"properties":32,"winners":8882,"density":460,"id":12,"geometry":1991503119,"mapSha":"6e79076e44e7630ce09e73f66fababaaeceede2e82577f174f9759033ddbcf35","palette":[[132,198,240,255],[206,201,133,255],[171,165,101,255],[68,66,32,255],[80,79,40,255],[245,138,0,255],[246,246,246,255],[68,66,32,255],[80,79,40,255],[246,246,246,255],[245,138,0,255]],"time":160,"terrain":1,"roadTerrain":4,"definitions":90},{"authored":4070,"total":6030,"swap":4231,"last":5830,"checkpoint":202,"objects":40,"properties":33,"winners":4297,"density":310,"id":13,"geometry":2103672557,"mapSha":"2b88b9eae2bb691fc0d0072b7c62eb9bb7d273e2b8f9ee4f80ceae9c710d3017","palette":[[255,195,94,255],[125,222,61,255],[94,187,63,255],[176,176,160,255],[160,160,144,255],[218,50,39,255],[246,246,246,255],[176,176,160,255],[246,246,246,255],[246,246,246,255],[218,50,39,255]],"time":165,"terrain":2,"roadTerrain":0,"definitions":94},{"authored":4720,"total":6680,"swap":4881,"last":6480,"checkpoint":203,"objects":41,"properties":30,"winners":3053,"density":276,"id":14,"geometry":105353275,"mapSha":"62949c0d3c9fec646d11513f156bf7e6a1a3fafc2fc726dfc2e39754b8e1b79c","palette":[[141,234,233,255],[0,170,98,255],[0,186,112,255],[115,112,115,255],[124,121,124,255],[115,112,115,255],[246,246,246,255],[115,112,115,255],[246,246,246,255],[246,246,246,255],[115,112,115,255]],"time":170,"terrain":2,"roadTerrain":0,"definitions":115},{"authored":4370,"total":6330,"swap":4531,"last":6130,"checkpoint":203,"objects":49,"properties":39,"winners":4107,"density":339,"id":15,"geometry":1741803976,"mapSha":"68dfbed09b5628459758503e069990a05a78de9274c965fb081932f17357ec6d","palette":[[240,176,176,255],[168,200,152,255],[160,192,144,255],[128,128,160,255],[136,136,168,255],[160,0,0,255],[246,246,246,255],[128,128,160,255],[246,246,246,255],[246,246,246,255],[160,0,0,255]],"time":160,"terrain":2,"roadTerrain":0,"definitions":118}] as const;
function geometryFingerprint(data:ReadonlySourceBiomeData):number {
  const view=new DataView(new ArrayBuffer(4));let hash=2166136261;
  for(const row of data.segments)for(const key of ['y0','y1','curve','gap'] as const){
    const value=row[key];view.setFloat32(0,value===0?0:value,true);
    for(let byte=0;byte<4;byte++)hash=Math.imul(hash^view.getUint8(byte),16777619)>>>0;
  }
  return hash;
}
function prefixes(data:ReadonlySourceBiomeData):void {
  expect(data.objectOffsets.length).toBe(data.totalCount+1);
  let cursor=0,previous=-1;
  for(let row=0;row<data.totalCount;row++){
    expect(data.objectOffsets[row]).toBe(cursor);
    while(cursor<data.placements.length&&data.placements[cursor]!.segment===row){
      const placement=data.placements[cursor++]!;
      expect(placement.id).toBe(row*5+placement.slot);expect(placement.id>previous).toBe(true);previous=placement.id;
      expect(placement.slot>=0&&placement.slot<5).toBe(true);
      expect(data.definitions[placement.definition]!.id).toBe(placement.definition);
    }
    const segment=data.segments[row]!;
    expect(Number.isFinite(segment.y0)&&Number.isFinite(segment.y1)&&Number.isFinite(segment.curve)&&Number.isFinite(segment.gap)).toBe(true);
    expect(segment.y0).toBe(row===0?0:data.segments[row-1]!.y1);
    expect(segment.light).toBe(Math.floor(row/3)%2);
  }
  expect(cursor).toBe(data.placements.length);expect(data.objectOffsets[data.totalCount]).toBe(cursor);
}
for(const oracle of cases)worldTest(`content.catalog map${oracle.id} source inventory geometry and complete prefixes`,()=>{
  const data=loadSourceBiome(oracle.id as SourceBiomeId);
  expect(data.id).toBe(oracle.id);expect(data.sourceCommit).toBe('6882721c99bc79365f815f68d389bf5078129e68');
  expect(data.profile).toBe('sourceCompatibility-original');expect(data.forkGradient).toBe(0);
  expect(data.sourceHashes[`Resources/Maps/MapLevels/Map${oracle.id}/map.txt`]).toBe(oracle.mapSha);
  expect([data.authoredCount,data.totalCount,data.swapLine,data.lastLine,data.checkpointLine]).toEqual([oracle.authored,oracle.total,oracle.swap,oracle.last,oracle.checkpoint]);
  expect([data.objects.length,data.objects.filter(o=>o.hasProperties).length,data.definitions.length,data.placements.length,data.maxWindowProps]).toEqual([oracle.objects,oracle.properties,oracle.definitions,oracle.winners,oracle.density]);
  expect([data.timeSeconds,data.terrain,data.roadTerrain]).toEqual([oracle.time,oracle.terrain,oracle.roadTerrain]);expect(data.palette).toEqual(oracle.palette);
  expect(data.candidatePlacements).toBe(data.placements.length+data.overwritten.length);
  expect(data.definitions.every(d=>d.kind==='authored'&&d.objectId>=1&&d.objectId<=oracle.objects&&d.sourceLine>0)).toBe(true);
  for(let i=0;i<data.objects.length;i++){
    const object=data.objects[i]!;expect(object.id).toBe(i+1);expect(object.sourcePath).toBe(`Resources/Maps/MapLevels/Map${oracle.id}/${i+1}.png`);
    expect(/^[0-9a-f]{64}$/.test(object.sha256)).toBe(true);expect(Object.isFrozen(object)).toBe(true);
    if(!object.hasProperties){expect(object.scale).toBe(1);expect(object.collisionWidthSourcePx).toBe(object.sourceSizePx[0]);expect(object.collisionPivotLeft).toEqual([.5,1]);}
  }
  expect(geometryFingerprint(data)).toBe(oracle.geometry);prefixes(data);
  expect(data.segments[oracle.authored+10]!.curve).toBe(-2);
  expect(data.segments[oracle.swap-1]!.mirror).toBe(true);
  expect(data.segments[data.totalCount-1]!.curve).toBe(0);
  expect(data.segments[data.totalCount-1]!.y1).toBe(data.segments[oracle.authored-1]!.y1);
  const checkpoint=data.placements.filter(p=>p.segment===oracle.checkpoint);
  expect(checkpoint.length>=2).toBe(true);
  expect(Object.isFrozen(data)&&Object.isFrozen(data.segments)&&Object.isFrozen(data.placements)).toBe(true);
  expect(loadSourceBiome(oracle.id as SourceBiomeId)===data).toBe(true);
},SCENE);

worldTest('content.catalog complete graph resolves all source paths and excludes start goal checkpoints',()=>{
  const catalog=loadSourceBiomeCatalog();
  const keys=['data/biomes/goal.json',...Array.from({length:15},(_,i)=>`data/biomes/map${String(i+1).padStart(2,'0')}.json`)];
  expect([...listData(SourceBiome)]).toEqual(keys);expect([...listData(SourceBiomeCatalog)]).toEqual(['data/biome-catalog.json']);
  expect(catalog.entries.length).toBe(16);expect(catalog.entries.map(e=>e.id)).toEqual(Array.from({length:16},(_,i)=>i+1));
  const rows=[[1],[2,3],[4,5,6],[7,8,9,10],[11,12,13,14,15]];
  for(let stage=0;stage<5;stage++)for(let position=0;position<rows[stage]!.length;position++){
    const id=rows[stage]![position]!,entry=catalog.entries[id-1]!,data=loadSourceBiome(id as SourceBiomeId);
    expect([entry.stage,entry.position,entry.kind,entry.terminal]).toEqual([stage+1,position,'ordinary',false]);
    expect(entry.links).toEqual({left:stage===4?16:rows[stage+1]![position],right:stage===4?16:rows[stage+1]![position+1],sequential:id+1});expect(entry.links).toEqual(data.links);
    expect(entry.dataKey).toBe(`data/biomes/map${String(id).padStart(2,'0')}.json`);
    expect(entry.hasCheckpoint).toBe(id!==1);expect(entry.checkpointLine).toBe(data.checkpointLine);
  }
  const terminal=catalog.entries[15]!;expect([terminal.id,terminal.kind,terminal.stage,terminal.terminal,terminal.hasCheckpoint,terminal.checkpointLine]).toEqual([16,'goal',6,true,false,-1]);
  expect(terminal.links).toEqual({left:-1,right:-1,sequential:-1});expect(terminal.dataKey).toBe('data/biomes/goal.json');
  for(let choices=0;choices<16;choices++){
    let id=1;for(let stage=0;stage<4;stage++){const node=catalog.entries[id-1]!;id=(choices>>stage)&1?node.links.right:node.links.left;}
    expect(id>=11&&id<=15).toBe(true);expect(catalog.entries[id-1]!.links.left).toBe(16);expect(catalog.entries[id-1]!.links.right).toBe(16);
  }
  for(let id=1;id<=15;id++)expect(catalog.entries[id-1]!.links.sequential).toBe(id+1);
  expect(catalog.goalPolicy).toEqual({randomProfile:'goal-offsets-sha256-u24-v1',seed:0,terrainProfile:'goal-terrain-defaults-v1',terrain:1,roadTerrain:0});
  expect(Object.isFrozen(catalog)&&Object.isFrozen(catalog.entries)).toBe(true);expect(loadSourceBiomeCatalog()===catalog).toBe(true);
},SCENE);

worldTest('content.catalog genuine goal retains materialized crowd replacements and shared definition identities',()=>{
  const data=loadSourceBiome(16);
  expect([data.id,data.authoredCount,data.totalCount,data.swapLine,data.lastLine,data.checkpointLine,data.timeSeconds,data.terrain,data.roadTerrain]).toEqual([16,1050,3010,1211,2810,-1,80,1,0]);
  expect([data.objects.length,data.definitions.length,data.candidatePlacements,data.overwritten.length,data.placements.length,data.maxWindowProps]).toEqual([45,938,941,558,383,187]);
  expect(data.definitions.every(d=>d.kind==='goal')).toBe(true);expect(data.links).toEqual({left:-1,right:-1,sequential:-1});
  expect(data.definitions.slice(-4).map(d=>[d.id,d.objectId,d.sourceLine])).toEqual([[934,1,1559],[935,45,1567],[936,45,1572],[937,44,1577]]);
  function winner(segment:number,slot:number){return data.placements.find(p=>p.segment===segment&&p.slot===slot)!;}
  expect(winner(504,1).definition).toBe(934);expect(data.definitions[winner(504,4).definition]!.objectId).toBe(30);
  expect(winner(505,1).definition).toBe(936);expect(winner(682,1).definition).toBe(936);
  expect(winner(505,4).definition).toBe(935);expect(winner(682,4).definition).toBe(935);
  expect(winner(506,1).definition).toBe(937);expect(winner(683,1).definition).toBe(937);
  expect(data.definitions[winner(670,0).definition]!.sourceLine).toBe(1540);expect(data.definitions[winner(670,0).definition]!.offsetX).toBe(Math.fround(-1.1099998950958252));
  const view=new DataView(new ArrayBuffer(4));for(const [id,bits] of [[21,3205929213],[22,1060946778],[15,3206909801],[28,1057629378]]){
    expect(data.definitions.some(d=>{view.setFloat32(0,d.offsetX,true);return d.objectId===id&&view.getUint32(0,true)===bits;})).toBe(true);
  }
  prefixes(data);expect(loadSourceBiome(16)===data).toBe(true);expect(Object.isFrozen(data)).toBe(true);
},SCENE);
