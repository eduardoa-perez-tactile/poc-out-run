import { ProjectionBuffers } from './projection-buffers.ts';
import { forkCenter,FORK_PALETTES,FORK_WHITE,blendColor } from './fork-fixture.ts';
import { projected,SEGMENT_LENGTH,VISIBLE_SEGMENTS,CAMERA_D,CAMERA_HEIGHT,HORIZON_Y,ROAD_HALF_WIDTH } from './road-projection.ts';
import { hillHeight } from './hill-fixture.ts';
const mesh=new ProjectionBuffers(VISIBLE_SEGMENTS*9);
const terrain=[new Uint8Array(3),new Uint8Array(3)];const road=[new Uint8Array(3),new Uint8Array(3)];
export const forkRoadStats={visibleSegments:0,hiddenSegments:0};
export function buildForkBuffers(distance:number,lateral:number,aspect:number,side:number,progress:number) {
  mesh.reset();forkRoadStats.visibleSegments=0;forkRoadStats.hiddenSegments=0;
  const palette=FORK_PALETTES[side===0?1:2]!;const current=FORK_PALETTES[0]!;
  for(let i=0;i<2;i++){blendColor(terrain[i]!,current.terrain[i]!,palette.terrain[i]!,progress);blendColor(road[i]!,current.road[i]!,palette.road[i]!,progress);}
  const rawBase=Math.floor(distance/SEGMENT_LENGTH);const fraction=distance/SEGMENT_LENGTH-rawBase;
  projected.base=((rawBase%1200)+1200)%1200;projected.fraction=fraction;projected.aspect=aspect;
  projected.center.fill(0);projected.y.fill(0);projected.scale.fill(0);projected.clip.fill(-1);
  const cameraX=forkCenter(distance,side)+lateral*ROAD_HALF_WIDTH;
  const cameraY=CAMERA_HEIGHT+hillHeight(distance)*.5;let crest=-1;
  for(let n=0;n<VISIBLE_SEGMENTS;n++) {
    const z0=(n-fraction)*SEGMENT_LENGTH;const z1=z0+SEGMENT_LENGTH;
    if(z0<=CAMERA_D)continue;
    const d0=(rawBase+n)*SEGMENT_LENGTH;const d1=d0+SEGMENT_LENGTH;
    const s0=CAMERA_D/z0;const s1=CAMERA_D/z1;
    const y0=HORIZON_Y+(hillHeight(d0)*.5-cameraY)*s0;
    const y1=HORIZON_Y+(hillHeight(d1)*.5-cameraY)*s1;
    projected.center[n]=(forkCenter(d0,side)-cameraX)*aspect*s0;
    projected.center[n+1]=(forkCenter(d1,side)-cameraX)*aspect*s1;
    projected.y[n]=y0;projected.y[n+1]=y1;projected.scale[n]=s0;projected.scale[n+1]=s1;projected.clip[n]=crest;
    if(y1<=crest){forkRoadStats.hiddenSegments++;continue;}
    const t=y0<crest?(crest-y0)/(y1-y0):0;const clippedY=Math.max(y0,crest);crest=y1;
    const shade=Math.floor((rawBase+n)/3)%2;const surface=road[shade]!;
    mesh.strip(-aspect,aspect,clippedY,-aspect,aspect,y1,0,terrain[shade]!);
    // Rumbles first, then BOTH asphalt strips; overlap remains asphalt rather
    // than drawing an inner rumble through the shared approach.
    for(let layer=0;layer<4;layer++)for(let arm=0;arm<2;arm++) {
      const rawCenter0=(forkCenter(d0,arm)-cameraX)*aspect*s0;const center1=(forkCenter(d1,arm)-cameraX)*aspect*s1;
      const width1=aspect*ROAD_HALF_WIDTH*s1;const width0=aspect*ROAD_HALF_WIDTH*s0;
      const center0=rawCenter0+(center1-rawCenter0)*t;const width=width0+(width1-width0)*t;
      if(layer===0)mesh.strip(center0-width*1.08,center0+width*1.08,clippedY,center1-width1*1.08,center1+width1*1.08,y1,.001,shade===0?surface:FORK_WHITE);
      else if(layer===1)mesh.strip(center0-width,center0+width,clippedY,center1-width1,center1+width1,y1,.002,surface);
      else {
        const offset=layer===2?-1/3:1/3;
        mesh.strip(center0+width*(offset-.015),center0+width*(offset+.015),clippedY,center1+width1*(offset-.015),center1+width1*(offset+.015),y1,.003,shade===0?surface:FORK_WHITE);
      }
    }
    forkRoadStats.visibleSegments++;
  }
  return mesh.arrays;
}
