# Connected competitive website

The Cloudflare Worker and Discord commands use the same D1 database and CloudStore. The new website reads `/api/v1`; authenticated actions are translated to the existing `runCommand` service with a server-resolved Discord member. Public and staff interfaces do not implement separate queue or placement logic.

## Delivered

The primary website uses real pathname routes, an original violet/graphite design, responsive ranking cards, shield tier badges, profiles, ordinal progression charts, player comparison, filtered results, live queue views, tester directory, mode guides, hall of fame, guides, FAQ, published changelog and protected account/staff/admin workspaces. The previous interface is preserved in `web/legacy.html` with its regression suite.

Public data is allowlisted. Private staff adjustment reasons, ticket transcripts and Discord identifiers are not returned by public placement APIs. Staff tier awards are explicitly labeled, credited to the awarding staff member, published through the retryable Discord outbox, and excluded from test counts, quotas and testing cooldowns.

Overall points default to peak tiers. Managers can change peak/current scoring and retired inclusion under Administration → Settings. Changes are audited. Competitive titles are cosmetic, scaled relative to the enabled mode count.

Result and queue pages check every 20 seconds while visible. New data waits behind an explicit refresh control so rows do not move while being read. Players can pause updates. The database remains authoritative across restarts.

## Activate Discord website sign-in

Set `DISCORD_CLIENT_SECRET` in the existing Site's hosting secrets and register this exact callback in the same Discord application's OAuth2 settings:

`https://minecraft-pvp-community.draxion0.chatgpt.site/auth/discord/callback`

The sign-in flow uses authorization code exchange, PKCE, one-use expiring state and an opaque session cookie. Only session hashes are persisted. Discord access tokens are transient. Mutations require same-origin requests and a session-bound CSRF token. Staff privileges are fetched from current guild membership and roles on each authenticated request. Missing credentials fail closed and display a useful Discord alternative.

Minecraft ownership proof still requires the already configured server-side ownership integration. Username lookup alone never verifies ownership. No sample competitors or placements are inserted into production.

## Validation and limits

Run `npm.cmd test`, then `npm.cmd run build:cloud` and `node --check dist/server/index.js`. Tests cover the retained workflows, new public APIs, private endpoint rejection, confirmed staff-award publication, OAuth replay/CSRF safeguards and public view rendering.

Browser automation was unavailable in the implementation environment. Real visual layout inspection, device screenshots, and live OAuth provider consent remain deployment follow-up checks. A working OAuth secret is required for an end-to-end logged-in browser test.

Protected workspaces expose the implemented operations; the full Discord controls remain available for deeper lifecycle actions and configuration. Mode equipment is shown only when approved loadout content exists. No mod download, historical seasonal awards, or duel statistics are invented. Public API documentation is available at `/api-docs`.
