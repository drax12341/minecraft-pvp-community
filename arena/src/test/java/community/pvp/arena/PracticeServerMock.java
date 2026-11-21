package community.pvp.arena;

import java.io.File;
import java.util.UUID;

import org.mockbukkit.mockbukkit.ServerMock;

/**
 * MockBukkit leaves this filesystem accessor unimplemented; no worlds are written by this fixture.
 */
final class PracticeServerMock extends ServerMock {
    final boolean imported;

    PracticeServerMock() {
        this(false);
    }

    PracticeServerMock(boolean imported) {
        this.imported = imported;
    }

    @Override
    public org.bukkit.block.data.BlockData createBlockData(String input) {
        try {
            return super.createBlockData(input);
        } catch (IllegalArgumentException ex) {
            // MockBukkit lacks several valid native properties (e.g. lantern.hanging).
            String name = input.split("\\[")[0];
            var material = org.bukkit.Material.matchMaterial(name);
            if (material == null) throw ex;
            return super.createBlockData(material);
        }
    }

    @Override
    public org.bukkit.World createWorld(org.bukkit.WorldCreator creator) {
        org.bukkit.World existing = getWorld(creator.name());
        if (existing != null) return existing;
        // Match the actual modern overworld height instead of MockBukkit's old 256-block default.
        var world = new org.mockbukkit.mockbukkit.world.WorldMock(org.bukkit.Material.AIR, -64, 320, -63) {
            private final java.util.Set<Long> generated = new java.util.HashSet<>();

            private long chunkKey(int x, int z) {
                return ((long) x << 32) ^ (z & 0xffffffffL);
            }

            // This fixture stores blocks directly; it does not run a native chunk generator or async IO.
            @Override
            public org.bukkit.generator.ChunkGenerator getGenerator() {
                return null;
            }

            @Override
            public boolean isChunkGenerated(int x, int z) {
                return generated.contains(chunkKey(x, z));
            }

            @Override
            public org.mockbukkit.mockbukkit.world.ChunkMock getChunkAt(int x, int z) {
                generated.add(chunkKey(x, z));
                return super.getChunkAt(x, z);
            }

            @Override
            public org.mockbukkit.mockbukkit.block.BlockMock getBlockAt(int x, int y, int z) {
                generated.add(chunkKey(x >> 4, z >> 4));
                return super.getBlockAt(x, y, z);
            }
        };
        // Keep existing generation regression fixtures on their archived v7 geometry.
        world.setName(!imported && creator.name().endsWith("_v8") ? creator.name().replace("_v8", "_v7") : creator.name());
        addWorld(world);
        return world;
    }

    private final File worlds =
            new File(System.getProperty("java.io.tmpdir"), "practice-world-fixture-" + UUID.randomUUID());

    @Override
    public File getWorldContainer() {
        return worlds;
    }
}
