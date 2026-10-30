import {material,unlit,texture2d,texture,uv,uniform,floor,mix,clamp,vec2,lit} from '@gameengine/materials';
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
    const texel=texture(image,coord);return unlit({color:texel.rgb,alpha:texel.a});
  },
});
