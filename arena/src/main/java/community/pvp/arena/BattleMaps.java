package community.pvp.arena;

import java.util.*;

import org.bukkit.*;
import org.bukkit.scheduler.BukkitRunnable;

/**
 * Original, deterministic terrain; no downloaded builds or survival-world edits.
 */
final class BattleMaps {
    static final int FIRST = 6, LAST = 23;
    static final String[] THEMES = {"Meadow", "Dunes", "Jungle", "Alpine", "Cherry", "Badlands"};
    static final Material[] ICONS = {Material.GRASS_BLOCK, Material.SAND, Material.JUNGLE_SAPLING,
            Material.SNOW_BLOCK, Material.CHERRY_SAPLING, Material.RED_SAND};

    record MapInfo(int id, int theme, int size) {
        int width() {
            return new int[]{50, 150, 250}[size];
        }

        int length() {
            return new int[]{50, 250, 350}[size];
        }

        int ceiling() {
            return new int[]{110, 180, 280}[size];
        }

        int cx() {
            return 2048 + (id - FIRST) * 512;
        }

        String name() {
            return THEMES[theme] + " / " + new String[]{"Compact", "Standard", "Sky"}[size];
        }

        boolean supports(String kit) {
            return size == 0 || !Set.of("sword", "axe", "uhc", "boxing", "bow").contains(kit);
        }

        boolean inside(Location l, World world, int margin) {
            return l.getWorld().equals(world) && l.getX() >= cx() - width() / 2 + margin
                    && l.getX() < cx() + width() / 2 - margin && l.getZ() >= 1024 - length() / 2 + margin
                    && l.getZ() < 1024 + length() / 2 - margin && l.getY() >= 50 && l.getY() < ceiling() - margin;
        }
    }

    static MapInfo get(int id) {
        return id < FIRST || id > LAST ? null : new MapInfo(id, (id - FIRST) / 3, (id - FIRST) % 3);
    }

    static List<MapInfo> all() {
        return java.util.stream.IntStream.rangeClosed(FIRST, LAST).mapToObj(BattleMaps::get).toList();
    }

    static int height(MapInfo m, int x, int z) {
        // Flat spawn lanes; the two sides have identical footing.
        if (Math.abs(z) < 7 || Math.abs(x) < 6) return 64;
        double wave = (Math.sin(Math.abs(x) * .055) + Math.cos(z * .048) + 2) / 4;
        return 64 + (int) (wave * (m.theme() == 2 || m.theme() == 3 ? 8 : 3));
    }

    static Location spawn(CommunityArena p, int id, boolean first) {
        MapInfo m = get(id);
        int x = (first ? -1 : 1) * Math.min(m.width() / 3, 55);
        return new Location(p.world, m.cx() + x + .5, 65, 1024.5, first ? -90 : 90, 0);
    }

    static boolean contains(CommunityArena p, int id, Location l) {
        MapInfo m = get(id);
        return m != null ? m.inside(l, p.world, 1) : l.getWorld().equals(p.world)
                && Math.abs(l.getX() - id * 160) < (id == 5 ? 39 : 31) && Math.abs(l.getZ()) < (id == 5 ? 39 : 31)
                && l.getY() >= 50 && l.getY() < 110;
    }

    static void build(CommunityArena p) {
        if (p.data.getBoolean("built-battle-maps-v5")) return;
        new BukkitRunnable() {
            int id = FIRST, x = -25, z = -25;

            public void run() {
                long deadline = System.nanoTime() + 4_000_000;
                do {
                    MapInfo m = get(id);
                    column(p, m, x, z);
                    if (++z >= m.length() / 2) {
                        z = -m.length() / 2;
                        x++;
                    }
                    if (x >= m.width() / 2) {
                        p.getLogger().info("Built " + m.name());
                        if (++id > LAST) {
                            try {
                                p.worldSaver.accept(p.world);
                                p.data.set("built-battle-maps-v5", true);
                                if (!p.save()) p.data.set("built-battle-maps-v5", false);
                            } catch (Exception ex) {
                                p.getLogger().severe("Map save failed: " + ex.getMessage());
                            }
                            cancel();
                            return;
                        }
                        m = get(id);
                        x = -m.width() / 2;
                        z = -m.length() / 2;
                    }
                } while (System.nanoTime() < deadline);
            }
        }.runTaskTimer(p, 1, 1);
    }

    static void set(World w, int x, int y, int z, Material mat) {
        w.getBlockAt(x, y, z).setType(mat, false);
    }

    static void column(CommunityArena p, MapInfo m, int x, int z) {
        World w = p.world;
        int wx = m.cx() + x, wz = 1024 + z, h = height(m, x, z);
        if (Math.floorMod(x, 4) == 0 && Math.floorMod(z, 4) == 0) w.setBiome(wx, 64, wz, switch (m.theme()) {
            case 1 -> org.bukkit.block.Biome.DESERT;
            case 2 -> org.bukkit.block.Biome.JUNGLE;
            case 3 -> org.bukkit.block.Biome.SNOWY_PLAINS;
            case 4 -> org.bukkit.block.Biome.CHERRY_GROVE;
            case 5 -> org.bukkit.block.Biome.BADLANDS;
            default -> org.bukkit.block.Biome.PLAINS;
        });
        Material top = switch (m.theme()) {
            case 1 -> Material.SAND;
            case 3 -> Material.SNOW_BLOCK;
            case 5 -> Material.RED_SAND;
            default -> Material.GRASS_BLOCK;
        };
        boolean edge = x == -m.width() / 2 || x == m.width() / 2 - 1 || z == -m.length() / 2 || z == m.length() / 2 - 1;
        for (int y = 50; y <= h; y++)
            set(w, wx, y, wz, y == 50 ? Material.BEDROCK : y == h ? top : y >= h - 2 ? (m.theme() == 1 ? Material.SANDSTONE : m.theme() == 5 ? Material.TERRACOTTA : Material.DIRT) : Material.STONE);
        set(w, wx, m.ceiling(), wz, Material.BARRIER);
        if (edge) {
            for (int y = h + 1; y < m.ceiling(); y++) set(w, wx, y, wz, Material.BARRIER);
            Material trim = m.theme() == 1 ? Material.CUT_SANDSTONE : m.theme() == 5 ? Material.RED_SANDSTONE : Material.STONE_BRICKS;
            for (int y = h; y < h + 4; y++) set(w, wx, y, wz, trim);
            if (Math.floorMod(x + z, 10) == 0) {
                for (int y = h + 4; y < h + 7; y++) set(w, wx, y, wz, trim);
                set(w, wx, h + 7, wz, Material.SEA_LANTERN);
            }
            return;
        }
        // Mirrored groves around a generous, clear central fighting lane.
        if ((m.size() == 0 ? Math.abs(x) == 15 && Math.abs(z) == 15 : Math.abs(z) > 14 && Math.abs(x) > 12 && Math.abs(x) < m.width() / 2 - 7 && Math.abs(z) < m.length() / 2 - 7
                && Math.floorMod(Math.abs(x), m.theme() == 2 ? 14 : 23) == 8 && Math.floorMod(Math.abs(z), 19) == 9)) {
            if (m.theme() == 1 || m.theme() == 5) {
                for (int y = 1; y <= 3; y++) set(w, wx, h + y, wz, Material.CUT_SANDSTONE);
                return;
            }
            int tall = m.theme() == 2 ? 9 : 5;
            Material log = m.theme() == 4 ? Material.CHERRY_LOG : m.theme() == 2 ? Material.JUNGLE_LOG : Material.SPRUCE_LOG;
            Material leaves = m.theme() == 4 ? Material.CHERRY_LEAVES : m.theme() == 2 ? Material.JUNGLE_LEAVES : Material.OAK_LEAVES;
            for (int y = 1; y <= tall; y++) set(w, wx, h + y, wz, log);
            for (int dy = -2; dy <= 1; dy++)
                for (int dx = -3; dx <= 3; dx++)
                    for (int dz = -3; dz <= 3; dz++)
                        if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) < 6) {
                            var b = w.getBlockAt(wx + dx, h + tall + dy, wz + dz);
                            if (b.getType().isAir()) {
                                var data = (org.bukkit.block.data.type.Leaves) leaves.createBlockData();
                                data.setPersistent(true);
                                b.setBlockData(data, false);
                            }
                        }
        }
    }
}
