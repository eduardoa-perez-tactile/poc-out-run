// @generated — do not edit. Regenerate with `pnpm gen` (tools/bindgen).
// This project's UI documents (ui/**/*.ui.json, ADR 0122) as types: `<Widget doc="…">` checks its
// props, codeAreas and refs against them. Types only: nothing imports this file at run time.
// Events are the names `onIntent` hears: `<id>` is the placing `<Widget>`'s `id` or `eventKey` (else a slug of
// its first text property's value, else the document's name), or in a document the use's key; `<item>` is a
// Repeat item's key.
import type { LocText } from '@gameengine/ui';

declare module '@gameengine/ui' {
  interface UiDocumentTypes {
    /**
     * Driving action: a widget, button (ui/docs/driving-action.ui.json)
     *
     * Properties:
     *   - `label`: text, default "PAUSE"
     * Events: `<id>`
     * Code areas: none
     * Refs: none
     */
    'driving-action': {
      props: { label: string | { loc: string } | LocText };
      areas: never;
      refs: never;
    };
    /**
     * Driving controls: a view, screen (ui/docs/driving-controls.ui.json)
     *
     * Properties: none
     * Events: `pause`
     * Code areas: `left`, `right`, `brake`, `throttle`
     * Refs: `pause`
     */
    'driving-controls': {
      props: {};
      areas: 'left' | 'right' | 'brake' | 'throttle';
      refs: 'pause';
    };
    /**
     * Driving hold: a widget (ui/docs/driving-hold.ui.json)
     *
     * Properties:
     *   - `label`: text, default "LEFT"
     *   - `held`: yesno, default false
     * Events: none
     * Code areas: none
     * Refs: none
     */
    'driving-hold': {
      props: { label: string | { loc: string } | LocText; held: boolean };
      areas: never;
      refs: never;
    };
    /**
     * Driving pause: a view, dialog (ui/docs/driving-pause.ui.json)
     *
     * Properties:
     *   - `musicLabel`: text, default "MUSIC 65%"
     *   - `sfxLabel`: text, default "SFX 80%"
     *   - `muteLabel`: text, default "MUTE ALL"
     * Events: `music-volume`, `sfx-volume`, `mute`, `resume`
     * Code areas: none
     * Refs: `music-volume`, `sfx-volume`, `mute`, `resume`
     */
    'driving-pause': {
      props: { musicLabel: string | { loc: string } | LocText; sfxLabel: string | { loc: string } | LocText; muteLabel: string | { loc: string } | LocText };
      areas: never;
      refs: 'music-volume' | 'sfx-volume' | 'mute' | 'resume';
    };
    /**
     * Hill proof: a view, screen (ui/docs/hill-proof.ui.json)
     *
     * Properties: none
     * Events: none
     * Code areas: none
     * Refs: `order`
     */
    'hill-proof': {
      props: {};
      areas: never;
      refs: 'order';
    };
    /**
     * Menu choice: a widget, button (ui/docs/menu-choice.ui.json)
     *
     * Properties:
     *   - `label`: text, default "CHOOSE"
     * Events: `<id>`
     * Code areas: none
     * Refs: none
     */
    'menu-choice': {
      props: { label: string | { loc: string } | LocText };
      areas: never;
      refs: never;
    };
    /**
     * Pre race art: a view, screen (ui/docs/pre-race-art.ui.json)
     *
     * Properties:
     *   - `screen`: enum home | options | mode | gears | car, default "home"
     *   - `backgroundImage`: image, default {"guid":"92a936c8-c393-55b4-99fa-1577809ea30a"}
     *   - `logoImage`: image, default {"guid":"bb996565-daa0-5c2e-a839-98aa54e5afc1"}
     *   - `carImage`: image, default {"guid":"ea2af638-351f-5fc8-9336-ea546c30f216"}
     *   - `gearLeftImage`: image, default {"guid":"2fe74eb6-149a-58a2-bc45-71dd8be04c0b"}
     *   - `gearRightImage`: image, default {"guid":"f8c832b0-274e-558e-ab03-f42e31b70f84"}
     *   - `showLogo`: yesno, default true
     *   - `showCar`: yesno, default false
     *   - `showGears`: yesno, default false
     * Events: none
     * Code areas: none
     * Refs: none
     */
    'pre-race-art': {
      props: { screen: 'home' | 'options' | 'mode' | 'gears' | 'car'; backgroundImage: string; logoImage: string; carImage: string; gearLeftImage: string; gearRightImage: string; showLogo: boolean; showCar: boolean; showGears: boolean };
      areas: never;
      refs: never;
    };
    /**
     * Pre race controls: a view, screen (ui/docs/pre-race-controls.ui.json)
     *
     * Properties:
     *   - `screen`: enum home | options | mode | gears | car, default "home"
     *   - `heading`: text, default ""
     *   - `primaryLabel`: text, default "START"
     *   - `secondaryLabel`: text, default "OPTIONS"
     *   - `detailLabel`: text, default ""
     *   - `availabilityLabel`: text, default ""
     *   - `selectedRow`: number, default 0
     * Events: `primary`, `secondary`, `tertiary`, `back`, `accept`, `previous`, `next`
     * Code areas: none
     * Refs: `primary`, `secondary`, `tertiary`, `back`, `accept`, `previous`, `next`
     */
    'pre-race-controls': {
      props: { screen: 'home' | 'options' | 'mode' | 'gears' | 'car'; heading: string | { loc: string } | LocText; primaryLabel: string | { loc: string } | LocText; secondaryLabel: string | { loc: string } | LocText; detailLabel: string | { loc: string } | LocText; availabilityLabel: string | { loc: string } | LocText; selectedRow: number };
      areas: never;
      refs: 'primary' | 'secondary' | 'tertiary' | 'back' | 'accept' | 'previous' | 'next';
    };
    /**
     * Live race HUD: a view (ui/docs/race-hud.ui.json)
     *
     * Properties:
     *   - `time`: text, default "155"
     *   - `score`: text, default "0"
     *   - `lap`: text, default "00:00.00"
     *   - `speed`: text, default "0"
     *   - `gear`: text, default "AUTO · LOW"
     *   - `stage`: text, default "STAGE 1/5"
     *   - `notice`: text, default "READY"
     *   - `bonus`: text, default ""
     *   - `showNotice`: yesno, default true
     *   - `showBonus`: yesno, default false
     *   - `urgent`: yesno, default false
     * Events: none
     * Code areas: none
     * Refs: none
     */
    'race-hud': {
      props: { time: string | { loc: string } | LocText; score: string | { loc: string } | LocText; lap: string | { loc: string } | LocText; speed: string | { loc: string } | LocText; gear: string | { loc: string } | LocText; stage: string | { loc: string } | LocText; notice: string | { loc: string } | LocText; bonus: string | { loc: string } | LocText; showNotice: boolean; showBonus: boolean; urgent: boolean };
      areas: never;
      refs: never;
    };
    /**
     * Race restart action: a widget, button (ui/docs/race-hud-action.ui.json)
     *
     * Properties:
     *   - `label`: text, default "RACE AGAIN"
     * Events: `<id>`
     * Code areas: none
     * Refs: none
     */
    'race-hud-action': {
      props: { label: string | { loc: string } | LocText };
      areas: never;
      refs: never;
    };
    /**
     * Race results: a view, dialog (ui/docs/race-hud-results.ui.json)
     *
     * Properties:
     *   - `title`: text, default "FINISH!"
     *   - `score`: text, default "148,360,000"
     *   - `summary`: text, default "TIME BONUS 42 S"
     * Events: `restart`
     * Code areas: none
     * Refs: `restart`
     */
    'race-hud-results': {
      props: { title: string | { loc: string } | LocText; score: string | { loc: string } | LocText; summary: string | { loc: string } | LocText };
      areas: never;
      refs: 'restart';
    };
    /**
     * Radio controls: a view, screen (ui/docs/radio-controls.ui.json)
     *
     * Properties: none
     * Events: `previous`, `next`, `start`, `back`
     * Code areas: none
     * Refs: `previous`, `next`, `start`, `back`
     */
    'radio-controls': {
      props: {};
      areas: never;
      refs: 'previous' | 'next' | 'start' | 'back';
    };
    /**
     * Radio selection: a view, screen (ui/docs/radio-selection.ui.json)
     *
     * Properties:
     *   - `titleImage`: image, default "textures/radio/soundtrack1"
     *   - `dialImage`: image, default "textures/radio/radio1"
     *   - `handImage`: image, default "textures/radio/hand1"
     * Events: none
     * Code areas: none
     * Refs: none
     */
    'radio-selection': {
      props: { titleImage: string; dialImage: string; handImage: string };
      areas: never;
      refs: never;
    };
  }
}
