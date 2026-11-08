# Minecraft PvP Tierlist · v0.2

[Design study](docs/DESIGN-STUDY.md): 18 reference projects, six visually inspected screenshots/concepts, and the resulting navigation, ranking and testing refinements. Evidence limits are recorded in the study.

**One independent tierlist. Every placement comes from this community’s tests.**

The new [Eclipse-inspired presentation](docs/ECLIPSE-INSPIRATION.md) adds a violet orbital homepage and matching visual styling. [Open rankings directly](https://drax12341.github.io/minecraft-pvp-community/#rankings).

Website: https://drax12341.github.io/minecraft-pvp-community/
Discord: https://discord.gg/a36rg6BxuX

## Website

A redesigned five-column tier board, 15 original kit icons, overall leaderboard, search/region filtering, profiles, comparisons, player cards, testing session availability, kit rules, request summaries, sponsor page and dedicated tagger configurator. An explicit sample preview demonstrates populated states; sample players are never published as real rankings. No third-party rankings are imported.

```sh
npm ci
npm test
npm run build
npm start
```

Open http://127.0.0.1:8787. Node 24+. The local site reads the live SQLite service; public static hosting reads the last exported/committed data. Public GitHub Pages deploys on push and schedule. This is not a persistent bot/API host.

## Testing operations

- Staff-verified Minecraft ownership before queue entry.
- Tester-controlled sessions by mode and region, capacity 1–200, cooldown 0–720 hours (default 72).
- One open entry per player/mode; no self-testing; atomic claims and results.
- UUID-backed results, evidence links, peak history and overall scoring.
- Private owner-only appeals, independent reviewers, audit-preserving result revocation and recalculated ranks.
- Public exports contain no Discord member IDs or private appeal text.

[Discord activation and commands](docs/DISCORD.md). The live guild cannot be configured until PC control or a bot connection is available. No bot credentials are committed. Native Discord setup could not run because the PC helper pipe is unavailable; the connector also rejects authentication.

The setup now prepares colored interest/tier roles, main/submode testing channels, staff channels and rich onboarding panels. It only creates missing channels and posts its panels once. It does not delete or rename existing channels. Run the dry run first and ensure the intended guild ID is correct.

```sh
npm run discord:plan
# Fill ignored .env locally and install your bot, then:
npm run discord:apply
node --env-file=.env server/index.mjs
npm run bot
```

After sessions/results change, the bot exports public JSON to data/. Publish those changes with `node scripts/publish-results.mjs` to update the static website. Exports must contain only shareable match evidence. A remote API deployment needs HTTPS, access controls and request throttling; the current service binds to loopback and trusts the bot’s service token.

## Dedicated Fabric tagger

[Experimental 0.2 release](https://github.com/drax12341/minecraft-pvp-community/releases/tag/v0.2.0-experimental). Minecraft Java **1.21.1**, Fabric Loader 0.16.14+, Fabric API 0.116.6+1.21.1, Java 21+ runtime. Build with Gradle 9.6.0/JDK 26:

```sh
gradle -p tagger build
```

Nametag/tablist labels load **only this tierlist’s results.json** by UUID. `/communitytag mode <id>`, `toggle`, `fallback`, `reload`. No provider switching. No copied community assets. Async polling, bounded profiles and a ten-minute failure expiry. Stable placements do not disappear merely because a test was published over two days ago. In-game rendering/mixin smoke testing remains required.

## Promotion and support

Player cards, deep profile links, sponsor contact and a weekly promotion draft workflow are included. Posting occurs only if an own-channel announcement webhook is configured as a GitHub secret. No bought ranks, automated unsolicited outreach or claims of guaranteed growth.

[Current delivery status](docs/STATUS.md). [Design direction](docs/DESIGN-V2.md). [Historical reference research](docs/RESEARCH.md) records inspirations; those projects are not affiliated or connected.
