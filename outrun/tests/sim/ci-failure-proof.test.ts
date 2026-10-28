import { worldTest, expect } from '@gameengine/test';

// Disposable CI evidence only. Never merge this branch.
worldTest('ci.intentional failure proves engine validation blocks integration', async ({ step }) => {
  await step(1);
  expect(true).toBe(false);
}, { scene: 'scenes/road-proof.scene.json' });
