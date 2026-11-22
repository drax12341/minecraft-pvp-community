package community.pvp.arena;

import java.util.*;

import org.bukkit.*;
import org.bukkit.entity.Player;
import org.bukkit.event.*;
import org.bukkit.event.player.*;

/**
 * Keeps unused entry rooms closed and contains fighters on the battlefield.
 */
final class RoundGates implements Listener {
    final CommunityArena p;
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
        sealed.add(id);
        gate(id, Material.IRON_BARS);
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
