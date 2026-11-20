# Screenshot reference analysis — v4

All 28 supplied PNGs were inspected, grouped into four contact sheets and traced to the plugin's menu/combat flows. The identifiers below are the numeric suffixes of the supplied files. This is a design interpretation, not access to CatPvP/PvPHQ's private code or server configuration. The earlier [CatPvP video analysis](VIDEO-REFERENCE.md) remains relevant for combat/tab/chat references.

| Screenshot ID | Observed reference | v4 interpretation |
|---|---|---|
| 10232516830271277861 | Profile rank, playtime, joined date, friends | Profile card with real local rank/Elo, tracked playtime/date, friend count and feature navigation |
| 11814280526786271113 | Sync-projectiles preference | No false latency-compensation switch; only preferences the server actually implements |
| 11949162996852153466 | Select-kit menu | Fourteen preset kit cards and separate saved custom kits |
| 12095615476775160342 | Both/casual/competitive filter | Reversible queue filter; both opens explicit casual/ranked choice |
| 12372464715526941688 | Queue overview | Real waiting/playing totals and kit detail menus |
| 1282756979338067962 | Detailed UHC statistics | Per-kit wins/losses/KD/streak/ratios with scope and period filters |
| 13295645748494769261 | Casual/ranked stats selector | Both/casual/ranked independent aggregates |
| 13718734494573661317 | PvPHQ victory and rating HUD | Victory/defeat score card, kit Elo change, eased division bossbar and cosmetic effects |
| 13808295312184080603 | Vanilla custom kit editor/palette | Three persistent server-controlled custom kit slots and equal-equipment unranked challenges |
| 14791459262586483448 | Netherite potion layout | Preset layout rearrangement retaining exact item counts and equipment |
| 15066877455578222528 | Regions | Honest standalone host label; no simulated server transfers |
| 15108289741107731169 | Dragon arena monument | Original winged quartz/accent backdrops and terraces outside fighting lanes |
| 15118697254009379206 | UHC statistics | Same genuinely recorded per-kit statistics view |
| 15285606039803104630 | Combat settings | Persistent flags for actual sidebar/chat/tags/health/hitsounds/spectators/victory/motion features |
| 16399874448414795922 | Mace queue | Four existing mace variants exposed in queue and statistics menus |
| 16620465437539536403 | Ban-related rating refund notifications | Persistent private inbox for actual rewards/quests/promotions; no invented anticheat or refunds |
| 16758988376433233448 | Time-of-day preference | Personal server/day/afternoon/night/midnight cycling; original mode restored on exit |
| 17110940468646633781 | Lobby overview | Original protected Citadel courtyard with hub navigation and genuine holograms |
| 17149293457189767381 | Region selector | Local deployment label and clear infrastructure limitation |
| 3063787034373623072 | Cat statue focal point | Original gold/quartz winged monument, four pillars, fountains and path rings |
| 3144092626369981336 | Victory score and rating bar | Final score title plus bounded, eased Elo progress bar |
| 371465531567641892 | Statistics | Framed statistics menu with global/per-kit cards |
| 4981190032656792303 | Paginated contenders/find player | Real-record pages, top-16 filter and `/findplayer` exact-name lookup |
| 5149706650538201552 | All-time/day/week periods | Preserved historical totals, UTC daily and ISO weekly buckets starting v4 |
| 6997379895317481975 | Global statistics | Global totals card with explicit historical coverage label |
| 7104410274149200088 | Kit top-five queue card | Top five from genuine ranked kit records, own Elo/streak and queue choices |
| 7764903957436293951 | Statistics menu | Compact preset grid, filters, profile/navigation links |
| 8752414122796622499 | Vanilla kit save slots | Three saved custom loadout slots with cancel/save and palette flow |

The shared visual direction uses dark framed inventory menus, restrained gold/cyan accents, concise information cards, colored Elo divisions, scoped chat, a compact sidebar and match-isolated tab with actual ping. Motion is optional and rewards commit before reveal. The plugin does not create custom client fonts, a resource pack, client HUD overlays or the reference servers' exact premium builds.

Implementation map: `ReferenceMenus` owns filters/profile/standings/time; `PracticeInsights` owns bounded aggregates; `SavedKits` owns palette/loadout snapshots; `PracticeInbox` owns private notices; `PracticeMotion` owns optional animation; `CitadelLobby` owns the original new map. `ArenaTerrain` keeps v3 and v4 recovery worlds separate. The local Graphify AST graph was refreshed for relationship review; its inferred structure is not runtime proof.

Validation uses JUnit/MockBukkit and review of inventory ownership, state transitions, persistence failures and world migration. Native Minecraft rendering, two-client combat and performance under production load still require host testing. The source ZIP contains tests and reproducible build instructions, not the supplied reference images.
