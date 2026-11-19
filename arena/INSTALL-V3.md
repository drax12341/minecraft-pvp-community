# CommunityArena 3.0.0 — Grove practice preview

Paper **1.21.11**, Java **21+**. This is a plugin JAR for the server's `plugins/` folder, not the Paper server executable. No client mod or extra plugin is required for its server-side features.

Based on the actual lobby, menu and combat frames in [Noisma's CatPvP video](https://www.youtube.com/watch?v=fs_T4Bs36Iw). See [the reference analysis](VIDEO-REFERENCE.md) for observed details and deliberate interpretations.

## Install or upgrade

1. Stop the server and back up worlds plus `plugins/CommunityArena/`.
2. Replace the old CommunityArena JAR with **CommunityArena-3.0.0.jar**. Keep `players.yml` and `config.yml`.
3. Start Paper. Initial generation takes roughly 10–20 seconds at normal tick speed. New worlds are **community_grove_v3** and **community_arena_v3**. The v2 `community_arena` world, statistics, rewards and inventory backups are preserved.
4. Join and use `/arena`. If a custom/old spawn was saved, run **`/pvpadmin usegrove`** as operator to activate the new lobby.
5. Use `/ranked sword` on two accounts, or `/duel Player sword 3` followed by `/duel accept Challenger`. Use `/layout sword` to arrange that kit.

Stop/start for updates; avoid `/reload`. Generated and existing legacy practice worlds load before saved locations deserialize. If an external custom world is missing, startup preserves the data and asks for that world to load first. Multiverse-Core, when present, is a soft dependency.

## New presentation

- Original grove map: grass island, dirt paths, large trees, stone lantern posts, pond/lilies/reeds, timber crossing and three real-record holograms.
- Video-style hotbar: clock navigation, sword queue, middle repeater settings, profile head and rewards book.
- Centered kit menus with real playing/waiting counts, queue details, personal layouts, ranked/casual selection, profile, settings, spectator browser, rewards and inventory leaderboards.
- Colored division/Elo nameplates, fighter health line, compact yellow/white sidebar, rating/name/title/ping in tab, and match-isolated visibility. Spectators see their match; fighters do not see spectators.
- Room-scoped division chat. Spectator chat cannot reach fighters. Match cards show opponent, kit, rounds and ping; result cards show score, duration, kit Elo change and streak, plus queue-again links.
- 3–2–1/GO, both-players-ready countdown skip by sneaking, round resets, victory/defeat presentation and return to configured spawn.

Nameplate divisions represent this server's Elo. They never invent community HT/LT placements. #1 Champion remains the highest global ranked player's title. Online and queue counts are actual local counts, not simulated network population.

## Combat and inventories

| Kit | Essentials | Default ranked set |
|---|---|---|
| `sword` | Diamond armor, sword-only storage | First to 3 |
| `axe` | Diamond gear, crossbow, sword, axe, bow, six arrows, shield | First to 3 |
| `crystal` | Netherite/blast protection, crystals, obsidian, anchors/glowstone, pearls, totems, XP, crossbow and slow-falling arrows | First to 1 |
| `smp` | Netherite sword/axe, fire-aspect sword, pearls/apples/totems, shield, potions and utility blocks | First to 1 |
| `uhc` | Water/lava, sword/axe, apples, webs, planks, crossbow/arrows, shield | First to 1 |
| `nethop` | Netherite, pearls, healing splash potions, speed/strength, apples and totem | First to 1 |
| `pot` | Diamond gear, pearls, healing splash potions, speed and food | First to 3 |
| `boxing` | Speed, fists, 100 valid opponent hits per round; tiny damage preserves native hit response | First to 3 |
| `diasmp`, `bow` | Diamond SMP and bow variants | First to 3 |
| `mace`, `mace_breach`, `mace_density`, `mace_spear` | Mace variants, wind charges, apples; spear when supported | First to 3 |

Unreadable counts/enchants in the video are original presets, not claims about CatPvP's private configuration. Operators can replace a whole preset with `/pvpadmin kit <kit>` after exiting practice. Both opponents receive equal equipment.

Right-click a kit or run `/layout <kit>` to arrange storage. The lower nine editable slots are the hotbar. Click complete stacks between slots, then Save. Armor/offhand and item amounts remain fixed. Preview items cannot be taken out; duplicate/incomplete layouts are rejected. If an operator changes a kit's inventory shape, incompatible saved layouts are ignored safely.

Global and per-kit Elo are independent. New ratings start at 600; v2 global ratings remain intact. Bronze <800, Iron 800, Gold 1000, Emerald 1200, Diamond 1450, Obsidian 1700 and Netherite 2000 each have I/II/III divisions. Ranked Elo uses K=32, a zero floor and widening kit-rating matchmaking. Same-pair/same-kit scoring has a two-minute cooldown; another kit remains available. The in-memory cooldown resets on restart. Casual/private/staff sets never change Elo. Kit win/loss statistics include casual sets.

## Player commands

| Command | Purpose |
|---|---|
| `/arena`, `/hub`, `/lobby`, `/spawn` | Enter practice hub |
| `/play [kit]`, `/queue [kit]`, `/ranked [kit]` | Menus or queues |
| `/layout <kit>`, `/profile` | Personal inventory arrangement and records |
| `/duel <player> <kit> [1..10]`, `/duel accept <player>` | Private set; invitations expire after 60 seconds |
| `/leave`, `/ffa`, `/spec <player>` | Leave/concede, sword FFA, spectating |
| `/settings`, `/stats` | Preferences and own global records |
| `/friends [add|accept|remove <online-player>]` | Mutual friends; 100-friend limit |
| `/quests`, `/cases`, `/cosmetics [name|none]` | Daily UTC reward and owned preset cosmetics |
| `/leaderboard [elo|wins|kills|deaths|streak|bestStreak|games]` | Text standings; navigation opens the inventory version |

Daily quest: play five sets and win three, then claim one cosmetic case with `/quests`. Cases reveal a preset title/particle cosmetic without combat advantages. Titles display in tab; particles/sound play with victory effects. Friends removal currently requires the other player online. During matches/spectating only leaving, statistics and direct messaging commands are allowed.

## Operator commands

`communityarena.admin` and `communityarena.tester` default to operators. Build bypass additionally requires actual operator status.

| Command | Purpose |
|---|---|
| `/pvpadmin usegrove` | Activate the generated v3 lobby |
| `/pvpadmin lobby <16..1000>` | Protect a square and save your safe standing position as spawn |
| `/pvpadmin pos1`, `pos2`, `save` | Select corners, then stand inside to save |
| `/pvpadmin setspawn`, `build` | Change protected spawn or toggle build bypass |
| `/pvpadmin arena <1..4> <a|b>` | Set fighter spawn inside the selected current arena |
| `/pvpadmin kit <kit>` | Save current inventory as a shared preset; exit practice first |
| `/pvpadmin recover <1..4>` | Retry reset when the arena has no active/finishing match |
| `/pvpadmin hologram <elo|wins|deaths|streak>` | Place a board and receive its ID |
| `/pvpadmin delhologram <id>` | Remove a board |
| `/testmatch <player1> <player2> <kit>` | Supervised casual first-to-ten |

Lobby selections protect the full vertical world height, span at most 1000 blocks per axis and cannot overlap combat arenas. This protects existing terrain, rather than generating a 1000-square build. Combat centers are X=160/320/480/640, Z=0; FFA is X=800. Incompatible v2 arena spawns fall back to safe v3 spawns.

## Configuration

Edit `plugins/CommunityArena/config.yml` while stopped:

```yaml
join-lobby: true
ranked-rounds: 3
rounds:
  crystal: 1
  smp: 1
  nethop: 1
  uhc: 1
presentation:
  brand: Community
  region: Standalone
  footer: /duel  /ranked  /profile
  nametags: true
  hide-score-numbers: true
```

Disabling `presentation.nametags` uses scoreboard prefix labels instead of floating entities. Players can independently toggle rating tags, health, sidebar, chat, invites, spectators, hit sounds and victory effects. Region is an actual host label, not routing infrastructure.

## Recovery and limits

Original inventories, location, experience, health, absorption, food and effects are backed up before clearing items. A failed backup write denies entry. Exiting also restores visibility. Invalid YAML/missing location worlds fail closed without rewriting records; main data writes use atomic replacement where supported.

Only active building-kit fighters can modify the generated combat interior, within 29 blocks of its center and Y=50..85. Supplied utility blocks, buckets, flows, breaking, fire changes and explosions record originals before edits. Explosions batch originals into one durable journal append. Journals cap at 25,000 changed blocks per arena. Boundary/countdown/write-failure edits are denied.

Between rounds/sets transient entities are removed, originals restored, Paper asked to save the world, then the journal removed. Cleanup loads arena chunks so persisted crystals cannot appear after teleport. Failed recovery retains its journal and reserves the arena; use the recovery command or diagnose the logged world/disk issue. Startup replays retained journals before matches. Keep backups of data, worlds and journals together. Resets/world saves are synchronous and can pause on slow disks; this targets a small standalone server, not a large network.

Tests cover the original functionality and new kit/layout clicks, command registration, rating isolation, readiness, Boxing resets, spectator/chat isolation, totem/void/absorption handling, boundary buckets, batched journals, failed flush retention and saved-location world reloads. MockBukkit does not implement native display rendering, number-format packets or world disk flushes; tests disable the first two and inject a world-save fixture. **Native client rendering, live combat balance, actual power-loss durability and load tests remain outstanding.**

This remains a preview, not a verified identical clone or a measurable “100x” claim. Client FPS/combo/armor HUDs, Feather branding, fonts/textures/shaders require client features and are not bundled. Party/team games, tournaments, regional routing, bespoke anticheat and automatic official HT/LT publication are outside this release.

Build: `mvn -f arena/pom.xml clean verify`. Output: `arena/target/CommunityArena-3.0.0.jar`. Test libraries are not shipped; Paper/SnakeYAML APIs come from the server. Test with the intended host's other chat/TAB/scoreboard plugins before opening publicly.

The existing Discord bot and GitHub Pages hosting are unchanged. Optional `/linkdiscord` stays disabled unless configured. OmniRoute is an unrelated AI gateway, not a Minecraft dependency.
