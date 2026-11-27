import {worldTest,expect} from '@gameengine/test';
import {loadMap01} from '../../src/content/biome.ts';
import {COLLISION_SOURCE_COMMIT,COLLISION_ROAD_UNITS_PER_SOURCE_PIXEL,COLLISION_AUTHORING_REFERENCE,
  PLAYER_COLLIDER,TRAFFIC_COLLIDERS,collisionTrafficHull,collisionRoadsideHull} from '../../src/sim/collision-metadata.ts';

function rejects(fn:()=>unknown){let thrown=false;try{fn();}catch{thrown=true;}expect(thrown).toBe(true);}
function placement(id:number){const row=loadMap01().placements.find(value=>value.id===id);if(!row)throw new Error(`Missing source fixture ${id}`);return row;}

worldTest('collision.metadata player uses authored source77 reference not art94 or prototype90',()=>{
  expect(PLAYER_COLLIDER).toEqual({halfWidth:234.06068420410156,halfLength:75});
  expect(COLLISION_AUTHORING_REFERENCE).toEqual({width:1280,playerDepth:702,fovDegrees:120,playerWidthSourcePx:77,playerCollisionScale:3.2,centerBiasRoad:0});
  expect(COLLISION_ROAD_UNITS_PER_SOURCE_PIXEL).toBe(9.035294532775879);
  expect(COLLISION_SOURCE_COMMIT).toBe('6882721c99bc79365f815f68d389bf5078129e68');
  expect(Object.isFrozen(PLAYER_COLLIDER)).toBe(true);
});
worldTest('collision.metadata all32 models use fixed neutral physical widths and original provenance',()=>{
  // Independently enumerated source c1 width families; visual SCALE .9/1.3 is absent.
  const widths=[58,40,40,44,44,44,58,40,40,44,44,44,58,40,40,44,44,44,58,40,40,44,44,44,58,40,40,44,44,44,44,44];
  const halfWidths:{[width:number]:number}={58:314.4282531738281,40:216.84707641601562,44:238.5317840576172};
  expect(TRAFFIC_COLLIDERS.length).toBe(32);expect(Object.isFrozen(TRAFFIC_COLLIDERS)).toBe(true);
  for(let i=0;i<32;i++){
    const actual=collisionTrafficHull(i+1);
    expect(actual.model).toBe(i+1);expect(actual.sourceWidthPx).toBe(widths[i]);
    expect(actual.halfWidth).toBe(halfWidths[widths[i]!]!);expect(actual.halfLength).toBe(75);
    expect(actual.sourcePath).toBe(`Resources/Vehicles/TrafficCars/Car${i+1}/c1.png`);
    expect(/^[0-9a-f]{64}$/.test(actual.sourceSha256)).toBe(true);expect(Object.isFrozen(actual)).toBe(true);
  }
  expect(collisionTrafficHull(1).sourceSha256).toBe('ce9405bf8dd7629b68d90f7d72e780d8673052b0cb7c287f2fb15216bf4159cf');
  expect(collisionTrafficHull(16).sourceSha256).toBe('3a2f519e005f02f23fb32ab23b2ef0cb69c2610cd1040addd15944e30bf5a2ca');
  expect(collisionTrafficHull(32).sourceSha256).toBe('e5ce053804fb5bc982520f90db389033769a029d8d6c2a75c54aa5695f46ce30');
  for(const invalid of [0,33,1.5,NaN])rejects(()=>collisionTrafficHull(invalid));
});
worldTest('collision.metadata palm48 uses authored20 width and distinct left right collision pivots',()=>{
  const data=loadMap01(),source=placement(1604),positive=collisionRoadsideHull(data,source)!;
  expect(positive).toEqual({mapId:1,placementId:1604,slot:4,objectId:48,centerX:2341.68310546875,halfWidth:108.42353820800781,minZ:48000,maxZ:48150});
  // Exercise the preserved left collision-pivot branch using the actual source
  // palm record; do not infer a trunk hull from alpha or visual pivots.
  const definitions=data.definitions.map(row=>row.id===source.definition?{...row,offsetX:-.800000011920929}:row);
  const negative=collisionRoadsideHull({...data,definitions},source)!;
  expect(negative.centerX).toBe(-2341.68310546875);expect(negative.halfWidth).toBe(positive.halfWidth);
  expect(negative.minZ).toBe(positive.minZ);expect(negative.maxZ).toBe(positive.maxZ);
});
worldTest('collision.metadata skips decorative objects and samples placement own right arm',()=>{
  const data=loadMap01();
  expect(collisionRoadsideHull(data,placement(1550))).toBe(null); // Source object38 COLLISION:0.
  expect(collisionRoadsideHull(data,placement(1754))).toEqual({mapId:1,placementId:1754,slot:4,objectId:64,centerX:7438.82373046875,halfWidth:338.8235778808594,minZ:52500,maxZ:52650});
  let physical=0,decorative=0;
  for(const source of data.placements){const hull=collisionRoadsideHull(data,source);if(!hull){decorative++;continue;}physical++;
    expect(hull.placementId).toBe(source.id);expect(hull.minZ).toBe(source.segment*150);expect(hull.maxZ-hull.minZ).toBe(150);
    expect(Number.isFinite(hull.centerX)&&Number.isFinite(hull.halfWidth)).toBe(true);
  }
  expect(physical>0&&decorative>0).toBe(true);
  rejects(()=>collisionRoadsideHull({...data,sourceCommit:'unreviewed'},placement(1604)));
  rejects(()=>collisionRoadsideHull(data,{...placement(1604),id:123}));
});
worldTest('collision.metadata ignores visual pivots frames viewport and terrain decoration',async({input,step})=>{
  const data=loadMap01(),source=placement(1604),expected=collisionRoadsideHull(data,source);
  const objects=data.objects.map(row=>row.id===48?{...row,pivotLeft:[0,0],pivotRight:[1,1],showTerrain:4}:row);
  expect(collisionRoadsideHull({...data,objects},source)).toEqual(expected);
  for(const [width,height] of [[1280,720],[852,393],[1920,1080]]){
    input.view(width!,height!,1);await step(1);
    expect(collisionRoadsideHull(data,source)).toEqual(expected);
    expect(collisionTrafficHull(1).halfWidth).toBe(314.4282531738281);
    expect(PLAYER_COLLIDER.halfWidth).toBe(234.06068420410156);
  }
});
