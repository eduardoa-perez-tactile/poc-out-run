import { renderTest } from '@gameengine/test';

// Starter coverage only. Road, car, HUD and touch assertions arrive with those features.
renderTest('bootstrap.landscape renderer draws within starter budget', async ({ step, input, render }) => {
  await step(40);
  for (const [width, height] of [[882, 344], [852, 393], [1080, 810], [1280, 720], [720, 540]]) {
    input.view(width!, height!, 1);
    await step(1);
    render.expectDrawCalls('>', 0, { width: width!, height: height! });
    render.expectDrawCalls('<=', 50, { width: width!, height: height! });
  }
});
