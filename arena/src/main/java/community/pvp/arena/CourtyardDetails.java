package community.pvp.arena;

import org.bukkit.Material;

/**
 * V7 courtyard arcade, watchtowers, broad paving details and a northern ceremonial arch.
 */
final class CourtyardDetails {
    static void column(int x, int z, ArenaLandscape.Column out) {
        int ax = Math.abs(x), az = Math.abs(z), edge = Math.max(ax, az);
        if (edge > 48) return;
        // Two-block-wide arcade, with actual open bays between its repeated columns.
        if (edge >= 46) {
            int along = ax >= az ? z : x;
            if (Math.floorMod(along, 8) < 2) out.fill(65, 77, Material.QUARTZ_PILLAR);
            out.fill(77, 78, Material.CHISELED_QUARTZ_BLOCK);
            out.fill(78, 79, Material.DARK_PRISMARINE);
            if (Math.floorMod(along, 8) == 0) out.fill(76, 77, Material.SEA_LANTERN);
        }
        int tx = ax - 43, tz = az - 43, d = Math.max(Math.abs(tx), Math.abs(tz));
        if (d <= 4) {
            out.fill(64, 65, Material.QUARTZ_BRICKS);
            out.fill(65, 82, Material.AIR);
            if (d == 4) {
                out.fill(65, 82, Material.QUARTZ_BRICKS);
                if ((Math.abs(tx) < 2 && tz < 0) || (Math.abs(tz) < 2 && tx < 0)) out.fill(65, 69, Material.AIR);
                else out.fill(71, 77, Material.LIGHT_BLUE_STAINED_GLASS);
            }
            int roof = 82 + (4 - d) / 2;
            out.fill(roof, roof + 2, Material.DARK_PRISMARINE);
            if (d == 0) out.fill(85, 86, Material.SEA_LANTERN);
            return;
        }
        if (Math.abs(z + 37) <= 1 && ax <= 9) {
            if (ax >= 7) {
                out.fill(65, 80, Material.QUARTZ_PILLAR);
                out.fill(65, 66, Material.POLISHED_DEEPSLATE);
                out.fill(79, 80, Material.GOLD_BLOCK);
            } else {
                int arch = 77 + (int) Math.sqrt(49 - x * x);
                out.fill(arch, arch + 2, Material.SMOOTH_QUARTZ);
                out.fill(arch + 2, arch + 3, Material.GOLD_BLOCK);
            }
        }
        if (edge < 43 && (ax == 5 || az == 5) && Math.hypot(x, z) > 10) out.fill(64, 65, Material.POLISHED_DEEPSLATE);
        if (edge < 43 && (ax == 4 || az == 4) && Math.hypot(x, z) > 10 && Math.floorMod(x + z, 6) == 0)
            out.fill(64, 65, Material.SEA_LANTERN);
        // Short stone seats leave the spawn and all four primary paths clear.
        if (((ax >= 23 && ax <= 27 && az == 12) || (az >= 23 && az <= 27 && ax == 12)))
            out.fill(65, 66, Material.SMOOTH_STONE_SLAB);
    }
}
