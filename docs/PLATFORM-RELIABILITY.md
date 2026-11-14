This earlier delivery is superseded by [the live v10 release](MACE-NETWORK-V10.md).

# Mace platform reliability upgrade

This delivery extends the existing cloud Discord application and its shared
SQLite/D1 rankings API. It preserves the seven configured Mace mode identities,
loadout approvals, existing rubric, independent high-tier sign-off, result and
appeal history, retirement policy and public website. The project remains ESM
JavaScript on Node 24 / Workers; no parallel TypeScript/PostgreSQL implementation
or competing production database was introduced.

## Implemented in this change

- `/verify start name` resolves the Java profile and generates a private,
  ten-minute challenge; only its SHA-256 digest is stored. `/linkdiscord code`
  on the trusted online-mode Paper server supplies the authenticated Player UUID.
  The API atomically links the matching account, consumes the challenge, audits
  the attempt and queues the verified-role update. Expiry, replay, duplicate UUIDs
  and identity replacement are rejected. Codes can be replaced once per minute.
  The legacy cloud `/verify-account` now only resynchronizes existing links.
- Waitlist interests remain independent of live FIFO queue membership. Players
  explicitly choose optional DM delivery using `/notifications delivery:dm` or
  panel buttons; default is none. Session alerts are scoped to mode/region,
  filter recorded restrictions/cooldowns, and are throttled for one hour.
  Blocked DMs are recorded without repeatedly attempting unwanted delivery.
- Ordinary `/result` and ticket result forms show a private confirmation. The
  ten-minute immutable draft belongs to the assigned tester. Confirmation
  repeats qualification, kit, readiness and assessment checks. Linked high-tier
  publications retain their existing phased review requirements.
- Result persistence, queue completion, cooldown snapshot and outbox jobs commit
  together. Jobs separately track public/high-tier announcements, affected-mode
  roles and private room archiving. Role operations touch only explicit mappings
  for that mode, add the current role before removing old mapped roles, and retry
  hierarchy/API failures. `/tier-role` records safe zero-permission role mappings
  with a reason; existing mappings require a reviewed migration to replace.
- Cooldown snapshots survive session changes. New command-opened sessions default
  to 720 hours (30 days); explicitly configured policies are preserved. Revoked
  results do not enforce their snapshots. Existing legacy result cooldown
  calculations remain compatible.
- `/testing-hub publish:true` installs a persistent aggregate dashboard in a guild
  text channel, moderator-only, recovering its existing bot message on retries.
  Personal actions open private interactions. `/api/platform` exposes aggregate
  statistics only. Queue boards distinguish live entry from saved future interest.
- Dashboard refreshes use payload fingerprints, database leases and a five-second
  edit interval. Scheduled/maintenance reconciliation coalesces delayed changes.
  Outbox leases expire after two minutes and failed work backs off up to one hour.
  `/delivery status|retry` and `/system` are staff-only operational controls.
- Database triggers retain queue, room readiness/state and finalized-result audit
  events in the mutation transaction. The website continues to read the same
  authoritative rankings records immediately after finalization.

## Installation

1. Back up the production database. Apply migrations through
   `0009_platform_reliability` using the existing Drizzle/Sites migration journal.
   Apply each statement-breakpoint block as a unit: audit triggers contain internal
   semicolons. Deploy the matching worker bundle after the migration.
2. Set `MINECRAFT_VERIFICATION_SERVER` to the actual Java server address. Generate
   separate high-entropy secrets (32+ characters) for `MINECRAFT_PROOF_SECRET` and
   `MAINTENANCE_SECRET` in hosting secret storage. Keep the existing Discord secrets.
3. Build/install `arena/target/CommunityArena-1.0.0.jar` on Paper. Its generated
   `plugins/CommunityArena/config.yml` has `ownership.endpoint` and
   `ownership.secret`. Set the endpoint to
   `https://YOUR-HOST/api/internal/ownership-proof` and the secret to the matching
   proof secret. Restart the plugin/server. It requires direct `online-mode=true`;
   offline-mode and proxy forwarding are deliberately rejected until a separately
   authenticated integration is implemented. Existing premium-only policy remains.
4. Register cloud commands with `npm run discord:register`, using the existing
   private environment. Install `/testing-hub publish:true` and the existing
   `/queue-board mode region publish:true` panels in the intended text channels.
   Map each enabled tier scope using `/tier-role mode tier role reason`.
5. Configure a once-per-minute scheduled worker trigger, or an authenticated
   scheduler POST to `/api/internal/reconcile` with `Authorization: Bearer` followed
   by the maintenance secret. The worker also drains jobs after interactions.
   The proof secret cannot invoke maintenance. A scheduler is needed for reliable
   recovery while no one is interacting with Discord.
6. Validate real server login, Discord hierarchy and private channel visibility in
   a staging guild. Synthetic fixtures never approve a production kit or create
   real ranks. Check `/delivery status` for missing channels/role permissions.

An announcement timeout has at-least-once delivery semantics: enforced Discord
nonces and the last 100 bot messages' durable test markers suppress retries.
Messages outside that history/Discord's nonce window may be duplicated. Database
result finalization remains exactly once. Public static mirrors still need their
existing live feed configuration; this change does not publish a new site.

## Verification and limits

Validation: all 88 Node tests pass; the cloud bundle builds and passes Node syntax checking; the Paper plugin compiles and packages successfully.

Automated coverage includes the actual migration SQL through a transactional D1
adapter and a complete synthetic ownership → interest → session alert → live
queue → pull → private room → readiness → assessment → confirmation → result →
profile/rankings API → cooldown → archive workflow. Reconstructed store instances
exercise restart persistence. Additional cases cover authorization, replay,
expired proof, duplicate results, failed delivery/retry, unrelated role retention,
blocked DMs and idempotent dashboard installation. Existing concurrent admission,
claims, private support, appeals and phased high-test checks remain in the suite.

The Java plugin builds for Java 21 against the existing Paper API. It needs a real
server integration test; compilation cannot prove Mojang login or Discord access.
No live database migration, guild activation, deployment or real test was performed
for this delivery.

The full master specification remains unfinished. In particular, it still needs
the eight-stage in-Discord setup wizard and database-backed mode/region editing,
independent per-tester regional availability sessions, the complete requested
ticket state machine and transcripts, generalized staff tier/cooldown overrides,
quota reminders, achievements/season analytics, and wider deployment/load testing.
The existing CLI server installers, support and high-tier workflows are retained;
these are not presented as completed replacements for those requirements.

Operational rollback: retain the database backup and roll back worker/command
registration together. Keep accounts, official results, audit history and queued
side effects. Do not drop new tables while a worker using them is running; resolve
pending delivery before a schema rollback.

## API references

Ownership uses the live authenticated Player UUID and requires the server's
[online-mode setting](https://docs.papermc.io/paper/reference/server-properties/).
Announcement requests follow Discord's
[message API](https://github.com/discord/discord-api-docs/blob/main/developers/resources/message.mdx)
for nonce deduplication and allowed mentions. Nonces alone are not a durable
exactly-once delivery guarantee.
