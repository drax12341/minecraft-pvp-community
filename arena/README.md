# CommunityArena 3.0.0

Video-informed grove practice plugin for Paper 1.21.11 / Java 21+.

- [Installation, upgrade instructions, commands and limitations](INSTALL-V3.md)
- [Timestamped video analysis and design choices](VIDEO-REFERENCE.md)

Includes an original natural lobby, ranked/casual duels, fourteen kits, personal inventory layouts, per-kit Elo, colored rating/health tags, compact chat/tab/sidebar presentation, spectating, recoverable building combat, quests and cosmetics.

Replace the previous plugin JAR while stopped and retain its data folder. If an old custom lobby is saved, use `/pvpadmin usegrove` to activate the new grove.

This is a preview: native client rendering, live combat and load testing remain outstanding. No client HUD/mod, texture pack, regional network or bespoke anticheat is bundled.

Build: `mvn -f arena/pom.xml clean verify`.
