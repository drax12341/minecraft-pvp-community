package community.pvp.arena;

import org.bukkit.*;
import org.bukkit.block.data.type.Leaves;
import org.bukkit.scheduler.BukkitRunnable;

final class GroveLobby {
  static void build(CommunityArena p) {
    if (p.data.getBoolean("grove-v3")) {
      p.groveReady = true;
      return;
    }
    World w = p.grove;
    new BukkitRunnable() {
      int x = -48;

      public void run() {
        for (int count = 0; count < 2 && x <= 48; count++, x++)
          for (int z = -48; z <= 48; z++) {
            double radius = Math.hypot(x, z);
            if (radius > 48) continue;
            for (int y = 61; y < 64; y++)
              w.getBlockAt(x, y, z).setType(y == 61 ? Material.STONE : Material.DIRT, false);
            boolean path = Math.abs(x) < 4 || Math.abs(z) < 4 || Math.abs(radius - 24) < 2.2;
            w.getBlockAt(x, 64, z)
                .setType(
                    path
                        ? ((x * x + z * z) % 4 == 0 ? Material.COARSE_DIRT : Material.DIRT_PATH)
                        : Material.GRASS_BLOCK,
                    false);
            if (radius > 45) w.getBlockAt(x, 63, z).setType(Material.MOSSY_COBBLESTONE, false);
          }
        if (x > 48) {
          decorate(p);
          try {
            p.worldSaver.accept(w);
          } catch (Exception ex) {
            p.getLogger().severe("Grove world save failed; generation remains incomplete.");
            cancel();
            return;
          }
          p.data.set("grove-v3", true);
          if (!p.save()) {
            p.data.set("grove-v3", false);
            cancel();
            return;
          }
          p.groveReady = true;
          p.ready = p.data.getBoolean("terrain-generator-v7");
          if (p.ready && p.getConfig().getBoolean("join-lobby", true))
            for (var player : Bukkit.getOnlinePlayers()) if (!p.busy(player)) p.enter(player);
          cancel();
        }
      }
    }.runTaskTimer(p, 1, 1);
  }

  static void decorate(CommunityArena p) {
    World w = p.grove;
    for (int[] point :
        new int[][] {
          {-34, -16}, {-30, 28}, {-10, 38}, {22, 35}, {36, 12}, {28, -28}, {-18, -34}, {-40, 5}
        }) tree(w, point[0], point[1]);
    for (int x = -8; x <= 8; x++)
      for (int z = -6; z <= 6; z++)
        if ((x * x) / 64.0 + (z * z) / 36.0 <= 1) {
          w.getBlockAt(22 + x, 63, -12 + z).setType(Material.GRAVEL, false);
          w.getBlockAt(22 + x, 64, -12 + z).setType(Material.WATER, false);
          if ((x + 2 * z) % 7 == 0)
            w.getBlockAt(22 + x, 65, -12 + z).setType(Material.LILY_PAD, false);
        }
    for (int z = -17; z <= -7; z += 2) {
      w.getBlockAt(13, 64, z).setType(Material.SAND, false);
      w.getBlockAt(13, 65, z).setType(Material.SUGAR_CANE, false);
      w.getBlockAt(13, 66, z).setType(Material.SUGAR_CANE, false);
    }
    for (int z = -18; z <= -6; z++)
      for (int x = 20; x <= 22; x++) w.getBlockAt(x, 65, z).setType(Material.SPRUCE_SLAB, false);
    for (int[] point :
        new int[][] {
          {-10, -12}, {10, 12}, {-10, 12}, {10, -12}, {-27, 0}, {27, 0}, {0, -27}, {0, 27}
        }) {
      int x = point[0], z = point[1];
      w.getBlockAt(x, 65, z).setType(Material.MOSSY_STONE_BRICKS, false);
      w.getBlockAt(x, 66, z).setType(Material.COBBLESTONE_WALL, false);
      w.getBlockAt(x, 67, z).setType(Material.LANTERN, false);
    }
    for (int x = -42; x <= 42; x += 7)
      for (int z = -42; z <= 42; z += 7)
        if (Math.hypot(x, z) < 44
            && Math.abs(x) > 6
            && Math.abs(z) > 6
            && !(x > 10 && x < 32 && z < 0 && z > -20))
          w.getBlockAt(x, 65, z)
              .setType((x + z) % 3 == 0 ? Material.POPPY : Material.SHORT_GRASS, false);
    for (int i = 0; i < 3; i++) {
      int x = (i - 1) * 14;
      for (int dx = -4; dx <= 4; dx++)
        for (int dz = -2; dz <= 2; dz++)
          w.getBlockAt(x + dx, 64, -27 + dz).setType(Material.STONE_BRICKS, false);
      String key = "holograms.f000000" + i;
      p.data.set(key + ".location", new Location(w, x, 68, -27));
      p.data.set(key + ".stat", new String[] {"wins", "elo", "deaths"}[i]);
    }
    w.setSpawnLocation(0, 65, 8);
    p.data.set("grove.spawn", new Location(w, 0.5, 65, 8.5, 180, 0));
  }

  static void tree(World w, int x, int z) {
    for (int y = 65; y <= 75; y++) w.getBlockAt(x, y, z).setType(Material.OAK_LOG, false);
    for (int y = 70; y <= 78; y++) {
      int radius = y < 76 ? 4 : 2;
      for (int dx = -radius; dx <= radius; dx++)
        for (int dz = -radius; dz <= radius; dz++)
          if (dx * dx + dz * dz <= radius * radius + 1 && !(dx == 0 && dz == 0 && y <= 75)) {
            var leaves = (Leaves) Material.OAK_LEAVES.createBlockData();
            leaves.setPersistent(true);
            w.getBlockAt(x + dx, y, z + dz).setBlockData(leaves, false);
          }
    }
    w.getBlockAt(x + 1, 69, z).setType(Material.OAK_LOG, false);
    w.getBlockAt(x + 2, 70, z).setType(Material.OAK_LOG, false);
    w.getBlockAt(x + 2, 69, z).setType(Material.LANTERN, false);
  }
}
