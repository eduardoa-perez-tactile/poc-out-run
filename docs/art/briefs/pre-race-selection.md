# Original pre-race selection — source import brief

## Purpose and source

Reproduce the original main/options/mode/transmission/car selection family before the existing
radio and race. All pages reuse source art. The final vehicle-selection direction is to use the original
background, garage, shadow and car sprites. Preserve their proportions and use a black
panel with a thin yellow outline; do not fill the panel yellow. Art generation is deferred.
Source pin: `6882721c99bc79365f815f68d389bf5078129e68`. The relevant implementations are
`src/Menus/MenuGame`, `MenuOptions`, `MenuMode`, `MenuGears` and `MenuCarSelection`;
`src/Game/Game.cpp` records the transition order. Follow [UI/HUD](../ui-hud.md),
[art direction](../art-direction.md) and [asset delivery](../asset-delivery.md).

The full source path is attract/press-start → main START/OPTIONS → mode → transmission →
car → radio → loading → race preparation. This feature reuses the original selection screens;
credits, rankings, saved settings, controller rebinding and additional game-mode progression
remain separate work. Missing mode implementation must be explicit; never silently start
Original after presenting another mode as playable.

## Imported layers and native canvases

`src/content/pre-race-art.ts` supplies the runtime keys, frame arrays and source sizes.

| Family | Runtime prefix | Source images / canvases |
|---|---|---|
| Main/mode/transmission backdrop | `textures/menus/main/` | background 320×224; six logo frames 176×88; selector 600×457 |
| Transmission | `textures/menus/gears/` | gear1…4, all 161×188 |
| Car selection | `textures/menus/car/` | grayscale background320×224, garage320×350 and separate shadow106×14 |
| Car rotation previews | `textures/menus/car/ferrariN/` | N1…14, c121…c128, all171×46 |
| Options | `textures/menus/options/` | background921×691; panel1280×1124 |
| Menu font | `fonts/DisposableDroid` | original `Resources/Fonts/DisposableDroid.ttf` |

The129 imported reference images and the font are byte-identical copies. The vehicle screen
uses the source composition with corrected alpha and proportional sizing. `OptionsMenu/outrun.png` is actually
JPEG-encoded; it is imported unchanged as `options/panel.jpg`, with the extension matching its
encoding. All other imported images are PNG. MainMenu and ModeMenu duplicate the same files;
the source code itself uses MainMenu for both, so no duplicate runtime set is needed.

Keep full transparent canvases: nearest filtering, trim=false, atlas=none, compression=none,
mipmaps=false. Preserve original palettes and static logo lettering; do not redraw them as
generic modern cards. New dynamic labels/hit areas belong to officially authored UI documents.
Use the source menu font for these pages without changing unrelated HUD typography.

## Observed source composition

Let `sx=W/921` and `sy=H/691`. These are source placement references; landscape safe bounds
and platform hit targets still belong to the UI layer.

- Main background fills the view. Logo position is `(W/2−180sx,H/2−200sy)`, scaled `(2sx,2sy)`.
  Its six frames advance every eleven 60-Hz display iterations (about0.183s each).
- Main green START/OPTIONS labels begin at `x=W/2−50sx` and
  `y=H/2+(70 or120)sx`. The selector is scaled by `0.06sx` and sits at
  `x=W/2−100sx`, `y=H/2+(75 or125)sx`.
- Mode labels are ORIGINAL MODE, CONTINUOUS MODE and SURVIVAL MODE, at
  `x=W/2−80sx` and `y=H/2+(20,70,120)sx`. Source Up/Down selection clamps at the ends.
- Transmission uses the same backdrop/logo, a translucent black panel with green outline,
  white GEARS MENU and blue CHOOSE TRANSMISSION. The panel is `710sx×490sy` at
  `(W/2−350sx,H/2−250sy)`. Gear images use `1.5sx×1.5sy` scaling at
  `(W/2−280sx,H/2−65sy)` and `(W/2+50sx,H/2−65sy)`.
  Automatic selection shows gear1+gear4; Manual shows gear2+gear3.
- Car selection uses the original grayscale backdrop, black/yellow-outline
  panel, white title, garage preview, shadow and separate selected car. The main panel is `710sx×500sy` at
  `(W/2−350sx,H/2−250sy)`. The garage is `310sx` wide and starts at
  `y=H/2−80sy`; the source uses height `225sx` at1280×720/1366×768 and `300sx` at
  lower4:3 resolutions. The car is centered, scaled `(1.6sx,1.6sy)`, at `y=H/2+90sy`.
  Its eight source frames advance every0.1s. The shadow is centered at
  `y=H/2+135sy`, scaled `(2.75sx,2.75sy)`.
- Options uses the source cyan-outlined textured panel and original font. Source rows are
  DIFFICULTY, TRAFFIC, RESOLUTION, SOUND and CONTROLS. Idle/hover/selected/locked colors are
  `#5DF44B` / `#E9F064` / `#FFFF00` / `#F8332D`. Browser/native responsive sizing is not a
  desktop resolution picker; unavailable rebinding/save destinations remain separate work.

## Controls and actual configuration

Source Enter accepts and Escape returns to the previous page. Main/mode/options use Up/Down;
transmission uses Left/Right (Automatic left, Manual right). Car selection uses Left/Right
clamped across fourteen source color variants. Keyboard and touch must reach the same actions;
no race countdown runs behind these pages.

Options Enter selects an editable row; Left/Right changes its clamped value. Difficulty is
EASY/NORMAL/HARD, default NORMAL. Traffic is LOW/MEDIUM/HIGH, default MEDIUM; source populations
are9/20/32. Preserve existing race-rule mapping rather than applying timer modifiers twice.
SOUND and CONTROLS are source submenus, not additional race-selection parameters.

The fourteen menu previews map index-for-index to actual selected race atlases. Every color
uses the same verified body canvases, UVs, pivots, wheel effects and physics; selection changes
the texture group, not collision or handling. Only the selected player-ferrariN group should
be acquired for the race. This does not claim new mode, save, ranking or residency features.

## Acceptance scope

Use the existing minimal changed-flow check: source-looking pages, keyboard/touch forward and
back, selected configuration and color reaching the race, and the existing radio flow.
Inspect representative desktop/small-landscape frames. Keep remaining game features separate
and stop after this pre-race feature. No generated art, additional art family, profiling or phone work belongs to this feature.
