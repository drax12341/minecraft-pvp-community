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

/** Write-ahead originals allow only the generated combat interior to be restored after a crash. */
final class ArenaTerrain implements Listener {
  final CommunityArena p;
  final Runnable flushWorld;
  final Map<Integer, LinkedHashMap<String, String>> changes = new HashMap<>();
  static final Set<Material> PLACE =
      Set.of(
          Material.OBSIDIAN,
          Material.COBWEB,
          Material.OAK_PLANKS,
          Material.GLOWSTONE,
          Material.RESPAWN_ANCHOR,
          Material.COBBLESTONE);

  ArenaTerrain(CommunityArena p) {
    this(p, () -> p.worldSaver.accept(p.world));
  }

  ArenaTerrain(CommunityArena p, Runnable flushWorld) {
    this.p = p;
    this.flushWorld = flushWorld;
    Bukkit.getPluginManager().registerEvents(this, p);
  }

  Path journal(int arena) {
    if (arena < 1 || arena > 4) throw new IllegalArgumentException("Invalid arena");
    return p.getDataFolder().toPath().resolve("arena-" + arena + ".journal");
  }

  int index(Location l) {
    if (!l.getWorld().equals(p.world)
        || l.getBlockY() < 50
        || l.getBlockY() > 85
        || Math.abs(l.getBlockZ()) > 29) return 0;
    for (int i = 1; i <= 4; i++) if (Math.abs(l.getBlockX() - i * 160) <= 29) return i;
    return 0;
  }

  CommunityArena.Match editable(Player player, Block b) {
    var m = p.matches.get(player.getUniqueId());
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
    if (index(block.getLocation()) != arena || block.getState() instanceof TileState) return false;
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
      if (index(block.getLocation()) != arena || block.getState() instanceof TileState)
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
    for (int i = 1; i <= 4; i++) {
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
            p.world.getBlockAt(
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
    if (!block.getWorld().equals(p.world)) return;
    var m = editable(e.getPlayer(), block);
    if (m == null || !record(arena, block)) e.setCancelled(true);
  }

  @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
  public void bucket(PlayerBucketFillEvent e) {
    int arena = index(e.getBlockClicked().getLocation());
    if (e.getBlockClicked().getWorld().equals(p.world)
        && (editable(e.getPlayer(), e.getBlockClicked()) == null
            || !record(arena, e.getBlockClicked()))) e.setCancelled(true);
  }

  boolean live(int arena) {
    return p.matches.values().stream()
        .anyMatch(m -> m.arena == arena && !m.ended && !m.paused && Loadouts.building(m.kit));
  }

  @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
  public void flow(BlockFromToEvent e) {
    if (!e.getBlock().getWorld().equals(p.world)) return;
    int arena = index(e.getBlock().getLocation());
    if (arena == 0
        || index(e.getToBlock().getLocation()) != arena
        || !live(arena)
        || !record(arena, e.getToBlock())) e.setCancelled(true);
  }

  void explosion(Location location, List<Block> blocks) {
    if (!location.getWorld().equals(p.world)) return;
    int arena = index(location);
    if (arena == 0 || !live(arena)) {
      blocks.clear();
      return;
    }
    blocks.removeIf(
        block -> index(block.getLocation()) != arena || block.getState() instanceof TileState);
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
        || !e.getPlayer().getWorld().equals(p.world)) return;
    Block block = e.getClickedBlock();
    var m = block == null ? null : editable(e.getPlayer(), block);
    if (m == null || !m.kit.equals("crystal")) e.setCancelled(true);
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
    if (e.getBlock().getWorld().equals(p.world)
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
    if (arena < 1 || arena > 4) throw new IllegalArgumentException("Invalid arena");
    int cx = arena * 160;
    for (int x = (cx - 34) >> 4; x <= ((cx + 34) >> 4); x++)
      for (int z = -34 >> 4; z <= (34 >> 4); z++)
        for (Entity entity : p.world.getChunkAt(x, z).getEntities())
          if (Math.abs(entity.getLocation().getX() - cx) <= 34
              && Math.abs(entity.getLocation().getZ()) <= 34
              && !(entity instanceof Player)
              && !(entity instanceof Display)) entity.remove();
  }
}
