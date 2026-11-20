# CommunityArena 4.1.0

Screenshot-informed ranked practice plugin for Paper 1.21.11 / Java 21+.

- [Install, upgrade, commands and configuration](INSTALL-V4.1.md)
- [Icon catalog, measured presentation work and profiling guidance](PERFORMANCE-V4.1.md)
- [Analysis of the 28 reference screenshots](SCREENSHOT-REFERENCE.md)
- [Earlier timestamped CatPvP video analysis](VIDEO-REFERENCE.md)

Distinct icons for all fourteen presets, fewer redundant presentation updates, corrected movement boundaries and an original Citadel lobby, fourteen preset kits, ranked/casual duels, three saved custom kits, personal layouts, filtered statistics, profiles, notifications, paginated standings, genuine hologram leaderboards, scoped chat/tab/sidebar, spectating, quests and animated cosmetic rewards.

Replace the previous plugin JAR while stopped and retain its data folder. Use `/pvpadmin usecitadel` to activate the new lobby if an older spawn is configured. Existing worlds and records are preserved.

This is a preview. Native Minecraft rendering, live two-client combat, power-loss durability and load testing remain unverified. Client HUDs, custom fonts/textures, regional routing and bespoke anticheat are not bundled. Server Elo never invents official community HT/LT placements.

Build: `mvn -f arena/pom.xml clean verify`.
