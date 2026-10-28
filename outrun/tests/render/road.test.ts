import { renderTest, expect } from '@gameengine/test';
import { RoadFixtureRequested, RoadProofState } from '../../src/schema.gen.ts';

const SCENE = { scene: 'scenes/road-proof.scene.json' };
const SIZES = [[882, 344], [852, 393], [1080, 810], [1280, 720], [720, 540]] as const;

for (const [name, fixtureId] of [['straight', 0], ['right', 1], ['left', 2]] as const) {
  for (const [width, height] of SIZES) {
    renderTest(`road.${name} at ${width}x${height}`, async ({ input, step, render, world }) => {
      input.view(width, height, 1);
      input.emit(RoadFixtureRequested, { fixtureId, distance: 45000, speed: 7200, lateral: 0, playing: false });
      await step(2);
      const before = world.resource(RoadProofState);
      const sample = render.probe({
        width, height,
        points: [[Math.floor(width / 2), Math.floor(height * 0.1)], [Math.floor(width / 2), Math.floor(height * 0.85)], [5, Math.floor(height * 0.8)]],
      });
      const sky = sample.points[0]!.rgba;
      const asphalt = sample.points[1]!.rgba;
      const terrain = sample.points[2]!.rgba;
      // These fail if the mesh disappears or draws with the wrong color space.
      expect(sky[2]).toBeGreaterThan(240);
      expect(sky[0]).toBeLessThan(8);
      expect(Math.abs(asphalt[0] - asphalt[1])).toBeLessThan(4);
      expect(asphalt[0]).toBeGreaterThan(140);
      expect(asphalt[0]).toBeLessThan(165);
      expect(terrain[0]).toBeGreaterThan(terrain[2] + 15);
      render.expectDrawCalls('>', 0, { width, height });
      render.expectDrawCalls('<=', 50, { width, height });
      // Bounded 2000-triangle mesh plus the engine's fullscreen clear triangle.
      render.expectTriangles('<=', 2001, { width, height });
      expect(world.resource(RoadProofState)).toEqual(before);
      render.expectScreenshot('road', { width, height });
    }, SCENE);
  }
}
