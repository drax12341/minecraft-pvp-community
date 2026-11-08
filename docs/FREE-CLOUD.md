# Discord commands without a running PC

The community's existing public Sites project can host a Cloudflare Worker and
provision persistent D1 storage. This reuses the connected hosting rather than
creating a paid Railway service or requiring a separate Cloudflare account.
There is no new paid hosting subscription in this deployment. Availability remains
subject to the existing Sites service, workspace access and applicable usage limits.

The Worker receives Discord HTTP interactions at:
`https://minecraft-pvp-community.draxion0.chatgpt.site/discord/interactions`.
It validates Discord's Ed25519 signature, rejects stale requests and other guilds,
acknowledges privately, deduplicates retries, executes the command and edits the
private reply. It does not maintain a Discord gateway connection/online indicator.

Twelve commands are implemented: preferences, verify-account, session,
queue (including private status), claim (including assigned-tester release), result, appeal, guide, availability, practice, tester-apply and profile. The owner and administrators can use staff commands;
testers/moderators retain their explicit role checks. Interest roles must grant no
permissions. Test capacity/cooldowns, assigned testers and independent appeals are
enforced in SQL; related statements use transactional D1 batches.

## Deployment

- `.openai/hosting.json` retains the existing project ID and declares `DB`.
- `drizzle/0000_discord_cloud.sql` creates the cloud schema; Sites applies migrations.
- Runtime secrets are configured through Sites, never bundled or committed.
- `npm run build:cloud` produces `dist/server/index.js`; publish using the Sites workflow.
- After health reports `runtime: cloud-http`, run:
  `node --env-file=.env scripts/activate-cloud.mjs --activate`.
  Discord validates the real signed endpoint before accepting it.
- Confirm the saved endpoint, then stop the previous local runtime. Never start the
  old gateway bot as a cloud substitute; command delivery now uses HTTP.

The public cloud website uses live D1 rankings/testing. GitHub Pages uses those
same public feeds. Player/account/queue/appeal records remain private; only anonymous
session counts and publishable results are exposed. The current experimental
tagger release still reads committed GitHub exports; it needs a later client update
to consume the cloud feed directly.

Local gateway code and Railway files remain an optional fallback. They are not
required for the cloud HTTP deployment. Free hosting cannot promise perpetual
availability, unlimited storage or no maintenance under future provider changes.

## Validation

Tests exercise the actual migration SQL, queue capacity, cooldowns, result ownership,
immutable evidence, independent appeals/revocation, role safety, owner authorization,
Ed25519 validation, stale/tampered requests, retry deduplication and private replies.
No fabricated player results are added to the public tierlist for smoke testing.
