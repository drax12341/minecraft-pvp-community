# CommunityArena 9.0.0 preview

## Changed

- Spawn directly onto every imported arena's battlefield. Closed entry rooms remain scenery and protected space. Remove gate opening, delayed closures and gate-hit readiness.
- Use one 3–2–1 countdown and crouch-ready policy for duels, team battles and solo practice targets. Both duel opponents, every party member, or the solo player must vote to skip. Ready votes take effect on the next server tick. Countdown movement permits looking around; item use and non-plugin teleports remain blocked until GO.
- Start new ranked profiles and kit ratings at 1000. Preserve existing ratings and inventory layouts. Replace the old Bronze/Obsidian bands with Copper/Iron/Gold/Emerald/Diamond/Netherite I–III. Champion requires first place and at least 2800 Elo.
- Match ranked players against the closest eligible kit rating. Both players' waiting time must permit the rating gap; a new entrant does not inherit a long-waiting opponent's wide search window.
- Make record holograms clickable. Add kit/timeframe filters and personal standing to the leaderboard menu. Daily/weekly totals use recorded UTC/ISO-week data; current Elo is never presented as a historical period result.
- Replace the settings wall with compact display, social and combat categories, readable descriptions, saved ON/OFF controls, and Shift-click reset. Friend-request privacy is enforced by the command handler.

## Fixed

- Add the missing native Lunge III enchantment to the Spear Mace preset.
- Apply Paper's attribute-swapping compatibility policy when the plugin starts, and restore the previous in-memory setting when it stops. The change is server-wide while enabled; `combat.attribute-swapping: false` opts out. No Paper configuration file is overwritten.
- Keep native attributes, enchantments and attack cooldowns; avoid custom velocity scripts that replace spear movement.

## Validation and limits

See INSTALL-V9.md and MEDAL-REFERENCE.md. This is a preview: automated and headless Paper validation do not establish connected-client appearance, swap timing or multiplayer load performance. Server Elo remains separate from reviewed community HT/LT placements.
