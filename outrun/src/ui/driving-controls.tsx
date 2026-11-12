import { app } from '@gameengine/runtime';
import { createEffect, createSignal, defineUI, emit, onCleanup, untrack, useResource, views, type ViewHandle } from '@gameengine/ui';
import { DrivingState, DrivingInput, DrivingControlChanged, DrivingControlsCancelled, DrivingPauseRequested, RaceState } from '../schema.gen.ts';
import { DrivingControlsView, DrivingPauseView, type DrivingControlsModel, type DrivingPauseModel } from '../views/driving-controls.view.tsx';
import {getRaceAudioSettings,subscribeRaceAudioSettings,toggleMute,setRaceAudioSettings} from '../audio/race-audio.ts';

export const DrivingControlsOverlay = defineUI({
  name: 'DrivingControlsOverlay',
  root() {
    const state = useResource(DrivingState);
    const input = useResource(DrivingInput);
    const race = useResource(RaceState);
    const [resetVersion, setResetVersion] = createSignal(0);
    let controls: ViewHandle<DrivingControlsModel> | null = null;
    let pause: ViewHandle<DrivingPauseModel> | null = null;
    const [sound,setSound]=createSignal(getRaceAudioSettings());
    onCleanup(subscribeRaceAudioSettings(setSound));
    const cancel = () => {
      if (!state()?.active) return;
      setResetVersion((value) => value + 1);
      emit(DrivingControlsCancelled, {});
    };
    const model = (): DrivingControlsModel => ({ enabled: state()?.playing === true || (race()?.initialized === true && race()?.phase === 0), heldMask: input()?.ui ?? 0, resetVersion: resetVersion() });
    onCleanup(app.onLifecycle((lifecycle) => { if (lifecycle === 'background') cancel(); }));
    createEffect(() => {
      const active = state()?.active === true;
      const playing = state()?.playing === true;
      const paused = race()?.initialized === true ? race()?.phase === 8 : !playing;
      const next = model();
      const audio=sound();
      const pauseModel:DrivingPauseModel={
        musicLabel:`MUSIC ${Math.round(audio.musicVolume*100)}%`,sfxLabel:`SFX ${Math.round(audio.sfxVolume*100)}%`,
        muteLabel:audio.muted?'UNMUTE ALL':'MUTE ALL'};
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
        if (active && paused && !pause) pause = views.push(DrivingPauseView, pauseModel, {
          onIntent: (name) => {
            if (name === 'resume') emit(DrivingPauseRequested, { paused: false });
            else if(name==='mute')toggleMute();
            else if(name==='music-volume')setRaceAudioSettings({musicVolume:((Math.floor(getRaceAudioSettings().musicVolume*4+0.001)+1)%5)/4});
            else if(name==='sfx-volume')setRaceAudioSettings({sfxVolume:((Math.floor(getRaceAudioSettings().sfxVolume*4+0.001)+1)%5)/4});
          },
        });
        else if ((!active || !paused) && pause) { pause.close({ immediate: true }); pause = null; }
        pause?.update(pauseModel);
      });
    });
    onCleanup(() => { controls?.close({ immediate: true }); pause?.close({ immediate: true }); });
    return null;
  },
});
