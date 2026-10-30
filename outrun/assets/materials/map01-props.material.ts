import {material,unlit,texture2d,uv,uniform,floor,mix,wgsl,fn} from '@gameengine/materials';
const sampleBase=fn('map01_props_base','vec4f',wgsl`
fn map01_props_base(atlas: texture_2d<f32>, atlasSampler: sampler, coord: vec2f) -> vec4f {
  return textureSampleLevel(atlas, atlasSampler, coord, 0.0);
}`);
export default material('Map01ProjectedProps',{
  blend:'blend',cull:'back',fog:false,
  params:{atlas:texture2d(),atlasSize:uniform.vec2([1024,1024]),filtered:uniform.f32(1,{min:0,max:1,step:1})},
  surface:({atlas,atlasSize,filtered})=>{
    // Linear is the reviewed moving-scenery choice; point remains available for
    // comparison. See the Map1 art brief for the near-detail tradeoff/no-mip scope.
    const point=floor(uv().mul(atlasSize)).add(.5).div(atlasSize);
    // Match the authored single-level cook in loose previews too; generated
    // whole-atlas mips could otherwise blend neighboring packed images.
    const texel=sampleBase(atlas,mix(point,uv(),filtered));
    return unlit({color:texel.rgb,alpha:texel.a});
  },
});
