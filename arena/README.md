# CommunityArena 2.0.0

A standalone Paper **1.21.11** practice plugin for Minecraft PvP Community. Requires **Java 21 or newer supported by Paper**. This is a plugin JAR to put in `plugins/`, not the Paper server executable. No additional plugins are required. It uses original generated builds and does not bundle another network's code, maps, branding or textures.

## Install

1. Back up the server and stop it. Use a dedicated practice server or test copy first.
2. Install Paper 1.21.11, then place `CommunityArena-2.0.0.jar` in `plugins/`. Remove the previous CommunityArena JAR if upgrading; retain its data folder.
3. Start the server normally. Initial construction takes roughly 11 seconds at 20 TPS in the dedicated `community_arena` world. An original quartz/purple/blackstone lobby, four enclosed duel arenas and one sword FFA arena are generated. Existing `built-v1` installations retain their existing architecture.
4. Join and use `/arena`. Joining automatically enters the lobby once arenas are ready. To disable automatic entry, stop the server and set `join-lobby: false` in `plugins/CommunityArena/config.yml`.
5. Two players can use `/ranked sword`, or `/duel Player sword 3` then `/duel accept Challenger` for first-to-three casual duels.

Stop/start the server when updating; avoid `/reload`. Keep regular backups of `plugins/CommunityArena/players.yml` and the arena world together. Do not edit player data while the server runs.

## Included

- Ranked 1v1 matchmaking, unranked queues, private first-to-1..10 duels, staff first-to-ten testing and sword FFA.
- Twelve presets: sword, axe, uhc, pot, nethop, smp, mace, mace_breach, mace_density, mace_spear, diasmp and bow. Operators can replace a preset with their own complete inventory, used equally by both opponents.
- Global server Elo, initially 600; Bronze <800, Iron 800, Gold 1000, Emerald 1200, Diamond 1450, Obsidian 1700, Netherite 2000. Highest rated player with a completed ranked match receives the #1 Champion label. Ties use UUID order.
- Elo transfers with K=32 and a zero floor. Ranked matchmaking starts within 100 Elo and widens every 15 seconds to 700. A ranked pair cannot score again for two minutes (in-memory cooldown resets on restart). Private and staff duels never alter Elo. This is separate from reviewed community HT/LT tier placements; no results are automatically published to Discord or the website.
- Protected lobby, sword/ranked/FFA/spectate/friends/quest/case/leaderboard/repeater settings hotbar, inventory menus, live sidebar and tab names with ping. Match tab header shows both fighters and spectator count.
- 3-2-1 countdown, GO title and sound; victory title, sound and cosmetic particle burst; three-second post-match display then teleport back to the configured lobby spawn. Ten-minute match time limit draws without Elo changes. Disconnecting/conceding forfeits a match.
- Saved wins, losses, kills, deaths, games, streak, best streak, ranked games, rating, settings, friends and cosmetics. Wins count duel sets; deaths count eliminated rounds and FFA deaths. FFA does not count as a duel win or advance duel quests.
- `/leaderboard elo|wins|deaths|streak|bestStreak` displays genuine server records. Three default floating boards show Elo, wins and deaths; more are operator-placeable. No demo placements or fake player entries.
- Spectators require both fighters' spectator setting, cannot queue while spectating, and return to lobby when the match ends. Match boundaries restrict travel. Spectators appear in the player tab list but are hidden from fighters in-world.
- Mutual friend requests, 60-second request expiry and a 100-friend limit. Add, accept and remove currently require the other player online.
- Daily UTC quest: complete five duel sets and win three, then `/quests` claims one cosmetic case. One claim per day. `/cases` consumes one case, reveals and equips an unlocked particle effect or preset title. No paid rewards or combat advantage. `/cosmetics` lists/selects owned rewards; `none` removes them. Titles display in tab; these are preset text cosmetics, not uploaded texture packs.
- Durable pre-practice inventory/location/experience/health/food/effect backups and restoration when exiting practice. A failed disk write prevents inventory clearing. Invalid player YAML disables startup without overwriting the file. Data writes use atomic replacement where supported. Active matches are voided on server restart, and original inventory backups restore on next join.

## Player commands

| Command | Use |
|---|---|
| `/arena`, `/hub`, `/lobby`, `/spawn` | Enter the protected practice lobby |
| `/play [kit]`, `/queue [kit]` | Open casual menu or queue |
| `/ranked [kit]` | Open ranked menu or queue |
| `/duel <player> <kit> [1..10]` | Invite to an unranked first-to-N set |
| `/duel accept <player>` | Accept an unexpired challenge |
| `/leave` | Cancel queue, concede, leave spectating or return from FFA |
| `/ffa` | Enter sword FFA |
| `/spec <player>`, `/spectate <player>` | Spectate an ongoing duel |
| `/settings` | Scoreboard, invites, hit sounds, spectators; exit to previous world/inventory |
| `/stats` | Own server Elo/rank/wins/deaths |
| `/friends [add\|accept\|remove <online-player>]` | Friend list and requests |
| `/quests` | View daily progress and claim eligible reward |
| `/cases` | Consume a case and unlock/equip a cosmetic |
| `/cosmetics [name\|none]` | Inspect/select owned preset titles and particles |
| `/leaderboard [stat]`, `/lb`, `/top` | Genuine server standings |

During a duel or spectator session, only `/leave`, `/stats` and direct messaging commands are allowed, preventing teleport/queue escapes. Use `/leave` before administrative setup.

## Operator setup

`communityarena.admin` and `communityarena.tester` default to operators. Build bypass additionally requires actual operator status. Normal players cannot change spawn, boundaries, arenas, kits or holograms.

| Command | Behavior |
|---|---|
| `/pvpadmin` | Setup help |
| `/pvpadmin lobby <16..1000>` | Protect a square centered on your position and save it as spawn; does not build/delete terrain |
| `/pvpadmin pos1`, `/pvpadmin pos2` | Select two opposite corners by standing on them |
| `/pvpadmin save` | Save selected X/Z boundary and your current safe spawn; stand inside the selection |
| `/pvpadmin setspawn` | Save your location/yaw inside the existing protected lobby |
| `/pvpadmin build` | Toggle operator-only build bypass for this session |
| `/pvpadmin arena <1..4> <a\|b>` | Set one fighter spawn inside that numbered generated combat arena |
| `/pvpadmin kit <kit>` | Save current full inventory as a shared kit preset; exit practice first |
| `/pvpadmin hologram <elo\|wins\|deaths\|streak>` | Create a floating leaderboard at your position; returns its ID |
| `/pvpadmin delhologram <id>` | Remove that board |
| `/testmatch <player1> <player2> <kit>` | Operator/tester supervised first-to-ten casual set |

Lobby protection covers the full vertical world height. Two-corner selections can span at most 1000 blocks per axis. A 1000-square lobby must be in another world or distant from the generated combat arenas; selections overlapping duel or FFA arenas are rejected so lobby immunity cannot break combat. Build your custom lobby on safe terrain before saving its spawn. Arena spawn customization stays inside the four generated arenas, whose centers are X=160/320/480/640, Z=0, floor Y=64. The FFA center is X=800. Holograms refresh every ten seconds.

The lobby prevents damage both to players inside it and attacks originating inside it. Block breaking/placing, explosions, fire, fluids, pistons and entity terrain changes are blocked in protected areas. Combat arenas disallow building and explosive block damage. Operator bypass permits block editing, not combat in the lobby.

## Scope and deployment checks

This release implements ranked/casual **1v1** and **sword FFA**. Party/team duels, tournaments, cross-server/region routing, bespoke anticheat, Crystal building combat, player custom-kit editors, kit-specific Elo, matchmaking across multiple servers, premium maps, chat format integration and a custom resource pack are **not implemented**. Operator kit presets are shared server configurations. Native vanilla/Paper combat is retained; the plugin does not emulate PvPHQ's advertised latency system. An actual server host/IP is not created by installing a plugin.

Persistent storage is a single local YAML file written on the main thread: suitable for a small standalone server, not a large network. Case reveal is a title presentation, not a spinning inventory animation. No claim of exact feature or visual parity with the reference servers is made.

Before opening publicly, run a two-client test on the intended Paper build: queue every desired kit, accept multi-round duels, test projectiles/potions/pearls/wind charges, inspect countdown/tab/sidebar/hologram layout, spectate, disconnect/reconnect, verify restart restoration and check interaction with other plugins. Automated MockBukkit tests do not render a Minecraft client and cannot validate native display entity rendering, actual network latency or combat balance. Keep `online-mode=true` on a direct public server; properly secure any proxy separately.

## Build and verification

`mvn -f arena/pom.xml clean verify` (Maven 3.9+, Java 21+ compatible with the chosen Paper API). Output: `arena/target/CommunityArena-2.0.0.jar`. Paper API is provided by the server; MockBukkit/JUnit are test-only and not shipped in the plugin.

JUnit and MockBukkit cover rating boundaries/upsets/floor, queue window, non-operator denial, lobby damage, unsafe region rejection, real record eligibility, inventory restoration/backup failure, casual versus ranked points, match idempotence, countdown immunity, opponent-only damage, spectator lifecycle, generated lobby definitions and quest double claims. An inverted matchmaking-window cap was rejected by the tests. Live client/render/load tests remain outstanding.

Graphify code analysis is generated locally under `arena/graphify-out/` (report, JSON and interactive graph); graph extraction diagnostics disclose unresolved external API references rather than treating them as proved runtime relationships.

## Reference research

- [CatPvP official store](https://catpvp.tebex.io/): multi-region practice, duels and FFA with popular kits.
- [CatPvP official site](https://catpvp.xyz/): ranked ratings and kit performance lookup. Public sources do not expose its private plugin or complete GUI/map specifications.
- [CatPvP channel](https://www.youtube.com/@catpvpserver): describes popular Sword/Crystal/Netherite/Boxing kits, custom kits, rounds, teams, parties and events. These establish inspiration, not a statement that all of them ship here.
- [PvP Club](https://mcpvp.club/): gamemode queues and party fights.
- [PvPHQ](https://modrinth.com/plugin/rhJNnrjR): casual, ranked, team and party modes.
- [MCPVP](https://www.mcpvp.com/): modern competitive practice network; distinct from mcpvp.club.
- [Paper project setup](https://docs.papermc.io/paper/dev/project-setup/) and [MockBukkit](https://docs.mockbukkit.org/docs/en/user_guide/introduction/getting_started): implementation and testing APIs.

The existing Discord ownership-link command is preserved but disabled unless its HTTPS endpoint and private secret are explicitly configured. No Discord bot changes, community placements, website hosting or deployments are part of this plugin release. OmniRoute is an AI gateway and is unrelated to the Minecraft runtime; no gateway is installed by this plugin.
