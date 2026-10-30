import { app } from '@gameengine/runtime';
import { createEffect, createSignal, defineUI, emit, onCleanup, untrack, useResource, views, type ViewHandle } from '@gameengine/ui';
import { DrivingState, DrivingInput, DrivingControlChanged, DrivingControlsCancelled, DrivingPauseRequested } from '../schema.gen.ts';
import { DrivingControlsView, DrivingPauseView, type DrivingControlsModel } from '../views/driving-controls.view.tsx';

export const DrivingControlsOverlay = defineUI({
  name: 'DrivingControlsOverlay',
  root() {
    const state = useResource(DrivingState);
    const input = useResource(DrivingInput);
    const [resetVersion, setResetVersion] = createSignal(0);
    let controls: ViewHandle<DrivingControlsModel> | null = null;
    let pause: ViewHandle<Record<string, never>> | null = null;
    const cancel = () => {
      if (!state()?.active) return;
      setResetVersion((value) => value + 1);
      emit(DrivingControlsCancelled, {});
    };
    const model = (): DrivingControlsModel => ({ enabled: state()?.playing === true, heldMask: input()?.ui ?? 0, resetVersion: resetVersion() });
    onCleanup(app.onLifecycle((lifecycle) => { if (lifecycle === 'background') cancel(); }));
    createEffect(() => {
      const active = state()?.active === true;
      const playing = state()?.playing === true;
      const next = model();
      untrack(() => {
        if (active && !controls) controls = views.push(DrivingControlsView, next, {
          onIntent(name, payload) {
            if (name === 'pause') emit(DrivingPauseRequested, { paused: true });
            else if (name === 'control' && payload && typeof payload === 'object') {
              const value = payload as { control?: unknown; down?: unknown };
              if (typeof value.control === 'number' && Number.isInteger(value.control) && value.control >= 0 && value.control <= 3 && typeof value.down === 'boolean') {
                emit(DrivingControlChanged, { control: value.control, down: value.down, source: 1 });
              }
            }
          },
        });
        else if (!active && controls) { controls.close({ immediate: true }); controls = null; }
        controls?.update(next);
        if (active && !playing && !pause) pause = views.push(DrivingPauseView, {}, {
          onIntent: (name) => { if (name === 'resume') emit(DrivingPauseRequested, { paused: false }); },
        });
        else if ((!active || playing) && pause) { pause.close({ immediate: true }); pause = null; }
      });
    });
    onCleanup(() => { controls?.close({ immediate: true }); pause?.close({ immediate: true }); });
    return null;
  },
});
