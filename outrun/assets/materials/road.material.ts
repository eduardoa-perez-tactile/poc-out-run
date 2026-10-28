// Opaque, unlit projected road; vertex colors are linear RGBA bytes.
import { material, unlit, vertexColor } from '@gameengine/materials';
export default material('ProjectedRoad', {
  blend: 'opaque', cull: 'back', fog: false,
  surface: () => unlit({ color: vertexColor().rgb, alpha: 1 }),
});
