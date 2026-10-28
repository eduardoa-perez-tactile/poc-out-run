// @generated — do not edit. Regenerate with `pnpm gen` (tools/bindgen).
// This project's UI documents (ui/**/*.ui.json, ADR 0122) as types: `<Widget doc="…">` checks its
// props, codeAreas and refs against them. Types only: nothing imports this file at run time.
// Events are the names `onIntent` hears: `<id>` is the placing `<Widget>`'s `id` or `eventKey` (else a slug of
// its first text property's value, else the document's name), or in a document the use's key; `<item>` is a
// Repeat item's key.
export {};

declare module '@gameengine/ui' {
  interface UiDocumentTypes {
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
  }
}
