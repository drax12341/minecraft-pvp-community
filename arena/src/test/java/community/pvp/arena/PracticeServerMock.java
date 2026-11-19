package community.pvp.arena;

import java.io.File;
import java.util.UUID;
import org.mockbukkit.mockbukkit.ServerMock;

/**
 * MockBukkit leaves this filesystem accessor unimplemented; no worlds are written by this fixture.
 */
final class PracticeServerMock extends ServerMock {
  private final File worlds =
      new File(System.getProperty("java.io.tmpdir"), "practice-world-fixture-" + UUID.randomUUID());

  @Override
  public File getWorldContainer() {
    return worlds;
  }
}
