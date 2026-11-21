package community.pvp.arena;

import java.util.Random;

import org.bukkit.*;
import org.bukkit.generator.*;

/**
 * ChunkData only: no world access, entity creation, IO, or main-thread block builder.
 */
class BattleGenerator extends ChunkGenerator {
    final boolean upgraded;

    BattleGenerator() {
        this(true);
    }

    BattleGenerator(boolean upgraded) {
        this.upgraded = upgraded;
    }

    static void column(BattleMaps.MapInfo map, int x, int z, ArenaLandscape.Column out) {
        ArenaLandscape.column(map, x, z, out);
        ArenaLandmarks.column(map, x, z, out);
    }

    @Override
    public BiomeProvider getDefaultBiomeProvider(WorldInfo info) {
        return new BiomeProvider() {
            @Override
            public org.bukkit.block.Biome getBiome(WorldInfo world, int x, int y, int z) {
                var m = BattleMaps.at(x, z);
                return m == null ? org.bukkit.block.Biome.PLAINS : switch (m.theme()) {
                    case 1 -> org.bukkit.block.Biome.DESERT;
                    case 2 -> org.bukkit.block.Biome.JUNGLE;
                    case 3 -> org.bukkit.block.Biome.SNOWY_PLAINS;
                    case 4 -> org.bukkit.block.Biome.CHERRY_GROVE;
                    case 5 -> org.bukkit.block.Biome.BADLANDS;
                    default -> org.bukkit.block.Biome.PLAINS;
                };
            }

            @Override
            public java.util.List<org.bukkit.block.Biome> getBiomes(WorldInfo world) {
                return java.util.List.of(org.bukkit.block.Biome.PLAINS, org.bukkit.block.Biome.DESERT, org.bukkit.block.Biome.JUNGLE, org.bukkit.block.Biome.SNOWY_PLAINS, org.bukkit.block.Biome.CHERRY_GROVE, org.bukkit.block.Biome.BADLANDS);
            }
        };
    }

    @Override
    public Location getFixedSpawnLocation(World world, Random random) {
        return new Location(world, .5, 65, 13.5);
    }

    @Override
    public boolean shouldGenerateNoise() {
        return false;
    }

    @Override
    public boolean shouldGenerateSurface() {
        return false;
    }

    @Override
    public boolean shouldGenerateCaves() {
        return false;
    }

    @Override
    public boolean shouldGenerateDecorations() {
        return false;
    }

    @Override
    public boolean shouldGenerateStructures() {
        return false;
    }

    @Override
    public boolean shouldGenerateMobs() {
        return false;
    }

    @Override
    public void generateNoise(WorldInfo info, Random random, int chunkX, int chunkZ, ChunkData data) {
        for (int x = 0; x < 16; x++)
            for (int z = 0; z < 16; z++) {
                int wx = chunkX * 16 + x, wz = chunkZ * 16 + z;
                BattleMaps.MapInfo map = BattleMaps.at(wx, wz);
                final int lx = x, lz = z;
                if (map != null) {
                    ArenaLandscape.Column out = (lo, hi, mat) -> {
                        if (hi > lo) data.setRegion(lx, lo, lz, lx + 1, hi, lz + 1, mat);
                    };
                    if (upgraded) column(map, wx - map.cx(), wz - 1024, out);
                    else ArenaLandscape.column(map, wx - map.cx(), wz - 1024, out);
                    continue;
                }
                // Legacy queue/FFA sectors remain available, without the former staged builder.
                for (int section = 0; section <= 5; section++) {
                    int radius = section == 5 ? 40 : 32;
                    if (Math.abs(wx - section * 160) > radius || Math.abs(wz) > radius) continue;
                    data.setRegion(x, 50, z, x + 1, 64, z + 1, Material.STONE);
                    data.setBlock(x, 50, z, Material.BEDROCK);
                    data.setBlock(x, 64, z, Material.SMOOTH_STONE);
                    if (Math.abs(wx - section * 160) == radius || Math.abs(wz) == radius)
                        data.setRegion(x, 65, z, x + 1, 110, z + 1, Material.BARRIER);
                    data.setBlock(x, 110, z, Material.BARRIER);
                    break;
                }
            }
    }
}
