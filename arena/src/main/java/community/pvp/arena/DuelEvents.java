package community.pvp.arena;

import org.bukkit.*;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.player.*;

final class DuelEvents implements Listener {
    final CommunityArena p;

    DuelEvents(CommunityArena p) {
        this.p = p;
    }

    DuelRules rules(Player player) {
        var match = p.matches.get(player.getUniqueId());
        if (match != null) return match.rules;
        var team = p.partyBattles.sessions.get(player.getUniqueId());
        if (team != null) return team.policy.rules;
        var bot = p.bots.sessions.get(player.getUniqueId());
        return bot == null ? null : bot.rules;
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void teleport(PlayerTeleportEvent e) {
        var m = p.matches.get(e.getPlayer().getUniqueId());
        var bot = p.bots.sessions.get(e.getPlayer().getUniqueId());
        var team = p.partyBattles.sessions.get(e.getPlayer().getUniqueId());
        int map = m != null ? m.arena : bot != null ? bot.map : team != null ? team.policy.arena : 0;
        if (map == 0) return;
        // Plugin teleports are used only by lifecycle transitions. All player escape paths fail closed.
        if (e.getCause() != PlayerTeleportEvent.TeleportCause.PLUGIN && !BattleMaps.contains(p, map, e.getTo())) {
            e.setCancelled(true);
            return;
        }
        DuelRules rules = rules(e.getPlayer());
        if (e.getCause() == PlayerTeleportEvent.TeleportCause.ENDER_PEARL && rules != null && !rules.pearlsWalls()) {
            Location l = e.getTo();
            for (int dx = -1; dx <= 1; dx++)
                for (int dz = -1; dz <= 1; dz++)
                    if (Math.abs(dx) + Math.abs(dz) == 1 && l.clone().add(dx, 0, dz).getBlock().getType().isSolid())
                        e.setCancelled(true);
        }
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void sprint(PlayerToggleSprintEvent e) {
        DuelRules r = rules(e.getPlayer());
        var m = p.matches.get(e.getPlayer().getUniqueId());
        if (!e.isSprinting() || r == null || !r.responsive() || m != null && m.paused) return;
        var player = e.getPlayer();
        // A bounded acceleration aid, not an artificial change to client ping or hit immunity.
        var forward = player.getLocation().getDirection().setY(0);
        if (forward.lengthSquared() > 0 && player.getVelocity().lengthSquared() < 0.3)
            player.setVelocity(player.getVelocity().add(forward.normalize().multiply(0.055)));
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void tnt(BlockPlaceEvent e) {
        if (e.getBlockPlaced().getType() != Material.TNT) return;
        DuelRules r = rules(e.getPlayer());
        if (r == null || !r.igniteTnt()) return;
        Location location = e.getBlockPlaced().getLocation();
        Bukkit.getScheduler().runTask(p, () -> {
            if (location.getBlock().getType() != Material.TNT || rules(e.getPlayer()) != r) return;
            location.getBlock().setType(Material.AIR, false);
            location.getWorld().spawn(location.clone().add(.5, 0, .5), TNTPrimed.class, t -> {
                t.setSource(e.getPlayer());
                t.setFuseTicks(80);
            });
        });
    }

    static void dropLoot(CommunityArena p, Player loser, CommunityArena.Match m) {
        if (!m.rules.loot()) return;
        for (var item : loser.getInventory().getContents())
            if (item != null && !item.getType().isAir())
                loser.getWorld().dropItemNaturally(loser.getLocation(), item.clone());
        loser.getInventory().clear();
    }
}
