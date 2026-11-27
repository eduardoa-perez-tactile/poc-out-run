import {material,unlit,texture2d,uv,uniform,wgsl,fn} from '@gameengine/materials';
const selectedAtlas=fn('traffic_composite_texel','vec4f',wgsl`
fn traffic_composite_texel(props: texture_2d<f32>, propsSampler: sampler,
  traffic: texture_2d<f32>, trafficSampler: sampler,
  scene: texture_2d<f32>, sceneSampler: sampler, coord: vec2f, kind: f32,
  propsSize: vec2f, trafficSize: vec2f, sceneSize: vec2f, propsFiltered: f32, trafficFiltered: f32) -> vec4f {
  if (kind > 1.5) {
    let point = (floor(coord * sceneSize) + vec2f(0.5)) / sceneSize;
    return textureSampleLevel(scene, sceneSampler, mix(point, coord, propsFiltered), 0.0);
  }
  if (kind > 0.5) {
    let point = (floor(coord * trafficSize) + vec2f(0.5)) / trafficSize;
    return textureSampleLevel(traffic, trafficSampler, mix(point, coord, trafficFiltered), 0.0);
  }
  let point = (floor(coord * propsSize) + vec2f(0.5)) / propsSize;
  return textureSampleLevel(props, propsSampler, mix(point, coord, propsFiltered), 0.0);
}`);
export default material('SourceTrafficComposite',{
  blend:'blend',cull:'back',fog:false,
  params:{propsAtlas:texture2d(),trafficAtlas:texture2d(),sceneAtlas:texture2d(),propsSize:uniform.vec2([1024,1024]),trafficSize:uniform.vec2([1024,1280]),sceneSize:uniform.vec2([1024,438]),
    propsFiltered:uniform.f32(1,{min:0,max:1,step:1}),trafficFiltered:uniform.f32(0,{min:0,max:1,step:1})},
  surface:({propsAtlas,trafficAtlas,sceneAtlas,propsSize,trafficSize,sceneSize,propsFiltered,trafficFiltered})=>{
    // UV1 is an explicit constant per quad, never opacity or an accidental tint.
    // LOD0 matches authored noMip cook even when loose PNGs allocate mip levels.
    // Traffic point is a source-reference candidate pending near/mid/far review.
    const texel=selectedAtlas(propsAtlas,trafficAtlas,sceneAtlas,uv(),uv(1).x,propsSize,trafficSize,sceneSize,propsFiltered,trafficFiltered);
    return unlit({color:texel.rgb,alpha:texel.a});
  },
});
