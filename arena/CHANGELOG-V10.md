# CommunityArena 10.0.0 preview

## Fixed

- Remove malformed `Â` prefixes from menu color strings. Repair already-saved malformed color labels when rendering them.
- Remove the old entry cages, glass roofs, lights and bars from generated arenas and existing owned arena chunks. Former cage areas become ordinary battlefield space.
- Allow anchor explosion events to reach the terrain handler; the old general block-explosion cancellation prevented anchor ground destruction.
- Permit self-projectile effects during active duels, bot sessions and party games while retaining opponent/team isolation. Native movement, damage, shields and invulnerability timing remain under Paper's control.

## Changed

- Give imported arenas a bedrock base at Y=92, a shallow stone ground layer, and protected stone side collars. Crystal/anchor explosions and permitted building-kit edits can affect the interior ground and player-placed utility blocks. Natural walls, the bedrock base and perimeter remain protected. Terrain changes retain write-ahead recovery and reset between rounds.
- Upgrade `/duel bot` from a moving dummy into an operator-only native melee opponent. Fighting mode defaults ON; stationary target mode remains available. The opponent pursues, strafes, attacks on bounded weapon cadence, uses the chosen kit's armor/weapon, blocks when its kit has a shield, and consumes finite golden-apple healing and configured totems. Both sides can win first-to rounds. Add bot score and health feedback.
- Keep bot sessions out of player Elo, official tiers, quests and published standings. Stop sessions after disconnect, operator revocation, timeout or invalid entity state.

## Performance

- Check nonempty queues every five ticks instead of waiting for the one-second presentation pass.
- Index bot entities directly instead of scanning all sessions for entity events. Keep only the current bot chunk ticket, releasing the previous ticket during movement.
- Send bot status once per second instead of ten times per second; avoid unchanged offhand/health-label updates.
- Reuse one online-player snapshot for visibility updates, reduce tiny nameplate teleports, and slow decorative glass updates from every four ticks to every twelve.
- Upgrade existing map chunks in the bounded prewarm pipeline, paused while fights run. Persist the completed migration marker only after the world save succeeds. Preserve synchronous write-ahead terrain recovery rather than trading durability for apparent speed.

## Limits

The opponent is visibly a native training mob with melee AI, not a fake online player or a complete human CPvP/flight strategy simulator. Its food/totem regeneration is reproduced explicitly because undead mobs do not receive ordinary regeneration effects. Connected-client hit feel, pathfinding under multiplayer load, TPS and Internet RTT still require staging measurement. No universal ping improvement is claimed.
