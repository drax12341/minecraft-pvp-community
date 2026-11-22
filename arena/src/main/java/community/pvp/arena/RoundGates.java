package community.pvp.arena;

import java.util.*;

import org.bukkit.*;
import org.bukkit.entity.Player;
import org.bukkit.event.*;
import org.bukkit.event.player.*;

/**
 * Contains fighters; removes historical cages once per reserved arena after startup.
 */
final class RoundGates implements Listener {
    final CommunityArena p;
    final Set<Integer> prepared = new HashSet<>();

    RoundGates(CommunityArena p) {
        this.p = p;
        Bukkit.getPluginManager().registerEvents(this, p);
    }

    void prepare(int id) {
        if (!ImportedBuilds.is(id) || !prepared.add(id)) return;
        var m = ImportedBuilds.get(id);
        var b = ImportedBuilds.build(id);
        for (var entry : List.of(b.a(), b.b()))
            for (int x = entry.x() - 5; x <= entry.x() + 5; x++)
                for (int z = entry.z() - 8; z <= entry.z() + 8; z++)
                    for (int y = 97; y <= 102; y++) {
                        var block = p.world.getBlockAt(m.cx() - m.width()/2 + x, y, 1024 - m.length()/2 + z);
                        if (!block.getType().isAir()) block.setType(Material.AIR, false);
                    }
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
        }
    }

}
