package community.pvp.arena;

import org.bukkit.Material;

/**
 * V7 landmarks layer over the frozen v6 terrain plan, keeping old worlds reproducible.
 */
final class ArenaLandmarks {
    static void column(BattleMaps.MapInfo map, int x, int z, ArenaLandscape.Column out) {
        int sx = map.width() / 3, sz = map.length() / 3, rx = Math.abs(x) - sx, rz = Math.abs(z) - sz;
        int distance = rx * rx + rz * rz;
        if (distance > 49 || Math.abs(z) < 9) return;
        int base = ArenaLandscape.terrain(map, sx, sz), ground = ArenaLandscape.terrain(map, x, z);
        out.fill(Math.min(base, ground), base + 1, map.theme() == 1 ? Material.SMOOTH_SANDSTONE : map.theme() == 5 ? Material.RED_SAND : Material.MOSS_BLOCK);
        out.fill(base + 1, Math.min(map.ceiling() - 2, base + 26), Material.AIR);
        switch (map.theme()) {
            case 0 -> {
                if (distance >= 30 && distance <= 40) out.fill(base + 1, base + 2, Material.MOSSY_STONE_BRICKS);
                if (Math.abs(rx) == 4 && Math.abs(rz) <= 1) out.fill(base + 1, base + 5, Material.CRACKED_STONE_BRICKS);
                if (distance < 9) out.fill(base, base + 1, Material.GRAVEL);
            }
            case 1 -> {
                if (Math.abs(rx) == 5 && Math.abs(rz) <= 1) out.fill(base + 1, base + 10, Material.CUT_SANDSTONE);
                if (Math.abs(rx) < 5 && Math.abs(rz) <= 1) {
                    int arch = base + 7 + (int) Math.sqrt(25 - rx * rx);
                    out.fill(arch, arch + 2, Material.CHISELED_SANDSTONE);
                }
                if (distance >= 36 && distance <= 49) out.fill(base, base + 1, Material.SANDSTONE);
                if (Math.abs(rx) == 5 && Math.abs(rz) == 4) out.fill(base + 1, base + 3, Material.CHISELED_SANDSTONE);
            }
            case 2 -> {
                int d = Math.max(Math.abs(rx), Math.abs(rz));
                if (d <= 6) {
                    int top = base + Math.max(1, 7 - d);
                    out.fill(base + 1, top + 1, d % 2 == 0 ? Material.MOSSY_COBBLESTONE : Material.MOSSY_STONE_BRICKS);
                }
                if (rx == 0 && rz == 0) out.fill(base + 7, base + 9, Material.CHISELED_STONE_BRICKS);
            }
            case 3 -> {
                if (distance <= 30) {
                    int height = 2 + Math.max(0, 6 - (int) Math.sqrt(distance)) * 2;
                    out.fill(base + 1, base + height, Material.PACKED_ICE);
                    out.fill(base + height, base + height + 1, Material.SNOW_BLOCK);
                }
            }
            case 4 -> {
                if (Math.abs(rx) == 4 && Math.abs(rz) <= 1) out.fill(base + 1, base + 9, Material.CHERRY_LOG);
                if (Math.abs(rx) <= 6 && Math.abs(rz) <= 1) {
                    out.fill(base + 8, base + 10, Material.CHERRY_PLANKS);
                    if (Math.abs(rx) >= 5) out.fill(base + 10, base + 11, Material.DARK_OAK_PLANKS);
                }
                if (distance > 20 && distance < 40 && (rx + rz) % 3 == 0)
                    out.fill(base + 1, base + 2, Material.PINK_PETALS);
            }
            case 5 -> {
                if (distance <= 36) {
                    int height = Math.max(2, 10 - (int) (Math.sqrt(distance) * 1.3));
                    for (int y = base + 1; y < base + height; y++) out.fill(y, y + 1, ArenaLandscape.rock(5, y, 0));
                    out.fill(base + height, base + height + 1, Material.RED_SAND);
                }
            }
        }
    }
}
