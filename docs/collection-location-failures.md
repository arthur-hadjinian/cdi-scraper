# Repeated location failures

User authorization: October 16, 2026. Save persistently problematic locations
and remove them from the active collection queue rather than retrying forever.

After every attempt in the configured attempt budget fails with a persistent
location error (no geocoding result, outside California, distant center, or
invalid/unknown ZIP), archive the original search row and reason in SQLite
`skipped_locations`, then set search status `skipped_location`. This terminal
status is excluded from the queue and retained through grid synchronization.
Export the audit to `exports/skipped-locations.json`. Retain saved agents and
their source-ZIP associations; this is a search-location decision, not producer
eligibility screening. Coverage at skipped locations remains unresolved.

Do not automatically skip ordinary pagination timeouts, transient geocoding
service failures, or access/quota restrictions. Preserve existing retry/stop
handling for those conditions. Mixed failure types remain retryable; automatic
skipping requires all configured attempts to qualify as location failures.

The user explicitly requested immediate archival of 90301 and 90845 after
their repeated failures in the completed English collection pass.
