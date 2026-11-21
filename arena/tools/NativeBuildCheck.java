package verification;

import java.lang.reflect.*;
import java.util.*;

import org.bukkit.*;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * Temporary test plugin, never included in the release JAR. Runs on real Paper.
 */
public final class NativeBuildCheck extends JavaPlugin {
    Object arena;
    ClassLoader loader;

    Object field(Object o, String n) throws Exception {
        var f = o.getClass().getDeclaredField(n);
        f.setAccessible(true);
        return f.get(o);
    }

    Object call(Object o, String n, Class<?>[] types, Object... args) throws Exception {
        var m = o.getClass().getDeclaredMethod(n, types);
        m.setAccessible(true);
        return m.invoke(o, args);
    }

    Object stat(String type, String name, Class<?>[] types, Object... args) throws Exception {
        var c = Class.forName("community.pvp.arena." + type, true, loader);
        var m = c.getDeclaredMethod(name, types);
        m.setAccessible(true);
        return m.invoke(null, args);
    }

    void check(boolean b, String message) {
        if (!b) throw new AssertionError(message);
    }

    @Override
    public void onEnable() {
        Bukkit.getScheduler().runTaskLater(this, () -> {
            try {
                preload();
            } catch (Throwable ex) {
                getLogger().log(java.util.logging.Level.SEVERE, "NATIVE_CHECK_FAILED", ex);
                Bukkit.shutdown();
            }
        }, 40);
    }

    void preload() throws Exception {
        arena = Bukkit.getPluginManager().getPlugin("CommunityArena");
        check(arena != null && ((JavaPlugin) arena).isEnabled(), "arena enabled");
        loader = arena.getClass().getClassLoader();
        World world = (World) field(arena, "world");
        var positions = new LinkedHashSet<Location>();
        for (int id = 100; id <= 126; id++) {
            Object map = stat("BattleMaps", "get", new Class<?>[]{int.class}, id);
            int cx = (int) call(map, "cx", new Class<?>[]{}), w = (int) call(map, "width", new Class<?>[]{});
            positions.add(new Location(world, cx, 96, 1024));
            positions.add(new Location(world, cx - w / 2, 96, 1024));
            positions.add(new Location(world, cx + w, 96, 1024));
            for (boolean first : List.of(true, false)) {
                Location spawn = (Location) stat("BattleMaps", "spawn", new Class<?>[]{arena.getClass(), int.class, boolean.class}, arena, id, first);
                for (int dx = -16; dx <= 16; dx += 16)
                    for (int dz = -16; dz <= 16; dz += 16) positions.add(spawn.clone().add(dx, 0, dz));
            }
        }
        positions.add((Location) stat("ImportedLobby", "spawn", new Class<?>[]{arena.getClass()}, arena));
        positions.add(new Location((World) field(arena, "citadel"), 300, 96, 0));
        var queue = new ArrayDeque<>(positions);
        loadNext(queue);
    }

    void loadNext(ArrayDeque<Location> queue) {
        if (queue.isEmpty()) {
            try {
                run();
            } catch (Throwable ex) {
                getLogger().log(java.util.logging.Level.SEVERE, "NATIVE_CHECK_FAILED", ex);
                Bukkit.shutdown();
            }
            return;
        }
        Location l = queue.remove();
        l.getWorld().getChunkAtAsync(l.getBlockX() >> 4, l.getBlockZ() >> 4, true).whenComplete((chunk, error) -> Bukkit.getScheduler().runTask(this, () -> {
            if (error != null) {
                getLogger().log(java.util.logging.Level.SEVERE, "NATIVE_CHECK_FAILED", error);
                Bukkit.shutdown();
                return;
            }
            chunk.addPluginChunkTicket(this);
            loadNext(queue);
        }));
    }

    @SuppressWarnings("unchecked")
    void run() throws Exception {
        arena = Bukkit.getPluginManager().getPlugin("CommunityArena");
        check(arena != null && ((JavaPlugin) arena).isEnabled(), "arena enabled");
        loader = arena.getClass().getClassLoader();
        var world = (World) field(arena, "world");
        var lobby = (World) field(arena, "citadel");
        check(world.getName().equals("community_arena_v8"), "new owned world");
        var builds = Class.forName("community.pvp.arena.ImportedBuilds", true, loader);
        var list = builds.getDeclaredField("builds");
        list.setAccessible(true);
        var data = (List<?>) list.get(null);
        int points = 0;
        for (int i = 0; i < 9; i++)
            for (int copy = 0; copy < 3; copy++) {
                int id = 100 + i * 3 + copy;
                var map = stat("BattleMaps", "get", new Class<?>[]{int.class}, id);
                int cx = (int) call(map, "cx", new Class<?>[]{}), width = (int) call(map, "width", new Class<?>[]{}), length = (int) call(map, "length", new Class<?>[]{}), ceiling = (int) call(map, "ceiling", new Class<?>[]{});
                var build = data.get(i);
                for (boolean first : List.of(true, false)) {
                    var spawn = (Location) stat("BattleMaps", "spawn", new Class<?>[]{arena.getClass(), int.class, boolean.class}, arena, id, first);
                    check(spawn.clone().add(0, -1, 0).getBlock().getType().isSolid(), "solid spawn " + id);
                    check(spawn.getBlock().isPassable() && spawn.clone().add(0, 1, 0).getBlock().isPassable(), "clear spawn " + id);
                    Object e = call(build, first ? "a" : "b", new Class<?>[]{});
                    int gate = (int) call(e, "gate", new Class<?>[]{}), z = (int) call(e, "z", new Class<?>[]{});
                    check(world.getBlockAt(cx - width / 2 + gate, 98, 1024 - length / 2 + z).getType() == Material.IRON_BARS, "generated gate " + id);
                    points += 4;
                }
                check(world.getBlockAt(cx - width / 2, 80, 1024).getType() == Material.BARRIER, "boundary " + id);
                check(world.getBlockAt(cx, 48, 1024).getType() == Material.BARRIER, "void catch " + id);
                check(world.getBlockAt(cx, ceiling - 1, 1024).getType() == Material.BARRIER, "ceiling " + id);
                check(world.getBlockAt(cx, 0, 1024).getType().isAir(), "pure void below " + id);
                check(world.getBlockAt(cx + width, 96, 1024).getType().isAir(), "void between instances " + id);
                points += 5;
            }
        var spawn = (Location) stat("ImportedLobby", "spawn", new Class<?>[]{arena.getClass()}, arena);
        check(spawn.clone().add(0, -1, 0).getBlock().getType().isSolid(), "lobby floor");
        check(spawn.getBlock().isPassable() && spawn.clone().add(0, 1, 0).getBlock().isPassable(), "lobby headroom");
        check(lobby.getBlockAt(300, 96, 0).getType().isAir(), "lobby void");
        Object gates = field(arena, "gates");
        var occupied = (Set<Integer>) field(arena, "occupied");
        occupied.add(100);
        call(gates, "close", new Class<?>[]{int.class}, 100);
        call(gates, "open", new Class<?>[]{int.class}, 100);
        var map = stat("BattleMaps", "get", new Class<?>[]{int.class}, 100);
        var b = data.getFirst();
        Object entry = call(b, "a", new Class<?>[]{});
        int gx = (int) call(map, "cx", new Class<?>[]{}) - (int) call(map, "width", new Class<?>[]{}) / 2 + (int) call(entry, "gate", new Class<?>[]{}), gz = 1024 - (int) call(map, "length", new Class<?>[]{}) / 2 + (int) call(entry, "z", new Class<?>[]{});
        check(world.getBlockAt(gx, 98, gz).getType().isAir(), "gate opened");
        int total = points + 4;
        Bukkit.getScheduler().runTaskLater(this, () -> {
            try {
                check(world.getBlockAt(gx, 98, gz).getType() == Material.IRON_BARS, "gate reclosed");
                occupied.remove(100);
                getLogger().info("NATIVE_CHECK_PASSED: " + (total + 1) + " checks across 27 copies and imported lobby; all native palettes loaded.");
            } catch (Throwable ex) {
                getLogger().log(java.util.logging.Level.SEVERE, "NATIVE_CHECK_FAILED", ex);
            } finally {
                Bukkit.shutdown();
            }
        }, 110);
    }
}
