package community.pvp.arena;

import org.bukkit.*;

final class ImportedLobby {
    static Location spawn(CommunityArena p) {
        var b = ImportedBuilds.builds.get(9);
        var a = b.a();
        return new Location(p.citadel, a.x() - b.width() / 2 + .5, 97, a.z() - b.length() / 2 + .5, 180, 0);
    }

    static void configure(CommunityArena p) {
        p.citadel.setGameRule(GameRule.RANDOM_TICK_SPEED, 0);
        if (p.data.getBoolean("citadel-v8")) return;
        var old = p.data.getLocation("setup.spawn");
        if (old != null && java.util.Set.of("community_citadel_v7", "community_citadel_v6", "community_citadel_v4", "community_arena_v7", "community_arena_v6", "community_arena_v4", "community_grove_v3").contains(old.getWorld().getName())) {
            p.data.set("setup.spawn", null);
            p.data.set("setup.corner1", null);
            p.data.set("setup.corner2", null);
        }
        var spawn = spawn(p);
        p.data.set("citadel.spawn", spawn);
        p.data.set("citadel-v4", true);
        p.data.set("citadel-v8", true);
        p.citadel.setSpawnLocation(spawn);
        for (int i = 0; i < 3; i++) {
            String key = "holograms.c400000" + i;
            p.data.set(key + ".location", spawn.clone().add((i - 1) * 5, 3, -9));
            p.data.set(key + ".stat", new String[]{"wins", "elo", "deaths"}[i]);
        }
        p.data.set("holograms.c4000003.location", spawn.clone().add(0, 4, 4));
        p.data.set("holograms.c4000003.text", java.util.List.of("§b§lCOMMUNITY PVP", "§7Duels · Parties · Kit Editor"));
    }

    static boolean contains(Location l, World w) {
        var b = ImportedBuilds.builds.get(9);
        return l.getWorld().equals(w) && Math.abs(l.getX()) < b.width() / 2 - 1 && Math.abs(l.getZ()) < b.length() / 2 - 1;
    }
}
