# Community upgrade — 9 November 2026

Live website: https://minecraft-pvp-community.draxion0.chatgpt.site
Discord: https://discord.com/channels/1568767259168608267/1569347570214506607
Support desk: https://discord.com/channels/1568767259168608267/1569347634395746364

## Applied and verified

- Existing IntelliJ project upgraded directly, preserving its previous changes and history.
- Discord now contains 73 channels and 56 roles. The additive upgrade created 15 roles and 25 channels/voice rooms, regrouped existing channels and verified 55 named text channels. Existing messages were retained.
- Public onboarding, request-test selectors, opt-in interests, 15 mode rubric panels, volunteer applications, support forms, private ticket/archive categories, moderator cases and separated helper/tester/moderator work areas.
- Tickets enforce one active case per category and two per member. General cases notify the configured support team inside the private channel; staff reports notify only moderators. Ticket closure retains history. No staff roles are automatically granted.
- Six-dimension rubric assessments and independent HT1/LT1/HT2/LT2 review tied to the exact assessment revision. Rubrics are original community criteria; benchmark opponents and exact kits still need staff calibration.
- Nineteen guild commands registered. Sites version 10 deployed successfully from source 246940bef4ff359e988ad0d5485f4e5f3e06692a, deployment appgdep_6af1d01f77e08191a9fef2bb961068e0, environment revision 2. Existing public audience retained.
- Live health returned HTTP 200, release community-v4, runtime cloud-http and pcRequired false. Public ranking/testing feeds returned 200; new script and shield logo returned 200. Unsigned interactions returned 401. Discord verified and saved the cloud endpoint.
- Website now connects its testing desk, support desk and Minecraft address; updated Paper version, original shield logo and responsive player hub. Text assets ship in the Worker; the existing original arena PNG remains served from the existing Pages origin.
- 23 automated tests pass, including ticket privacy/limits/notification scoping and assessment revision sign-off. Worker syntax, Git whitespace checks and secret scan passed.

## Minecraft deliverable — built, not installed

CommunityArena-1.0.0.jar compiles against the official Paper 1.21.11 API using Java 21 bytecode. Source is included in arena-source.zip.

Implemented: dedicated generated arena world, lobby, four concurrent duel arenas, sword FFA, 12 practice kit variants, queue pairing, 60-second private challenges, countdowns, first-to-ten staff sets, scoreboards, ping display, saved settings, practice win/loss counters, disconnect concessions and ten-minute match timeout. Inventory backups are retained on disk and restored when leaving practice. Arena block changes/explosion damage are constrained to protect its floor.

Commands: /arena, /play, /duel player kit, /duel accept player, /ffa, /leave, /stats, /settings. Staff: /testmatch player1 player2 kit (communityarena.tester, defaults to operators). /settings includes exit to the prior world.

Upload the JAR to MineKeep /plugins, then start/restart Paper. Wait for “CommunityArena enabled” and “Lobby, four duel arenas and FFA arena built” in the console. Join mcpvpcommunity.minekeep.gg and use /arena.

The server was started once to initialize its files, and later showed OFFLINE. MineKeep's free server sleeps when empty; this pass did not establish always-on Minecraft hosting. No paid upgrade was purchased.

## Unfinished work and verification limits

- JAR upload did not complete. Chrome reported local file access disabled twice, including after the user enabled it. Native fallback was stopped by the computer-use safety check because it could not determine Chrome's current URL. No further UI input followed that stop.
- The arena has NOT been loaded in a live Paper server or playtested. Treat the JAR as experimental until two-player tests verify movement, damage, potion/mace behavior, queues, forfeits, restarts and inventory restoration. The arena is a first implementation, not a proven equivalent to PvPHQ/CatPvP/PvPClub/MCPvP.
- Crystal, Cart and Creeper practice gameplay and map resets are not implemented. Exact reference server settings, matchmaking internals, anticheat, replay and ranked gameplay were not reproduced. Ranked was never entered.
- Existing project research documents describe prior inspections of Lucnoxity, Central and Mace SubModes. This pass also reached the exact Minecraft Mace community and observed its channel directory. Its request form and kit images were not inspected before computer use ended. No reference kit photos were copied.
- Exact kit inventory manifests, reference photo review, calibrated benchmark opponents, real tester assignments and live user acceptance tests remain needed before official testing sessions open. No official session was opened automatically and no fake player placements were added.
- The new logo is deployed on the website and supplied as an editable SVG. Applying a raster version as the Discord/server icon remains unfinished.
- Fresh browser rendering and mobile screenshot QA of the deployed changes could not be completed after computer use stopped.

No credentials are included in these deliverables.
