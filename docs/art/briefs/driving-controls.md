# Driving-control prototype brief

- Asset/family: engine-rendered held-control and pause documents; no raster asset production.
- Context: #17 opt-in driving proof, landscape mobile/web; preserve central road and car space.
- References: [UI/HUD guide](../ui-hud.md), uppercase source control labels and the proposed
  lower-side composition in [layout proposal](../references/landscape-layout.svg).
- Proposed appearance: dark navy `#15283D` panels, white live labels; held state uses
  warm amber `#EAA847` with dark navy labels and a0.92-scale inset face. These are prototype conventions, not copied source swatches.
- Logical size:176×176 UI reference pixels per control; actual hit areas must remain≥50 view
  points across the five test sizes. No claim of physical-device measurements.
- Anchor: bottom-left steering pair, bottom-right pedal pair;32-reference-pixel safe-edge gap.
- States: normal, held, cancelled/released, paused beneath a blocking dimmed dialog. UI state
  cannot change handling except through recorded control/pause input.
- Runtime delivery: CLI-authored UI documents and live engine text; no sprites, atlas, pivot,
  import metadata or additional asset group. Default font remains a prototype font choice.
- Review: real small-screen frame and hit tests, both notch rotations, distinct simultaneous
  controls, readable held feedback and a clear middle40% of the road. No physical-phone work.
