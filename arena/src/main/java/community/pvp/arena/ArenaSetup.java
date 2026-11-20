package community.pvp.arena;

import java.util.*;

import org.bukkit.*;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.block.*;
import org.bukkit.event.entity.*;
import org.bukkit.event.player.*;

final class ArenaSetup implements Listener {
    final CommunityArena p;
    final Map<UUID, Location[]> corners = new HashMap<>();
    final Set<UUID> builders = new HashSet<>();

    ArenaSetup(CommunityArena p) {
        this.p = p;
        Bukkit.getPluginManager().registerEvents(this, p);
    }

    Location spawn() {
        Location fallback =
                p.data.getBoolean("citadel-v4") ? p.data.getLocation("citadel.spawn") : null;
        if (fallback == null)
            fallback =
                    p.data.getLocation(
                            "grove.spawn",
                            p.grove == null ? p.loc(0, 0, 0, 180) : new Location(p.grove, 0.5, 65, 8.5, 180, 0));
        return p.data.getLocation("setup.spawn", fallback);
    }

    boolean validRegion(Location a, Location b) {
        if (!a.getWorld().equals(b.getWorld())
                || Math.abs(a.getX() - b.getX()) > 1000
                || Math.abs(a.getZ() - b.getZ()) > 1000) return false;
        if (a.getWorld().equals(p.world))
            for (int i = 1; i <= 5; i++) {
                int r = i == 5 ? 41 : 33;
                if (Math.max(a.getX(), b.getX()) >= i * 160 - r
                        && Math.min(a.getX(), b.getX()) <= i * 160 + r
                        && Math.max(a.getZ(), b.getZ()) >= -r
                        && Math.min(a.getZ(), b.getZ()) <= r) return false;
            }
        if (a.getWorld().equals(p.world)) for (var map : BattleMaps.all()) {
            if (Math.max(a.getX(), b.getX()) >= map.cx() - map.width() / 2 - 2 && Math.min(a.getX(), b.getX()) <= map.cx() + map.width() / 2 + 2
                    && Math.max(a.getZ(), b.getZ()) >= 1024 - map.length() / 2 - 2 && Math.min(a.getZ(), b.getZ()) <= 1024 + map.length() / 2 + 2)
                return false;
        }
        return true;
    }

    Location duelSpawn(int arena, boolean first) {
        Location fallback = p.loc(arena, first ? -18 : 18, 0, first ? -90 : 90);
        Location saved = p.data.getLocation("setup.arenas." + arena + "." + (first ? "a" : "b"));
        if (saved == null
                || !saved.getWorld().equals(p.world)
                || Math.abs(saved.getX() - arena * 160) > 30
                || Math.abs(saved.getZ()) > 30
                || saved.getY() < 65
                || saved.getY() > 73) return fallback;
        return saved;
    }

    boolean contains(Location l) {
        if ((l.getWorld().equals(p.citadel) || l.getWorld().equals(p.grove))
                && Math.abs(l.getX()) <= 49
                && Math.abs(l.getZ()) <= 49) return true;
        Location a = p.data.getLocation("setup.corner1"), b = p.data.getLocation("setup.corner2");
        if (a == null || b == null)
            return l.getWorld().equals(p.world) && Math.abs(l.getX()) <= 33 && Math.abs(l.getZ()) <= 33;
        return l.getWorld().equals(a.getWorld())
                && l.getX() >= Math.min(a.getX(), b.getX())
                && l.getX() <= Math.max(a.getX(), b.getX()) + 1
                && l.getZ() >= Math.min(a.getZ(), b.getZ())
                && l.getZ() <= Math.max(a.getZ(), b.getZ()) + 1;
    }

    void command(Player player, String[] args) {
        if (!player.hasPermission("communityarena.admin")) {
            p.tell(player, "Operator permission required.");
            return;
        }
        if (p.busy(player)) {
            p.tell(player, "Leave the match first.");
            return;
        }
        if (args.length == 0) {
            p.tell(
                    player,
                    "/pvpadmin setspawn | lobby <size: 16..1000> | pos1 | pos2 | save | build | hologram"
                            + " <elo|wins|deaths|streak> | delhologram <id>");
            return;
        }
        Location here = player.getLocation();
        switch (args[0].toLowerCase(Locale.ROOT)) {
            case "usecitadel" -> {
                if (!p.data.getBoolean("citadel-v4")) {
                    p.tell(player, "The citadel is still being constructed.");
                    return;
                }
                p.data.set("setup.corner1", new Location(p.citadel, -49, 0, -49));
                p.data.set("setup.corner2", new Location(p.citadel, 49, 0, 49));
                p.data.set("setup.spawn", p.data.getLocation("citadel.spawn"));
            }
            case "usegrove" -> {
                p.data.set("setup.corner1", new Location(p.grove, -49, 0, -49));
                p.data.set("setup.corner2", new Location(p.grove, 49, 0, 49));
                p.data.set(
                        "setup.spawn", p.data.getLocation("grove.spawn", new Location(p.grove, 0.5, 65, 8.5)));
            }
            case "recover" -> {
                if (args.length != 2 || !args[1].matches("[1-4]|[6-9]|1[0-9]|2[0-3]")) {
                    p.tell(player, "/pvpadmin recover <1..4 or 6..23>");
                    return;
                }
                int index = Integer.parseInt(args[1]);
                if (p.matches.values().stream().anyMatch(m -> m.arena == index) || p.bots.sessions.values().stream().anyMatch(b -> b.map == index) || p.partyBattles.sessions.values().stream().anyMatch(b -> b.policy.arena == index)) {
                    p.tell(player, "Wait until the arena has no active or finishing match.");
                    return;
                }
                try {
                    p.terrain.clearEntities(index);
                    p.terrain.reset(index);
                    p.occupied.remove(index);
                    p.tell(player, "Arena recovered and available.");
                } catch (Exception ex) {
                    p.tell(player, "Recovery failed; journal retained. Check server logs.");
                    p.getLogger().severe(ex.getMessage());
                }
                return;
            }
            case "setspawn" -> {
                if (!contains(here)) {
                    p.tell(player, "Set lobby boundaries here first.");
                    return;
                }
                p.data.set("setup.spawn", here);
            }
            case "pos1", "pos2" -> {
                Location[] points = corners.computeIfAbsent(player.getUniqueId(), k -> new Location[2]);
                points[args[0].equalsIgnoreCase("pos1") ? 0 : 1] = here;
                p.tell(player, "Corner saved in selection. Use /pvpadmin save after both corners.");
                return;
            }
            case "save" -> {
                Location[] points = corners.get(player.getUniqueId());
                if (points == null
                        || points[0] == null
                        || points[1] == null
                        || !validRegion(points[0], points[1])) {
                    p.tell(
                            player,
                            "Select two corners in one world, at most 1000 blocks apart, without overlapping"
                                    + " combat arenas.");
                    return;
                }
                Location a = points[0], b = points[1];
                if (!here.getWorld().equals(a.getWorld())
                        || here.getX() < Math.min(a.getX(), b.getX())
                        || here.getX() > Math.max(a.getX(), b.getX()) + 1
                        || here.getZ() < Math.min(a.getZ(), b.getZ())
                        || here.getZ() > Math.max(a.getZ(), b.getZ()) + 1) {
                    p.tell(player, "Stand inside your selection on a safe spawn block before saving.");
                    return;
                }
                p.data.set("setup.corner1", a);
                p.data.set("setup.corner2", b);
                p.data.set("setup.spawn", here);
            }
            case "lobby" -> {
                if (args.length != 2 || !args[1].matches("[0-9]{1,4}")) {
                    p.tell(player, "/pvpadmin lobby <size: 16..1000>");
                    return;
                }
                int size = Integer.parseInt(args[1]);
                if (size < 16 || size > 1000) {
                    p.tell(player, "Size must be 16..1000.");
                    return;
                }
                double half = size / 2.0;
                Location a = here.clone().add(-half, 0, -half), b = here.clone().add(half - 1, 0, half - 1);
                if (!validRegion(a, b)) {
                    p.tell(
                            player,
                            "Region overlaps combat arenas. Choose a separate world or a distant lobby site.");
                    return;
                }
                p.data.set("setup.corner1", a);
                p.data.set("setup.corner2", b);
                p.data.set("setup.spawn", here);
            }
            case "arena" -> {
                if (args.length != 3 || !args[1].matches("[1-4]") || !List.of("a", "b").contains(args[2])) {
                    p.tell(player, "/pvpadmin arena <1..4> <a|b> while inside that generated arena");
                    return;
                }
                int index = Integer.parseInt(args[1]);
                if (!here.getWorld().equals(p.world)
                        || Math.abs(here.getX() - index * 160) > 30
                        || Math.abs(here.getZ()) > 30
                        || here.getY() < 65
                        || here.getY() > 73) {
                    p.tell(player, "Spawn must be inside the chosen generated arena.");
                    return;
                }
                p.data.set("setup.arenas." + index + "." + args[2], here);
            }
            case "kit" -> {
                if (args.length != 2 || !p.kit(args[1])) {
                    p.tell(
                            player, "/pvpadmin kit <kit> saves your inventory as that kit for both opponents.");
                    return;
                }
                if (p.managed(player)) {
                    p.tell(player, "Exit practice through Settings before saving an operator kit.");
                    return;
                }
                p.data.set("kits." + args[1], Arrays.asList(player.getInventory().getContents()));
            }
            case "build" -> {
                if (!player.isOp()) {
                    p.tell(player, "Only operators can enable building.");
                    return;
                }
                if (!builders.remove(player.getUniqueId())) builders.add(player.getUniqueId());
                p.tell(player, "Lobby build bypass: " + builders.contains(player.getUniqueId()));
                return;
            }
            case "hologram" -> {
                if (args.length != 2 || !List.of("elo", "wins", "deaths", "streak").contains(args[1])) {
                    p.tell(player, "Choose elo, wins, deaths or streak.");
                    return;
                }
                String id = UUID.randomUUID().toString().substring(0, 8);
                p.data.set("holograms." + id + ".location", here);
                p.data.set("holograms." + id + ".stat", args[1]);
                p.tell(player, "Hologram id: " + id);
            }
            case "delhologram" -> {
                if (args.length != 2 || !args[1].matches("[a-f0-9]{8}")) {
                    p.tell(player, "/pvpadmin delhologram <id>");
                    return;
                }
                p.data.set("holograms." + args[1], null);
            }
            default -> {
                p.tell(player, "Unknown setup command. /pvpadmin");
                return;
            }
        }
        p.save();
        p.visuals.refreshHolograms();
        p.tell(
                player,
                "Setup saved. Lobby protection extends through the entire world height; no blocks were"
                        + " generated or deleted.");
    }

    boolean protectedBlock(org.bukkit.block.Block block, Player player) {
        return contains(block.getLocation())
                && !(player.isOp() && builders.contains(player.getUniqueId()));
    }

    @EventHandler(ignoreCancelled = true)
    public void breakBlock(BlockBreakEvent e) {
        if (protectedBlock(e.getBlock(), e.getPlayer())) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void place(BlockPlaceEvent e) {
        if (protectedBlock(e.getBlock(), e.getPlayer())) e.setCancelled(true);
    }

    @EventHandler
    public void lobbyDamage(EntityDamageEvent e) {
        if (contains(e.getEntity().getLocation())) e.setCancelled(true);
        if (e instanceof EntityDamageByEntityEvent hit) {
            Entity source = hit.getDamager();
            if (source instanceof org.bukkit.entity.Projectile pr
                    && pr.getShooter() instanceof Entity shooter) source = shooter;
            if (contains(source.getLocation())
                    || source instanceof Player a
                    && p.managed(a)
                    && !p.matches.containsKey(a.getUniqueId())
                    && !p.ffa.contains(a.getUniqueId())
                    && (p.bots == null || !p.bots.sessions.containsKey(a.getUniqueId()))
                    && (p.partyBattles == null || !p.partyBattles.sessions.containsKey(a.getUniqueId())))
                e.setCancelled(true);
        }
    }

    @EventHandler
    public void explode(EntityExplodeEvent e) {
        e.blockList().removeIf(b -> contains(b.getLocation()));
    }

    @EventHandler
    public void explode(BlockExplodeEvent e) {
        e.blockList().removeIf(b -> contains(b.getLocation()));
    }

    @EventHandler
    public void burn(BlockBurnEvent e) {
        if (contains(e.getBlock().getLocation())) e.setCancelled(true);
    }

    @EventHandler
    public void flow(BlockFromToEvent e) {
        if (contains(e.getToBlock().getLocation())) e.setCancelled(true);
    }

    @EventHandler
    public void bucket(PlayerBucketEmptyEvent e) {
        if (protectedBlock(e.getBlockClicked(), e.getPlayer())
                || contains(e.getBlockClicked().getRelative(e.getBlockFace()).getLocation()))
            e.setCancelled(true);
    }

    @EventHandler
    public void bucket(PlayerBucketFillEvent e) {
        if (protectedBlock(e.getBlockClicked(), e.getPlayer())) e.setCancelled(true);
    }

    @EventHandler
    public void piston(BlockPistonExtendEvent e) {
        if (contains(e.getBlock().getLocation())
                || e.getBlocks().stream()
                .anyMatch(
                        b ->
                                contains(b.getLocation())
                                        || contains(b.getRelative(e.getDirection()).getLocation())))
            e.setCancelled(true);
    }

    @EventHandler
    public void piston(BlockPistonRetractEvent e) {
        if (contains(e.getBlock().getLocation())
                || e.getBlocks().stream()
                .anyMatch(
                        b ->
                                contains(b.getLocation())
                                        || contains(b.getRelative(e.getDirection()).getLocation())))
            e.setCancelled(true);
    }

    @EventHandler
    public void change(EntityChangeBlockEvent e) {
        if (contains(e.getBlock().getLocation())) e.setCancelled(true);
    }

    @EventHandler
    public void quit(PlayerQuitEvent e) {
        builders.remove(e.getPlayer().getUniqueId());
        corners.remove(e.getPlayer().getUniqueId());
    }
}
