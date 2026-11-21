package community.pvp.arena;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

import org.bukkit.*;
import org.bukkit.block.*;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.block.*;
import org.bukkit.event.entity.*;
import org.bukkit.event.player.*;

/**
 * Write-ahead originals allow only the generated combat interior to be restored after a crash.
 */
final class ArenaTerrain implements Listener {
    final CommunityArena p;
    final World world;
    final String journalPrefix;
    final Runnable flushWorld;
    final Map<Integer, LinkedHashMap<String, String>> changes = new HashMap<>();
    static final Set<Material> PLACE =
            Set.of(
                    Material.TNT,
                    Material.OBSIDIAN,
                    Material.COBWEB,
                    Material.OAK_PLANKS,
                    Material.GLOWSTONE,
                    Material.RESPAWN_ANCHOR,
                    Material.COBBLESTONE);

    ArenaTerrain(CommunityArena p) {
        this(p, p.world, activePrefix(p), true, () -> p.worldSaver.accept(p.world));
    }

    ArenaTerrain(CommunityArena p, Runnable flushWorld) {
        this(p, p.world, activePrefix(p), true, flushWorld);
    }

    private ArenaTerrain(
            CommunityArena p, World world, String prefix, boolean listen, Runnable flushWorld) {
        this.p = p;
        this.world = world;
        this.journalPrefix = prefix;
        this.flushWorld = flushWorld;
        if (listen) Bukkit.getPluginManager().registerEvents(this, p);
    }

    static String activePrefix(CommunityArena p) {
        return p.world.getName().equals("community_arena_v8") ? "v8-arena-" : "v7-arena-";
    }

    java.util.List<Integer> arenaIds() {
        return java.util.stream.IntStream.concat(java.util.stream.IntStream.rangeClosed(1, BattleMaps.LAST).filter(i -> i != 5), journalPrefix.equals("v8-arena-") ? java.util.stream.IntStream.rangeClosed(ImportedBuilds.FIRST, ImportedBuilds.LAST) : java.util.stream.IntStream.empty()).boxed().toList();
    }

    void recoverV7() {
        boolean pending = java.util.stream.IntStream.rangeClosed(1, BattleMaps.LAST).filter(i -> i != 5).anyMatch(i -> Files.exists(p.getDataFolder().toPath().resolve("v7-arena-" + i + ".journal")));
        if (!pending) return;
        World old = Bukkit.getWorld("community_arena_v7");
        if (old == null)
            throw new IllegalStateException("v7 recovery needs original community_arena_v7; journal preserved");
        var legacy = new ArenaTerrain(p, old, "v7-arena-", false, () -> p.worldSaver.accept(old));
        for (int i : legacy.arenaIds()) if (Files.exists(legacy.journal(i))) legacy.clearEntities(i);
        legacy.recover();
    }

    void recoverV6() {
        boolean pending = java.util.stream.IntStream.rangeClosed(1, BattleMaps.LAST).filter(i -> i != 5).anyMatch(i -> Files.exists(p.getDataFolder().toPath().resolve("v6-arena-" + i + ".journal")));
        if (!pending) return;
        World old = Bukkit.getWorld("community_arena_v6");
        if (old == null)
            throw new IllegalStateException("v6 journal exists but original community_arena_v6 world is missing; journal preserved");
        ArenaTerrain legacy = new ArenaTerrain(p, old, "v6-arena-", false, () -> p.worldSaver.accept(old));
        for (int i = 1; i <= BattleMaps.LAST; i++)
            if (i != 5 && Files.exists(legacy.journal(i))) legacy.clearEntities(i);
        legacy.recover();
    }

    void recoverV4() {
        boolean pending = java.util.stream.IntStream.rangeClosed(1, BattleMaps.LAST).filter(i -> i != 5).anyMatch(i -> Files.exists(p.getDataFolder().toPath().resolve("v4-arena-" + i + ".journal")));
        if (!pending) return;
        World old = Bukkit.getWorld("community_arena_v4");
        if (old == null)
            throw new IllegalStateException("v4 journal exists but original community_arena_v4 world is missing; journal preserved");
        ArenaTerrain legacy = new ArenaTerrain(p, old, "v4-arena-", false, () -> p.worldSaver.accept(old));
        for (int i = 1; i <= BattleMaps.LAST; i++)
            if (i != 5 && Files.exists(legacy.journal(i))) legacy.clearEntities(i);
        legacy.recover();
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void spawn(EntitySpawnEvent e) {
        if (!(e.getEntity() instanceof Player) && e.getEntity().getWorld().equals(world) && journalPrefix.equals(activePrefix(p)))
            e.getEntity().setPersistent(false);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void projectile(org.bukkit.event.entity.ProjectileLaunchEvent e) {
        if (e.getEntity().getWorld().equals(world) && journalPrefix.equals(activePrefix(p)))
            e.getEntity().setPersistent(false);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void entityUnload(org.bukkit.event.world.EntitiesUnloadEvent e) {
        if (!e.getWorld().equals(world) || !journalPrefix.equals(activePrefix(p))) return;
        for (Entity entity : e.getEntities())
            if (!(entity instanceof Player) && !(entity instanceof Display) && p.bots.session(entity)==null) entity.remove();
    }

    void recoverLegacy() {
        boolean pending = false;
        for (int i = 1; i <= 4; i++)
            if (Files.exists(p.getDataFolder().toPath().resolve("arena-" + i + ".journal")))
                pending = true;
        if (!pending) return;
        World old = Bukkit.getWorld("community_arena_v3");
        if (old == null)
            throw new IllegalStateException(
                    "A v3 terrain journal exists but its community_arena_v3 world is missing; recovery data"
                            + " was preserved");
        ArenaTerrain legacy = new ArenaTerrain(p, old, "arena-", false, () -> p.worldSaver.accept(old));
        for (int i = 1; i <= 4; i++) if (Files.exists(legacy.journal(i))) legacy.clearEntities(i);
        legacy.recover();
    }

    Path journal(int arena) {
        if ((arena < 1 || arena > BattleMaps.LAST) && !(journalPrefix.equals("v8-arena-") && ImportedBuilds.is(arena)) || arena == 5)
            throw new IllegalArgumentException("Invalid arena");
        return p.getDataFolder().toPath().resolve(journalPrefix + arena + ".journal");
    }

    int index(Location l) {
        var candidate = BattleMaps.at(l.getBlockX(), l.getBlockZ());
        if (candidate != null && candidate.inside(l, world, 2)) return candidate.id();
        if (!l.getWorld().equals(world)
                || l.getBlockY() < 50
                || l.getBlockY() > 85
                || Math.abs(l.getBlockZ()) > 29) return 0;
        for (int i = 1; i <= 4; i++) if (Math.abs(l.getBlockX() - i * 160) <= 29) return i;
        return 0;
    }

    CommunityArena.Match editable(Player player, Block b) {
        var m = p.matches.get(player.getUniqueId());
        if (m == null && p.bots != null && p.bots.sessions.containsKey(player.getUniqueId()))
            m = p.bots.sessions.get(player.getUniqueId()).policy;
        if (m == null && p.partyBattles != null) {
            var battle = p.partyBattles.sessions.get(player.getUniqueId());
            if (battle != null && battle.alive.contains(player.getUniqueId())) m = battle.policy;
        }
        return m != null
                && !m.ended
                && !m.paused
                && Loadouts.building(m.kit)
                && index(b.getLocation()) == m.arena
                ? m
                : null;
    }

    String coords(Block b) {
        return b.getX() + "," + b.getY() + "," + b.getZ();
    }

    boolean record(int arena, Block block) {
        return record(arena, block, block.getBlockData().getAsString());
    }

    boolean record(int arena, Block block, String original) {
        if (index(block.getLocation()) != arena || ImportedBuilds.protectedRoom(arena, block.getLocation()) || block.getType() == Material.BARRIER || block.getState() instanceof TileState)
            return false;
        var map = changes.computeIfAbsent(arena, k -> new LinkedHashMap<>());
        String key = coords(block);
        if (map.containsKey(key)) return true;
        if (map.size() >= 25000) return false;
        try {
            Files.writeString(
                    journal(arena),
                    key + " " + original + "\n",
                    StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.APPEND,
                    StandardOpenOption.SYNC);
            map.put(key, original);
            return true;
        } catch (IOException e) {
            p.getLogger().severe("Arena journal write failed; terrain edit denied.");
            return false;
        }
    }

    boolean recordBatch(int arena, Collection<Block> blocks) {
        var map = changes.computeIfAbsent(arena, k -> new LinkedHashMap<>());
        var pending = new LinkedHashMap<String, String>();
        for (Block block : blocks) {
            if (index(block.getLocation()) != arena || ImportedBuilds.protectedRoom(arena, block.getLocation()) || block.getType() == Material.BARRIER || block.getState() instanceof TileState)
                return false;
            String key = coords(block);
            if (!map.containsKey(key)) pending.putIfAbsent(key, block.getBlockData().getAsString());
        }
        if (map.size() + pending.size() > 25000) return false;
        if (pending.isEmpty()) return true;
        StringBuilder log = new StringBuilder();
        pending.forEach((key, value) -> log.append(key).append(' ').append(value).append('\n'));
        try {
            Files.writeString(
                    journal(arena),
                    log,
                    StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.APPEND,
                    StandardOpenOption.SYNC);
            map.putAll(pending);
            return true;
        } catch (IOException e) {
            p.getLogger().severe("Explosion journal write failed; terrain damage denied.");
            return false;
        }
    }

    void recover() {
        for (int i : arenaIds()) {
            Path file = journal(i);
            if (!Files.exists(file)) continue;
            try {
                var map = new LinkedHashMap<String, String>();
                for (String line : Files.readAllLines(file)) {
                    String[] parts = line.split(" ", 2);
                    if (parts.length != 2) throw new IOException("Malformed arena journal");
                    map.put(parts[0], parts[1]);
                    if (map.size() > 25000) throw new IOException("Oversize arena journal");
                }
                changes.put(i, map);
                reset(i);
            } catch (Exception e) {
                throw new IllegalStateException(
                        "Cannot recover arena " + i + "; retaining journal for operator recovery", e);
            }
        }
    }

    void reset(int arena) {
        var map = changes.get(arena);
        if (map == null || map.isEmpty()) return;
        try {
            for (var entry : map.entrySet()) {
                String[] xyz = entry.getKey().split(",");
                if (xyz.length != 3) throw new IOException("Invalid coordinates");
                Block block =
                        world.getBlockAt(
                                Integer.parseInt(xyz[0]), Integer.parseInt(xyz[1]), Integer.parseInt(xyz[2]));
                if (index(block.getLocation()) != arena) throw new IOException("Journal outside arena");
                block.setBlockData(Bukkit.createBlockData(entry.getValue()), false);
            }
            flushWorld.run();
            Files.deleteIfExists(journal(arena));
            changes.remove(arena);
        } catch (Exception e) {
            throw new IllegalStateException(
                    "Arena reset failed; keeping recovery journal and arena reserved", e);
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void place(BlockPlaceEvent e) {
        int arena = index(e.getBlock().getLocation());
        if (arena == 0) return;
        var m = editable(e.getPlayer(), e.getBlock());
        if (m == null
                || !PLACE.contains(e.getBlock().getType())
                || !record(arena, e.getBlock(), e.getBlockReplacedState().getBlockData().getAsString()))
            e.setCancelled(true);
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void breakBlock(BlockBreakEvent e) {
        int arena = index(e.getBlock().getLocation());
        if (arena == 0) return;
        if (editable(e.getPlayer(), e.getBlock()) == null || !record(arena, e.getBlock())) {
            e.setCancelled(true);
            return;
        }
        e.setDropItems(false);
        e.setExpToDrop(0);
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void bucket(PlayerBucketEmptyEvent e) {
        Block block = e.getBlockClicked().getRelative(e.getBlockFace());
        int arena = index(block.getLocation());
        if (!block.getWorld().equals(world)) return;
        var m = editable(e.getPlayer(), block);
        if (m == null || !record(arena, block)) e.setCancelled(true);
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void bucket(PlayerBucketFillEvent e) {
        int arena = index(e.getBlockClicked().getLocation());
        if (e.getBlockClicked().getWorld().equals(world)
                && (editable(e.getPlayer(), e.getBlockClicked()) == null
                || !record(arena, e.getBlockClicked()))) e.setCancelled(true);
    }

    boolean live(int arena) {
        if (p.bots != null && p.bots.sessions.values().stream().anyMatch(s -> s.map == arena && !s.paused && Loadouts.building(s.policy.kit)))
            return true;
        if (p.partyBattles != null && p.partyBattles.sessions.values().stream().anyMatch(b -> b.policy.arena == arena && !b.paused && Loadouts.building(b.policy.kit)))
            return true;
        return p.matches.values().stream()
                .anyMatch(m -> m.arena == arena && !m.ended && !m.paused && Loadouts.building(m.kit));
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void entityBlockChange(EntityChangeBlockEvent e) {
        if (!e.getBlock().getWorld().equals(world)) return;
        int arena = index(e.getBlock().getLocation());
        // Falling sand records both its departure and landing, preserving dune terrain after reset.
        if (arena == 0 || !live(arena) || !record(arena, e.getBlock())) e.setCancelled(true);
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void flow(BlockFromToEvent e) {
        if (!e.getBlock().getWorld().equals(world)) return;
        int arena = index(e.getBlock().getLocation());
        if (arena == 0
                || index(e.getToBlock().getLocation()) != arena
                || !live(arena)
                || !record(arena, e.getToBlock())) e.setCancelled(true);
    }

    void explosion(Location location, List<Block> blocks) {
        if (!location.getWorld().equals(world)) return;
        int arena = index(location);
        if (arena == 0 || !live(arena)) {
            blocks.clear();
            return;
        }
        blocks.removeIf(
                block -> index(block.getLocation()) != arena || ImportedBuilds.protectedRoom(arena, block.getLocation()) || block.getType() == Material.BARRIER || block.getState() instanceof TileState);
        if (!recordBatch(arena, blocks)) blocks.clear();
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void explode(EntityExplodeEvent e) {
        explosion(e.getLocation(), e.blockList());
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void explode(BlockExplodeEvent e) {
        explosion(e.getBlock().getLocation(), e.blockList());
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void crystal(PlayerInteractEvent e) {
        if (e.getItem() == null
                || e.getItem().getType() != Material.END_CRYSTAL
                || !e.getPlayer().getWorld().equals(world)) return;
        Block block = e.getClickedBlock();
        var m = block == null ? null : editable(e.getPlayer(), block);
        if (m == null || !m.kit.equals("crystal") && m.customEquipment == null) e.setCancelled(true);
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void ignite(BlockIgniteEvent e) {
        int arena = index(e.getBlock().getLocation());
        if (arena > 0 && (!live(arena) || !record(arena, e.getBlock()))) e.setCancelled(true);
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void burn(BlockBurnEvent e) {
        int arena = index(e.getBlock().getLocation());
        if (arena > 0 && (!live(arena) || !record(arena, e.getBlock()))) e.setCancelled(true);
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void spread(BlockSpreadEvent e) {
        int arena = index(e.getSource().getLocation());
        if (e.getBlock().getWorld().equals(world)
                && (arena == 0
                || index(e.getBlock().getLocation()) != arena
                || !live(arena)
                || !record(arena, e.getBlock()))) e.setCancelled(true);
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void form(BlockFormEvent e) {
        int arena = index(e.getBlock().getLocation());
        if (arena > 0 && (!live(arena) || !record(arena, e.getBlock()))) e.setCancelled(true);
    }

    void clearEntities(int arena) {
        if ((arena < 1 || arena > BattleMaps.LAST) && !(journalPrefix.equals("v8-arena-") && ImportedBuilds.is(arena)) || arena == 5)
            throw new IllegalArgumentException("Invalid arena");
        var map = BattleMaps.get(arena);
        if (map != null) {
            for (int x = (map.cx() - map.width() / 2) >> 4; x <= ((map.cx() + map.width() / 2) >> 4); x++)
                for (int z = (1024 - map.length() / 2) >> 4; z <= ((1024 + map.length() / 2) >> 4); z++)
                    if (journalPrefix.equals(activePrefix(p)) ? world.isChunkLoaded(x, z) : world.isChunkGenerated(x, z))
                        for (Entity e : world.getChunkAt(x, z).getEntities())
                            if (map.inside(e.getLocation(), world, 0) && !(e instanceof Player) && !(e instanceof Display))
                                e.remove();
            return;
        }
        int cx = arena * 160;
        for (int x = (cx - 34) >> 4; x <= ((cx + 34) >> 4); x++)
            for (int z = -34 >> 4; z <= (34 >> 4); z++)
                if (journalPrefix.equals(activePrefix(p)) ? world.isChunkLoaded(x, z) : world.isChunkGenerated(x, z))
                    for (Entity entity : world.getChunkAt(x, z).getEntities())
                        if (Math.abs(entity.getLocation().getX() - cx) <= 34
                                && Math.abs(entity.getLocation().getZ()) <= 34
                                && !(entity instanceof Player)
                                && !(entity instanceof Display)) entity.remove();
    }
}
