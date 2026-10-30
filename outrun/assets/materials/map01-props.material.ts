import {material,unlit,texture2d,texture,uv,uniform,floor,mix} from '@gameengine/materials';
export default material('Map01ProjectedProps',{
  blend:'blend',cull:'back',fog:false,
  params:{atlas:texture2d(),atlasSize:uniform.vec2([1024,1024]),filtered:uniform.f32(1,{min:0,max:1,step:1})},
  surface:({atlas,atlasSize,filtered})=>{
    // The point candidate is retained for measured near/far filtering review.
    // Filtering/mip policy is accepted only after the projected moving comparison.
    const point=floor(uv().mul(atlasSize)).add(.5).div(atlasSize);
    const texel=texture(atlas,mix(point,uv(),filtered));
    return unlit({color:texel.rgb,alpha:texel.a});
  },
});
