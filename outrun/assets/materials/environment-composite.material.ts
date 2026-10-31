import {material,unlit,texture2d,uv,uniform,wgsl,fn} from '@gameengine/materials';

const selectedTexel=fn('environment_composite_texel','vec4f',wgsl`
fn environment_composite_texel(page0: texture_2d<f32>, sampler0: sampler,
  page1: texture_2d<f32>, sampler1: sampler,
  traffic: texture_2d<f32>, trafficSampler: sampler,
  coord: vec2f, kind: f32, trafficSize: vec2f) -> vec4f {
  if (kind > 1.5) {
    let point = (floor(coord * trafficSize) + vec2f(0.5)) / trafficSize;
    return textureSampleLevel(traffic, trafficSampler, point, 0.0);
  }
  if (kind > 0.5) {
    return textureSampleLevel(page1, sampler1, coord, 0.0);
  }
  return textureSampleLevel(page0, sampler0, coord, 0.0);
}`);

// Separate contract from the preserved Map1 material: UV1.x is 0/1/2.
export default material('DestinationEnvironmentComposite',{
  blend:'blend',cull:'back',fog:false,
  params:{page0:texture2d(),page1:texture2d(),traffic:texture2d(),trafficSize:uniform.vec2([1024,1280])},
  surface:({page0,page1,traffic,trafficSize})=>{
    const texel=selectedTexel(page0,page1,traffic,uv(),uv(1).x,trafficSize);
    return unlit({color:texel.rgb,alpha:texel.a});
  },
});
