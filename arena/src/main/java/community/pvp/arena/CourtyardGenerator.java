package community.pvp.arena;

import java.util.Random;

import org.bukkit.*;
import org.bukkit.generator.*;

/**
 * Enclosed garden courtyard: four pavilions, lantern arcades, trees and a central fountain.
 */
final class CourtyardGenerator extends BattleGenerator {
    CourtyardGenerator() {
        super(true);
    }

    CourtyardGenerator(boolean upgraded) {
        super(upgraded);
    }

    static void fullColumn(int x, int z, ArenaLandscape.Column out) {
        column(x, z, out);
        CourtyardDetails.column(x, z, out);
    }

    @Override
    public void generateNoise(WorldInfo info, Random random, int cx, int cz, ChunkData data) {
        for (int x = 0; x < 16; x++)
            for (int z = 0; z < 16; z++) {
                int wx = cx * 16 + x, wz = cz * 16 + z;
                final int lx = x, lz = z;
                ArenaLandscape.Column out = (lo, hi, mat) -> {
                    if (hi > lo) data.setRegion(lx, lo, lz, lx + 1, hi, lz + 1, mat);
                };
                if (upgraded) fullColumn(wx, wz, out);
                else column(wx, wz, out);
            }
    }

    static void column(int x, int z, ArenaLandscape.Column out) {
        if (Math.abs(x) > 49 || Math.abs(z) > 49) return;
        int ax = Math.abs(x), az = Math.abs(z), edge = Math.max(ax, az);
        double radius = Math.hypot(x, z);
        out.fill(50, 51, Material.BEDROCK);
        out.fill(51, 64, Material.STONE);
        boolean path = ax < 4 || az < 4 || radius > 17 && radius < 21 || edge > 43;
        Material floor = radius < 9 ? Material.SMOOTH_QUARTZ : path ? (Math.floorMod(x + z, 7) == 0 ? Material.POLISHED_ANDESITE : Material.STONE_BRICKS) : Material.GRASS_BLOCK;
        out.fill(64, 65, floor);
        if (radius > 5 && radius < 7) {
            out.fill(65, 66, Material.QUARTZ_BRICKS);
            return;
        }
        if (radius <= 5) {
            out.fill(64, 65, Material.PRISMARINE_BRICKS);
            out.fill(65, 66, Material.WATER);
            if (ax < 2 && az < 2) {
                out.fill(65, 69, Material.QUARTZ_PILLAR);
                out.fill(69, 70, Material.SEA_LANTERN);
                out.fill(70, 71, Material.WATER);
            }
            return;
        }
        if (edge == 49) {
            out.fill(65, 110, Material.BARRIER);
            out.fill(65, 72, Material.STONE_BRICKS);
            out.fill(72, 73, Material.MOSSY_STONE_BRICKS);
            return;
        }
        // Four pavilion buildings frame the courtyard, with open doorways facing its center.
        int dx = ax - 31, dz = az - 31, d = Math.max(Math.abs(dx), Math.abs(dz));
        if (d <= 10) {
            out.fill(64, 65, Material.SMOOTH_QUARTZ);
            if (d >= 8) {
                boolean door = (Math.abs(dx) < 3 && dz < 0) || (Math.abs(dz) < 3 && dx < 0);
                if (!door) {
                    out.fill(65, 76, Material.QUARTZ_BRICKS);
                    if (d == 8 && Math.floorMod(dx + dz, 4) < 2) out.fill(68, 72, Material.LIGHT_BLUE_STAINED_GLASS);
                }
            }
            int roof = 77 + (10 - d) / 3;
            out.fill(roof, roof + 1, d == 10 ? Material.DARK_OAK_PLANKS : Material.DARK_PRISMARINE);
            if (d < 3) out.fill(roof + 1, roof + 2, Material.COPPER_BLOCK);
            return;
        }
        if ((ax == 12 && az % 16 == 0 && az < 42) || (az == 12 && ax % 16 == 0 && ax < 42)) {
            out.fill(65, 66, Material.CHISELED_STONE_BRICKS);
            out.fill(66, 69, Material.DARK_OAK_FENCE);
            out.fill(69, 70, Material.SEA_LANTERN);
            out.fill(70, 71, Material.DARK_OAK_SLAB);
            return;
        }
        int tx = ax - 17, tz = az - 31;
        if (Math.abs(tx) <= 4 && Math.abs(tz) <= 4) {
            if (tx == 0 && tz == 0) out.fill(65, 74, Material.OAK_LOG);
            for (int y = 71; y <= 77; y++) {
                int r = y < 74 ? 4 : y < 76 ? 3 : 1;
                if (tx * tx + tz * tz <= r * r && !(tx == 0 && tz == 0 && y < 74))
                    out.fill(y, y + 1, Material.OAK_LEAVES);
            }
        }
        if (!path && d > 10 && Math.floorMod(x * 37 + z * 71, 53) == 0) out.fill(65, 66, Material.AZURE_BLUET);
        if (edge == 45 && ax > 6 && az > 6) {
            out.fill(65, 68, Material.OAK_LEAVES);
        }
    }

    static void configure(CommunityArena p) {
        p.citadel.setGameRule(GameRule.RANDOM_TICK_SPEED, 0);
        // Migrate once; later operator spawn selections and removed holograms remain authoritative.
        if (p.data.getBoolean("citadel-v7")) return;
        var saved = p.data.getLocation("setup.spawn");
        if (saved != null && java.util.Set.of("community_citadel_v6", "community_arena_v6", "community_citadel_v4", "community_grove_v3", "community_arena_v4").contains(saved.getWorld().getName()) && Math.abs(saved.getX()) <= 49 && Math.abs(saved.getZ()) <= 49) {
            p.data.set("setup.spawn", null);
            p.data.set("setup.corner1", null);
            p.data.set("setup.corner2", null);
        }
        p.data.set("citadel-v4", true);
        p.data.set("citadel-v7", true);
        p.data.set("citadel.spawn", new Location(p.citadel, .5, 65, 13.5, 180, 0));
        p.citadel.setSpawnLocation(0, 65, 13);
        p.citadel.setGameRule(GameRule.RANDOM_TICK_SPEED, 0);
        for (int i = 0; i < 3; i++) {
            String key = "holograms.c400000" + i;
            p.data.set(key + ".location", new Location(p.citadel, (i - 1) * 12, 68, -13));
            p.data.set(key + ".stat", new String[]{"wins", "elo", "deaths"}[i]);
        }
        p.data.set("holograms.c4000003.location", new Location(p.citadel, .5, 69, 10));
        p.data.set("holograms.c4000003.text", java.util.List.of("§a§lTHE COURTYARD", "§7Duels · Parties · Reference Kits"));
    }
}
