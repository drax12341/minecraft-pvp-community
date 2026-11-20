package community.pvp.arena;

import java.io.File;
import java.util.UUID;
import org.mockbukkit.mockbukkit.ServerMock;

/**
 * MockBukkit leaves this filesystem accessor unimplemented; no worlds are written by this fixture.
 */
final class PracticeServerMock extends ServerMock {
  @Override
  public org.bukkit.World createWorld(org.bukkit.WorldCreator creator) {
    org.bukkit.World existing = getWorld(creator.name());
    if (existing != null) return existing;
    // Match the actual modern overworld height instead of MockBukkit's old 256-block default.
    var world = new org.mockbukkit.mockbukkit.world.WorldMock(org.bukkit.Material.AIR, -64, 320, -63) {
      // This fixture stores blocks directly; it does not run a native chunk generator or async IO.
      @Override public org.bukkit.generator.ChunkGenerator getGenerator() { return null; }
    };
    world.setName(creator.name());
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
