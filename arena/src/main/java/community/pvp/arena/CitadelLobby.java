package community.pvp.arena;

import org.bukkit.*;
import org.bukkit.scheduler.BukkitRunnable;

/**
 * A fresh owned world keeps upgrades away from operator-edited older lobbies.
 */
final class CitadelLobby {
    static void build(CommunityArena p) {
        if (p.citadel.getName().equals("community_citadel_v8")) {
            ImportedLobby.configure(p);
            return;
        }
        if (p.citadel.getName().equals("community_citadel_v7")) {
            CourtyardGenerator.configure(p);
            return;
        }
        if (p.data.getBoolean("citadel-v4")) return;
        World w = p.citadel;
        new BukkitRunnable() {
            int x = -48;

            public void run() {
                for (int n = 0; n < 2 && x <= 48; n++, x++)
                    for (int z = -48; z <= 48; z++) {
                        double radius = Math.hypot(x, z);
                        if (radius > 48) continue;
                        for (int y = 61; y < 64; y++) w.getBlockAt(x, y, z).setType(Material.STONE, false);
                        boolean ring = Math.abs(radius - 22) < 2 || Math.abs(radius - 39) < 1;
                        boolean path = Math.abs(x) < 4 || Math.abs(z) < 4;
                        Material floor =
                                radius < 11
                                        ? Material.POLISHED_BLACKSTONE_BRICKS
                                        : ring
                                        ? Material.SMOOTH_QUARTZ
                                        : path ? Material.POLISHED_ANDESITE : Material.GRASS_BLOCK;
                        if (radius < 10 && ((x + z) % 7 == 0)) floor = Material.GILDED_BLACKSTONE;
                        w.getBlockAt(x, 64, z).setType(floor, false);
                        if (radius > 46) w.getBlockAt(x, 63, z).setType(Material.DEEPSLATE_BRICKS, false);
                    }
                if (x > 48) {
                    decorate(p);
                    try {
                        p.worldSaver.accept(w);
                    } catch (Exception e) {
                        p.getLogger().severe("Citadel save failed; construction is not marked complete.");
                        cancel();
                        return;
                    }
                    p.data.set("citadel-v4", true);
                    if (!p.save()) {
                        p.data.set("citadel-v4", false);
                        cancel();
                        return;
                    }
                    for (var player : Bukkit.getOnlinePlayers())
                        if (p.managed(player)
                                && !p.busy(player)
                                && !p.ffa.contains(player.getUniqueId())
                                && !p.queues.containsKey(player.getUniqueId())) p.lobby(player);
                    cancel();
                }
            }
        }.runTaskTimer(p, 1, 1);
    }

    static void decorate(CommunityArena p) {
        World w = p.citadel;
        for (int[] corner : new int[][]{{-30, -25}, {30, -25}, {-30, 25}, {30, 25}}) {
            int x = corner[0], z = corner[1];
            for (int y = 65; y <= 79; y++)
                for (int dx = -1; dx <= 1; dx++)
                    for (int dz = -1; dz <= 1; dz++)
                        w.getBlockAt(x + dx, y, z + dz)
                                .setType(
                                        y == 65 || y == 77 ? Material.CHISELED_QUARTZ_BLOCK : Material.QUARTZ_PILLAR,
                                        false);
            for (int dx = -3; dx <= 3; dx++)
                for (int dz = -3; dz <= 3; dz++)
                    if (Math.abs(dx) + Math.abs(dz) <= 4)
                        w.getBlockAt(x + dx, 80, z + dz).setType(Material.SMOOTH_QUARTZ_SLAB, false);
            w.getBlockAt(x, 81, z).setType(Material.SEA_LANTERN, false);
        }
        for (int side : new int[]{-1, 1})
            for (int i = 0; i < 26; i++) {
                int x = side * i, y = 83 + (int) (8 * Math.sin(i / 25.0 * Math.PI)) - i / 3;
                for (int feather = 0; feather < 4; feather++) {
                    w.getBlockAt(x, y - feather, -30 - feather)
                            .setType(feather == 0 ? Material.GOLD_BLOCK : Material.QUARTZ_BLOCK, false);
                    w.getBlockAt(x, y - feather, -31 - feather)
                            .setType(Material.POLISHED_BLACKSTONE_BRICKS, false);
                }
            }
        for (int y = 65; y <= 87; y++)
            for (int x = -2; x <= 2; x++)
                for (int z = -32; z <= -28; z++)
                    if (Math.abs(x) == 2 || z == -32 || z == -28)
                        w.getBlockAt(x, y, z)
                                .setType(
                                        y % 6 == 0 ? Material.GOLD_BLOCK : Material.POLISHED_BLACKSTONE_BRICKS, false);
        for (int side : new int[]{-1, 1}) {
            int cx = side * 22;
            for (int x = -5; x <= 5; x++)
                for (int z = -5; z <= 5; z++)
                    if (x * x + z * z <= 25) {
                        w.getBlockAt(cx + x, 63, 18 + z).setType(Material.PRISMARINE_BRICKS, false);
                        w.getBlockAt(cx + x, 64, 18 + z).setType(Material.WATER, false);
                    }
            w.getBlockAt(cx, 64, 18).setType(Material.SEA_LANTERN, false);
            for (int y = 65; y <= 68; y++) w.getBlockAt(cx, y, 18).setType(Material.SMOOTH_QUARTZ, false);
        }
        for (int z : new int[]{-18, -6, 6, 30})
            for (int side : new int[]{-1, 1}) {
                int x = side * 9;
                w.getBlockAt(x, 65, z).setType(Material.CHISELED_STONE_BRICKS, false);
                w.getBlockAt(x, 66, z).setType(Material.END_ROD, false);
            }
        for (int i = 0; i < 3; i++) {
            String key = "holograms.c400000" + i;
            p.data.set(key + ".location", new Location(w, (i - 1) * 14, 69, -15));
            p.data.set(key + ".stat", new String[]{"wins", "elo", "deaths"}[i]);
        }
        p.data.set("holograms.c4000003.location", new Location(w, 0.5, 70, 3));
        p.data.set(
                "holograms.c4000003.text",
                java.util.List.of(
                        "\u00a7e\u00a7lTHE CITADEL", "\u00a77Ranked practice | Your next chapter"));
        p.data.set("citadel.spawn", new Location(w, 0.5, 65, 16.5, 180, 0));
        w.setSpawnLocation(0, 65, 16);
    }

    static void arena(CommunityArena p, int index) {
        World w = p.world;
        int cx = index * 160;
        Material accent =
                index == 1
                        ? Material.GOLD_BLOCK
                        : index == 2
                        ? Material.RED_NETHER_BRICKS
                        : index == 3 ? Material.CYAN_TERRACOTTA : Material.CHISELED_SANDSTONE;
        for (int side : new int[]{-1, 1})
            for (int i = 0; i < 22; i++) {
                int y = 86 + (int) (6 * Math.sin(i / 21.0 * Math.PI));
                for (int feather = 0; feather < 3; feather++)
                    w.getBlockAt(cx + side * i, y - feather, -38 - feather)
                            .setType(feather == 0 ? accent : Material.SMOOTH_QUARTZ, false);
            }
        for (int y = 65; y <= 87; y++)
            for (int dx = -2; dx <= 2; dx++)
                w.getBlockAt(cx + dx, y, -40)
                        .setType(y % 6 == 0 ? accent : Material.DEEPSLATE_BRICKS, false);
        for (int x = -28; x <= 28; x++)
            for (int z = -28; z <= 28; z++)
                if (Math.abs(x) > 23 && Math.abs(z) > 13) {
                    w.getBlockAt(cx + x, 65, z).setType(Material.DIRT, false);
                    w.getBlockAt(cx + x, 66, z)
                            .setType(index == 2 ? Material.CRIMSON_NYLIUM : Material.GRASS_BLOCK, false);
                }
    }
}
