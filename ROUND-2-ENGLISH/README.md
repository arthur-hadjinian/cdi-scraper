# Round 2 — English

Fresh collection begun October 8, 2026. English (`ENGL`), Life and Annuity (`LIFE_ANU`), 50 miles around ZIP 91506. Same 128 search centers with four-mile spacing and five-mile directory searches.

Database: `data/agents.db`. Live CSV: `exports/cdi-agents.csv`. License numbers are deduplicated within this round only; round-one agents are not excluded.

Run `./run.ps1` to start/resume and `./status.ps1` for status. The scripts use the parent project's source code and installed dependencies, but all data, CSVs, logs, browser profile and configuration are stored in this folder.

Timing: 2–4 seconds between pages, 5–10 seconds between ZIPs, restored to the round-one pace on October 9, 2026. Error waits and three-attempt limit are unchanged. Headless mode enabled. Raw collected prospects are not recruiting-screen approvals.

Supervisor restart cooldowns: 2, 5, 5, 5, then 60 minutes (five automatic restarts), updated at the user's request on October 9, 2026. Timeout failures use this schedule; access blocks and non-timeout errors still stop for review.

Pagination recovery (October 9, 2026): use the site's page/group control first; check for changed records, retry locally after 35 seconds with up to 70 more seconds, and avoid duplicate clicks while a request is pending. Pagination HTTP errors and failed requests are logged. After three ordinary timeout attempts, leave the ZIP in `error` for recovery and continue other ZIPs. A pass with deferred ZIPs requests a supervised retry; it does not claim completion. Verification challenges and HTTP 403/429 still stop the run.

Queue priority (October 9, 2026): resume the interrupted ZIP, then search untouched `pending` ZIPs before revisiting `error` ZIPs. Completed and capped ZIPs are excluded from this queue. Failed ZIPs remain saved for recovery; they must not be marked complete to improve progress numbers.

Location safety (October 13, 2026): search `ZIP, CA`, never bare ZIPs. Capture Google's actual geocoding result, require US/CA and coordinates within five miles of the intended ZIP reference, and check the submitted center agrees before saving any result. Unique/company ZIP failures can retry a nearby ZIP within three miles and its city/state; actual center offset and fallback input are logged in `logs/location-checks.jsonl`. Fallback searches provide approximate coverage, not identical ZIP circles. Fresh forms prevent old results from being reused. Geocoding dialogs and site errors are reported promptly instead of becoming generic timeouts.

Prior data: `data/agents-before-location-fix-20261013.db` is a consistent pre-fix backup. `exports/location-audit/summary.json` and `legacy-address-audit.json` contain non-destructive address ZIP review flags. Legacy zero-result searches were requeued for verified recovery. All saved agents are retained; address flags do not change recruiting approval. Existing capped search centers have not all been revalidated, and 300-result caps remain unresolved.

Final ZIP recovery (October 14): `docs/search-location-overrides.json` records a corrected postal reference for 93031 and nearby physical search inputs for 90101. The five-mile validation limit remains unchanged. The log records the actual reference and whether a substitute input was used; substitute circles provide approximate recovery coverage, not identical boundaries.

Any ZIP reaching the site's 300-result limit is incomplete (`truncated`), even if all available groups have been collected. Spaced search centers provide approximate geographic coverage; do not equate queue completion with exhaustive results.
