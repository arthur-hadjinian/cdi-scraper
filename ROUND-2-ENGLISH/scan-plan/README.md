# Collection scan plan

Prepared 2026-10-14T16:10:07.830Z. No baseline snapshot or agent-database mutation was made.

{
  "prepared_at": "2026-10-14T16:10:07.830Z",
  "origin_zip": "91506",
  "radius_miles": 50,
  "existing_centers": 328,
  "verified_existing_centers": 37,
  "census_area_centers_within_radius": 408,
  "unused_census_area_centers": 171,
  "unused_candidates_with_consistent_references": 163,
  "manual_reference_review": 8,
  "first_batch": 40,
  "current_agents": 52454,
  "batch_mix": {
    "coverage_and_boundary": 10,
    "productive_capped_overlap": 30
  },
  "limitations": [
    "Census ZCTAs are a geographic proxy, not a current USPS delivery-type certification. Each live center must still pass geocoding checks.",
    "Circle coverage is modeled from validated centers where available and legacy references otherwise. Unvalidated coverage is provisional.",
    "Scores are prioritization heuristics, not predicted agent counts; historical first-discovery yield is affected by search order.",
    "Centers are inside the 50-mile circle. Five-mile searches can also return outside-circle addresses; collection boundaries remain approximate.",
    "This planner does not modify the agent database, create a baseline snapshot, or launch the selected batch."
  ]
}

The first batch is prioritized, not a prediction of yield. Verify live locations and collect existing-license-deduplicated results. Track failures and cap statuses. The 8 reference disagreements must be reviewed before being queued.
