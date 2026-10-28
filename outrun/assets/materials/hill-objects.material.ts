import { material, unlit, texture2d, texture, uv } from '@gameengine/materials';
export default material('HillDiagnosticObjects', {
  blend: 'blend', cull: 'back', fog: false,
  params: { atlas: texture2d() },
  surface: ({ atlas }) => {
    const texel = texture(atlas, uv());
    return unlit({ color: texel.rgb, alpha: texel.a });
  },
});
