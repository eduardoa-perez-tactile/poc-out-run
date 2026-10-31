import {material,unlit,uniform} from '@gameengine/materials';
export default material('DestinationSourceSky',{
  blend:'opaque',cull:'back',fog:false,
  params:{sky:uniform.color('#0080f6')},
  surface:({sky})=>unlit({color:sky.rgb,alpha:sky.a}),
});
