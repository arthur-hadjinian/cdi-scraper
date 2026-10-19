# Capped-area midpoint recovery — research plan

User requested a plan for the 499 capped searches on October 16, 2026, while
authorizing the separate 13-center pass to launch. The user subsequently
authorized the 65-candidate validation and all-phase capped-area expansion.
The broader pipeline is now approved and running. No recurring app automation
was created; two finite local supervisors handle validation and collection.

The underlying strategy remains shifting the search center to reveal a different
result set. Earlier implementations narrowed the pool to unused postal ZIPs,
excluded centers closer than 0.75 miles to reserved centers, processed parents
once, and permitted one adaptive child. These were efficiency limits, not proof
that the regional producer population was exhausted.

## Research inventory

Read-only planning found 499 capped centers. 231 have recorded live geocoding
evidence; 268 retain only historical reference coordinates and need verification
before relying on their midpoint geometry. Among verified centers, 2,578
overlapping pairs were separated by 1.5–8 miles. Pair midpoints are planning
targets, not unsupported raw-coordinate searches.

Official 2020 Census California place references add named city/community inputs
to the remaining postal-reference pool. There are 202 published place points
inside the 50-mile circle. Ranked positions near capped-pair midpoints, with
at least 0.75-mile spacing from existing/reserved centers, produced 65 spatially
deduplicated research inputs. These are unverified search candidates, not a
promise of 65 useful new centers. The Google geocoder may resolve a city name
away from its Census internal point or to a previously searched location.

Source: https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_gaz_place_06.txt
Inventory: `ROUND-2-ENGLISH/scan-plan/cap-midpoint-research-plan.json`.

## Authorized execution sequence

1. Observe results from the approved 13-center pass; preserve marginal unique
   additions, elapsed time, actual coordinates and cap status.
2. Validate the 65 shortlisted inputs through normal CDI ZIP/city controls.
   Reject whole-state resolutions, wrong places, outside-radius centers and
   duplicate actual coordinates. Verify older parent coordinates as needed.
3. Rank verified new positions by nearby capped clusters, useful prior yield,
   distance from existing centers, and proximity to midpoint targets. Midpoints
   should guide selection, not automatically override yield or location quality.
4. Publish distinct verified inputs into the approved candidate manifest and
   bounded collection queue using the user's broader authorization. Preserve
   every rejection reason and the approved 13-center work already in progress.
5. After each finished probe, recompute candidates across all phases. Permit
   multiple sides/siblings if prior probes are productive; stop low-yield branches.
   Track recent per-probe yield rather than treating old first-discovery totals
   as a guarantee of current recovery potential.

Retain finite batch/depth/sibling limits and existing skipped-location handling.
Do not restart capped searches at identical submitted coordinates without a
specific diagnostic reason. Increasing the search radius can increase the cap
problem, and the CDI form's minimum supported radius is five miles.

Execution checkpoint: `ROUND-2-ENGLISH/scan-plan/cap-expansion-validation-state.json`.
Validation log: `ROUND-2-ENGLISH/logs/cap-validation.log`.
Run `node --experimental-sqlite --disable-warning=ExperimentalWarning --import tsx ../scripts/english-grand-status.ts`
from ROUND-2-ENGLISH for status including the new validation pipeline.

Limits: process the frozen 65 inputs first, then verify legacy capped-parent
postal inputs and refresh the shortlist. Maximum 150 candidate inputs in this
finite validation run and 100 newly verified midpoint centers. Collection also
retains its 100-follow-up ceiling, three sibling/depth limits, low-yield stop and
0.75-mile spacing. Geographic checks run at five-second intervals, with two
attempts for transient geocoder failures; quota/access failures stop for attention.
Legacy current-location checks never overwrite historical submitted-center
evidence. Resume checkpoints survive interruption; publishing uses atomic files.

If a cluster has no distinct supported ZIP/city centers left, geographic recursion
is exhausted for that cluster. Mark its remaining coverage uncertain. A separate
supported search method would need its own evidence, validation and approval.
