# CommunityArena 4.0.0 — Citadel practice preview

Requires **Paper 1.21.11 and Java 21+**. Put the plugin JAR in the server's `plugins/` folder. It is not a server executable. No client mod or additional runtime plugin is required for the included features.

## Install or upgrade

1. Stop the server. Back up worlds and `plugins/CommunityArena/` together, including terrain journals.
2. Replace the old CommunityArena JAR with **CommunityArena-4.0.0.jar**. Keep the data folder, `players.yml` and `config.yml`. Do not leave multiple versions installed.
3. Start Paper and allow initial generation to finish. New owned worlds are **community_citadel_v4** and **community_arena_v4**. Older practice worlds, custom spawn selections, records, inventory backups and cosmetics remain intact.
4. Join with `/arena`. If an older/custom lobby is selected, an operator can use **`/pvpadmin usecitadel`** to select the new hub. The v3 grove remains available with `/pvpadmin usegrove`.
5. Verify `/ranked sword` on two accounts, spectating, death/respawn, reward menus and your other plugins on a staging server before opening publicly.

Use stop/start for upgrades, not `/reload`. Legacy v3 terrain journals recover against their original `community_arena_v3` world; v4 journals have separate filenames. A missing recovery world or failed write keeps the journal and reserves the arena. Do not delete journals to bypass a logged recovery failure. Custom external worlds must be loaded before saved locations deserialize; Multiverse-Core is an optional soft dependency.

## New lobby, menus and motion

- An original circular Citadel courtyard, quartz pillars, fountains, a gold/quartz winged monument and genuine wins/Elo/deaths holograms. Four refreshed combat arenas have winged backdrops and terraces. Older operator-edited worlds are not rebuilt.
- Protected lobby: no player damage or PvP. Clock navigation, sword matchmaking, repeater settings, profile and rewards items open framed menus. Operator building requires both operator status and explicit build mode.
- Queue filter for both/casual/ranked, actual playing/waiting counts and kit top five. Selecting both opens an explicit casual/ranked choice. Right-click a kit to arrange its fixed preset storage.
- Profile with server rank, Elo division, tracked playtime, tracking date, friends, statistics, custom kits, inbox, cosmetics and standings.
- All-time/today/this-week statistics, both/casual/ranked filters, global/per-kit cards, wins/losses, kills/deaths, streaks and ratios. Days are UTC calendar days; weeks are ISO UTC weeks. Storage keeps 35 active daily and 12 active weekly buckets per player.
- Paginated real-player standings, top-16 view and exact-name player lookup. No fabricated players or placements.
- Private persistent reward/quest/promotion notifications, unread/all filter and pages; 50 notices retained per player.
- 3–2–1/GO titles, countdown particle rings, animated menu borders, victory/defeat cards, eased Elo progress bossbar, winner cosmetic particles and sound chords. Case rewards are durably saved before the rolling reveal; closing or disconnecting does not lose an awarded reward. Owning the entire catalog keeps the case.
- Personal time: server/day/afternoon/night/midnight. It changes only that player's view. Leaving practice restores the previous personal-time mode and original inventory/location/state.

Players can disable optional motion with **Settings → animations**. Operators can set `presentation.effects: false` in `config.yml`. The separate victory preference controls optional result effects; essential result/countdown information remains visible.

## Commands

| Command | Purpose |
|---|---|
| `/arena`, `/hub`, `/lobby`, `/spawn` | Enter practice hub |
| `/play [kit]`, `/queue [kit]`, `/ranked [kit]` | Menus or queues |
| `/duel <player> <kit> [1..10]` | Private preset set |
| `/duel accept <player>` | Accept a preset or custom invitation; expires after 60 seconds |
| `/layout <kit>` | Arrange fixed preset storage; lower nine editable slots are hotbar |
| `/customkit` | Three saved custom loadout slots |
| `/customduel <player> <1..3>` | Unranked custom set; both fighters receive independent copies of the saved loadout |
| `/profile`, `/stats`, `/notifications` | Profile, filtered statistics, private inbox |
| `/findplayer <exact-name>` | Look up an existing server player's record and Elo position |
| `/leaderboard [elo\|wins\|kills\|deaths\|streak\|bestStreak\|games]` | Text standings; navigation opens inventory standings |
| `/settings` | Preferences and exit practice |
| `/leave`, `/ffa`, `/spec <player>` | Leave/concede, sword FFA, spectating |
| `/friends [add\|accept\|remove <online-player>]` | Mutual friends, maximum 100 |
| `/quests`, `/cases`, `/cosmetics [name\|none]` | Daily quest, cosmetic case, owned title/particle selection |

Custom builder: click a storage slot to choose from the controlled item palette; right-click to clear it. Armor/offhand cycle through allowed choices. Save commits the loadout; Cancel discards edits. Menu items cannot escape into player inventories. Both opponents receive equal equipment. Custom sets are always unranked and use a separate statistics card.

Daily quest: play five sets and win three in the UTC day, then claim one case. Cosmetics are preset titles and particles without combat advantages. Friends removal currently requires the other player online. During combat/spectating only the permitted match-safe commands are available.

## Operators and map setup

`communityarena.admin` and `communityarena.tester` default to operators.

| Command | Purpose |
|---|---|
| `/pvpadmin usecitadel`, `/pvpadmin usegrove` | Select a generated lobby |
| `/pvpadmin lobby <16..1000>` | Protect a square and save your safe standing position as spawn |
| `/pvpadmin pos1`, `/pvpadmin pos2`, `/pvpadmin save` | Select two corners, then stand inside to save |
| `/pvpadmin setspawn`, `/pvpadmin build` | Change spawn or toggle operator build bypass |
| `/pvpadmin arena <1..4> <a\|b>` | Set a fighter spawn inside that arena |
| `/pvpadmin kit <kit>` | Save current inventory as shared preset; exit practice first |
| `/pvpadmin recover <1..4>` | Retry an idle arena's failed reset |
| `/pvpadmin hologram <elo\|wins\|deaths\|streak>` | Place a genuine-record hologram and receive its ID |
| `/pvpadmin delhologram <id>` | Remove a board |
| `/testmatch <player1> <player2> <kit>` | Supervised casual first-to-ten |

Lobby bounds protect the full world height, span at most 1000 blocks on either horizontal axis and cannot overlap combat arenas. Selecting bounds protects existing terrain; it does not generate a 1000×1000 build. Both generated hubs remain protected even when a custom lobby is selected. Combat centers are X=160/320/480/640, Z=0; FFA is X=800 in the combat world. Older incompatible arena spawns fall back safely inside v4 arenas.

## Kits, ratings and historical records

Fourteen preset kits: sword, axe, crystal, smp, uhc, nethop, pot, boxing, diasmp, bow, mace, mace_breach, mace_density and mace_spear. Crystal/SMP/UHC/Nethop default to first-to-one; other ranked presets default to first-to-three. Boxing is 100 valid opponent hits per round. Preset details and earlier mechanics are documented in `INSTALL-V3.md`.

Global and per-kit Elo are independent. New ratings start at 600. Bronze <800, Iron 800, Gold 1000, Emerald 1200, Diamond 1450, Obsidian 1700 and Netherite 2000 each have I/II/III divisions. The highest global ranked player earns #1 Champion. Elo uses K=32, a zero floor and widening kit-rating matchmaking. Same-pair/same-kit rating has a two-minute in-memory cooldown, reset on restart. Casual/private/custom/staff sets never change Elo.

Existing all-time wins/losses/Elo are preserved. Ranked/casual splits and daily/weekly history begin with v4; missing historical splits are not reconstructed. Legacy global kills/deaths include FFA; filtered day/week counters exclude FFA. Per-kit kills/deaths and best-streak tracking begin with v4. Profile tracking date/playtime also begin when v4 first observes the player. Menus label these limits.

These are local server records and Elo divisions, separate from published community HT/LT placements. No automatic community placement or anticheat rating refund is claimed.

## Configuration and recovery

Edit `plugins/CommunityArena/config.yml` while stopped:

```yaml
join-lobby: true
ranked-rounds: 3
presentation:
  brand: Community
  region: Standalone
  footer: /duel  /ranked  /profile
  nametags: true
  hide-score-numbers: true
  effects: true
```

Region is a host label; changing it does not route traffic or create another server. Players independently control sidebar, invites, hit sounds, spectators, nameplates, health, chat, victory effects and animations.

Original inventories, location, experience, health, absorption, food, effects and personal time are backed up before entering. Backup write failure denies entry. Invalid YAML or missing location worlds fail closed instead of rewriting player records. Main data uses atomic replacement where supported. Reward write failure rolls back the uncommitted claim/unlock.

Building-kit fighters may modify only the generated combat interior, within 29 blocks of its center and Y=50..85. Blocks/buckets/flows/fire/explosions record originals before edits, with a 25,000-change cap per arena. Between rounds/sets transient entities are removed, blocks restored, the world saved, then the journal removed. Failed recovery reserves the arena and retains its journal. Synchronous persistence can pause on slow storage; this targets a small standalone server.

## Verification and limits

86 JUnit/MockBukkit tests cover queue/rating rules, command permissions, inventory/menu clicks, filtered stats, UTC rollover/retention, custom kit snapshots, notification privacy, case rollback/closing, spectator/chat isolation, terrain journals and v3-world recovery. A deliberately inverted new animation guard must fail the closing-reward regression test before the source is restored and the clean suite rerun.

MockBukkit does not implement native display rendering, number-format packets or real world disk flushes. Tests disable native-only display features and inject save fixtures. **Native Minecraft visuals, live two-client combat balance, actual power-loss durability and load testing remain unverified.** Test your other scoreboard/TAB/chat plugins for conflicts.

This preview interprets the supplied screenshots with original assets. Exact private server configurations, client Feather/FPS/combo/armor HUDs, fonts/textures/shaders, regional infrastructure, party/team games, tournaments, bespoke anticheat and automated ban refunds are not included. Reference images are not redistributed.

Build: `mvn -f arena/pom.xml clean verify`. Output: `arena/target/CommunityArena-4.0.0.jar`. Test libraries are not shipped; Paper supplies runtime APIs. Existing Discord bot files and GitHub Pages hosting are unchanged. OmniRoute's requested skill was reviewed: it describes an independent AI gateway and adds no Minecraft functionality or runtime dependency here.
