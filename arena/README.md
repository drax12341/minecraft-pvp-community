# CommunityArena 8.0.0 preview

Paper 1.21.11 / Java 21+. One server plugin JAR.

See [installation and preparation](INSTALL-V8.md) and [imported build catalogue](BUILDS-V8.md).

Nine supplied arena builds, each with three isolated copies, and the supplied colorful lobby. Small/Bigger/Massive selection, gray/green selected cards, kit restrictions, countdown entry gates, void containment, nine reference presets, a lobby layout editor, ranked/casual duels, private settings, parties and operator targets.

Native chunk generation and bounded asynchronous prewarming avoid the old global block-builder wait. Leaderboard score snapshots avoid repeated full-record sorting/reads. Historical worlds, pending recovery journals and original inventory backups remain supported.

Kit metadata inferences are preserved in INSTALL-V6.md. Native Paper generation and block states are verified; client visuals, live player load/TPS/RTT and power-loss behavior still need staging verification. No network-ping guarantee or automatic community placement is claimed.

Build: mvn -f arena/pom.xml clean verify.
