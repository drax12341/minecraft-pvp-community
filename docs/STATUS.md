# Delivery status · v0.2

## Implemented

- Eclipse-inspired homepage: orbital identity, floating violet navigation, background controls, feature grid, interactive walkthrough and FAQ. Existing rankings and testing routes remain available.

- One independent tierlist: external imports, provider switcher and community directory removed.
- New five-tier board, original shaded pixel kit artwork, overall leaderboard, search/regions, profiles, comparisons, cards and explicit sample preview.
- Testing center with public session snapshots, local request summaries, kit rules and recent test history.
- Session open/pause/close, capacity limits, retest cooldowns, verified-account queues, atomic tester claims and evidence-linked results.
- Private appeals with independent review and audit-preserving revocation/recalculated rankings.
- Discord setup with colored roles, mode testing channels and rich onboarding panels; safe mode/region preference commands.
- Dedicated Fabric 1.21.1 tagger using only this tierlist’s feed; no external providers.
- Public Pages hosting, platform/mod CI and optional own-channel promotion workflow.

## Live Discord and hosting

The dedicated bot is authenticated and installed in guild 1568767259168608267.
The additive setup created the planned roles and channels and posted panels in writable channels.
Existing permission rules still block panels in welcome, rules, how-to-test and choose-your-modes;
a server administrator must grant the bot Send Messages in those channels. Existing messages were preserved.
Role IDs and credentials are stored only in ignored local .env.

The cloud HTTP Worker and persistent D1 database are deployed on the existing Sites
project. Discord validated and saved its interactions endpoint. Commands and cloud
rankings/testing storage no longer require a local gateway process or a running PC.
No separate Railway/Cloudflare subscription was created. The cloud HTTP app does not
maintain the green Discord online indicator. Existing hosting access, quotas and
service availability still apply. See [the cloud deployment](FREE-CLOUD.md).
Docker/Railway and the combined local runtime remain optional fallback paths.

Verification on 2026-11-08: published Sites version 7, stopped the prior local
runtime and its bot child, confirmed the local port is offline, then received HTTP
200 from cloud health with `pcRequired: false`. Website, artwork and public feeds
also returned HTTP 200. All 14 automated tests passed.

## Remaining limits

- Visual browser QA and in-game Fabric/mixin smoke testing remain unavailable/unverified.
- All seven commands are registered. Discord's real signed endpoint validation succeeded; individual live player testing flows still need staff-run acceptance testing. Automated tests cover the command/SQL/security logic.
- Staff must establish real Minecraft ownership checks, exact kit rubrics and trained testers before opening sessions.
- The public websites read live cloud result/session feeds. The existing experimental tagger release still reads committed exports and needs a later client update for live cloud data. Private queues and appeals are never public feeds.
- No hosted Minecraft arena, anti-cheat, automatic match capture, replay infrastructure, payment processing, self-service data deletion or confirmed sponsors.
