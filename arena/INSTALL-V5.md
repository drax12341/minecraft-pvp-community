# CommunityArena 5.0.0 preview

Requires Paper **1.21.11** and **Java 21+**. This download is a server plugin, not a client mod or a server executable.

Stop the server, back up worlds and `plugins/CommunityArena/` together, replace the previous JAR with `CommunityArena-5.0.0.jar`, and restart. Keep `players.yml`, config, and terrain journals. Do not install two CommunityArena versions or use `/reload`.

The eighteen new arenas build incrementally in the existing owned `community_arena_v4` world, far from the old arenas. No survival world is rebuilt. Initial construction can take several minutes; wait for all eighteen `Built ...` messages. Selection is enabled only after the world and completion flag are saved. Existing inventories, custom lobby settings, records and recovery journals remain supported. Existing four arenas provide matchmaking during construction; automatic matchmaking uses the new compatible arenas once construction finishes.

## Maps

Each theme has Compact **50 x 50**, Standard **150 x 250**, and Sky **250 x 350** variants. Their ceilings are Y=110, 180, and 280 respectively. These are generated footprint dimensions; perimeter walls take part of that space.

| Theme | Selector icon | Terrain |
|---|---|---|
| Meadow | Grass block | Mostly open grass, gentle hills up to three blocks |
| Dunes | Sand | Sandstone, sand hills and small ruins |
| Jungle | Jungle sapling | Larger hills, taller trees and denser groves |
| Alpine | Snow block | Snow-covered rolling terrain and trees |
| Cherry | Cherry sapling | Cherry groves, grass and gentle hills |
| Badlands | Red sand | Terracotta, red sand hills and sandstone ruins |

Spawns and clear central lanes are level, with mirrored terrain around them. Bedrock floors, barrier walls/ceilings and movement/pearl/chorus guards contain combat. Terrain changes are journaled and reset. Sword, axe, UHC, boxing and bow are restricted to Compact maps in menus and at session creation. Other modes support all three sizes. Each map hosts one session at a time; choose another map when occupied.

## Duel menus

`/duel` opens the opponent picker. `/duel <player>` opens mode selection for that player. Select the kit, map, first-to score (1..10), and settings, then click the central kit icon to send the invitation. Right-click decreases numeric options. Saved custom kits appear below the fourteen presets; both opponents receive copies of the saved equipment. The receiver uses `/duel accept <sender>` within sixty seconds. Invitations retain an immutable snapshot of the settings and custom equipment.

- **Pearls on walls:** OFF rejects pearl landings adjacent to solid side walls. ON allows those native pearl landings; arena boundaries remain enforced. This does not introduce wall phasing.
- **Responsive movement:** ON adds a small, bounded forward impulse when beginning a sprint. It changes server movement, not network ping or client input latency. This is opt-in for private sessions; ranked defaults remain unchanged.
- **Spectators:** OFF blocks `/spec` for that session. ON still respects every involved player's personal spectator preference. Available for human, bot and party sessions.
- **Auto ignite TNT:** ON primes placed TNT with a four-second fuse. It requires a building kit containing TNT. TNT and flint-and-steel are available in the custom-kit palette; this option does not silently add TNT to ranked presets.
- **Death loot:** ON drops session equipment on knockout. Drops can be collected by living participants in that arena and are removed on round/set cleanup. Original pre-practice inventories never become loot.

The older `/duel <player> <kit> [rounds]` syntax remains supported with default settings. Private duels never award ranked Elo or community HT/LT placements.

## Parties

| Command | Action |
|---|---|
| `/party create` | Create a party; default capacity 10 |
| `/party invite <player>` | Send an invitation valid for 60 seconds |
| `/party accept <leader>` | Accept a matching invitation |
| `/party list` | Show leader, capacity, members and teams |
| `/party transfer <member>` | Transfer leadership |
| `/party max <1..50>` | Set capacity, never below current membership |
| `/party kick <member>` | Remove a member |
| `/party team <member> <red\|blue>` | Assign a team |
| `/party split` | Alternate members into two balanced teams |
| `/party fight` | Choose kit, map and settings in the duel GUI; start team elimination |
| `/party leave`, `/party disband` | Leave or disband |

`/p` is an alias. Only the leader can invite, transfer, kick, change capacity/teams, start battles or disband. Members must be online and idle before a battle starts, and both teams must contain a player. Team membership is fixed during a battle. Friendly fire is disabled; eliminated members spectate until the next round or set end. First-to scoring works for teams; boxing requires 100 hits received per victim. `/leave` or a disconnect ends a party set safely. Parties are temporary and do not persist across server restarts. Bot and party sessions award no statistics, Elo, quests or community placements.

## Operator bot practice

Operators use `/duel bot`. Choose the same kit/map/settings as a normal duel, then set **stationary/moving** and **0..64 totems**. The native target is an armored zombie labeled Practice Bot, not a simulated player or a full combat AI. Moving mode follows a small circuit. It does not attack back. Auto-totem consumes a finite supply, restores health and shows a totem effect. Defeating it advances the first-to counter; subsequent rounds reset terrain and equipment. Use `/leave` to finish. Operator status is rechecked during practice. Sessions expire after ten minutes.

## Friends tab

Press crouch in the lobby to switch the tab roster to online friends; release and crouch again to return to players. The header also lists up to twenty saved friends with online/offline markers. This does not hide other players in the lobby world. Combat/spectator entry shows its normal session roster. Leaving practice restores listings. Existing friend commands are unchanged. Other TAB/scoreboard plugins may compete with these updates.

## Recovery and verification

`/pvpadmin recover <1..4 or 6..23>` retries cleanup of an idle arena. Arena IDs 6..23 correspond to theme order above, with Compact/Standard/Sky for each theme. Failed terrain resets keep the reservation and journal. Do not delete journals to bypass errors. All bounded arena chunks are scanned for transient entities before reuse, including previously unloaded chunks; cleanup and world saves can pause on slow storage.

Build with `mvn -f arena/pom.xml clean verify`. JUnit/MockBukkit exercises settings snapshots, map restrictions/containment, generated floor/sky columns, terrain recovery, party authority/capacity/team damage, casual results, finite bot totems, denied bot access, loot, GUI labels and the friends-tab toggle, alongside the existing suite. Inverting the compact-map restriction caused its regression test to fail, then the original condition was restored.

Native client rendering, human-versus-human combat balance, moving-target smoothness, power-loss durability and fifty-player performance have **not** been verified in a real Minecraft server. Stage this preview with your other plugins before public use. Backups permit rollback to the previous JAR and matching world/data snapshot.

Requested skills: Ponytail guided reuse of the existing recovery/loadout systems; Graphify's no-existing-graph workflow used targeted structural tracing; security hardening checked authority and input/session boundaries; code review used an independent reviewer and addressed its blockers. OmniRoute is an independent AI gateway and requires no Minecraft runtime integration. GitHub Pages and Discord bot files are unchanged by this upgrade.
