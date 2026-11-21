package community.pvp.arena;

import org.bukkit.Material;

/**
 * Pure terrain plan: safe for Paper's parallel generation workers and reproducible in tests.
 */
final class ArenaLandscape {
    interface Column {
        void fill(int from, int to, Material material);
    }

    static int terrain(BattleMaps.MapInfo m, int x, int z) {
        if (Math.abs(z) < 7 && Math.abs(x) < m.width() / 2 - 1) return 64;
        int edge = Math.min(m.width() / 2 - Math.abs(x), m.length() / 2 - Math.abs(z));
        double band = 12 + Math.sin(z * .043) * 3 + Math.cos(x * .057) * 2;
        if (edge > band) return BattleMaps.height(m, x, z);
        double ridge = (Math.sin(x * .18) + Math.cos(z * .13) + 2) * 1.8;
        return 65 + (int) ((1 - Math.min(edge, band) / band) * (13 + ridge));
    }

    static Material rock(int theme, int y, int hash) {
        return switch (theme) {
            case 1 ->
                    y % 5 == 0 ? Material.CHISELED_SANDSTONE : y % 4 == 0 ? Material.SMOOTH_SANDSTONE : Material.SANDSTONE;
            case 5 ->
                    y % 6 < 2 ? Material.ORANGE_TERRACOTTA : y % 6 < 4 ? Material.RED_TERRACOTTA : Material.YELLOW_TERRACOTTA;
            case 3 -> y > 75 ? Material.SNOW_BLOCK : hash % 5 == 0 ? Material.BLUE_ICE : Material.ANDESITE;
            default -> hash % 7 == 0 ? Material.MOSSY_COBBLESTONE : hash % 4 == 0 ? Material.ANDESITE : Material.STONE;
        };
    }

    static void column(BattleMaps.MapInfo m, int x, int z, Column out) {
        int h = terrain(m, x, z), edge = Math.min(m.width() / 2 - Math.abs(x), m.length() / 2 - Math.abs(z));
        int hash = Math.floorMod(x * 734287 + z * 912931 + m.theme() * 313, 997);
        Material surface = switch (m.theme()) {
            case 1 -> hash % 9 == 0 ? Material.SMOOTH_SANDSTONE : Material.SAND;
            case 3 -> Material.SNOW_BLOCK;
            case 5 -> Material.RED_SAND;
            default -> hash % 13 == 0 ? Material.MOSS_BLOCK : Material.GRASS_BLOCK;
        };
        out.fill(50, 51, Material.BEDROCK);
        out.fill(51, Math.min(h, 64), Material.STONE);
        if (edge < 12) {
            for (int y = 64; y < h; y++) out.fill(y, y + 1, rock(m.theme(), y, hash + y));
        } else out.fill(64, h, Material.DIRT);
        out.fill(h, h + 1, surface);
        out.fill(m.ceiling(), m.ceiling() + 1, Material.BARRIER);
        boolean wall = x == -m.width() / 2 || x == m.width() / 2 - 1 || z == -m.length() / 2 || z == m.length() / 2 - 1;
        if (wall) {
            out.fill(h + 1, m.ceiling(), Material.BARRIER);
            return;
        }
        // Worn ceremonial gateway on either spawn axis, carved into the enclosing natural ridge.
        if (Math.abs(x) > m.width() / 2 - 7 && Math.abs(z) < 6) {
            Material trim = m.theme() == 1 || m.theme() == 5 ? Material.CUT_SANDSTONE : Material.STONE_BRICKS;
            out.fill(64, 65, trim);
            if (Math.abs(z) >= 4) out.fill(65, 76, trim);
            if (Math.abs(z) < 4) {
                out.fill(65, 73, Material.AIR);
                out.fill(73 + (4 - Math.abs(z)) / 2, 76 + (4 - Math.abs(z)) / 2, trim);
            }
            if (Math.abs(z) == 4) out.fill(76, 77, Material.SEA_LANTERN);
            return;
        }
        // Grass/flower texture is deliberately kept away from the spawn and main combat lane.
        if (Math.abs(z) > 9 && edge > 12 && hash % 37 == 0 && m.theme() != 1 && m.theme() != 5)
            out.fill(h + 1, h + 2, m.theme() == 3 ? Material.SNOW : m.theme() == 4 ? Material.PINK_PETALS : hash % 2 == 0 ? Material.SHORT_GRASS : Material.FERN);
        if (m.theme() == 1 || m.theme() == 5) {
            int rx = Math.abs(x) - m.width() / 3, rz = Math.abs(z) - m.length() / 3;
            if (Math.abs(rz) <= 1 && Math.abs(rx) <= 4) {
                if (Math.abs(rx) == 4) out.fill(h + 1, h + 9, Material.CUT_SANDSTONE);
                else out.fill(h + 7, h + 9, Material.CHISELED_SANDSTONE);
                return;
            }
            if (edge > 9 && edge < 20 && Math.abs(z) > 10 && hash % 59 == 0) {
                out.fill(h + 1, h + 3, Material.CUT_SANDSTONE);
                out.fill(h + 3, h + 4, Material.CHISELED_SANDSTONE);
            }
            if (edge > 14 && Math.abs(z) > 10 && hash % 131 == 0) out.fill(h + 1, h + 2, Material.DEAD_BUSH);
            return;
        }
        // Deterministic tree cells, with tapered, overlapping crowns rather than repeated flat lollipops.
        int spacing = m.size() == 0 ? 15 : m.theme() == 2 ? 15 : 23;
        int tx = (int) Math.round(Math.abs(x) / (double) spacing) * spacing, tz = (int) Math.round(Math.abs(z) / (double) spacing) * spacing;
        int cellHash = Math.floorMod(tx * 31 + tz * 17 + m.theme() * 131, 997);
        if (m.theme() == 0 && cellHash % 3 == 0) return;
        tx += cellHash % 5 - 2;
        tz += (cellHash / 5) % 5 - 2;
        if (tx < 12 || tz < 12 || tx > m.width() / 2 - 7 || tz > m.length() / 2 - 7) return;
        int dx = Math.abs(x) - tx, dz = Math.abs(z) - tz;
        int base = terrain(m, tx, tz), tall = (m.theme() == 2 ? 11 : m.theme() == 3 ? 9 : 7) + cellHash % 3 - 1;
        Material log = m.theme() == 4 ? Material.CHERRY_LOG : m.theme() == 2 ? Material.JUNGLE_LOG : m.theme() == 3 ? Material.SPRUCE_LOG : Material.OAK_LOG;
        Material leaves = m.theme() == 4 ? Material.CHERRY_LEAVES : m.theme() == 2 ? Material.JUNGLE_LEAVES : m.theme() == 3 ? Material.SPRUCE_LEAVES : Material.OAK_LEAVES;
        if (dx == 0 && dz == 0) out.fill(base + 1, base + tall + 1, log);
        if (m.theme() == 2 && Math.abs(dx) + Math.abs(dz) == 1) out.fill(base + 1, base + 3, log);
        for (int dy = 0; dy <= 5; dy++) {
            int radius = m.theme() == 3 ? Math.max(1, 4 - dy / 2) : dy < 2 ? 3 : dy < 4 ? 4 : 2;
            if (dx * dx + dz * dz <= radius * radius && !(dx == 0 && dz == 0 && dy < 3))
                out.fill(base + tall - 3 + dy, base + tall - 2 + dy, leaves);
        }
    }
}
