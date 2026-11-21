# CommunityArena 8.0.1 preview

8.0.1 fixes map cards silently ignoring clicks while their copies are preparing or busy. Any compatible design can now be selected; the browser shows available/preparing counts, and selecting a preparing design prioritizes its next unused copy. Starting a match still waits for a prepared, unoccupied copy. This patch reuses the existing v8 worlds and builds; no world deletion or rebuild is needed.

Paper 1.21.11, Java 21 or newer. Stop the server, back up the plugin data and worlds, replace the CommunityArena JAR, and start again. No WorldEdit, FAWE, Citizens, or schematic files are needed on the server: the sanitized builds are bundled in the one JAR.

The new owned worlds are `community_arena_v8` and `community_citadel_v8`. Previous worlds are retained for inventory-location and terrain-journal recovery. Keep them until recovery is complete. A v7 journal with a missing original world fails startup safely instead of discarding recovery data. Existing nine kit presets and player layouts remain unchanged.

On the first start, arena copies prepare in the background, smallest first, one asynchronous chunk request at a time. A copy becomes selectable for starting matches only after all its chunks have prepared. Allow this initial preparation to finish before opening the server; `/pvpadmin maps` reports progress. Preparation pauses during fights to protect their tick budget. Imported arenas always prepare, including when an older config has `maps.prewarm: false`.

The `/duel` map browser has Small/Bigger/Massive tabs. Selecting an arena stays in the browser and changes its gray marker to green; the second row contains fitting theme icons. Sword, Axe and UHC see only Small arenas. The restriction also applies to direct actions, invitations, queues, parties and bot practice. A design has three separate physical instances; players select the design and the allocator reserves a free prepared copy.

Each imported arena has two matching entry rooms. Every round counts down, opens the gates at GO, and closes them five seconds later. Stragglers are moved onto the exit landing first. Closed rooms reject pearls and other player teleports; their structures cannot be edited or destroyed by explosions. Bot practice also has countdown gates; party rooms support 25v25 and unbalanced teams up to 49v1 within the 50-member party limit.

Arena islands have no generated mainland underneath or between them. Invisible perimeter walls, ceilings and a catch floor enforce containment. Falling players return to an exit landing rather than dropping into the void. The separate casual FFA platform is retained. The colorful lobby includes the existing practice hotbar, kit editor and real record leaderboards; `/pvpadmin usecitadel` selects it if a custom lobby selection was retained.

Verification includes automated menu/allocation/gate/containment/recovery regression tests and a separate real Paper verification plugin (not shipped) checking native palettes, all 27 copies, lobby floors/headroom, void, boundaries and gate opening/closing. Test fixtures retain archived v7 terrain regression coverage. MockBukkit lacks several native BlockData properties, so native block-state validation is essential.

No connected Minecraft client was used for visual walk-throughs or multiplayer combat/load testing. Structural/top-down previews are not Minecraft screenshots. RTT depends on host location and each player's route; this JAR cannot guarantee low ping for everyone.
