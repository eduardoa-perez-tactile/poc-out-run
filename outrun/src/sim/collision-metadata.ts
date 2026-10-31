import {math} from '@gameengine/runtime';
import type {ReadonlySourceBiomeData} from '../schema.gen.ts';

const f=math.fround;
export const COLLISION_SOURCE_COMMIT='6882721c99bc79365f815f68d389bf5078129e68';
/** Authored road-space conversion; source projection scale and viewport cancel. */
export const COLLISION_ROAD_UNITS_PER_SOURCE_PIXEL=math.fround(9.035294117647059);
export const COLLISION_TRAFFIC_REFERENCE_SCALE=math.fround(1.2);
export const COLLISION_ROAD_WIDTH=1600;
export const COLLISION_SEGMENT_LENGTH=150;
export interface CollisionHull {readonly halfWidth:number;readonly halfLength:number}
export interface CollisionTrafficHull extends CollisionHull {
  readonly model:number;readonly sourceWidthPx:number;readonly sourcePath:string;readonly sourceSha256:string;
}
export interface CollisionRoadsideHull {
  readonly mapId:number;readonly placementId:number;readonly slot:number;readonly objectId:number;
  readonly centerX:number;readonly halfWidth:number;readonly minZ:number;readonly maxZ:number;
}
export type CollisionPlacement=ReadonlySourceBiomeData['placements'][number];
export const PLAYER_COLLIDER:CollisionHull=Object.freeze({halfWidth:math.fround(234.06068588082016),halfLength:75});
export const COLLISION_AUTHORING_REFERENCE=Object.freeze({width:1280,playerDepth:702,fovDegrees:120,playerWidthSourcePx:77,playerCollisionScale:3.2,centerBiasRoad:0});

/** Fixed neutral c1 references, authored independently of all runtime artwork. */
export const TRAFFIC_COLLIDERS:readonly CollisionTrafficHull[]=Object.freeze([
  Object.freeze({model:1,halfWidth:314.4282531738281,halfLength:75,sourceWidthPx:58,sourcePath:'Resources/Vehicles/TrafficCars/Car1/c1.png',sourceSha256:'ce9405bf8dd7629b68d90f7d72e780d8673052b0cb7c287f2fb15216bf4159cf'}),
  Object.freeze({model:2,halfWidth:216.84707641601562,halfLength:75,sourceWidthPx:40,sourcePath:'Resources/Vehicles/TrafficCars/Car2/c1.png',sourceSha256:'c4dfcd4791b1ba8a14324ee18f97ae9a770f18f583c4b5ee5c79db0b4a29649b'}),
  Object.freeze({model:3,halfWidth:216.84707641601562,halfLength:75,sourceWidthPx:40,sourcePath:'Resources/Vehicles/TrafficCars/Car3/c1.png',sourceSha256:'0dc463067af81586e7508e9d198fd915912b042f8b34e876512ecb81b88efe3b'}),
  Object.freeze({model:4,halfWidth:238.5317840576172,halfLength:75,sourceWidthPx:44,sourcePath:'Resources/Vehicles/TrafficCars/Car4/c1.png',sourceSha256:'7acda79e7f2cf75be3713e7bd95054c024a93c813dcf4c168f9d1c71e5969391'}),
  Object.freeze({model:5,halfWidth:238.5317840576172,halfLength:75,sourceWidthPx:44,sourcePath:'Resources/Vehicles/TrafficCars/Car5/c1.png',sourceSha256:'12b1abd45b7a0cb19f1ea06f3d9c8ad0f9646a3edb40c1a4e37f69b614e4aecc'}),
  Object.freeze({model:6,halfWidth:238.5317840576172,halfLength:75,sourceWidthPx:44,sourcePath:'Resources/Vehicles/TrafficCars/Car6/c1.png',sourceSha256:'3a45575010e780675b135a3bd385816e821f53624635f4faa9431b7fea55f315'}),
  Object.freeze({model:7,halfWidth:314.4282531738281,halfLength:75,sourceWidthPx:58,sourcePath:'Resources/Vehicles/TrafficCars/Car7/c1.png',sourceSha256:'012bf57f4184ee65b1ecf206c97fb5b64ddc8aa4d8e0243c08aff865a995295f'}),
  Object.freeze({model:8,halfWidth:216.84707641601562,halfLength:75,sourceWidthPx:40,sourcePath:'Resources/Vehicles/TrafficCars/Car8/c1.png',sourceSha256:'40d0d7d2eaf45582a674e3c2faf5bb74894f504fb6740d5bba703b195e177e72'}),
  Object.freeze({model:9,halfWidth:216.84707641601562,halfLength:75,sourceWidthPx:40,sourcePath:'Resources/Vehicles/TrafficCars/Car9/c1.png',sourceSha256:'9519bce2e70c817a6937e0762d675244590221279cf86af27c2fafca9020f4eb'}),
  Object.freeze({model:10,halfWidth:238.5317840576172,halfLength:75,sourceWidthPx:44,sourcePath:'Resources/Vehicles/TrafficCars/Car10/c1.png',sourceSha256:'90968be384c211506302dbace066e28f0033348c15deae7ca1a4f1042e2e6c7c'}),
  Object.freeze({model:11,halfWidth:238.5317840576172,halfLength:75,sourceWidthPx:44,sourcePath:'Resources/Vehicles/TrafficCars/Car11/c1.png',sourceSha256:'4b37ea9ff4f61b18d1fee32530c143df6b9ffadaa3bf689404557752687aa344'}),
  Object.freeze({model:12,halfWidth:238.5317840576172,halfLength:75,sourceWidthPx:44,sourcePath:'Resources/Vehicles/TrafficCars/Car12/c1.png',sourceSha256:'293bbcc1ab8e09e480f5eb427a017d674aee46a473d57db12b7d94fd4fcc713f'}),
  Object.freeze({model:13,halfWidth:314.4282531738281,halfLength:75,sourceWidthPx:58,sourcePath:'Resources/Vehicles/TrafficCars/Car13/c1.png',sourceSha256:'ba8313b04ab03f5976e44d406f2879ded52480508fb329ac4782a6c22eba4fa3'}),
  Object.freeze({model:14,halfWidth:216.84707641601562,halfLength:75,sourceWidthPx:40,sourcePath:'Resources/Vehicles/TrafficCars/Car14/c1.png',sourceSha256:'66dea1579b95df408778cc7f0d79de784639c4354a5f0c7039264f773987d619'}),
  Object.freeze({model:15,halfWidth:216.84707641601562,halfLength:75,sourceWidthPx:40,sourcePath:'Resources/Vehicles/TrafficCars/Car15/c1.png',sourceSha256:'09deb261c02ed73f894633d71a9587e8c1bfb3b1e8181760fa354ee831966e43'}),
  Object.freeze({model:16,halfWidth:238.5317840576172,halfLength:75,sourceWidthPx:44,sourcePath:'Resources/Vehicles/TrafficCars/Car16/c1.png',sourceSha256:'3a2f519e005f02f23fb32ab23b2ef0cb69c2610cd1040addd15944e30bf5a2ca'}),
  Object.freeze({model:17,halfWidth:238.5317840576172,halfLength:75,sourceWidthPx:44,sourcePath:'Resources/Vehicles/TrafficCars/Car17/c1.png',sourceSha256:'2e7afc1a7a6e137282c06487d74d97eb592950bea3c792731be739f416686666'}),
  Object.freeze({model:18,halfWidth:238.5317840576172,halfLength:75,sourceWidthPx:44,sourcePath:'Resources/Vehicles/TrafficCars/Car18/c1.png',sourceSha256:'1cc6d6168e1a7d9ef93e2ddda79b7190f5df711fbafbca10ed1dfd59d5ac72c7'}),
  Object.freeze({model:19,halfWidth:314.4282531738281,halfLength:75,sourceWidthPx:58,sourcePath:'Resources/Vehicles/TrafficCars/Car19/c1.png',sourceSha256:'8d37af012d8bc344731ddf71cd97fef115a9cf0c1dd42be7a576bf390863759b'}),
  Object.freeze({model:20,halfWidth:216.84707641601562,halfLength:75,sourceWidthPx:40,sourcePath:'Resources/Vehicles/TrafficCars/Car20/c1.png',sourceSha256:'43b21ce77bb4d2ade7b1d906b69d2cf7d8e447a8f729972cc88ff224df3cf474'}),
  Object.freeze({model:21,halfWidth:216.84707641601562,halfLength:75,sourceWidthPx:40,sourcePath:'Resources/Vehicles/TrafficCars/Car21/c1.png',sourceSha256:'baaf2b0d477d335aa038af02ad76acfcaf5b23ad9594f6c5deac2d4567e653d6'}),
  Object.freeze({model:22,halfWidth:238.5317840576172,halfLength:75,sourceWidthPx:44,sourcePath:'Resources/Vehicles/TrafficCars/Car22/c1.png',sourceSha256:'41495d9f30381abb504fd0e2dfe6bb7504e7a13d0653343c794bd0301dc405eb'}),
  Object.freeze({model:23,halfWidth:238.5317840576172,halfLength:75,sourceWidthPx:44,sourcePath:'Resources/Vehicles/TrafficCars/Car23/c1.png',sourceSha256:'e3f8f212807ade8ab18129ccfcdf341a7edb280796cbec395bcd2c63cc8f719b'}),
  Object.freeze({model:24,halfWidth:238.5317840576172,halfLength:75,sourceWidthPx:44,sourcePath:'Resources/Vehicles/TrafficCars/Car24/c1.png',sourceSha256:'58a87eac7588ef28c0f2f9763d2fcbc5fa43a866f613da18888655c6666546e6'}),
  Object.freeze({model:25,halfWidth:314.4282531738281,halfLength:75,sourceWidthPx:58,sourcePath:'Resources/Vehicles/TrafficCars/Car25/c1.png',sourceSha256:'087ba114032a94080bee9ecff1fc3f8a5d5fa52d86a3b3ac10bd138b72ddfb4e'}),
  Object.freeze({model:26,halfWidth:216.84707641601562,halfLength:75,sourceWidthPx:40,sourcePath:'Resources/Vehicles/TrafficCars/Car26/c1.png',sourceSha256:'222587aa6c699e55b049b373925aeb8348fa085f7f66bf8f59b3d86af2420f8c'}),
  Object.freeze({model:27,halfWidth:216.84707641601562,halfLength:75,sourceWidthPx:40,sourcePath:'Resources/Vehicles/TrafficCars/Car27/c1.png',sourceSha256:'f987f0bd0d4af6ba00feee208a70efc6c4a7d5c77cf64ee631701ca178e17b6d'}),
  Object.freeze({model:28,halfWidth:238.5317840576172,halfLength:75,sourceWidthPx:44,sourcePath:'Resources/Vehicles/TrafficCars/Car28/c1.png',sourceSha256:'ab91b267d2272da524b4255d23dfdab1d8de5e8d97081d0628d94643e03c1c92'}),
  Object.freeze({model:29,halfWidth:238.5317840576172,halfLength:75,sourceWidthPx:44,sourcePath:'Resources/Vehicles/TrafficCars/Car29/c1.png',sourceSha256:'a3b788a95be45c2945d0d3c2b382339a862c4dfbf54d6ae458daea9286142974'}),
  Object.freeze({model:30,halfWidth:238.5317840576172,halfLength:75,sourceWidthPx:44,sourcePath:'Resources/Vehicles/TrafficCars/Car30/c1.png',sourceSha256:'004552bf8f6c22941b94d869ee7291d829a3679d21d920e3b263caae3070a4e1'}),
  Object.freeze({model:31,halfWidth:238.5317840576172,halfLength:75,sourceWidthPx:44,sourcePath:'Resources/Vehicles/TrafficCars/Car31/c1.png',sourceSha256:'37533f0ef458187428ac8637407a946a8ecf134f313e4b54a79b096bab4437fc'}),
  Object.freeze({model:32,halfWidth:238.5317840576172,halfLength:75,sourceWidthPx:44,sourcePath:'Resources/Vehicles/TrafficCars/Car32/c1.png',sourceSha256:'e5ce053804fb5bc982520f90db389033769a029d8d6c2a75c54aa5695f46ce30'}),
]);
export function collisionTrafficHull(model:number):CollisionTrafficHull {
  if(!Number.isInteger(model)||model<1||model>TRAFFIC_COLLIDERS.length)throw new Error(`Unknown collision traffic model ${model}`);
  return TRAFFIC_COLLIDERS[model-1]!;
}

/** Only preserved original source physics records participate; no image/frame IO. */
export function collisionRoadsideHull(data:ReadonlySourceBiomeData,placement:CollisionPlacement):CollisionRoadsideHull|null {
  if(data.id!==1||data.sourceCommit!==COLLISION_SOURCE_COMMIT||data.segmentLength!==COLLISION_SEGMENT_LENGTH)throw new Error('Unsupported collision source biome');
  if(!Number.isInteger(placement.segment)||placement.segment<0||placement.segment>=data.segments.length||!Number.isInteger(placement.slot)||placement.slot<0||placement.slot>4||placement.id!==placement.segment*5+placement.slot)throw new Error('Invalid collision placement identity');
  const definition=data.definitions[placement.definition];
  if(!definition||definition.id!==placement.definition)throw new Error('Missing collision placement definition');
  const object=data.objects[definition.objectId-1];
  if(!object||object.id!==definition.objectId)throw new Error('Missing collision source object');
  if(!object.collision)return null;
  const width=object.sourceSizePx[0],pivot=definition.offsetX>=0?object.collisionPivotRight[0]:object.collisionPivotLeft[0];
  if(width===undefined||pivot===undefined||![width,pivot,object.scale,object.collisionWidthSourcePx,definition.offsetX].every(Number.isFinite)||width<=0||object.scale<=0||object.collisionWidthSourcePx<0||pivot<0||pivot>1)throw new Error('Invalid collision source dimensions/pivot');
  const k=COLLISION_ROAD_UNITS_PER_SOURCE_PIXEL;
  const sourceWidth=f(f(width*k)*object.scale);
  const shift=f(sourceWidth*(definition.offsetX>=0?pivot:f(-(1-pivot))));
  const arm=definition.side?data.segments[placement.segment]!.gap:0;
  const centerX=f(f(arm+f(definition.offsetX*COLLISION_ROAD_WIDTH))+shift);
  const halfWidth=f(f(f(object.collisionWidthSourcePx*k)*object.scale)/2);
  const minZ=f(placement.segment*COLLISION_SEGMENT_LENGTH),maxZ=f((placement.segment+1)*COLLISION_SEGMENT_LENGTH);
  if(!Number.isFinite(centerX)||!Number.isFinite(halfWidth))throw new Error('Non-finite collision source hull');
  return {mapId:data.id,placementId:placement.id,slot:placement.slot,objectId:object.id,centerX,halfWidth,minZ,maxZ};
}
