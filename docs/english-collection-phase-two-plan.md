# English collection: next-stage plan

Prepared October 14, 2026. This is a proposed work plan, not permission to start a full enrichment run, paid research, or outreach. Screening policy remains `docs/imo-final-approval-rules.md`; export presentation remains `docs/recruiting-csv-columns.md`.

## Objective and starting point

Turn the English collection into a useful, traceable independent-IMO recruiting list for Life, final expense, IUL, and fixed annuities. Measure progress by eligible producers with usable contacts, alongside unique records collected.

At the latest detailed recovery check: 328 ZIP search centers were attempted, including 128 original centers and 200 recovery centers. The saved collection exceeded 52,000 unique licenses. The earlier recovery comparison found 22,639 licenses only through recovery searches, showing material value. Counts must be recalculated from the final snapshot, rather than copied into future reports.

Most searches reached CDI's 300-result cap. Historical locations were not all verified before the geocoding fix. Neither a finished queue nor a PASS decision proves exhaustive collection, current product sales, or the father's personal approval.

## 1. Close collection and freeze a baseline

- Let the final two searches finish or exhaust a bounded recovery pass. A cap is a finished available-results search, not complete coverage. If CDI keeps failing, retain explicit unresolved statuses and allow later work to proceed from the saved data rather than waiting indefinitely.
- Export a dated English-only CSV and consistent database backup. Keep the live file as a separate changing artifact.
- Record unique-license count, original/recovery counts, complete/capped/unresolved counts, collected dates, coordinate corrections, and search substitutions.
- Match the previously enriched 7,518 records to this English snapshot by license number. Count the actual overlap; do not assume the entire enrichment batch belongs to this language cohort. Reuse existing evidence with its check date and refresh stale/uncertain evidence where needed.

Deliverable: a frozen English master, collection coverage report, and license-keyed enrichment queue.

## 2. Check quality before scaling

Audit approximately 150 records in a stratified sample: original-search records, recovery-only records, and geographically flagged/near-boundary records. Reuse the earlier address flags as candidate review groups; rerun the audit on the final dataset because the previous audit covered only 48,972 records.

Check identity and license-link consistency; duplicate keys; actual resolved search center and fallback evidence where available; address geography; valid source/check dates; and whether apparent contacts are individual or shared. Unknown location or contact is retained as uncertainty. Geographic review is separate from recruiting eligibility.

Every new search must record the actual center, intended reference, distance between them, query input, and any substitute ZIP. A fallback changes the search circle and must remain visible in the coverage report. Five-mile searches around centers within 50 miles can return records outside the core 50-mile circle; do not claim strict-radius membership from source ZIP alone.

If sampling reveals a recurring source or parsing problem, repair and recheck the affected cohort before broad enrichment. Do not erase leads to improve reported accuracy.

Deliverable: quality findings, affected cohorts, and fixes or review queues.

## 3. Enrichment and screening pilot

Run a 250-record pilot of English licenses not yet enriched. Include original and recovery records, ordinary and mixed agency profiles, and missing-contact examples. Collect fresh CDI evidence and apply the existing rules deterministically where possible.

- Extract qualifications, issue dates, active appointments, agencies, languages, address/contact data, and source dates.
- Match confirmed exclusions against current relevant relationships, preserving terminated relationships as history rather than rejection triggers.
- Use REVIEW for genuinely missing/ambiguous records or unfamiliar agency classification. Do not invent exclusions to make results match an old list.
- Use model judgment only for the ambiguous factual/classification cases. Cache verified organization classifications with their sources and dates; do not extend exclusions through ownership alone.
- Keep producer fit, outreach readiness, and geography separate internally. Keep the agreed user-facing columns; do not restore removed priority, JSON, or diagnostic columns to the main export.
- Preserve eligible missing-contact leads. License appointments do not prove sales of the target products.

Manually spot-check at least 10 PASS, 10 FAIL, and 10 REVIEW cases. Inspect evidence and the explanation, not only whether a result matches an earlier decision. Correct systematic failures before scaling. If a category has fewer than 10 cases, review those available and state the limitation.

Deliverable: an XLSX pilot with Master, Passed, Failed, Needs review, and passed-language subsets; concise pilot validation and observed processing cost/time.

## 4. Scale enrichment in checkpoints

After the pilot is reviewed, process approximately 1,000 licenses per batch with durable evidence and license-keyed results, frequent checkpoints, bounded retries, and restart support. Give missing pages/partial evidence REVIEW, never an automatic FAIL.

For each batch report attempted/successful enrichment, new PASS/FAIL/REVIEW counts, concrete review causes, direct-contact readiness internally, missing-contact leads, remaining work, and measured throughput. Do not extrapolate the 7,518-record batch's pass rate as a promise for the full English cohort.

Retain the agreed 33-column workbook format and distinguish unchecked records from screened ones. Test language tabs against Master; a multilingual person may appear in multiple language subsets and must not be double-counted as a unique lead.

Deliverable: progressively enriched English master and traceable screening decisions.

## 5. Prioritize contact research

Start with eligible producers who already have stronger Life-business signals and potentially usable direct contacts. Suitable producers with missing/shared/toll-free-only contacts remain saved for research. Auto/home or health-only displayed relationships and no displayed relationships remain eligible under the rulebook but receive lower research priority.

Use public business sources first. Validate identity and whether a number reaches the producer; directory presence alone is not proof of directness. Use the LinkedIn queue's strong/possible/not-found distinctions. Do not automatically assign possible matches as confirmed identities. Paid enrichment and outbound messages require a separate user instruction.

Deliverable: an outreach-ready subset and a retained contact-research queue. No outreach is initiated by this plan.

## 6. Targeted additional recovery

Run a proposed 20-30 new search-center pilot, rather than simply removing the existing 200-center limit. Choose previously productive capped neighborhoods with sparse neighboring coverage, valid physical centers, and nearby searches that still yielded new licenses. Compare yield to the saved baseline, accounting for overlap and the order in which searches ran.

Keep validated California centers and existing conservative pacing. Record time, pages, unique additions, duplicate rate, caps, and failures for every search. Where feasible, measure downstream PASS and contact-ready yield as well as raw additions.

Use the existing recovery signal of at least 10 new licenses or 5% new records as a starting heuristic, not an eligibility rule. Expand promising clusters in small batches. After repeated neighboring searches yield few or no new agents, defer that cluster. End expansion when marginal useful yield no longer justifies collection time or a user-set budget. Do not assume all gaps are recoverable through CDI's interface.

Deliverable: a recovery-pilot scorecard and a justified expand/stop decision by neighborhood.

## Proposed order and decision gates

1. Final snapshot and coverage report.
2. Quality sample and targeted repairs.
3. 250-record enrichment pilot and evidence review.
4. Checkpointed bulk enrichment, producing useful passed/contact-ready leads.
5. Contact research for suitable leads that need it.
6. Bounded additional recovery in parallel only after the quality checks pass.

Continue collecting where measured yield is strong, but do not hold the usable existing list hostage to the last low-yield search. Report successful collection and actual recruitment-screen results separately. No new carrier exclusions, contact requirements, spending authority, or permission to message producers are created by this plan.
