# Minecraft PvP Community

Public website: https://minecraft-pvp-community.draxion0.chatgpt.site

Main Discord: https://discord.gg/a36rg6BxuX

An initial platform for a multi-mode Minecraft community, with an independent directory, timestamped MCTiers rankings, searchable profiles, comparisons, downloadable player cards, testing guidance, sponsor information, Discord setup/bot tooling, a SQLite result service and an experimental Fabric tagger.

## Run locally

Use Node 24 or later:

```sh
npm ci
npm run refresh
npm test
npm run build
npm start
```

Open http://127.0.0.1:8787. The service binds to loopback. The public site is static and reads committed/exported JSON, while the local service reads community results from SQLite. MCTiers is a top-50 overall snapshot, not the complete ladder. Other ranking providers currently link out. Empty community results are intentional.

## Discord

[Setup and onboarding](docs/DISCORD.md). Run `npm run discord:plan` before activation. The live guild has not been changed by this implementation. Bot credentials must be entered locally into ignored `.env`; no personal Discord tokens. Bot/API hosting is separate from GitHub Pages.

## Fabric tagger

`tagger/` targets **Minecraft Java 1.21.1**, Fabric Loader 0.16.14+, Fabric API 0.116.6+1.21.1 and Java 21+. Build with Gradle 9.6.0 and JDK 26 (CI uses these pinned versions):

```sh
gradle -p tagger build
```

Install the normal JAR from `tagger/build/libs/` alongside Fabric API in a 1.21.1 Fabric client. This is experimental; compilation is not a substitute for in-game rendering/mixin validation. It supports nametag and tablist labels, selected modes, highest-active fallback, a source switch and a saved config. `/communitytag` lists commands. Copy website-downloaded `community-tagger.json` into Minecraft's `config/` directory before launching. Missing config properties use defaults.

Only the 50 snapshot players can have MCTiers labels; an absent player is unranked/unknown in this feed, not necessarily unranked on MCTiers. The client fetches HTTPS snapshots asynchronously every five minutes, caps parsed profiles, hides snapshots older than two days, and expires cached labels after ten minutes without a successful refresh. It never scans files, logs into Minecraft or sends server/chat history. Provider and mode remain in each label. No source or icons were copied from the reference mods.

## Free hosting and promotion

The GitHub Pages workflow builds and deploys the site on push and every six hours, refreshing the MCTiers snapshot. Enable Pages using GitHub Actions in repository settings if not already enabled. GitHub scheduled workflows run on a best-effort basis and may be disabled after inactivity. The Sites publication is an additional static launch snapshot; GitHub Actions does not update it automatically.

Player links and SVG cards are generated in the website. `node scripts/promotion.mjs` generates a draft locally. The weekly GitHub workflow uploads a draft and sends one announcement only if you configure `DISCORD_ANNOUNCEMENT_WEBHOOK` as a repository secret pointing to your own opt-in community announcements channel. No automated outreach, mass mentions or popularity guarantees.

## Safety and operation

No credentials belong in public JSON or source control. SQLite stores queue identities, verified account links, evidence URLs and audit events locally; back it up and protect the file. Public exports contain player profiles and evidence links, so review them before publishing. Do not expose the write API directly: add HTTPS, network access controls, request throttling and monitoring before remote hosting. The shared service token trusts the bot to enforce staff roles. Automated verification, privacy requests, moderation actions and result-reversal UI are not implemented.

## Research and remaining work

[Research, feature matrix, sources and limitations](docs/RESEARCH.md). [Delivery status](docs/STATUS.md). This is a working initial implementation, not every feature from every referenced server. No payments, confirmed sponsorships, live Minecraft server, replay/matchmaking infrastructure or third-party partnerships have been created.

Original code is MIT licensed. Ranking data and dependencies retain their original rights.
