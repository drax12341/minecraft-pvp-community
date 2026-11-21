# CommunityArena 7.0.0 preview

Requires **Paper 1.21.11 / Java 21+**. Stop the server, back up worlds and `plugins/CommunityArena/` together, replace the old CommunityArena JAR with `CommunityArena-7.0.0.jar`, and restart. Do not keep two plugin versions or use `/reload`.

## Clickable map sizes

`/duel` → player → kit → map now has three explicit size buttons at the top:

- **Compact:** 50 x 50, sky ceiling Y=110.
- **Standard:** 150 x 250, sky ceiling Y=180.
- **Sky:** 250 x 350, sky ceiling Y=280.

Each size shows six biome cards. Switching size preserves the chosen biome. Sword, Axe and UHC show locked larger-size buttons, and the server enforces the same restriction on clicks. Switching from an unrestricted kit to a Compact-only kit keeps the biome and chooses its Compact variant. Random Biome selects a free map of the chosen size. Busy cards cannot be selected; a busy selected variant cannot send a challenge. If its arena becomes busy after an invitation is sent, acceptance keeps the invitation active instead of consuming it. Invitations still expire after sixty seconds.

## Arenas and lobby

The eighteen arenas retain their bedrock floors, boundary shells, level starting lanes, ceilings, hills, groves and terrain restoration. This version adds four mirrored landmark areas per map, away from player and moving-target spawn lanes: meadow garden ruins, sandstone arches, jungle shrines, snow/ice formations, cherry gateways and layered badlands buttes.

The new courtyard adds a quartz/gold northern arch, perimeter arcades, corner watchtowers, detailed paving, inset lighting and seats around the existing pavilions, planted paths and fountain. Interiors and doors are cleared of earlier hedges/scenery. Native generation builds these structures, without a global main-thread block builder.

New owned worlds are **community_arena_v7** and **community_citadel_v7**. Existing v6/v4/v3 worlds are preserved. The v6 generators retain the earlier geometry, so previously ungenerated chunks in an archived v6 world do not unexpectedly receive the v7 structures or an empty replacement generator. Built-in lobby selections migrate once; external custom lobbies and later operator choices remain authoritative. `/pvpadmin usecitadel` selects the new courtyard.

Background prewarming prepares all **3,168 arena chunks**, one native asynchronous request at a time, with Compact maps first. It pauses during active duels, bot sessions, party battles and FFA. Let `/pvpadmin maps` finish with zero failures before opening publicly if you want every map generated ahead of play. Generation can take several idle minutes. `maps.prewarm: false` disables the background pass. Native on-demand generation remains available. The v7 completion marker is separate from v6.

Rendered map/lobby overview assets use the actual generator plan with flat material colours. They are structural previews, not Minecraft client screenshots or a shader/texture promise. Optional reproduction after tests: `python arena/tools/render-terrain-preview.py` and the same command with `--lobby` (Pillow required for this offline tool only).

## Performance and records

The hologram top-ten path now snapshots each eligible score once and retains only the best ten candidates. It preserves score-descending, UUID-string tie ordering. Same-stat boards share a ranking only within the current refresh, and unchanged display text is not reassigned. A later refresh recomputes from current records.

The fixed 1,000-record fixture went from **18,204 integer configuration reads to 2,000**, with the same leaders and tie order. This measures avoided plugin work; it is not a native TPS, packet-count or network-ping benchmark. Existing visibility caches, native chunk generation, bounded background prewarming and v7-only loaded-chunk entity cleanup remain in place. Journal durability is retained.

Network RTT still depends on host location, route, congestion and client connection. The plugin neither spoofs ping nor guarantees low ping for every player. Use Paper's bundled spark profiler on the actual host to compare the same player count/activity before and after upgrading. No global server properties, other plugins' settings, Discord infrastructure or GitHub Pages hosting are changed by this upgrade.

## Data and compatibility

Pending v6 journals are recovered against the original v6 combat world; v4/v3 recovery remains supported. A missing required original world fails closed and retains its journal. Legacy cleanup visits generated chunks only, so it does not create void chunks in a partly generated old world. New v7 journals use their own prefix. Do not delete journals to bypass an error.

The nine approved reference kits, kit-layout schema, duel toggles, parties, friends tab and operator practice targets are unchanged. Old preset history and original inventory backups remain intact. Hidden kit enchantment/potion/container/texture inferences remain documented in [the preserved v6 guide](https://github.com/drax12341/minecraft-pvp-community/blob/arena-v7.0.0-preview/arena/INSTALL-V6.md); this is not claimed to be an official MCTiers export. No community HT/LT placements are generated by practice matches.

## Verification and rollback

Build with `mvn -f arena/pom.xml clean verify`. Tests cover size-button behavior, kit restrictions and malformed/forged clicks, busy-map invitations, immutable invitation settings, native ChunkData v6/v7 separation, world-specific journal recovery, landmark presence, all-map bot/team clearance, bounded top-ten ordering/read counts, shared-board refresh freshness and the existing suite. A deliberately inverted heap comparison is caught by its ranking regression before the original source is restored.

**Not verified in a live Minecraft deployment:** final client rendering, host TPS under load, regional ping, native chunk/entity IO across power loss and fifty-player behavior. Stage this preview with your other plugins. Rollback requires the previous JAR and its matching full world/data backup, not deleting or mixing journals.

Requested skills were applied: Ponytail for focused reuse, Graphify for targeted code relationships without an existing graph, security hardening for selection/session/recovery boundaries, and independent code review. OmniRoute remains an independent AI gateway with no native Minecraft runtime role.
