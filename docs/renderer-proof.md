# Renderer proof decision — synthetic fork and transition

Issue #8 extends the bounded road proof with continuous mirrored arms, a hill, two periodic
background layers and Map1→Map2 / Map1→Map6 diagnostic palette successors. It imports no source
panorama or production art and makes no campaign/checkpoint decisions.

`5` previews the left successor, `6` the right; `Space` pauses/resumes both distance and
transition ticks. `1`–`4` return to existing fixtures. Dedicated `fork-left` and `fork-right`
scenes provide identical moving inputs for native evidence. Preview requests are recorded;
keyboard requests retain playback state rather than replaying a stale pause value.

The fork uses one shared approach and matching per-segment endpoints. Its eased separation
reaches 9600 world units; the two asphalt strips cover overlapping inner rumbles until the
arms separate. Road and billboard crest clipping use the same sample. Background silhouettes
are code-native diagnostic geometry, not approved production panoramas: far/near silhouettes
wrap periodically and scroll at three/five periods per complete proof loop. All three profile
families are resident; during a wipe current and selected successor each draw far/near layers.

Simulation owns previous/current transition ticks, bounded at 180 fixed steps. Presentation
interpolates that state; paused ticks and interpolation history freeze. Existing fixtures leave
the inactive resource at its defaults. The background MeshRenderer is attached to the existing
camera entity (local depths 12.1/12/11.9, behind the road at camera depth 10); it adds no entity
or simulated transform. MeshRenderer is presentation-only. The engine omits default resource rows from hashes;
old replay verification must establish preservation rather than rewriting old baselines.

## Explicit source compatibility and corrections

- Source gap expansion truncates the increment before every segment. The existing reference
  case `0→1036` over 300 segments ends at `900`; reverse expansion ends at `136`. A focused
  oracle preserves this rule for future conversion. The synthetic fork uses smooth endpoints.
- Source rendering advances the background wipe five screen pixels per update and RGB one
  channel step per update. This proof deliberately uses fixed-step progress and linear-color
  blending, removing render-cadence and resolution dependence.
- Preview side controls framing and visual successor only. It cannot commit a campaign route,
  award a checkpoint or change movement speed. Route semantics remain a later ticket.

## Capability and cost evidence

Author checks on the macOS release hosts passed 26 T0 tests per V8/Hermes/web lane, with no
hash mismatches. All 15 prior road/hill test hashes are unchanged; both prior replay files were
left byte-identical. The canonical replay verifier is checked separately after the harness
scene-contract repair; this comparison does not claim that unavailable lane passed.

The 18 fork frames per tier cover both arms at approach/midpoint/successor across 882×344,
1280×720 and 720×540. They were visually reviewed; existing 54 road/hill goldens remain unchanged.
The full mobile T1 suite passed, as did existing compatibility cases and the focused fork
compatibility suite. All use desktop phone-low residency. Final candidate gates and browser
evidence belong in the PR after integration.

| Peak synthetic transition observation | Mobile tier | Compatibility tier |
|---|---:|---:|
| Maximum draws in the 180-step canonical fork replay | 6 | 6 |
| Pipelines created during replay | 0 | 0 |
| GC pauses above 4 ms | 0 | 0 |
| JS allocation during that replay run | 15.484 MiB | 10.584 MiB |
| Current dynamic mesh storage (runtime assertion) | ≤500,000 bytes | ≤500,000 bytes |

At midpoint, current and selected successor each contribute far/near geometry; all three
immutable profile families are loaded. Declared streams transfer at most 424,380 bytes per
active sample: road 396,000 + objects 14,300 + backgrounds 14,080. The native mesh layout calculation
is 447,528 bytes; these are calculated buffer sizes, not measured GPU bandwidth. No new textures
are loaded for the candidate backgrounds. Two short native moving runs (3.20/3.21 seconds, M2 Max, Metal, release host, 1920×1080)
advanced 185/191 fixed steps with zero idle skips. Left/right active-work p95 was 2.177/4.069 ms,
frame-interval p95 16.750/16.865ms, and RSS 174.44/174.84 MiB. First-frame intervals 178.33/54.47 ms
were startup hitches, not hidden steady-state samples. Additional endpoint-only native captures
confirmed exact successor sky RGB `(0,128,246)` / `(247,223,0)` after transition completion.
These are bounded desktop observations, not sustained or phone measurements. Actual browser
left/right transition observations remain separate final-candidate PR evidence.

The proof does not establish production panorama import/atlas seams, compressed sprite quality,
all-biome texture peaks, campaign transitions or physical-phone performance. Native timing/RSS
observations apply only to their recorded desktop host and profile. Hardware budgets remain
design targets. Source hill-parser and map-graph conversion policies remain in the reference
fixtures; this synthetic geometry does not silently repair imported map lengths or gaps.

## Diagnostic visual brief

Reference families are the exact Map1, Map2 and Map6 palette rows in
[the environment guide](art/environments.md). Broad far silhouettes and a darker near band
follow that guide's layering/readability rules; these polygon profiles are explicitly new
renderer diagnostics. They use normalized screen geometry rather than a native bitmap canvas,
repeat periodically, have no collision anchors and remain behind road/object/player/UI planes.
No production texture, atlas, panorama, logo or animation family is created by this ticket.
The preview replays boot the canonical start scene and activate through recorded events;
manual-only preview scenes are never used as replay recording contracts.
