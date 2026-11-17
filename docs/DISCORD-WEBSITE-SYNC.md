# Discord to GitHub Pages

The public website stays at https://drax12341.github.io/minecraft-pvp-community/.
Its rankings and session availability now read the existing Discord bot's public
`/data/results.json` and `/data/testing.json` endpoints. No Discord messages,
roles, account verification or result classifications are changed by this sync.

The previous disconnect came from serving the empty checked-in JSON files while
the active cloud bot stored the real placements elsewhere. Its public datastore
currently contains draxion__ and Kewisdis, both HT3 in High Tier Mace. They are
staff-awarded placements, so they appear on the board while the official
completed-test counter remains zero. Never convert awards into completed tests.

The browser loads live public data on entry and checks every 60 seconds while
visible and not editing a field or using a dialog. Manual Refresh checks the
same source. Failed refreshes retain the last loaded records and show a warning.
A cold start during an outage uses the saved Pages snapshot and marks it stale.
Recovery clears the warning. Requests omit credentials and referrers, reject
redirects and have a 10-second timeout. Public fields are validated and
allowlisted; Discord account IDs, staff actors, private evidence and appeals
are not copied to the website's snapshot. Previews cannot become real placements.

`npm run sync:community` refreshes the checked-in snapshot from the bot.
`node scripts/sync-community.mjs --required` fails if the live source is unavailable.
The Pages workflow runs synchronization before building, including its existing
six-hour schedule. Build-time outages retain the checked-in snapshot rather than
replacing it with an empty feed. The existing `scripts/publish-results.mjs`
also uses this cloud sync; `scripts/export-results.mjs` is only for the separate
local SQLite development server and is not the public website's source.

Older bot releases expose at most 100 recent completed tests without a total.
Below that cap the list is complete and repeat tests each count. At the cap the
website displays an unknown total rather than claiming 100 is the lifetime count.
Once the bot exposes `completedTests`, the exact total is used automatically.
The source in `cloud/store.mjs` already exports that field for its next backend
release. No bot backend deployment or website hosting migration is needed for
the current two players to appear.

Verification covers normalization, private-field stripping, rejection of invalid
feeds/previews, repeat counts and capped totals, initial fallback and refresh
failure. Isolated headless Chrome verifies the actual live players, mode/search
controls, manual refresh, simulated outage retention, cold-start fallback and
recovery. Fixture responses are never written to published data.
