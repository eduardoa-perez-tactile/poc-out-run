# Road-space contact detector

Issue #61 is the detector foundation of #14. It provides authored physical metadata,
authoritative motion stages, source-row sweeps, one accepted-contact event and the traffic
bonus eligibility seam. `scenes/driving-contact.scene.json` is a nondefault detector fixture:
contacts do not yet spin, slow or lock the player. Complete recovery is #62; source animation,
visual impact alignment and actual browser recovery acceptance are #63. This slice cannot
close #14 or establish a playable race.

Read [collision metadata](collision-metadata.md) for the reviewed source references, fixed
player/traffic hulls and roadside pivots. Physical bounds have inclusive faces. The original
150-unit contact grid motivates the authored half-length75 bodies and roadside row bands;
these are explicit road-space adaptations, not measured chassis lengths.

## Authoritative trajectories

An optional CollisionDriver on the sole TerrainDriver/TrafficPool entity requests stage
operands from the same terrain arithmetic that moves the player: start L0, post-steering LS,
post-carry LC, drift increment, raw LR and bounded LF, plus actual stored previousGap and the
actual new-speed30.5/right-road carry gate. The owner also records logical player Z endpoints,
handling cap and publication step. Detection rejects stale steps or mismatched owners/maps.
There is no second terrain integrator. Ownerless scenes create no motion trace or departure
list and retain the original traffic mask, RNG owner and physical arithmetic.

Sweeps interpolate continuous steering/drift within each source row. Right-road carry occurs
at the player's logical row-entry times; traffic uses its own car-row gap. This is the frozen
within-step interpolation adaptation: the source only defines aggregate operators, not a
unique continuous path. Each row interval closes with the original f32 operation order.
A stale stored gap remains the actual operand; any residual correction is a final landing,
and the carry gate still applies. Row changes and clamps test endpoint occupancy only; they
cannot sweep through skipped median space. Zero movement, reverse travel, exact row faces,
initial overlap and simultaneous actor jumps have explicit tests.

Pair-local row events retain their unrounded numerator/denominator ordering; equal f32
witness times alone do not make distinct events simultaneous. Poses and published witnesses
are f32. At a simultaneous final row entry, order is incoming both-pre, atomic both-post
with exact player LR, then the named player LR-to-LF bound landing with traffic already post.
No lateral segment connects either jump. Hit TOI selects a witness and priority; it never
rewinds or integrates the completed ordinary hit tick again.

## Identity, priority and passing

The query visits the source object-prefix rows touched by the swept player body and at most
32 selected traffic slots. Source collision:false is excluded; selected inactive cars remain
physical, and logical arm labels never prevent contact where road geometry overlaps.
Any roadside hit wins before traffic, even if a traffic TOI is earlier. Within a category,
priority is TOI, source slot order/placement ID or traffic slot/lifetime. Traffic keys name the
old epoch/slot/generation before finalize can recycle it.

Parking needs the same old-life rule. A car live at tick start can reach the bounded terminal
during advance, where park() overwrites interpolation history. Only collision-owned advances
capture that same computed trajectory before park. It exists through the closed incoming
terminal witness and disappears afterward; no later row or player-clamp landing can hit it.
Already parked cars stay excluded. This transient descriptor changes neither movement nor RNG.

An accepted contact suppresses all passing candidates that tick; finalize still consumes the
candidate's old passed flag. No-hit eligibility is unsigned0xffffffff. This whole-tick policy
is an intentional adaptation to the source's earlier award ordering. Recovery #62 adds the
locked-tick policy; the detector foundation itself never enables a recovery lock.

A fixed64-key SIM ledger prevents repeat acceptance while a lifetime remains overlapped.
Prune at the START pose before insertion: pruning a departing overlap at its end would allow
its initial overlap to trigger twice. Exact touching stays disarmed; strict separation or a
new generation rearms. The150-unit player interval touches at most3 closed150-unit roadside
bands, each with at most5 placements, plus32 traffic lives: at most47 start overlaps.
Capacity/extent/prefix assumptions are guarded; keys are never silently evicted.

Pause freezes detector state. Recorded driver/traffic resets, rebases and scene entry are
contact/pass barriers and clear the ledger; scene exit removes the owner. The entry reducer
explicitly classifies the contact fixture as driving and clears input holds and traffic
preview mode: cooking can omit their all-default resource rows, so scene JSON alone cannot
clear stale state from a previous driving/catalog/art scene. Stale motion cannot
create a hit while driving is inactive or at the paused section end. Loose and cooked fixtures
must retain the same optional-owner behavior.

## Evidence and fast iteration

`npm run test:focus -- 'collision.*'` runs the focused behavior. Tests cover real fork gaps,
source widths/pivots, exact faces, continuous and discontinuous sweeps, both arms, old-life
parking/recycle and nonvacuous same-tick passing suppression. Actual recorded inputs produce
roadside and seeded-traffic hits at1280x720,852x393 and1080x810 with identical contact events,
timing and physical outcomes. ViewInfo itself is recorded SIM state, so hashes across different
viewport inputs are not expected to match; identical recordings must match across JS lanes.

The coordinator records final native/cooked/web hashes, pre-edit ownerless trace comparison,
replay/hot-reload evidence, measured desktop workload, exact tested head/base and required CI
in the ticket PR. Missing evidence remains pending. No phone run, hardware FPS guarantee,
crash recovery or browser impact-to-control result is claimed by this detector document.

The new [roadside contact replay](../../outrun/tests/replays/collision_integration_recorded_roadside_crossing_accepts_original_placement_once_and_keeps_the_completed_driving_pose.greplay)
records12steps and ends at `b3ed026f0244625c`; it is registered in the normal suite.
The live endpoint regression separately proves an initially overlapping old car can contact
before it parks later in that tick. Separate recorded cases prove actual passing-candidate
consumption without award and old-generation contact before same-tick recycle; they do not
claim that the source's previous-player-row recycle condition permits both in one case.
