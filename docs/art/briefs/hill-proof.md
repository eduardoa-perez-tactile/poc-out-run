# Hill renderer diagnostic atlas

- Asset ID: `diagnostics/hill-proof`; purpose: verify projection, contact, alpha ordering and bottom UV cropping in issue #7.
- Reference family: Map1's open blue sky, pale ground and compact road-facing silhouettes; see [environments](../environments.md). These geometric diagnostic symbols are proposed test fixtures, not replacement production artwork.
- Native atlas: 128×64 RGBA, four 32×64 cells. Each cell retains transparent margins; no trimming or rotation. Generator: `outrun/tools/build-hill-atlas.py`.
- Cells: asymmetric green roadside post, red rear-view traffic block, blue half-alpha overlap block, distant ochre ridge. Distinct top/middle/bottom bands expose UV stretching. Empty cutouts expose incorrect opaque blending.
- View/contact: fixed road-facing billboards, bottom-center pivot `[0.5,1]` in top-left image coordinates; fixture metadata supplies independent world width/height. No collision geometry.
- Palette: green `#179300`, yellow `#F7DF00`, red `#E64242`, blue `#0080F6`, ochre `#987808`, dark `#222222`; diagnostic role colors intentionally span reference families for measurable contrast.
- States: one still frame each; runtime projection supplies distance scaling. Review native atlas, near/far objects, fully/partially hidden crests, transparent overlaps and both landscape extremes.
- Runtime group: one small diagnostic texture/material; no biome-wide atlas or generated AI art. Alpha must remain clean outside silhouettes; mipmapped uncompressed sampling and bounded mesh buffers.
- Acceptance: reviewed T1 frames and moving native/browser crest sequence; no claims of production-art approval or phone measurements.
