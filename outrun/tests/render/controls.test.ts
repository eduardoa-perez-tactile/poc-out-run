import { renderTest, expect, type UIRect } from '@gameengine/test';
import { DrivingState, DrivingInput } from '../../src/schema.gen.ts';
const SCENE = { scene: 'scenes/driving-proof.scene.json' };
const SIZES = [[882, 344], [852, 393], [1080, 810], [1280, 720], [720, 540]] as const;
const center = (r: UIRect): [number, number] => [r.x + r.width / 2, r.y + r.height / 2];

renderTest('controls.hit targets hold steering and throttle independently until up or cancel', async ({ world, input, step, render, ui }) => {
  input.view(852, 393, 1, [59, 0, 0, 34]);
  await step(3); render.stats({ width: 852, height: 393 });
  const left = center(ui.rect('drive-left')!); const throttle = center(ui.rect('drive-throttle')!);
  input.pointer('down', ...left, 1); input.pointer('down', ...throttle, 2);
  await step(3);
  expect(world.resource(DrivingInput).ui).toBe(5);
  expect(world.resource(DrivingState).legacySpeed > 0).toBe(true);
  input.pointer('move', 426, 100, 1);
  await step(2);
  expect(world.resource(DrivingInput).ui).toBe(5);
  input.pointer('move', ...left, 1); await step(2);
  expect(world.resource(DrivingInput).ui).toBe(5);
  input.pointer('up', 426, 100, 1); await step(3);
  expect(world.resource(DrivingInput).ui).toBe(1);
  input.key('ArrowUp', true);
  input.pointer('cancel', ...throttle, 2); await step(3);
  expect(world.resource(DrivingInput).ui).toBe(0);
  expect(world.resource(DrivingInput).keyboard).toBe(1);
  input.key('ArrowUp', false); await step(2);
  expect(world.resource(DrivingInput).keyboard).toBe(0);
}, SCENE);

for (const notchRight of [false, true]) {
renderTest(`controls.pause modal blocks and centers with notch ${notchRight ? 'right' : 'left'}`, async ({ world, input, step, render, ui }) => {
  const insets: [number, number, number, number] = notchRight ? [0, 0, 59, 34] : [59, 0, 0, 34];
  input.view(852, 393, 1, insets); await step(3); render.stats({ width: 852, height: 393 });
  const throttle = center(ui.rect('drive-throttle')!);
  input.pointer('down', ...throttle, 1); await step(3);
  expect(world.resource(DrivingInput).ui).toBe(1);
  await ui.press('driving-controls.pause'); await step(3);
  render.stats({ width: 852, height: 393 });
  const panel = ui.rect('driving-pause')!;
  expect(panel !== null).toBe(true);
  expect(Math.abs(panel.x + panel.width / 2 - 426) < 1).toBe(true);
  expect(Math.abs(panel.y + panel.height / 2 - 196.5) < 1).toBe(true);
  expect(panel.x >= insets[0] && panel.y >= 0).toBe(true);
  expect(panel.x + panel.width <= 852 - insets[2] && panel.y + panel.height <= 393 - 34).toBe(true);
  expect(world.resource(DrivingState).playing).toBe(false);
  expect(world.resource(DrivingInput).ui).toBe(0);
  input.pointer('up', ...throttle, 1);
  input.pointer('down', ...throttle, 2); await step(3);
  expect(world.resource(DrivingInput).ui).toBe(0);
  input.pointer('up', ...throttle, 2); await step(2);
  const resume = ui.rect('driving-pause.resume');
  expect(resume !== null).toBe(true);
  expect(Math.abs(resume!.x + resume!.width / 2 - (panel.x + panel.width / 2)) < 1).toBe(true);
  await ui.press('driving-pause.resume'); await step(3);
  expect(world.resource(DrivingState).playing).toBe(true);
  expect(world.resource(DrivingInput).ui).toBe(0);
}, SCENE);
}

for (const [width, height] of SIZES) {
  for (const rotated of [false, true]) {
    renderTest(`controls.safe targets at ${width}x${height} notch ${rotated ? 'right' : 'left'}`, async ({ world, input, step, render, ui }) => {
      const insets: [number, number, number, number] = rotated ? [0, 0, 59, 34] : [59, 0, 0, 34];
      input.view(width, height, 1, insets); await step(3);
      const stats = render.stats({ width, height });
      expect(stats.drawCalls < 60).toBe(true);
      for (const name of ['left', 'right', 'brake', 'throttle']) {
        const r = ui.rect(`drive-${name}`)!;
        expect(r !== null).toBe(true);
        expect(r.width >= 50 && r.height >= 50).toBe(true);
        expect(r.x >= insets[0] && r.y >= insets[1]).toBe(true);
        expect(r.x + r.width <= width - insets[2] + 0.5).toBe(true);
        expect(r.y + r.height <= height - insets[3] + 0.5).toBe(true);
        // Keep the middle40% free for near road/player visibility.
        expect(name === 'left' || name === 'right' ? r.x + r.width < width * 0.3 : r.x > width * 0.7).toBe(true);
      }
      expect(world.resource(DrivingInput).ui).toBe(0);
    }, SCENE);
  }
}
