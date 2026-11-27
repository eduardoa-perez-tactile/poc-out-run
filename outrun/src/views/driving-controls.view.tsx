import { createEffect, createSignal, defineView, onCleanup, untrack, View, Widget } from '@gameengine/ui';

export interface DrivingControlsModel { enabled: boolean; heldMask: number; resetVersion: number; manual?: boolean; shiftEnabled?: boolean }
export const DrivingControlsView = defineView<DrivingControlsModel>({
  name: 'DrivingControls',
  description: 'Held steering and pedals, manual gear buttons. Intents: control {control,down}, shift {up}, pause.',
  samples: {
    driving: { enabled: true, heldMask: 0, resetVersion: 0 },
    steeringAndThrottle: { enabled: true, heldMask: 5, resetVersion: 0 },
    paused: { enabled: false, heldMask: 0, resetVersion: 0 },
    manual: { enabled: true, heldMask: 1, resetVersion: 0, manual: true, shiftEnabled: true },
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
    const shift = (up: boolean, name: string, label: string) => {
      const [pressed, setPressed] = createSignal(false);
      let reset = model().resetVersion;
      const enabled = () => model().enabled && model().manual === true && model().shiftEnabled === true;
      createEffect(() => {
        const m = model(), cancelled = reset !== m.resetVersion;
        reset = m.resetVersion;
        if (!enabled() || cancelled) untrack(() => setPressed(false));
      });
      onCleanup(() => setPressed(false));
      return View({
        id: `drive-${name}`, class: 'driving-hold-target', disabled: () => !enabled(),
        onPressIn: event => {
          if (event.phase !== 'down' || !enabled() || pressed()) return;
          setPressed(true);
          intent('shift', {up});
        },
        onPointerUp: () => setPressed(false),
        children: Widget({doc: 'driving-hold', props: {label, held: () => pressed()}}),
      });
    };
    return <Widget id="driving-controls" doc="driving-controls" props={{manual: () => model().manual === true}} codeAreas={{
      left: hold(2, 'left', 'LEFT'), right: hold(3, 'right', 'RIGHT'),
      brake: hold(1, 'brake', 'BRAKE'), throttle: hold(0, 'throttle', 'ACCEL'),
      gearDown: shift(false, 'gear-down', 'GEAR -'), gearUp: shift(true, 'gear-up', 'GEAR +'),
    }} onIntent={(_, event) => { if (event.path.at(-1) === 'pause') intent('pause'); }} />;
  },
});

export interface DrivingPauseModel {musicLabel?:string;sfxLabel?:string;muteLabel?:string;}
export const DrivingPauseView = defineView<DrivingPauseModel>({
  name: 'DrivingPause', layer: 'overlay', blockInput: true, dims: true,
  description: 'Driving pause and sound levels.', samples: { paused: {} },
  render: (model, { intent }) => <Widget id="driving-pause" doc="driving-pause" props={{
    musicLabel:()=>model().musicLabel??'MUSIC 65%',
    sfxLabel:()=>model().sfxLabel??'SFX 80%',muteLabel:()=>model().muteLabel??'MUTE ALL',
  }} onIntent={(_, event) => {
    const action=event.path.at(-1);
    if(action)intent(action);
  }} />,
});
