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
     * Properties: none
     * Events: `resume`
     * Code areas: none
     * Refs: `resume`
     */
    'driving-pause': {
      props: {};
      areas: never;
      refs: 'resume';
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
  }
}
