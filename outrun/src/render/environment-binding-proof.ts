import {defineSystem,read,query,meshes,textures} from '@gameengine/runtime';
import {EnvironmentReviewSlot} from '../schema.gen.ts';
import {ProjectionBuffers} from './projection-buffers.ts';

const proof=new ProjectionBuffers(9),uvs1=new Float32Array(9*8);
const arrays={...proof.arrays,uvs1};
const white=new Uint8Array([255,255,255]);
const textureNames=['environment-proof-page0','environment-proof-page1','environment-proof-traffic'];
const colors:[[number,number,number,number],[number,number,number,number],[number,number,number,number]]=[[255,0,0,255],[0,255,0,255],[0,0,255,255]];
function rect(left:number,right:number,kind:number){
  const q=proof.count;
  proof.strip((left-640)/360,(right-640)/360,(360-200)/360,(left-640)/360,(right-640)/360,(360-100)/360,.02+q*.001,white);
  for(let v=0;v<4;v++){proof.uvs[q*8+v*2]=.5;proof.uvs[q*8+v*2+1]=.5;uvs1[q*8+v*2]=kind;}
}
/** Isolated architecture witness, not a destination or live race fixture. */
export const EnvironmentBindingProof=defineSystem({
  name:'EnvironmentBindingProof',stage:'LateUpdate',query:query(read(EnvironmentReviewSlot)),
  run(_ctx,owners){
    let active=false;
    for(const chunk of owners.chunks())for(let row=0;row<chunk.length;row++)if(chunk.col(EnvironmentReviewSlot).slot[row]===99)active=true;
    if(!active){
      if(meshes.info('environment-binding-proof')!==null)meshes.destroy('environment-binding-proof');
      for(const name of textureNames)if(textures.info(name)!==null)textures.destroy(name);
      return;
    }
    for(let i=0;i<3;i++)if(textures.info(textureNames[i]!)===null)textures.create(textureNames[i]!,{width:1,height:1,srgb:false,color:colors[i]!});
    proof.reset();uvs1.fill(0);
    rect(100,200,0);rect(250,350,1);rect(400,500,2);
    rect(600,700,1);rect(625,675,2);rect(650,725,0);
    rect(800,900,0);rect(825,875,2);rect(850,925,1);
    if(meshes.info('environment-binding-proof')===null)meshes.create('environment-binding-proof',arrays);else meshes.update('environment-binding-proof',arrays);
  },
});
