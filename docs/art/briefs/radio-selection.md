# Original radio selection — source import brief

- Family/purpose: the original pre-race illustrated coastal radio screen; select and preview
  the race soundtrack before loading/countdown. This is a direct source import, not new art.
- Reference: upstream `6882721c99bc79365f815f68d389bf5078129e68`,
  `Resources/Menus/MusicMenu/` and `src/Menus/MenuMusicRadio/MenuMusicRadio.cpp`.
  See [UI/HUD guide](../ui-hud.md) for the existing observed radio family.
- Palette and layers: preserve the exact source RGBA pixels, transparency and baked static
  title lettering. Draw background, selected track title, selected dial, then selected hand.
  Do not replace these with a generic settings card, pause-menu radio selector or generated art.
- Delivery: `assets/textures/radio/` contains all 22 original PNGs, byte-identical to source.
  Import as untrimmed textures with nearest filtering, no compression, mipmaps or atlas.
  UI documents own placement and semantic actions; imported images have no collision role.

## Native canvases and asset keys

| Layer | Source canvas | Runtime key |
|---|---|---|
| Background | 320×224 | `textures/radio/radioBackground` |
| Titles 1–9 | widths 175,127,111,139,125,138,80,84,103; height16 | `textures/radio/soundtrack1` … `soundtrack9` |
| Dial frames 1–9 | 126×30 | `textures/radio/radio1` … `radio9` |
| Hand frames 1–3 | 133×59 | `textures/radio/hand1` … `hand3` |

All overlays keep their full source canvas and top-left placement origin. The source has
no sprite-sheet slicing or additional pose interpolation.

## Observed layout and interaction

For viewport `W×H`, the source defines `sx=W/921`, `sy=H/691`:

- Stretch the background to the viewport.
- Title size is `(nativeWidth×3×sx, 16×3×sx)`; center it horizontally and vertically.
- Dial size is `(126×3×sx, 30×3×sy)`; place at
  `x=(W−dialWidth×0.5)/2`, `y=H×0.8725−dialHeight`.
- Hand size is `(133×3×sx, 59×3×sy)`; place at
  `x=(W−handWidth×0.66)/2`, `y=H−handHeight`.

Entering the screen selects source track1 (Magical Sound Shower), plays the radio-intro
effect and coastal Wave loop, and previews that track. Left/Right choose within tracks1–9:
selection clamps at the ends; it does not wrap. A change plays the original choose effect
and replaces the preview. Title/dial use the selected index; hand uses index modulo3.

Enter confirms, plays the original confirm effect, stops menu Wave/preview, then proceeds
through loading to race preparation. Escape plays the original back effect and returns to
vehicle selection in the source; vehicle/menu completion remains separate backlog work.
The race clock/countdown must not run behind this selection screen.

For mobile, map touch equivalents to the same previous/next/confirm actions while retaining
the original illustrated screen and readable safe-area hit targets. Do not invent additional
visible settings panels. Any unsupported earlier-menu destination must stay explicit rather
than launching a separate menu-port workstream in this audio ticket.

## Audio delivery

`audio-catalog.ts` keeps the nine source radio tracks and includes the original intro
`radioSelect`, change `radioMove`, confirmation `radioConfirm`, back `radioBack` and `wave`
effects. These are preloaded in `audio/race/core.bank`; Wave deliberately retains source
stereo. Long selected music remains streamed outside the bank. Stop Wave and preview on
screen exit/cleanup; pause/background handling belongs to the presentation audio controller.

## Acceptance scope

Inspect one actual selection frame at desktop and small landscape size, actual left/right
selection and confirm/start, and audible preview/cleanup using the existing audio checks.
Reuse existing race evidence. No new art generation, broad UI sweep or phone work is needed.
