import { ProjectionBuffers,EMPTY_MESH } from './projection-buffers.ts';
import { FORK_PALETTES,blendColor } from './fork-fixture.ts';
const mesh=new ProjectionBuffers(64);
const sky=new Uint8Array(3);
// Periodic code-native diagnostic panoramas. Endpoints use modulo addressing.
const profiles=Object.freeze([
  Object.freeze([.02,.04,.11,.06,.03,.08,.02,.09,.04,.12,.07,.03]),
  Object.freeze([.03,.09,.07,.12,.02,.04,.09,.03,.10,.06,.03,.07]),
  Object.freeze([.09,.04,.12,.02,.06,.10,.05,.03,.11,.04,.08,.02]),
]);
export const forkBackgroundStats={quads:0,farPhase:0,nearPhase:0};
export function backgroundPhase(distance:number,layer:number):number {
  const phase=distance/180000*(layer===0?3:5);return phase-Math.floor(phase);
}
export function backgroundHeight(profile:number,segment:number):number {
  const shape=profiles[profile]!;return shape[((segment%shape.length)+shape.length)%shape.length]!;
}
export function buildForkBackgrounds(active:boolean,distance:number,aspect:number,side:number,progress:number) {
  mesh.reset();forkBackgroundStats.quads=0;forkBackgroundStats.farPhase=0;forkBackgroundStats.nearPhase=0;
  if(!active)return EMPTY_MESH;
  const target=side===0?1:2;const p=Math.max(0,Math.min(1,progress));
  blendColor(sky,FORK_PALETTES[0]!.sky,FORK_PALETTES[target]!.sky,p);
  // Camera-attached mesh: local depths behind the road, whose camera depth is10.
  mesh.strip(-aspect,aspect,-1,-aspect,aspect,1,-12.1,sky);
  const wipe=aspect-2*aspect*p;
  // All current/left/right profile tables are resident. At midpoint current and
  // selected successor each contribute a far and near layer to one bounded mesh.
  for(let layer=0;layer<2;layer++) {
    const phase=backgroundPhase(distance,layer);
    if(layer===0)forkBackgroundStats.farPhase=phase;else forkBackgroundStats.nearPhase=phase;
    for(let pane=0;pane<2;pane++) {
      const profile=pane===0?0:target;
      const minX=pane===0?-aspect:wipe;const maxX=pane===0?wipe:aspect;
      const shift=pane===0?-2*aspect*p:2*aspect*(1-p);
      const bottom=layer===0?-.58:-.60;const baseline=layer===0?-.24:-.34;
      const color=layer===0?FORK_PALETTES[profile]!.far:FORK_PALETTES[profile]!.near;
      for(let i=0;i<24;i++) {
        const left=-aspect+(i/12-phase)*2*aspect+shift;const right=left+2*aspect/12;
        const x0=Math.max(-aspect,minX,left);const x1=Math.min(aspect,maxX,right);
        if(x1<=x0)continue;
        const h0=backgroundHeight(profile,i+(layer?3:0));const h1=backgroundHeight(profile,i+1+(layer?3:0));
        const top0=baseline+h0+(h1-h0)*(x0-left)/(right-left);
        const top1=baseline+h0+(h1-h0)*(x1-left)/(right-left);
        mesh.quad(x0,bottom,x1,bottom,x1,top1,x0,top0,layer===0?-12:-11.9,color);
      }
    }
  }
  forkBackgroundStats.quads=mesh.count;
  return mesh.arrays;
}
