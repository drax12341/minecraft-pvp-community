package community.pvp.arena;

import java.util.*;

import org.bukkit.*;
import org.bukkit.entity.Player;
import org.bukkit.event.*;
import org.bukkit.event.player.*;

/**
 * Gate state belongs to an arena lease; generation tokens cancel delayed work after reuse.
 */
final class RoundGates implements Listener {
    final CommunityArena p;
    final Map<Integer, Integer> generations = new HashMap<>();
    final Set<Integer> sealed = new HashSet<>();

    RoundGates(CommunityArena p) {
        this.p = p;
        Bukkit.getPluginManager().registerEvents(this, p);
    }

    void gate(int id, Material material) {
        if (!ImportedBuilds.is(id)) return;
        var m = BattleMaps.get(id);
        var b = ImportedBuilds.build(id);
        for (var e : List.of(b.a(), b.b()))
            for (int z = e.z() - 8; z <= e.z() + 8; z++)
                for (int y = 97; y <= 101; y++)
                    p.world.getBlockAt(m.cx() - m.width() / 2 + e.gate(), y, 1024 - m.length() / 2 + z).setType(material, false);
    }

    void close(int id) {
        generations.merge(id, 1, Integer::sum);
        sealed.remove(id);
        gate(id, Material.IRON_BARS);
    }

    void open(int id) {
        if (!ImportedBuilds.is(id)) return;
        int generation = generations.getOrDefault(id, 0);
        gate(id, Material.AIR);
        Bukkit.getScheduler().runTaskLater(p, () -> {
            if (!p.occupied.contains(id) || generations.getOrDefault(id, 0) != generation) return;
            // Move any stragglers (and a stationary bot) onto the open landing before closing.
            for (var entity : p.world.getNearbyEntities(p.loc(id, 0, 0, 0), BattleMaps.get(id).width(), 240, BattleMaps.get(id).length())) {
                if (!(entity instanceof Player) && p.bots.session(entity) == null) continue;
                if (ImportedBuilds.protectedRoom(id, entity.getLocation()))
                    entity.teleport(exit(id, entity.getLocation()));
            }
            sealed.add(id);
            gate(id, Material.IRON_BARS);
        }, 100);
    }

    Location exit(int id, Location here) {
        var m = BattleMaps.get(id);
        var b = ImportedBuilds.build(id);
        double x = here.getX() - (m.cx() - m.width() / 2);
        boolean first = Math.abs(x - b.a().x()) <= Math.abs(x - b.b().x());
        var e = first ? b.a() : b.b();
        return new Location(p.world, m.cx() - m.width() / 2 + e.gate() + (first ? 2.5 : -1.5), 97, 1024 - m.length() / 2 + e.z() + .5, first ? -90 : 90, 0);
    }

    int arena(Player a) {
        var m = p.matches.get(a.getUniqueId());
        if (m != null) return m.arena;
        var b = p.bots.sessions.get(a.getUniqueId());
        if (b != null) return b.map;
        var team = p.partyBattles.sessions.get(a.getUniqueId());
        return team == null ? 0 : team.policy.arena;
    }

    @EventHandler(ignoreCancelled = false)
    public void ready(PlayerInteractEvent e) {
        if (e.getAction() != org.bukkit.event.block.Action.LEFT_CLICK_BLOCK || e.getClickedBlock() == null) return;
        var m = p.matches.get(e.getPlayer().getUniqueId());
        if (m == null || m.ended || !m.paused || !ImportedBuilds.is(m.arena)) return;
        var map = BattleMaps.get(m.arena);
        var build = ImportedBuilds.build(m.arena);
        var block = e.getClickedBlock();
        for (var entry : List.of(build.a(), build.b()))
            if (block.getWorld().equals(p.world) && block.getX() == map.cx() - map.width() / 2 + entry.gate() && Math.abs(block.getZ() - (1024 - map.length() / 2 + entry.z())) <= 8 && block.getY() >= 97 && block.getY() <= 101 && e.getPlayer().getLocation().distanceSquared(block.getLocation()) <= 36) {
                m.readied.add(e.getPlayer().getUniqueId());
                e.getPlayer().sendActionBar(net.kyori.adventure.text.Component.text("Ready | " + m.readied.size() + "/2"));
                e.setCancelled(true);
                return;
            }
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void move(PlayerMoveEvent e) {
        int id = arena(e.getPlayer());
        if (!ImportedBuilds.is(id) || !e.hasChangedPosition()) return;
        if (e.getTo().getY() < 50) {
            e.setTo(exit(id, e.getFrom()));
            e.getPlayer().setFallDistance(0);
            e.getPlayer().setVelocity(new org.bukkit.util.Vector());
        } else if (sealed.contains(id) && ImportedBuilds.protectedRoom(id, e.getTo())) e.setTo(e.getFrom());
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void teleport(PlayerTeleportEvent e) {
        int id = arena(e.getPlayer());
        if (e.getCause() != PlayerTeleportEvent.TeleportCause.PLUGIN && sealed.contains(id) && ImportedBuilds.protectedRoom(id, e.getTo()))
            e.setCancelled(true);
    }
}
