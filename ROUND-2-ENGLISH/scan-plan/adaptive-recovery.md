# Adaptive collection recovery

Enabled October 14, 2026 at the user's request. After each successful search,
reassess previously unhandled capped searches in the phase-two batch, including
new adaptive children. Existing completed/capped searches are not restarted.

- Reserve all already queued or searched ZIPs, so none can be added twice.
- Choose at most one new nearby center per capped parent and append it after
  the existing queue, with a persistent rank that survives restart.
- Recompute ranking from current saved unique yield and spacing from existing
  search centers. Actual validated search coordinates take precedence over
  old reference coordinates when available.
- Require at least 10 newly discovered agents or 5% unique yield at the parent.
- Stop at 100 extra centers, three adaptive generations, exhausted candidates,
  or low unique yield. Candidates must be within 50 miles of 91506, within
  five miles of the parent, and at least 0.75 miles from reserved centers.
- Keep the eight user-removed coordinate centers excluded.
- Candidate pool uses the bundled California ZIP references. The consistent
  Census candidates are already queued; remaining postal references may include
  special-purpose ZIPs. They must pass the existing live geocoding checks before
  any results are saved. Ranking is a heuristic, not proof of missing agents.
- Every cap remains truncated: added centers cannot prove complete coverage.

Settings: `adaptive-recovery-settings.json`. Saved rationale and parent/child
links: SQLite `adaptive_decisions` and `adaptive_recovery`. Disable the feature
by setting `enabled` false; existing queued work remains saved.
