# Regional collection expansion — approved finite pass

Prepared October 16, 2026, Pacific time. The user authorized implementation,
investigation and bounded validation, but requested approval before final
collection or recurring tasks. The user subsequently approved the 13-center
finite pass, launched October 16, 2026 at 9:28 PM Pacific. Launch baseline:
67,542 saved agents. No recurring automation was created.

## Proposed finite pass

Nine initial searches: ZIPs 90095, 90506, 91042, 91759; city queries Agua Dulce,
Acton, Mount Baldy, Northridge and Lancaster. Four conditional candidates:
90223, 91329, 93539 and 93586. Each reference was geocoded through the official
CDI page and lies inside the 50-mile radius of 91506. Mount Baldy's postal and
city centers are distinct locations, not duplicate task identities.

The candidate pool contains 13 total centers; the 100-follow-up limit is a
safety ceiling, not permission to invent unverified candidates or expand scope.
An in-memory simulation queued all 13, reassessing productive capped parents
from the original phase as well as phase two. The live database was opened
read-only for that simulation.

Multiple follow-ups per parent are supported: up to three siblings, counting
earlier adaptive siblings; wait for the preceding sibling to finish; stop when
its unique yield is below 10 agents and below 5%. Depth limit remains three.
Deduplicate actual reference/submitted coordinates, with 0.75-mile spacing;
follow-ups must be within five miles of the parent. Initial area probes are
separate. Preserve every cap and skipped status as unresolved coverage.

## Validation and exclusions

Twenty-four bounded location checks were performed. Lebec postal/city centers
resolved outside the radius. 90888 resolved to the whole state rather than the
requested ZIP. Other inputs were held for proximity to a previous or proposed
center. Do not restore previously removed or skipped tasks in place; proposed
new centers have explicit IDs and independent, verified references.

Two normal CDI form checks passed: 91759 resolved to its reference but showed
no pagination/results in the bounded check; Agua Dulce returned 21 results.
Neither check collected producer records or updated the agent database.
All 16 automated safeguards and TypeScript compilation passed.

The public individual-name search has first/last-name fields but no geographic
or language filters. No bulk name-search collector was implemented or launched.
It would require a separate validation plan; it cannot promise the same audience.

## Approval gate and review artifacts

- Proposal: `ROUND-2-ENGLISH/scan-plan/expansion-plan-preview.json` (disabled).
- Location evidence: `expansion-location-verification.json`.
- Form evidence: `expansion-ui-checks.json`.
- Simulation: `expansion-simulation.json`.
- Map: http://127.0.0.1:8766/scan-plan/proposal.

Runtime ignores the proposal. It reads only
`ROUND-2-ENGLISH/scan-plan/approved-expansion-plan.json`, which must have
`enabled=true` and a real user-approval timestamp. That file was created only
after the user's approval. The existing supervisor uses unchanged pacing and
retries. Do not enlarge the approved candidate list or create a recurring
automation without additional user approval.

New center task IDs preserve provenance and first-discovery yield. The source
map keeps exported `source_zips` postal-only; city queries without a postal code
retain their input in SQLite `search_sources`, rather than inventing a ZIP.
