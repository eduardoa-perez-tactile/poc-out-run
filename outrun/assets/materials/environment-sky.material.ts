import {material,unlit,uniform} from '@gameengine/materials';
export default material('DestinationSourceSky',{
  blend:'opaque',cull:'back',fog:false,
  // Preserve the existing GPU f32 values; host Math.pow must not change the material hash.
  params:{sky:uniform.color([0,0.2158605009317398,0.9215818643569946,1])},
  surface:({sky})=>unlit({color:sky.rgb,alpha:sky.a}),
});
