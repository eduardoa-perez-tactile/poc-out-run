import { createEffect, createSignal, defineView, onCleanup, untrack, View, Widget } from '@gameengine/ui';

export interface DrivingControlsModel { enabled: boolean; heldMask: number; resetVersion: number }
export const DrivingControlsView = defineView<DrivingControlsModel>({
  name: 'DrivingControls',
  description: 'Held steering and pedals. Intents: control {control,down}, pause.',
  samples: {
    driving: { enabled: true, heldMask: 0, resetVersion: 0 },
    steeringAndThrottle: { enabled: true, heldMask: 5, resetVersion: 0 },
    paused: { enabled: false, heldMask: 0, resetVersion: 0 },
  },
  render(model, { intent }) {
    const hold = (control: number, name: string, label: string) => {
      const [pressed, setPressed] = createSignal(false);
      let reset = model().resetVersion;
      const change = (down: boolean) => {
        if (pressed() === down) return;
        setPressed(down);
        intent('control', { control, down });
      };
      createEffect(() => {
        const m = model();
        const cancelled = reset !== m.resetVersion;
        reset = m.resetVersion;
        // Sim releases and lifecycle cancellation also clear presentation feedback.
        if (!m.enabled || cancelled || (m.heldMask & (1 << control)) === 0) untrack(() => change(false));
      });
      onCleanup(() => change(false));
      return View({
        id: `drive-${name}`, class: 'driving-hold-target', disabled: () => !model().enabled,
        onPressIn: (event) => { if (event.phase === 'down' && model().enabled) change(true); },
        onPointerUp: () => change(false),
        children: Widget({ doc: 'driving-hold', props: { label, held: () => pressed() || (model().heldMask & (1 << control)) !== 0 } }),
      });
    };
    return <Widget id="driving-controls" doc="driving-controls" codeAreas={{
      left: hold(2, 'left', 'LEFT'), right: hold(3, 'right', 'RIGHT'),
      brake: hold(1, 'brake', 'BRAKE'), throttle: hold(0, 'throttle', 'ACCEL'),
    }} onIntent={(_, event) => { if (event.path.at(-1) === 'pause') intent('pause'); }} />;
  },
});

export const DrivingPauseView = defineView<Record<string, never>>({
  name: 'DrivingPause', blockInput: true, dims: true,
  description: 'Minimal blocking driving pause. Intent: resume.', samples: { paused: {} },
  render: (_, { intent }) => <Widget id="driving-pause" doc="driving-pause" onIntent={(_, event) => {
    if (event.path.at(-1) === 'resume') intent('resume');
  }} />,
});
