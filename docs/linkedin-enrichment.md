# LinkedIn enrichment operated from this chat

Created October 10, 2026 at the user's request for a low-cost workflow for about
10,000 rows. The first pilot researches 50 existing passed rows; it does not
rescreen producer eligibility or change the father's approval history.

## What is implemented

This chat performs public web searches and evaluates identity evidence. A local
SQLite queue saves results by license number, skips completed rows, rejects
unknown licenses and accidental overwrites, and separates uncertain URLs from
strong matches. The scripts do not make network requests, switch chat models,
schedule background work, or spend API credits. They are a durable backing store
for the chat, not an unattended search service.

User commands can be ordinary requests: "Enrich the next 50", "Show possible
matches", or "Export the current results". Only process the batch requested.

Current job: `outputs/linkedin-pilot/`. Source: the user's
`cdi-agents-full-batch (1).xlsx`, Master sheet, `Passed Test = Yes`.
There are 5,232 such rows in this file. Preserve their order and all original
columns. `Yes` means the existing screen passed, not a new personal approval.
Input fingerprint and filtering settings are saved. A changed workbook/filter
requires a new job; do not silently attach results to different people.

## Run a batch

Use the bundled Python/Node paths from `load_workspace_dependencies`. The commands
below use `python` and `node` as shorthand for those executables. Run from the
repository root.

1. Read this document and the recruiting instructions in root `AGENTS.md`.
2. Run `python scripts/linkedin_queue.py status`.
3. Run `python scripts/linkedin_queue.py next --limit 50 --output outputs/linkedin-pilot/next.json`.
4. Search each returned person using name plus agency/city/business context.
   Keep one person per query. Batch independent queries for efficiency, but do
   not assume a multi-query tool call is one billable API search.
5. Start with one focused query. If unresolved, allow one alternate query using
   a business name, city, name variant or professional website. If there is a
   credible candidate, allow up to two targeted verification queries. Stop
   unsuccessful searches rather than repeatedly changing the wording. A stronger
   model cannot recover an unindexed profile merely by reasoning longer.
6. Record every actual query, date, observed URL and concise evidence. Batch
   results are JSON lists with `license`, `name`, `status`, `linkedin_url`,
   `candidate_url`, `evidence`, `sources` (URL list), `checked_on` (ISO date),
   `queries` (actual query list), and `evidence_access`.
7. Save every 10-25 rows with `python scripts/linkedin_queue.py record --input PATH`.
   `--replace` is only for an intentional evidence-based correction. A failed
   tool call is not evidence of no profile: retry within budget or leave pending.
8. Run `python scripts/linkedin_queue.py export`, then the artifact-tool builder
   `node outputs/linkedin-pilot/build.mjs`, then
   `python scripts/linkedin_xlsx_links.py`. Follow the spreadsheet skill, including
   its operation marker before the first workbook authoring command in that run.
9. Verify the saved file's source-row count/order and values, dates, links, status
   totals and rendered changed ranges before returning it.

The supplied builder targets this pilot job. For a new workbook, initialize a
new job with `python scripts/linkedin_queue.py --job outputs/NEW-JOB init --input PATH`,
then adapt the builder's job directory. Do not assume every file has the same
source sheet/header/filter names; CLI flags are available for each.

## Identity decisions

- **Strong match:** a real individual `/in/` URL, matching name and corroborating
  business context, such as exact agency and location, phone/address, or license.
  A combination of name, location and a consistent insurance profession can
  support a strong match when there is no competing candidate or contradictory
  fact; document when license/contact confirmation is absent. This is a research
  judgment, not proof of identity or a verified outreach endpoint.
- **Possible match:** credible candidate but a missing identity link, conflicting
  location, ambiguous namesake, or insufficient business context. Leave
  `linkedin_url` blank and put the URL in `candidate_url`.
- **Not found:** no adequately corroborated individual profile within the search
  budget. This does not mean no profile exists. Company pages and name directories
  do not count as individual LinkedIn matches.
- **Not researched:** rows outside the completed batch. Do not count as failures.

Use professional evidence only. Ignore unrelated health, family, criminal or
other personal details returned incidentally by search engines. Do not infer
identity from ethnicity, language, age, appearance or sensitive attributes.
Never invent a profile slug. Search snippets are often stale: identify the
access method and distinguish the search check date from a source's crawl date.
Opening an unavailable LinkedIn page does not verify its current contents.
Follow up through public professional sources; do not bypass a login/access block.

Public-profile employment and insurer appointments are different relationships.
Do not convert newly found employer names into new screening decisions. If a
future request includes rescreening, refresh CDI by license and apply the
controlling rulebook. LinkedIn matches do not automatically change direct-phone
contact readiness.

## Model and spending recommendation

Use GPT-6 Luna with low reasoning for routine small evidence packets, then
GPT-6.1 Sol only for credible ambiguous candidates. A 10% escalation allowance
is a starting budget, not a measured requirement. Keep each classification
request small (for example 1-10 independent people with stable IDs) and exclude
irrelevant page navigation/activity. Validate returned IDs/URLs before saving.
Do not send the entire 10,000-row workbook with every request.

This pilot was performed by the current chat, not by a Luna/Sol model comparison.
The routing recommendation is based on documented model positioning, not a
measured precision or cost advantage on this dataset. Selecting a different model
in the app is separate from the local queue. API prices do not establish the
user's Codex-plan credit consumption.

Official sources checked October 10, 2026:

- [OpenAI model catalog](https://developers.openai.com/api/docs/models): Luna is
  positioned for cost-sensitive volume; Sol balances capability and cost.
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing): short-context
  standard Luna is $0.10 input/$0.50 output per million tokens; Sol is
  $2 input/$10 output. Built-in web search is $10 per 1,000 calls plus tokens.
- [Serper](https://serper.dev/): $50 prepaid for 50,000 queries at the entry tier,
  credits valid six months, excluding taxes. This is a candidate cheaper retrieval
  backend; its match yield has not been tested on this list.

Illustrative API-only estimate, not a quote or measured bill: 10,000 rows at
2,000 input and 300 output tokens each cost about $3.50 on Luna. Reviewing 1,000
of them again with the same token sizes on Sol adds $7. Search dominates:
10,000-20,000 built-in search calls add $100-$200; at Serper's entry unit rate
the same query count consumes $10-$20 of credits but requires its $50 pack.
Reasoning, longer evidence, extra searches, hosting and taxes can increase totals.
No API account/key, external backend or paid service was configured for the pilot.

## Pilot and scale decision

### Optional enrichment clarification and revisit, October 10, 2026

The user explicitly confirmed that LinkedIn is an optional additional outreach
channel. The existing leads remain usable without it. Missing, uncertain or
unavailable LinkedIn profiles must not become screening failures or hold the
lead pipeline. No messages or connection requests were sent.

At the user's request, revisited the 43 unresolved/uncertain people in the same
first 50 using name variants, business/contact context, professional websites
and public LinkedIn results. Added one uncertain Adriana Norman candidate;
no additional strong match. Current totals: **7 strong, 5 possible, 38 unresolved**.
Saved professional identity evidence for future reuse, including WFG license
corroboration, agency addresses and a CPA website. Original eligibility and
source contact values were retained. Employment clues are not a new CDI screen.

The complete second-pass query log was not recoverable. Saved the recoverable
actual queries and this limitation in `revisit-audit.json` and result payloads.
The sheet's **Recorded searches** column is a partial log count, not total effort
or a billable-call measure. Initial research and queue snapshots were preserved.

For optional enrichment at scale, use one focused search plus one alternate;
verify only credible candidates, cache results by license, and stop unresolved
rows. Revisit them when LinkedIn is actually needed for that lead. Directory-only
shortlists can be checked manually within an authorized LinkedIn session; they
are not confirmed profile links. This pilot does not establish that the unresolved
people lack LinkedIn. Benchmark a different retrieval backend before committing
to a bulk paid run; changing the reasoning model alone has not been tested as a
solution to this retrieval limitation.

Initial pass: all first 50 selected rows were attempted. Results: 7 strong matches (14%),
4 possible matches (8%), 39 not found within the budget (78%). There were 104
logical search queries plus page opens. These are not billable-call measurements.
The alphabetical sample is not random and should not be extrapolated as a
population accuracy or coverage estimate. Match accuracy has not been independently
verified. Original source details retain their October 8 check dates; LinkedIn
research is dated October 10. No new CDI screen was performed.

Do not spend on a blind 10,000-row rollout using this search approach at this
yield. Before buying a bulk run, compare an alternate search backend on the same
50 and evaluate additional strong, independently checked matches per dollar.
The chat can remain the interface while a paid search backend runs underneath,
if the user later supplies credentials and authorizes that integration. Existing
completed research remains reusable either way.

## Files and validation

- `scripts/linkedin_queue.py`: intake, progress, resume, transactional recording,
  export and overwrite/identity guards.
- `scripts/linkedin_queue_test.py`: atomic invalid-batch handling, resume behavior,
  overwrite protection, uncertain-link and non-profile rejection tests.
- `outputs/linkedin-pilot/queue.sqlite3`: current durable progress.
- `outputs/linkedin-pilot/source.json`: source data and provenance.
- `outputs/linkedin-pilot/research.json`: first 50 research decisions.
- `outputs/linkedin-pilot/search-audit.json`: actual query batches and selected
  public professional search-result excerpts; not every irrelevant result.
- `outputs/linkedin-pilot/build.mjs`: artifact-tool workbook builder.
- `scripts/linkedin_xlsx_links.py`: adds only native hyperlink elements because
  artifact-tool's HYPERLINK evaluator is unsupported in this runtime.
- `outputs/linkedin-pilot/approved-linkedin-pilot.xlsx`: user-facing workbook.

The queue is single-chat/single-writer. It does not claim distributed locking,
automatic scheduling, API billing enforcement, or ongoing unattended operation.
