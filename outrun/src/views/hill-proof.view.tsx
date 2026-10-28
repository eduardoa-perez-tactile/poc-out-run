import { Widget, defineView } from '@gameengine/ui';
export const HillProofView = defineView<Record<string, never>>({
  name: 'HillProofOrder', layer: 'overlay',
  description: 'Diagnostic yellow strip proving UI draws above the player plane.',
  samples: { proof: {} },
  render: () => <Widget id="hill-proof-order" doc="hill-proof" />,
});
