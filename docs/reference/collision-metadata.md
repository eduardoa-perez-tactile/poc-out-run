# Collision authoring reference

The detector child of #14 uses immutable physical dimensions in canonical road X/Z. It does
not yet provide crash movement, recovery, source crash poses or gameplay activation. Those
remain separate recovery and visual children. All source references below are pinned to
`6882721c99bc79365f815f68d389bf5078129e68`.

`src/sim/collision-metadata.ts` imports runtime deterministic math and schema types only.
No PNG, texture, atlas, frame selector, visual manifest, projected point, viewport or alpha
mask supplies a runtime collider. Authored source-reference dimensions remain physical data
when an image is replaced. Roadside records come from the preserved, frozen SourceBiome
source properties, not the independently replaceable runtime scenery atlas.

The source `PlayerCar.cpp:744–753` uses playerW77 with fixed3.2 screen scale; the94px Ferrari
canvas and the old unused halfWidth90 prototype are different values. `Line.cpp:82–94`
projects world X with `cameraD/depth * viewportWidth/2`; `Globals.h:89–92` sets FOV120.
The chosen authoring reference fixes width1280 and player depth702, so player half-width is
`(77*3.2/2) / ((1/tan60°)/702*1280/2)`, authored once as f32 **234.06068420410156**.
The source screen-center+5px bias is removed. This is a reviewed road-space adaptation:
source row-near depth and viewport varied; it is not a uniquely measured original body hull.
Runtime performs no trigonometry or projection to obtain that dimension.

For targets, source `PlayerCar.cpp:765–818,838–893` scales width by
`1.6*(.3/170)*pointScale*viewportWidth*1600*targetScale`. Dividing by projected road-unit
scale `pointScale*viewportWidth/2` gives `K=3.2*(.3/170)*1600`. K is authored/rounded once
to f32 **9.035294532775879**. Calculation order is then `q(width*K)`, `q(result*scale)`,
`q(result/2)`, where q is `math.fround`. This normalized road-space rounding contract is
not a claim of bitwise equality to the original sequence of projected multiplications.

Traffic physics fixes the original neutral `CarN/c1.png` reference for all32models, with
original path and SHA256 in each frozen entry. Width58 models1/7/13/19/25 have half-width
**314.4282531738281**; width40 models2/3/8/9/14/15/20/21/26/27 have
**216.84707641601562**; the remaining width44 models have **238.5317840576172**.
Target scale is source fixed1.2 rounded to f32, not model visual SCALE.9/1.3. Original
collision width followed the currently selected frame; fixing c1 is an intentional stability
adaptation, so poses cannot change physics. No runtime image read is required.

Roadside `Biome.cpp:130–203` preserves COLLISION, WIDTH_COLLISION, SCALE and distinct visual
and collision pivots. For a source placement, center starts at its own row's arm center
(0 or gap), plus `q(offsetX*1600)`. Full source canvas width is converted through K and SCALE
with the same f32 order, then shifted by collision-right pivot for nonnegative offset, or
negative `(1-collisionLeftPivot)` for negative offset. The half-width instead uses authored
WIDTH_COLLISION. Each multiplication, signed pivot factor and center sum is rounded in the
order defined by the helper. Visual pivots, vertical decoration and terrain labels cannot
change that hull. Source palm48 has reference canvas153px but collision width20px and separate
collision pivots~.36/.64; its physical half-width is **108.42353820800781**, not its canopy.
COLLISION:false returns no hull, even when the object is visible.

The source checks traffic in the same150-unit row and roadside on the player's current row;
it contains no measured longitudinal chassis length. The selected authored player/traffic
half-length75 and roadside band `[segment*150,(segment+1)*150]` are explicit grid-based
adaptations with inclusive faces. Finite player length expands roadside contact beyond the
original point-in-row check. Slot/placement identity comes from the source compiler, not an
art index. Contact priority, discontinuous trajectory handling, rearm and pass eligibility
belong to the detector/query contract rather than this metadata module.

Focused `collision.metadata*` tests cover the frozen authoring constants/all32model families,
source provenance anchors, source palm width/pivot branches, decorative exclusion, right-arm
placement gap, all committed placement bands and viewport/visual-pivot invariance. Native,
cooked and web results are recorded by the coordinator for the exact candidate; this document
makes no unrun gate, visual-alignment, full crash/recovery or phone-performance claim.
