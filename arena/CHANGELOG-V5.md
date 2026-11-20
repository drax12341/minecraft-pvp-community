# 5.0.0 preview

Added eighteen biome-themed arenas in three sizes, high sky ceilings, contained match boundaries, compatible-map restrictions, themed selectors, GUI duel configuration and immutable invitation settings.

Added private-session toggles for wall-adjacent pearls, sprint acceleration, spectators, automatic TNT ignition and knockout loot. Saved custom kits can use the same menu; their controlled palette now includes TNT and flint-and-steel.

Added temporary parties with capacity up to fifty, invitations, leadership transfer, kicking, red/blue teams, balanced splitting, and casual team elimination sets. Added operator-only stationary/moving native practice targets with configurable finite totems and first-to scoring. These sessions never award rankings or community placements.

Added lobby crouch toggling between the normal tab roster and friends. Preserved original inventory backups, records, old arenas and terrain journals; expanded recovery to the new arenas and cleanup to unloaded arena chunks.

Validation: **120 JUnit/MockBukkit tests passed, zero failures/errors/skips**, clean Maven verify, compact-map mutation caught and restored, independent code review with reported blockers resolved. No runtime dependencies added. Native client appearance, live combat and fifty-player load remain unverified; use a staging server first. See INSTALL-V5.md for commands, semantics, installation and rollback.
