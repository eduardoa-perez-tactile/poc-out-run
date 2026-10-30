import {material,unlit,texture2d,uv,uniform,floor,mix,clamp,vec2,lit,wgsl,fn} from '@gameengine/materials';
const sampleBase=fn('map01_panorama_base','vec4f',wgsl`
fn map01_panorama_base(image: texture_2d<f32>, imageSampler: sampler, coord: vec2f) -> vec4f {
  return textureSampleLevel(image, imageSampler, coord, 0.0);
}`);
export default material('Map01Panorama',{
  blend:'blend',cull:'back',fog:false,
  params:{image:texture2d(),imageSize:uniform.vec2([2048,256]),filtered:uniform.f32(1,{min:0,max:1,step:1})},
  // The filtered candidate uses continuous repeating UVs across wrap seams.
  // A separate point candidate permits comparison with source SFML defaults.
  surface:({image,imageSize,filtered})=>{
    const point=floor(uv().mul(imageSize)).add(.5).div(imageSize);
    const candidate=mix(point,uv(),filtered);
    // The3D sampler repeats both axes. Only U may wrap: clamp V inside the
    // source's top253 rows so filtering cannot pull the opaque bottom into sky.
    const coord=vec2(candidate.x,clamp(candidate.y,lit(.5).div(imageSize.y),lit(252.5).div(imageSize.y)));
    // Loose PNG loading generates mips even though the authored cook has one
    // level. Sample level0 explicitly: a larger mip footprint would wrap opaque
    // bottom texels into this transparent top despite the base-level clamp.
    const texel=sampleBase(image,coord);return unlit({color:texel.rgb,alpha:texel.a});
  },
});
