# Video reference analysis

Reference: https://www.youtube.com/watch?v=fs_T4Bs36Iw

Public metadata: **“I got 2000 elo on new ranking system cat pvp”**, **Noisma**, **37:14**. Chapters cover Crystal, Sword, SMP, UHC, Axe (written “exe”) and Netherite Pot.

Analysis used 35 extracted 720p frames across these chapters, with detailed inspection of lobby, queues, inventories, tab and combat. This is targeted visual sampling, not verification of every frame or hidden mechanic. Reference frames remain local research material and are not redistributed in the JAR/source archive.

| Time | Observed | Implementation |
|---|---|---|
| 00:00–00:20 | Grass/dirt hub, trees, pond/reeds, stone/lanterns; clock/sword/repeater/head/book | Original grove world and matching navigation hierarchy |
| 00:15 | Copper I (928) label above a player | Colored server division/Elo nameplate; own Bronze–Netherite ladder retained |
| 00:18–00:22 | Timed queue action bar and secondary queue menu | Queue status and kit detail stage |
| 00:30 | Netherite Crystal inventory, pearls/totems/crystals/obsidian/glowstone/crossbow/tools; match card | Native Crystal preset, bounded building and recovery; unreadable values remain original choices |
| 04:40 | Diamond armor, sword-only hotbar, opponent rating/name/health, round/time/score sidebar | Sword preset, health line and compact duel sidebar |
| 08:10 | Result card with rating/division/streak progress | Set result card with actual kit delta, division/streak and queue-again action |
| 08:25–08:45 | Yellow kit titles and playing/waiting counts | Framed menus with actual counts and layout access |
| 08:30 | Netherite SMP, shield, multiple swords, pearls/apples/totem/potions | Distinct SMP preset |
| 08:55 | TAB title/region, online count, two colored fighters with ping, own latency/footer | Match-isolated tab using actual local counts and configurable footer |
| 12:00 | UHC water/axe/sword/apples/web/lava/planks/crossbow/shield | Utility preset with fluid/placement recovery |
| 19:25 | Left Shift skip countdown (1/2), Axe first-to-three card | Both-player readiness and per-kit ranked set lengths |
| 20:00 | Axe/crossbow/sword/bow, six arrows and shield | Axe preset essentials |
| 30:48–31:10 | Pot option and Netherite potion combat, heals/apples/totem, rating and health | Separate potion presets with kit Elo and health display |
| 36:15–36:40 | Return to hub, floating standings and pond | Return flow, real-record holograms and inventory standings |

Community branding replaces CatPvP branding. No premium map, texture, skin or private plugin binary is copied. The video’s Elo divisions are not evidence of reviewed HT/LT placements; community tier publication and the existing client tagger remain separate.

Feather/FPS/combo/equipment overlays are client-side and cannot be silently recreated by a normal server plugin. Network counts and regional routing from the reference are not fabricated here. Exact knockback tuning, matchmaking internals, hidden inventories, settings pages and map dimensions cannot be established from sampled frames; documented original choices fill those gaps.

Review prompted fixes for bucket edits outside reset bounds, absorption double-counting, stale v2 arena spawns, Boxing hits surviving rounds, missing cosmetic titles, per-block explosion flushes, generation markers preceding world saves, and saved locations loading before their worlds.

Tests exercise persisted location reloads, click-driven layout saves, and chat recipient isolation. Native Minecraft rendering and live PvP acceptance tests remain outstanding; the release is marked preview.
