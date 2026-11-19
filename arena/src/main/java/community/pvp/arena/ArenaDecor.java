package community.pvp.arena;

import org.bukkit.*;

final class ArenaDecor {
  static void build(CommunityArena p) {
    World w = p.world;
    for (int x = -30; x <= 30; x++)
      for (int z = -30; z <= 30; z++) {
        int radius = Math.max(Math.abs(x), Math.abs(z));
        Material floor =
            radius == 29 || radius == 10
                ? Material.CRYING_OBSIDIAN
                : radius < 8 ? Material.POLISHED_BLACKSTONE : Material.POLISHED_DEEPSLATE;
        if (Math.abs(x) <= 2 || Math.abs(z) <= 2) floor = Material.SMOOTH_QUARTZ;
        if (radius == 6 || radius == 17) floor = Material.PURPUR_BLOCK;
        if (radius == 28 && (x + z) % 4 == 0) floor = Material.SEA_LANTERN;
        w.getBlockAt(x, 64, z).setType(floor, false);
      }
    for (int x : new int[] {-23, 23})
      for (int z : new int[] {-23, 23}) {
        for (int y = 65; y <= 73; y++)
          w.getBlockAt(x, y, z)
              .setType(
                  y == 65 || y == 73 ? Material.CHISELED_QUARTZ_BLOCK : Material.QUARTZ_PILLAR,
                  false);
        w.getBlockAt(x, 74, z).setType(Material.SEA_LANTERN, false);
        for (int d = -2; d <= 2; d++) {
          w.getBlockAt(x + d, 75, z).setType(Material.PURPUR_SLAB, false);
          w.getBlockAt(x, 75, z + d).setType(Material.PURPUR_SLAB, false);
        }
      }
    for (int z : new int[] {-27, 27})
      for (int x = -5; x <= 5; x++)
        for (int y = 65; y <= 71; y++)
          if (Math.abs(x) == 5 || y == 71)
            w.getBlockAt(x, y, z).setType(Material.POLISHED_BLACKSTONE_BRICKS, false);
          else w.getBlockAt(x, y, z).setType(Material.PURPLE_STAINED_GLASS, false);
    if (!p.data.contains("holograms"))
      for (int i = 0; i < 3; i++) {
        String id = "0000000" + i;
        p.data.set("holograms." + id + ".location", new Location(w, (i - 1) * 14, 69, -15));
        p.data.set("holograms." + id + ".stat", new String[] {"wins", "elo", "deaths"}[i]);
      }
    p.data.set("built-v2", true);
    p.save();
  }
}
