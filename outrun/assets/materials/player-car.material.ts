import { material, unlit, texture2d, texture, uv, floor, vec2, vertexColor, mix } from '@gameengine/materials';
export default material('PlayerCarPixels', {
  blend: 'blend', cull: 'back', fog: false,
  params: { atlas: texture2d() },
  surface: ({ atlas }) => {
    // Explicit 1024² atlas, uncompressed, one mip. Sampling texel centers prevents
    // the material's linear sampler from interpolating across source pixels.
    const size = vec2(1024,1024);
    const point = floor(uv().mul(size)).add(.5).div(size);
    const texel = texture(atlas,point);
    return unlit({ color: mix(vertexColor().rgb,texel.rgb,vertexColor().a), alpha: mix(1,texel.a,vertexColor().a) });
  },
});
