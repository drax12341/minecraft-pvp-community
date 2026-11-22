package community.pvp.arena;

import java.io.*;
import java.util.*;
import java.util.zip.GZIPInputStream;

import org.bukkit.*;
import org.bukkit.block.data.BlockData;
import org.bukkit.generator.ChunkGenerator;

/**
 * Sanitized, bundled templates. Immutable column runs are shared by every arena copy.
 */
final class ImportedBuilds {
    static final int FIRST = 100, COPIES = 3, COUNT = 9, LAST = FIRST + COUNT * COPIES - 1;
    static final String[] NAMES = {"Frost Ring", "Fighter Circle", "Royal Bridges", "Castle Gardens", "Sandstone Hall", "Woodland Court", "Sky Blossom", "Sunstone Sanctuary", "Grand Colosseum", "Colorful Citadel"};
    static final Material[] ICONS = {Material.PACKED_ICE, Material.IRON_SWORD, Material.BLUE_BANNER, Material.MOSSY_STONE_BRICKS, Material.SANDSTONE, Material.SPRUCE_SAPLING, Material.CHERRY_SAPLING, Material.SUNFLOWER, Material.CHISELED_SANDSTONE};
    static final int[] SIZES = {0, 0, 0, 1, 1, 1, 1, 2, 2};
    static final List<BattleMaps.MapInfo> SLOTS = java.util.stream.IntStream.rangeClosed(FIRST, LAST).mapToObj(id -> new BattleMaps.MapInfo(id, (id - FIRST) / COPIES, SIZES[(id - FIRST) / COPIES])).toList();
    static final List<BattleMaps.MapInfo> TEMPLATES = SLOTS.stream().filter(m -> (m.id() - FIRST) % COPIES == 0).toList();
    static volatile List<Build> builds = List.of();
    static final Map<Integer, List<org.bukkit.util.Vector>> teamLandings = new HashMap<>();

    record Run(int from, int to, int palette) {
    }

    record Entry(int x, int z, int gate) {
    }

    record Build(int width, int height, int length, int floor, BlockData[] palette, List<Run>[] columns, Entry a,
                 Entry b) {
        int baseY() {
            return 96 - floor;
        }

        void column(ChunkGenerator.ChunkData chunk, int lx, int lz, int x, int z) {
            if (x < 0 || z < 0 || x >= width || z >= length) return;
            for (Run r : columns[z * width + x])
                chunk.setRegion(lx, baseY() + r.from, lz, lx + 1, baseY() + r.to, lz + 1, palette[r.palette]);
        }
    }

    static synchronized void load() {
        if (!builds.isEmpty()) return;
        var result = new ArrayList<Build>();
        for (int i = 0; i <= COUNT; i++) {
            try (var resource = ImportedBuilds.class.getResourceAsStream("/builds/" + i + ".bin.gz")) {
                if (resource == null) throw new IOException("Missing build " + i);
                result.add(read(new DataInputStream(new GZIPInputStream(resource))));
            } catch (IOException | IllegalArgumentException e) {
                throw new IllegalStateException("Cannot load bundled build " + NAMES[i] + "; refusing incomplete arenas", e);
            }
        }
        builds = List.copyOf(result);
    }

    @SuppressWarnings("unchecked")
    static Build read(DataInputStream in) throws IOException {
        if (in.readInt() != 0x43413842) throw new IOException("Invalid build signature");
        int w = in.readUnsignedShort(), h = in.readUnsignedShort(), l = in.readUnsignedShort(), floor = in.readUnsignedShort(), count = in.readUnsignedShort();
        if (w < 20 || l < 20 || w > 512 || l > 512 || h < 8 || h > 256 || floor + 7 >= h || count < 1 || count > 4096 || (long) w * h * l > 16000000)
            throw new IOException("Invalid build dimensions");
        BlockData[] palette = new BlockData[count];
        for (int i = 0; i < count; i++) {
            String s = in.readUTF();
            if (s.length() > 512 || !s.startsWith("minecraft:") || s.contains("command_block") || s.contains("spawner") || s.contains("portal") || s.contains("jigsaw") || s.contains("structure_block"))
                throw new IOException("Unsafe palette entry");
            try {
                palette[i] = Bukkit.createBlockData(s);
            } catch (IllegalArgumentException ex) {
                throw new IOException("Invalid native block state: " + s, ex);
            }
        }
        Entry a = entry(in, w, l), b = entry(in, w, l);
        short[] blocks = new short[w * h * l];
        for (int i = 0; i < blocks.length; i++) {
            int p = in.readUnsignedShort();
            if (p >= count) throw new IOException("Invalid palette index");
            blocks[i] = (short) p;
        }
        if (in.read() != -1) throw new IOException("Trailing build data");
        List<Run>[] columns = (List<Run>[]) new List<?>[w * l];
        for (int z = 0; z < l; z++)
            for (int x = 0; x < w; x++) {
                var runs = new ArrayList<Run>();
                int y = 0;
                while (y < h) {
                    int start = y, p = Short.toUnsignedInt(blocks[(y * l + z) * w + x]);
                    while (++y < h && Short.toUnsignedInt(blocks[(y * l + z) * w + x]) == p) {
                    }
                    if (!palette[p].getMaterial().isAir()) runs.add(new Run(start, y, p));
                }
                columns[z * w + x] = List.copyOf(runs);
            }
        return new Build(w, h, l, floor, palette, columns, a, b);
    }

    static Entry entry(DataInputStream in, int w, int l) throws IOException {
        Entry e = new Entry(in.readUnsignedShort(), in.readUnsignedShort(), in.readUnsignedShort());
        if (e.x < 6 || e.x >= w - 6 || e.z < 9 || e.z >= l - 9 || e.gate < 1 || e.gate >= w - 1)
            throw new IOException("Invalid entry room");
        return e;
    }

    static boolean is(int id) {
        return id >= FIRST && id <= LAST;
    }

    static int template(int id) {
        return FIRST + ((id - FIRST) / COPIES) * COPIES;
    }

    static Build build(int id) {
        return builds.get((id - FIRST) / COPIES);
    }

    static BattleMaps.MapInfo get(int id) {
        return is(id) ? SLOTS.get(id - FIRST) : null;
    }

    static BattleMaps.MapInfo at(int x, int z) {
        int n = Math.floorDiv(x - 20000 + 512, 1024);
        var m = get(FIRST + n);
        return m != null && x >= m.cx() - m.width() / 2 && x < m.cx() - m.width() / 2 + m.width() && z >= 1024 - m.length() / 2 && z < 1024 - m.length() / 2 + m.length() ? m : null;
    }

    static Location spawn(CommunityArena p, int id, boolean first) {
        var m = get(id);
        var b = build(id);
        var e = first ? b.a : b.b;
        return new Location(p.world, m.cx() - m.width() / 2 + e.gate + (first ? 2.5 : -1.5), 97, 1024 - m.length() / 2 + e.z + .5, first ? -90 : 90, 0);
    }

    static Material material(Build b, int x, int y, int z) {
        if (x < 0 || z < 0 || x >= b.width || z >= b.length) return Material.AIR;
        int localY = y - b.baseY();
        for (Run run : b.columns[z * b.width + x])
            if (localY >= run.from && localY < run.to) return b.palette[run.palette].getMaterial();
        return Material.AIR;
    }

    static Location teamSpawn(CommunityArena p, int id, boolean first, int member) {
        var map = get(id);
        var b = build(id);
        int key = (id - FIRST) / COPIES * 2 + (first ? 0 : 1);
        var points = teamLandings.computeIfAbsent(key, unused -> {
            var own = first ? b.a : b.b;
            var other = first ? b.b : b.a;
            double sx = own.gate + (first ? 2.5 : -1.5), sz = own.z + .5;
            double ox = other.gate + (first ? -1.5 : 2.5), oz = other.z + .5;
            var result = new ArrayList<org.bukkit.util.Vector>();
            for (int dx = -20; dx <= 20; dx++)
                for (int dz = -20; dz <= 20; dz++) {
                    int x = (int) Math.floor(sx) + dx, z = own.z + dz;
                    if (x < 1 || z < 1 || x >= b.width - 1 || z >= b.length - 1) continue;
                    double px = x + .5, pz = z + .5;
                    if (Math.pow(px - sx, 2) + Math.pow(pz - sz, 2) >= Math.pow(px - ox, 2) + Math.pow(pz - oz, 2)) continue;
                    if (Math.abs(px - b.a.x - .5) < 7 && Math.abs(pz - b.a.z - .5) < 10
                            || Math.abs(px - b.b.x - .5) < 7 && Math.abs(pz - b.b.z - .5) < 10) continue;
                    if (material(b, x, 96, z).isSolid() && material(b, x, 97, z).isAir() && material(b, x, 98, z).isAir())
                        result.add(new org.bukkit.util.Vector(px, 97, pz));
                }
            result.sort(Comparator.<org.bukkit.util.Vector>comparingDouble(v -> Math.pow(v.getX() - sx, 2) + Math.pow(v.getZ() - sz, 2))
                    .thenComparingDouble(org.bukkit.util.Vector::getX).thenComparingDouble(org.bukkit.util.Vector::getZ));
            if (result.size() < 49) throw new IllegalStateException("Not enough safe team landings in " + map.name());
            return List.copyOf(result.subList(0, 49));
        });
        var point = points.get(member);
        return new Location(p.world, map.cx() - map.width() / 2 + point.getX(), 97,
                1024 - map.length() / 2 + point.getZ(), first ? -90 : 90, 0);
    }

    static int available(CommunityArena p, int template, String kit) {
        var m = get(template);
        if (m == null || !m.supports(kit)) return 0;
        int start = template(template);
        for (int id = start; id < start + COPIES; id++)
            if (!p.occupied.contains(id) && (p.warmup == null || p.warmup.ready(id))) return id;
        return 0;
    }

    static boolean protectedRoom(int id, Location l) {
        if (!is(id)) return false;
        var m = get(id);
        var b = build(id);
        double x = l.getX() - (m.cx() - m.width() / 2), z = l.getZ() - (1024 - m.length() / 2);
        if (l.getY() < 95 || l.getY() > 103) return false;
        return Math.abs(x - b.a.x - .5) < 7 && Math.abs(z - b.a.z - .5) < 10 || Math.abs(x - b.b.x - .5) < 7 && Math.abs(z - b.b.z - .5) < 10;
    }
}
