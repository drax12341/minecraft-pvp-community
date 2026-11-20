# CommunityArena 4.1 — icons and responsiveness

## Distinct kit identities

Every preset has a distinct base material, shared across queue cards, details, statistics and spectating. Cards add a short combat-style line and suppress irrelevant item tooltips. Actions remain in server-controlled metadata; these changes do not alter combat equipment or saved layouts.

| Kit | Icon | Style |
|---|---|---|
| Sword | Diamond sword | Precision / sword fundamentals |
| Axe | Diamond axe | Shieldbreak / axe and crossbow |
| Crystal | End crystal | Detonate / crystals and anchors |
| UHC | Golden apple | Survival / buckets, webs and healing |
| SMP | Netherite sword | Endurance / Netherite survival |
| Diamond SMP | Diamond chestplate | Classic / diamond survival |
| Netherite Pot | Netherite chestplate | Overdrive / Netherite potions |
| Diamond Pot | Pink healing splash potion | Refill / potion combat |
| Bow | Bow | Deadeye / ranged precision |
| Boxing | Red leather chestplate | Combo / speed and 100 hits |
| Mace | Mace | Impact / fundamentals |
| Mace Breach | Anvil | Breach / armor pressure |
| Mace Density | Heavy core | Density / aerial strikes |
| Mace + Spear | Diamond spear; trident fallback if unavailable | Reach / mace and spear |

## Measured work reduction

`SmoothExperienceTest.stableLobbyDoesNotRepeatVisibilityTabOrScoreboardAssignments` creates 24 connected MockBukkit players, enters practice, performs a warm-up refresh, resets counters, then executes 20 presentation/board refreshes without changing lobby state. Counters intercept the real Player API calls made by the plugin.

| API operation in that fixture | v4.0 | v4.1 |
|---|---:|---:|
| Repeated player show/hide calls | 11,520 | 0 |
| Repeated tab-name assignments | 480 | 0 |
| Repeated scoreboard assignments | 480 | 0 |

These are API-operation counts from a controlled test. They are not measured network packet counts, real-host tick times, FPS gains or ping reductions. Paper may already coalesce some identical setters internally. Necessary updates still occur when names/titles, health, preferences, match state, spectators or visibility change. Equality checks also avoid unchanged header/footer, sidebar, row/team and health writes. Nameplates avoid unchanged label/position updates, although that native display path is not exercised by MockBukkit.

Owned visibility decisions are tracked separately from other plugins, reconciled on match/spectator transitions and discarded on exit/quit. No combat damage, projectile speed, attack cooldown, knockback or client latency value is falsified. Existing inventory backup writes and terrain-journal safety remain synchronous; slow storage and large player records can still cause pauses.

## Movement fixes

- Check `PlayerMoveEvent.getTo()` for arena/spectator bounds; using the old player location delayed enforcement until another movement event.
- Redirect lobby moves with `setTo()` instead of teleporting from inside the move handler.
- Skip cancelled and orientation-only movement. Countdown freezing still stops position changes while allowing camera rotation.
- Handle destination world differences before calculating distance, and stop an invalid combat move before applying a round loss.

These regressions are checked through dispatched movement events, plus actual disconnect events for both managed spectators and unmanaged players. Existing tests continue to cover spectating, chat isolation, inventory safety, rating integrity and journal recovery.

## Validate on the actual host

The plugin alone cannot shorten network distance, fix routing/Wi-Fi, compensate safely for arbitrary high latency or guarantee a target ping. Use a geographically suitable host and diagnose server-side stalls separately from network RTT. This workspace has no connected live Minecraft host or two-client session, so real combat smoothness and native visuals remain unverified.

Paper includes spark. While players reproduce the lag, run `/spark profiler start --timeout 600` as operator and inspect the resulting report. Compare CPU-heavy tick paths, allocation/GC and storage pauses under the same player count, kits and host before/after. Keep backup and journal guarantees enabled. Official sources: [Paper profiling](https://docs.papermc.io/paper/profiling/) and [scheduler/thread-safety guidance](https://docs.papermc.io/paper/dev/scheduler/). World/entity work stays on the main thread because Bukkit world access is generally not safe asynchronously.

Use Settings → animations or `presentation.effects: false` for reduced optional motion. Test interactions with other TAB/scoreboard/chat/vanish plugins before public rollout. The source bundle includes reproducible regression tests; no production load or live-client benchmark is claimed.

## Requested skills

Ponytail guided a focused change using the current Paper APIs without a new runtime dependency. Graphify's existing AST graph was queried and refreshed for caller relationships. Security/review checks cover server-owned menu actions, unchanged inventory/rating boundaries and visibility lifecycle tests. OmniRoute setup was read: it configures a standalone AI gateway and adds no Minecraft networking feature here.
