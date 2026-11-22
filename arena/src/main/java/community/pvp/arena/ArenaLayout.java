package community.pvp.arena;

import org.bukkit.*;

/** Owned arena geometry only: shallow recoverable ground, permanent edges, no entry cages. */
final class ArenaLayout {
    static final int BASE = 92, SURFACE = 96;
    interface Column { void set(int from, int to, Material material); }

    static boolean cage(ImportedBuilds.Build b, int x, int z) {
        return Math.abs(x - b.a().x()) <= 5 && Math.abs(z - b.a().z()) <= 8
                || Math.abs(x - b.b().x()) <= 5 && Math.abs(z - b.b().z()) <= 8;
    }

    static boolean side(BattleMaps.MapInfo m, int x, int z) {
        return x < 3 || z < 3 || x >= m.width() - 3 || z >= m.length() - 3;
    }

    static void column(BattleMaps.MapInfo m, int x, int z, Column out) {
        var b = ImportedBuilds.build(m.id());
        out.set(BASE, BASE + 1, Material.BEDROCK);
        out.set(BASE + 1, SURFACE, Material.STONE);
        if (cage(b, x, z)) {
            out.set(SURFACE, SURFACE + 1, Material.SMOOTH_STONE);
            out.set(SURFACE + 1, SURFACE + 7, Material.AIR);
        } else if (ImportedBuilds.material(b, x, SURFACE, z).isAir())
            out.set(SURFACE, SURFACE + 1, Material.STONE);
        if (side(m, x, z)) out.set(BASE + 1, SURFACE + 9, Material.STONE);
    }

    static void prepareChunk(CommunityArena p, int id, Chunk chunk) {
        var m = ImportedBuilds.get(id);
        if (m == null) return;
        for (int dx = 0; dx < 16; dx++) for (int dz = 0; dz < 16; dz++) {
            int wx = chunk.getX() * 16 + dx, wz = chunk.getZ() * 16 + dz;
            int x = wx - (m.cx() - m.width() / 2), z = wz - (1024 - m.length() / 2);
            if (x < 0 || z < 0 || x >= m.width() || z >= m.length()) continue;
            // The outer invisible containment shell stays intact.
            if (x == 0 || z == 0 || x == m.width() - 1 || z == m.length() - 1) continue;
            column(m, x, z, (from, to, material) -> {
                for (int y = from; y < to; y++) {
                    var block = chunk.getWorld().getBlockAt(wx, y, wz);
                    if (block.getType() != material) block.setType(material, false);
                }
            });
        }
    }

    static boolean mutable(int arena, org.bukkit.block.Block block, String original, boolean recorded) {
        if (!ImportedBuilds.is(arena)) return true;
        var m = ImportedBuilds.get(arena);
        int x = block.getX() - (m.cx() - m.width() / 2), z = block.getZ() - (1024 - m.length() / 2);
        if (side(m, x, z) || block.getY() <= BASE || block.getType() == Material.BEDROCK) return false;
        return block.getY() <= SURFACE || recorded || original.equals("minecraft:air")
                || original.equals("minecraft:cave_air") || original.equals("minecraft:void_air");
    }
}
