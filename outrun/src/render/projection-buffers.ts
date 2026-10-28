import type { MeshArrays } from '@gameengine/runtime';
// Fixed-capacity presentation scratch; constructed once, fully reset per sample.
export class ProjectionBuffers {
  readonly positions: Float32Array; readonly normals: Float32Array;
  readonly tangents: Float32Array; readonly uvs: Float32Array;
  readonly colors: Uint8Array; readonly indices: Uint16Array;
  readonly arrays: MeshArrays;
  count=0;
  readonly capacity:number;
  constructor(capacity: number) {
    this.capacity=capacity;
    this.positions=new Float32Array(capacity*12);this.normals=new Float32Array(capacity*12);
    this.tangents=new Float32Array(capacity*16);this.uvs=new Float32Array(capacity*8);
    this.colors=new Uint8Array(capacity*16);this.indices=new Uint16Array(capacity*6);
    this.arrays={positions:this.positions,normals:this.normals,tangents:this.tangents,uvs:this.uvs,colors:this.colors,indices:this.indices};
  }
  reset() {
    this.count=0;this.positions.fill(0);this.normals.fill(0);this.tangents.fill(0);this.uvs.fill(0);this.colors.fill(0);this.indices.fill(0);
    for(let v=0;v<this.capacity*4;v++){this.normals[v*3+2]=1;this.tangents[v*4]=1;this.tangents[v*4+3]=1;}
  }
  quad(x0:number,y0:number,x1:number,y1:number,x2:number,y2:number,x3:number,y3:number,z:number,color:ArrayLike<number>) {
    const q=this.count++;if(q>=this.capacity)throw new Error('projection buffer capacity exceeded');
    const p=q*12;const a=this.positions;
    a[p]=x0;a[p+1]=y0;a[p+2]=z;a[p+3]=x1;a[p+4]=y1;a[p+5]=z;
    a[p+6]=x2;a[p+7]=y2;a[p+8]=z;a[p+9]=x3;a[p+10]=y3;a[p+11]=z;
    const v=q*4;const k=q*6;const ix=this.indices;
    ix[k]=v;ix[k+1]=v+1;ix[k+2]=v+2;ix[k+3]=v;ix[k+4]=v+2;ix[k+5]=v+3;
    for(let i=0;i<4;i++){const c=(v+i)*4;this.colors[c]=color[0]!;this.colors[c+1]=color[1]!;this.colors[c+2]=color[2]!;this.colors[c+3]=255;}
  }
  strip(left0:number,right0:number,y0:number,left1:number,right1:number,y1:number,z:number,color:ArrayLike<number>) {
    this.quad(left0,y0,right0,y0,right1,y1,left1,y1,z,color);
  }
}
export const EMPTY_MESH: MeshArrays={positions:new Float32Array(0),indices:new Uint16Array(0)};
