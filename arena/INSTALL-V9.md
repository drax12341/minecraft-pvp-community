# Install CommunityArena 9.0.0 preview

Requires Paper **1.21.11**, Java **21+**, and a matching Java Edition client for native spears/Lunge. This JAR targets 1.21.11; do not assume a newer Minecraft version has identical swapping behavior.

1. Stop the server and back up `plugins/CommunityArena/` and the existing arena worlds.
2. Replace the previous CommunityArena JAR with `CommunityArena-9.0.0.jar`. Keep exactly one CommunityArena JAR in `plugins/`. Preserve its data folder and historical worlds for recovery.
3. Start the server. Existing inventory backups, custom kits, layouts, statistics and rated results remain. New profiles start at 1000; existing ratings are preserved.
4. Use `/pvpadmin maps` to check preparation. The existing 27 imported map copies and lobby remain; this release does not regenerate or replace your builds. `/pvpadmin usecitadel` selects the bundled lobby when desired.
5. Check `/settings`, `/leaderboard`, `/ranked`, and a casual `/duel`. Crouch once during the countdown to vote to skip. Duels need both votes; team games need everyone; a solo practice target needs your one vote. Disabling visual animations changes effects, never competitive readiness requirements.

## Attribute swaps and Lunge

`combat.attribute-swapping` defaults to `true` in the plugin config. On supported Paper 1.21.11, the plugin applies `GlobalConfiguration.unsupportedSettings.updateEquipmentOnPlayerActions = false` in memory on startup. This is a **server-wide** equipment policy, including worlds outside this plugin, while CommunityArena is enabled. Set the plugin option to `false` and restart to retain Paper's configured default. The original in-memory value is restored on plugin shutdown; `config/paper-global.yml` is never overwritten.

If compatibility fails, the startup log explains it and the combat information menu reports native defaults. The supported manual alternative is `unsupported-settings.update-equipment-on-player-actions: false` in Paper's global config followed by a restart. Do not change unrelated Paper security settings.

The Spear Mace preset now supplies native Lunge III. Native hunger, saturation, durability, attack cooldowns, enchantments, shield and wind-charge behavior remain. A matching connected client is still needed to validate frame-sensitive swap techniques; this plugin does not claim to reproduce client-predicted behavior or override third-party anti-cheat rules.

Official references: [Paper global configuration](https://docs.papermc.io/paper/reference/global-configuration/), [Paper 1.21.11 enchantments](https://jd.papermc.io/paper/1.21.11/org/bukkit/enchantments/Enchantment.html), [Minecraft 1.21.11 mechanics](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-11).

## Ranked display and records

Copper starts at 1000, Iron at 1300, Gold at 1600, Emerald at 1900, Diamond at 2200, Netherite at 2500. Each band has three 100-point subdivisions; ratings above 2800 retain Netherite III unless the player qualifies as Champion through #1 local ranked standing. Historical ratings below 1000 display Copper I without rewriting their number. These fixed bands are an adaptation of the reference, not its hidden automatic scaling algorithm.

Right-click a record hologram within eight blocks while in the lobby to open standings. Kit filters show actual recorded kit results. Daily means UTC day; weekly means ISO week in UTC. Missing historical breakdowns stay absent. Elo uses current ratings and disables the period-total control. No preview, bot session, casual match or tier estimate creates a ranked placement.

The new division information hologram is installed once near the selected lobby spawn. Existing operator hologram definitions are preserved. The reference analysis describes what was observed, retained, changed and unavailable. Client resource packs, custom HUDs, cross-region infrastructure and proprietary packet optimizations are outside this JAR.

## Rollback

Stop the server, restore the backed-up plugin data and previous JAR, and retain the same worlds. Restoring the data backup avoids showing new 1000-point profiles under the older division scheme. Do not delete historical worlds or recovery journals.
