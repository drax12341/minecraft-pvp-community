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
    int checks;

    Object field(Object o, String n) throws Exception {
        var f = o.getClass().getDeclaredField(n);
        f.setAccessible(true);
        return f.get(o);
    }

    void set(Object o, String n, Object value) throws Exception {
        var f = o.getClass().getDeclaredField(n);
        f.setAccessible(true);
        f.set(o, value);
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
        checks++;
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

    World fieldWorld() {
        try { return (World) field(arena, "world"); }
        catch (Exception ex) { throw new IllegalStateException(ex); }
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
            if (chunk.getWorld().equals(fieldWorld())) {
                int id = 100 + Math.floorDiv(chunk.getX() * 16 - 20000 + 512, 1024);
                try {
                    if (id >= 100 && id <= 126) stat("ArenaLayout", "prepareChunk", new Class<?>[]{arena.getClass(), int.class, Chunk.class}, arena, id, chunk);
                } catch (Exception ex) { throw new IllegalStateException(ex); }
            }
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
        for (int i = 0; i < 9; i++)
            for (int copy = 0; copy < 3; copy++) {
                int id = 100 + i * 3 + copy;
                var map = stat("BattleMaps", "get", new Class<?>[]{int.class}, id);
                int cx = (int) call(map, "cx", new Class<?>[]{}), width = (int) call(map, "width", new Class<?>[]{}), length = (int) call(map, "length", new Class<?>[]{}), ceiling = (int) call(map, "ceiling", new Class<?>[]{});
                var build = data.get(i);
                for (boolean first : List.of(true, false)) {
                    var spawn = (Location) stat("BattleMaps", "spawn", new Class<?>[]{arena.getClass(), int.class, boolean.class}, arena, id, first);
                    check(spawn.clone().add(0, -5, 0).getBlock().getType() == Material.BEDROCK, "bedrock base " + id);
                    check(spawn.clone().add(0, -1, 0).getBlock().getType().isSolid(), "solid spawn " + id);
                    check(spawn.getBlock().isPassable() && spawn.clone().add(0, 1, 0).getBlock().isPassable(), "clear spawn " + id);
                    Object e = call(build, first ? "a" : "b", new Class<?>[]{});
                    int gate = (int) call(e, "gate", new Class<?>[]{}), z = (int) call(e, "z", new Class<?>[]{});
                    check(world.getBlockAt(cx - width / 2 + gate, 98, 1024 - length / 2 + z).getType().isAir(), "cage door removed " + id);
                    int roomX = (int) call(e, "x", new Class<?>[]{});
                    for (int dx = -5; dx <= 5; dx++) for (int dz = -8; dz <= 8; dz++) for (int y = 97; y <= 102; y++)
                        check(world.getBlockAt(cx - width/2 + roomX + dx, y, 1024 - length/2 + z + dz).getType().isAir(), "cage removed " + id);
                    for (int member = 0; member < 49; member++) {
                        Location team = (Location) stat("PartyBattles", "teamSpawn", new Class<?>[]{arena.getClass(), int.class, boolean.class, int.class}, arena, id, first, member);
                        check(team.clone().add(0, -1, 0).getBlock().getType().isSolid(), "team floor " + id + ":" + first + ":" + member);
                        check(team.getBlock().isPassable() && team.clone().add(0, 1, 0).getBlock().isPassable(), "team headroom " + id + ":" + first + ":" + member);
                    }
                }
                check(world.getBlockAt(cx - width / 2, 80, 1024).getType() == Material.BARRIER, "boundary " + id);
                check(world.getBlockAt(cx, 48, 1024).getType() == Material.BARRIER, "void catch " + id);
                check(world.getBlockAt(cx, ceiling - 1, 1024).getType() == Material.BARRIER, "ceiling " + id);
                check(world.getBlockAt(cx, 0, 1024).getType().isAir(), "pure void below " + id);
                check(world.getBlockAt(cx + width, 96, 1024).getType().isAir(), "void between instances " + id);
            }
        var spawn = (Location) stat("ImportedLobby", "spawn", new Class<?>[]{arena.getClass()}, arena);
        check(spawn.clone().add(0, -1, 0).getBlock().getType().isSolid(), "lobby floor");
        check(spawn.getBlock().isPassable() && spawn.clone().add(0, 1, 0).getBlock().isPassable(), "lobby headroom");
        check(lobby.getBlockAt(300, 96, 0).getType().isAir(), "lobby void");
        Object bots = field(arena, "bots");
        Class<?> sessionType = Class.forName("community.pvp.arena.PracticeBots$Session", true, loader);
        var constructor = sessionType.getDeclaredConstructor();
        constructor.setAccessible(true);
        Object session = constructor.newInstance();
        var targetLocation = (Location) stat("BattleMaps", "spawn", new Class<?>[]{arena.getClass(), int.class, boolean.class}, arena, 100, false);
        call(bots, "pin", new Class<?>[]{sessionType, Location.class}, session, targetLocation);
        check(targetLocation.getChunk().getPluginChunkTickets().contains((JavaPlugin) arena), "target chunk pinned");
        call(bots, "unpin", new Class<?>[]{sessionType}, session);
        check(!targetLocation.getChunk().getPluginChunkTickets().contains((JavaPlugin) arena), "target chunk ticket released");
        Object gates = field(arena, "gates");
        var occupied = (Set<Integer>) field(arena, "occupied");
        occupied.add(100);
        call(gates, "prepare", new Class<?>[]{int.class}, 100);
        var map = stat("BattleMaps", "get", new Class<?>[]{int.class}, 100);
        var b = data.getFirst();
        Object entry = call(b, "a", new Class<?>[]{});
        int gx = (int) call(map, "cx", new Class<?>[]{}) - (int) call(map, "width", new Class<?>[]{}) / 2 + (int) call(entry, "gate", new Class<?>[]{}), gz = 1024 - (int) call(map, "length", new Class<?>[]{}) / 2 + (int) call(entry, "z", new Class<?>[]{});
        check(world.getBlockAt(gx, 98, gz).getType() == Material.AIR, "unused cages removed");
        Object global = Class.forName("io.papermc.paper.configuration.GlobalConfiguration").getMethod("get").invoke(null);
        Object unsupported = global.getClass().getField("unsupportedSettings").get(global);
        check(!unsupported.getClass().getField("updateEquipmentOnPlayerActions").getBoolean(unsupported), "attribute swapping enabled in live Paper");
        Object[] kit = (Object[]) stat("ReferenceLoadouts", "create", new Class<?>[]{String.class}, "mace_spear");
        boolean lunge = false;
        for (Object item : kit) if (item instanceof org.bukkit.inventory.ItemStack stack && stack.getType().name().endsWith("_SPEAR"))
            lunge = stack.getEnchantmentLevel(org.bukkit.enchantments.Enchantment.LUNGE) == 3;
        check(lunge, "native Lunge III kit");
        var botType = Class.forName("community.pvp.arena.PracticeBots$Session", true, loader);
        var ctor = botType.getDeclaredConstructor(); ctor.setAccessible(true);
        Object combat = ctor.newInstance();
        var equipment = stat("ReferenceLoadouts", "create", new Class<?>[]{String.class}, "sword");
        set(combat, "equipment", equipment); set(combat, "map", 100); set(combat, "moving", true); set(combat, "ticks", 2);
        var opponent = (org.bukkit.entity.Zombie) call(bots, "spawn", new Class<?>[]{botType}, combat);
        var dummy = world.spawn(opponent.getLocation().clone().add(-2, 0, 0), org.bukkit.entity.Mannequin.class);
        dummy.setInvulnerable(false);
        double health = dummy.getHealth();
        stat("BotCombat", "tick", new Class<?>[]{org.bukkit.entity.LivingEntity.class, org.bukkit.entity.Zombie.class, botType}, dummy, opponent, combat);
        check(dummy.getHealth() < health, "bot deals real native melee damage");
        check((int) field(combat, "nextAttack") == 15, "bot native sword cadence");
        check(opponent.hasAI(), "fighting bot AI enabled");
        check(opponent.getEquipment().getItemInMainHand().getType() == Material.DIAMOND_SWORD, "bot chosen kit weapon");
        dummy.teleport(opponent.getLocation().clone().add(-6, 0, 0));
        opponent.setHealth(5);
        set(combat, "eating", 2); set(combat, "healing", 1);
        for (int tick = 4; tick <= 32; tick += 2) {
            set(combat, "ticks", tick);
            stat("BotCombat", "tick", new Class<?>[]{org.bukkit.entity.LivingEntity.class, org.bukkit.entity.Zombie.class, botType}, dummy, opponent, combat);
        }
        check(opponent.getHealth() > 5, "finite NPC healing restores real health");
        check((int) field(combat, "healing") == 0, "NPC healing supply consumed");
        opponent.remove(); dummy.remove();
        Bukkit.getScheduler().runTaskLater(this, () -> {
            try {
                check(world.getBlockAt(gx, 98, gz).getType() == Material.AIR, "cages stay removed");
                occupied.remove(100);
                getLogger().info("NATIVE_CHECK_PASSED: " + checks + " checks across 27 copies and imported lobby; all native palettes loaded.");
            } catch (Throwable ex) {
                getLogger().log(java.util.logging.Level.SEVERE, "NATIVE_CHECK_FAILED", ex);
            } finally {
                Bukkit.shutdown();
            }
        }, 110);
    }
}
