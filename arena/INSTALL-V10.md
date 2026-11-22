# CommunityArena 10.0.0 preview

Requires **Paper 1.21.11 / Java 21+**. Keep the existing attribute-swap configuration described in INSTALL-V9.md.

1. Stop the server. Back up `plugins/CommunityArena/` **and the arena worlds**. This release deliberately changes the owned arena terrain and removes generated entry cages.
2. Replace the previous CommunityArena JAR with `CommunityArena-10.0.0.jar`; keep exactly one copy in `plugins/`. Preserve player data, inventory backups, kit layouts and recovery journals.
3. Start the server and let `/pvpadmin maps` finish preparing copies. Each copy becomes available after all its chunks have been upgraded. The first upgrade can take several minutes; preparation pauses during matches. Do not delete worlds or journals to speed this up.
4. Check `/settings`, `/play`, a casual duel and Crystal mode. Color prefixes are repaired on render, including already-saved hologram labels. The old cages are removed from existing chunks as well as new generation.

## Operator bot duels

Use **`/duel bot`**, choose a kit and map, and confirm. “Bot fights back” defaults ON; toggle it OFF for a stationary target. Set first-to rounds and finite totems in the same menu. Crouch during countdown to start early. `/leave` ends the session.

The native training opponent pursues and strafes through Paper pathfinding, uses its kit's armor/weapon, attacks through native damage events, and has finite healing and defensive behavior. The sidebar shows the score; its name shows health. It is a visible training mob, not a player account or a full Crystal/mace aerial AI. Bot results never create ranked records.

## Ground destruction and protection

Imported arenas have an unbreakable bedrock base at Y=92, editable interior ground at Y=93–96, and a protected three-block side collar. Existing natural structures above the floor and the invisible outer containment shell remain protected. Permitted player-placed blocks above the floor can be removed and exploded; their originals are tracked.

Crystal and anchor explosions remove eligible ground while excluding walls, sides, bedrock and containers. Terrain is restored between rounds and after recovery. The same bounded terrain policy applies to building kits in bot and party sessions. Damage is rejected during countdown.

## Responsiveness and rollback

Queue checks now run every five ticks. Reduced UI traffic, indexed bot lookups, bounded bot chunk tickets and background map conversion reduce avoidable work. Native hit immunity and player attack cooldowns are preserved. Network ping still depends on player location, routing and host capacity; validate multiplayer hit timing and TPS on your host before moving out of preview.

For rollback, stop the server and restore the previous JAR, **world backup and plugin-data backup together**. Restoring only the old JAR will not rebuild removed cages or undo the bedrock/stone changes.

Implementation references: [Paper pathfinding](https://docs.papermc.io/paper/dev/entity-pathfinder/), [native entity attacks](https://jd.papermc.io/paper/1.21.11/org/bukkit/entity/LivingEntity.html), and [Paper display entities](https://docs.papermc.io/paper/dev/display-entities/).
