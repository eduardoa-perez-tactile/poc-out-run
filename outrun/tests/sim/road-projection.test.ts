import { worldTest, expect } from '@gameengine/test';
import { buildRoadBuffers, VISIBLE_SEGMENTS } from '../../src/render/road-projection.ts';

worldTest('road.projection near plane and loop boundaries stay finite and bounded', async () => {
  for (const fixture of [0, 1, 2]) {
    for (const distance of [0, 149.999, 150, 45000, 179999.999, 180000, -150]) {
      const data = buildRoadBuffers(fixture, distance, 0, 16 / 9);
      expect(data.positions.length).toBe(VISIBLE_SEGMENTS * 5 * 4 * 3);
      expect(data.indices!.length).toBe(VISIBLE_SEGMENTS * 5 * 6);
      expect(data.positions.every(Number.isFinite)).toBe(true);
      for (let i = 0; i < data.indices!.length; i += 3) {
        const ia = data.indices![i]! * 3;
        const ib = data.indices![i + 1]! * 3;
        const ic = data.indices![i + 2]! * 3;
        const ax = data.positions[ia]!; const ay = data.positions[ia + 1]!;
        const bx = data.positions[ib]!; const by = data.positions[ib + 1]!;
        const cx = data.positions[ic]!; const cy = data.positions[ic + 1]!;
        expect((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)).toBeGreaterThanOrEqual(0);
      }
    }
  }
});

worldTest('road.projection left and right fixture geometry mirror while buffers are reused', async () => {
  const right = buildRoadBuffers(1, 45000, 0, 16 / 9);
  const rightPositions = right.positions.slice();
  const left = buildRoadBuffers(2, 45000, 0, 16 / 9);
  expect(left.positions === right.positions).toBe(true);
  // Quad 2 is the asphalt strip. Its endpoint center changes sign, not width or Y.
  let different = false;
  for (let quad = 2; quad < 200 * 5; quad += 5) {
    const p = quad * 12;
    const rightCenter = (rightPositions[p]! + rightPositions[p + 3]!) / 2;
    const leftCenter = (left.positions[p]! + left.positions[p + 3]!) / 2;
    expect(leftCenter).toBeCloseTo(-rightCenter, 5);
    if (Math.abs(rightCenter) > 0.01) different = true;
    expect(left.positions[p + 1]).toBe(rightPositions[p + 1]);
  }
  expect(different).toBe(true);
});
