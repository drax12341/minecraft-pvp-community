# CommunityArena 7.0.0 preview

Paper 1.21.11 / Java 21+. One server plugin JAR.

See [installation, map sizes, performance evidence and limits](INSTALL-V7.md).

Eighteen biome arenas with new landmark clearings, a grand courtyard with arcades and towers, clickable Compact/Standard/Sky selection, nine reference presets, a lobby layout editor, ranked/casual duels, private settings, parties, operator targets and genuine server-record standings.

Native chunk generation and bounded asynchronous prewarming avoid the old global block-builder wait. Leaderboard score snapshots avoid repeated full-record sorting/reads. Historical worlds, pending recovery journals and original inventory backups remain supported.

Kit metadata inferences are preserved in INSTALL-V6.md. Native client visuals, live server TPS/RTT and power-loss/load behavior still need staging verification. No network-ping guarantee or automatic community placement is claimed.

Build: mvn -f arena/pom.xml clean verify.
