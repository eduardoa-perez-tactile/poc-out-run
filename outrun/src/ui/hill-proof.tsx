import { createEffect, defineUI, untrack, useResource, views, type ViewHandle } from '@gameengine/ui';
import { RoadProofState, VehiclePreview } from '../schema.gen.ts';
import { HillProofView } from '../views/hill-proof.view.tsx';
export const HillProofOverlay = defineUI({
  name: 'HillProofOverlay',
  root: () => {
    const state = useResource(RoadProofState);
    const vehicle = useResource(VehiclePreview);
    let proof: ViewHandle<Record<string, never>> | null = null;
    createEffect(() => {
      const visible = state()?.fixtureId === 3 && vehicle()?.enabled !== true;
      untrack(() => {
        if (visible && !proof) proof = views.push(HillProofView, {});
        else if (!visible && proof) { proof.close(); proof = null; }
      });
    });
    return null;
  },
});
