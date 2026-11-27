import type {ReadonlySourceBiomeData,TrafficPoolValue} from '../schema.gen.ts';
import {sourcePlayerSample} from '../content/biome.ts';
import {TRAFFIC_SOURCE} from '../content/vehicles/traffic-source.manifest.ts';
import {createEmptyTrafficPool} from '../sim/traffic-math.ts';
import {CAMERA_D,HORIZON_Y,ROAD_HALF_WIDTH} from './road-projection.ts';

export interface TrafficArtFixture {
  readonly data:ReadonlySourceBiomeData;readonly pool:TrafficPoolValue;
  readonly cameraOriginZ:number;readonly lateral:number;
  // Reference 1280x720 overlap point: both real PNGs are opaque here. Baseline
  // fixture variants prove painter order without assuming a texture color transform.
  readonly probe:readonly[number,number];readonly propSegment:number;readonly carSegment:number;
}
let cachedData:ReadonlySourceBiomeData|null=null;
const fixtures:(TrafficArtFixture|undefined)[]=new Array(11);
// Presentation-only immutable fixture cache, never a live TrafficPool component.
// Cases0/1 composite;2/3 isolated matching prop/car for0;4/5 isolated car/prop for1.
export function makeTrafficArtFixture(data:ReadonlySourceBiomeData,caseId:number):TrafficArtFixture{
  if(!Number.isInteger(caseId)||caseId<0||caseId>10)throw new Error('Traffic art fixture case must be0..10');
  if(cachedData!==data){cachedData=data;fixtures.fill(undefined);}
  const existing=fixtures[caseId];if(existing)return existing;
  if(caseId>=6){const fixture=projectionFixture(data,caseId);fixtures[caseId]=fixture;return fixture;}
  const nearCar=caseId===1||caseId===4||caseId===5;
  const cameraOriginZ=45000,aspect=16/9,propSegment=nearCar?314:310,carSegment=nearCar?310:314;
  const propOnly=caseId===2||caseId===5,carOnly=caseId===3||caseId===4;
  const object=data.objects[47]!;if(object.id!==48)throw new Error('Traffic fixture requires source palm48');
  const model=TRAFFIC_SOURCE.models[0]!,frame=model.frames[0]!;
  const carScale=CAMERA_D/(carSegment*data.segmentLength-cameraOriginZ),propScale=CAMERA_D/(propSegment*data.segmentLength-cameraOriginZ);
  const carUnit=carScale*aspect*(.3/170*ROAD_HALF_WIDTH)*model.scale;
  const carWidth=frame.sourceSizePx[0]*carUnit*3.2,carHeight=frame.sourceSizePx[1]*carUnit*3.43;
  const carOffset=-.7,carProbeX=frame.opaqueProbePx[0]+.5,carProbeY=frame.opaqueProbePx[1]+.5;
  const targetX=carOffset*ROAD_HALF_WIDTH*aspect*carScale+(carProbeX/frame.sourceSizePx[0]-.5)*carWidth;
  const cameraY=sourcePlayerSample(data,cameraOriginZ).cameraY;
  const carGround=HORIZON_Y+(data.segments[carSegment]!.y0-cameraY)*carScale;
  const targetY=carGround+(1-carProbeY/frame.sourceSizePx[1])*carHeight;
  const propUnit=propScale*aspect*(.3/170*ROAD_HALF_WIDTH)*object.scale;
  const propWidth=object.sourceSizePx[0]!*propUnit*3.2,propHeight=object.sourceSizePx[1]!*propUnit*3.43;
  // This inspected opaque trunk texel is deliberately aligned over the car's
  // inspected opaque body texel. Only placement offsets change, never source art,
  // visual scale/pivots or road geometry. It is a controlled occlusion fixture.
  const propProbeX=100.5,propProbeY=140.5,pivot=object.pivotLeft;
  const offsetX=(targetX-(propProbeX/object.sourceSizePx[0]!-pivot[0]!)*propWidth)/(ROAD_HALF_WIDTH*aspect*propScale);
  if(offsetX>=0)throw new Error('Traffic fixture must retain source left-pivot selection');
  const propGround=HORIZON_Y+(data.segments[propSegment]!.y0-cameraY)*propScale;
  const offsetY=(propGround+(pivot[1]!-propProbeY/object.sourceSizePx[1]!)*propHeight-targetY)/(propScale*1000);
  const definitions=[{...data.definitions[0]!,id:0,objectId:48,offsetX,offsetY,viewportYFactor:0,side:false}];
  const placements=carOnly?[]:[{id:propSegment*5+1,segment:propSegment,slot:1,definition:0}];
  const objectOffsets=new Array<number>(data.totalCount+1).fill(0);
  if(!carOnly)for(let row=propSegment+1;row<objectOffsets.length;row++)objectOffsets[row]=1;
  const fixtureData:ReadonlySourceBiomeData={...data,definitions,placements,objectOffsets};
  const pool=createEmptyTrafficPool();pool.initialized=true;pool.population=9;
  pool.z[0]=pool.previousZ[0]=carSegment*data.segmentLength;
  pool.offset[0]=pool.previousOffset[0]=carOffset;pool.active[0]=propOnly?0:1;pool.generation[0]=1;
  const fixture:TrafficArtFixture={data:fixtureData,pool,cameraOriginZ,lateral:0,
    probe:[Math.floor((targetX/aspect+1)*1280/2),Math.floor((1-targetY)*720/2)],propSegment,carSegment};
  fixtures[caseId]=fixture;return fixture;
}

// Additional explicit presentation fixtures retain the immutable source road,
// palette and all original objects; only local placements/pool snapshots differ.
function projectionFixture(data:ReadonlySourceBiomeData,caseId:number):TrafficArtFixture{
  const cameraOriginZ=caseId===6?642600:caseId===10?450000:45000;
  const base=Math.floor(cameraOriginZ/data.segmentLength),pool=createEmptyTrafficPool();
  pool.initialized=true;pool.population=caseId===9?32:9;
  const lateral=caseId===6||caseId===9?sourcePlayerSample(data,cameraOriginZ).gap/(2*ROAD_HALF_WIDTH):0;
  const count=caseId===6?2:caseId===9?32:1;
  for(let slot=0;slot<count;slot++){
    const n=caseId===6?160.5:caseId===7||caseId===8?74.5:caseId===9?20.5+Math.floor(slot/8)*8:199.75;
    pool.z[slot]=pool.previousZ[slot]=(base+n)*data.segmentLength;
    pool.side[slot]=caseId===6?slot:caseId===9&&slot%8>=4?1:0;
    pool.offset[slot]=pool.previousOffset[slot]=caseId===9?(slot%4-1.5)*.5:0;
    pool.active[slot]=caseId===8?0:1;pool.generation[slot]=1;
  }
  const fixtureData:ReadonlySourceBiomeData={...data,placements:[],definitions:[],objectOffsets:new Array<number>(data.totalCount+1).fill(0)};
  return{data:fixtureData,pool,cameraOriginZ,lateral,probe:[640,360],propSegment:-1,carSegment:Math.floor(pool.z[0]!/data.segmentLength)};
}
