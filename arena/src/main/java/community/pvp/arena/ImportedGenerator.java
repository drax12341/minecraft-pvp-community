package community.pvp.arena;

import java.util.Random;

import org.bukkit.*;
import org.bukkit.generator.*;

/**
 * Builds are generated directly into native chunks; outside the islands is genuine void.
 */
final class ImportedGenerator extends ChunkGenerator {
    final boolean lobby;

    ImportedGenerator(boolean lobby) {
        this.lobby = lobby;
    }

    @Override
    public void generateNoise(WorldInfo info, Random random, int cx, int cz, ChunkData chunk) {
        // Retain the separate casual FFA platform, floating over the same empty world.
        if (!lobby && cx >= 47 && cx <= 52 && cz >= -3 && cz <= 2) {
            new BattleGenerator().generateNoise(info, random, cx, cz, chunk);
            return;
        }
        for (int x = 0; x < 16; x++)
            for (int z = 0; z < 16; z++) {
                int wx = cx * 16 + x, wz = cz * 16 + z;
                if (lobby) {
                    var b = ImportedBuilds.builds.get(9);
                    b.column(chunk, x, z, wx + b.width() / 2, wz + b.length() / 2);
                } else {
                    var m = ImportedBuilds.at(wx, wz);
                    if (m == null) continue;
                    var b = ImportedBuilds.build(m.id());
                    int bx = wx - (m.cx() - m.width() / 2), bz = wz - (1024 - m.length() / 2);
                    b.column(chunk, x, z, bx, bz);
                    // Invisible shell includes a catch floor. It adds no mainland beneath floating builds.
                    chunk.setBlock(x, 48, z, Material.BARRIER);
                    chunk.setBlock(x, m.ceiling() - 1, z, Material.BARRIER);
                    if (bx == 0 || bz == 0 || bx == m.width() - 1 || bz == m.length() - 1)
                        chunk.setRegion(x, 48, z, x + 1, m.ceiling(), z + 1, Material.BARRIER);
                }
            }
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
    public Location getFixedSpawnLocation(World w, Random r) {
        return new Location(w, .5, 97, .5);
    }
}
