package community.pvp.arena;

import java.util.*;
import java.util.function.BooleanSupplier;
import org.bukkit.*;
import org.bukkit.entity.Player;
import org.bukkit.event.*;
import org.bukkit.event.player.PlayerToggleSneakEvent;
import org.bukkit.scheduler.BukkitRunnable;

/** One readiness policy for duels, teams and practice targets. */
final class RoundCountdown implements Listener {
    final CommunityArena p;
    final Map<UUID, Set<UUID>> waiting = new HashMap<>();

    RoundCountdown(CommunityArena p) {
        this.p = p;
        Bukkit.getPluginManager().registerEvents(this, p);
    }

    void start(List<Player> players, Set<UUID> ready, BooleanSupplier active, Runnable go, String label) {
        ready.clear();
        for (Player player : players) {
            waiting.put(player.getUniqueId(), ready);
            p.frozen.add(player.getUniqueId());
        }
        new BukkitRunnable() {
            int ticks;
            int shownReady = -1;
            void clear() {
                for (Player player : players) {
                    UUID id = player.getUniqueId();
                    if (waiting.get(id) == ready) {
                        waiting.remove(id);
                        p.frozen.remove(id);
                    }
                }
                cancel();
            }
            public void run() {
                if (!active.getAsBoolean() || players.stream().anyMatch(a -> !a.isOnline())) {
                    clear();
                    return;
                }
                if (ticks >= 60 || ready.size() == players.size()) {
                    clear();
                    go.run();
                    return;
                }
                if (ticks % 20 == 0)
                    for (Player player : players)
                        RoundEffects.count(p, player, 3 - ticks / 20, label);
                if (ticks % 20 == 0 || shownReady != ready.size()) {
                    for (Player player : players)
                        player.sendActionBar(PracticePresentation.ui("§eLeft Shift: skip countdown §7(" + ready.size() + "/" + players.size() + ")"));
                    shownReady = ready.size();
                }
                ticks++;
            }
        }.runTaskTimer(p, 0, 1);
    }

    @EventHandler(ignoreCancelled = true)
    public void sneak(PlayerToggleSneakEvent e) {
        var ready = waiting.get(e.getPlayer().getUniqueId());
        if (e.isSneaking() && ready != null) ready.add(e.getPlayer().getUniqueId());
    }

    @EventHandler(priority = EventPriority.HIGHEST)
    public void use(org.bukkit.event.player.PlayerInteractEvent e) {
        if (!waiting.containsKey(e.getPlayer().getUniqueId())) return;
        e.setUseItemInHand(Event.Result.DENY);
        e.setUseInteractedBlock(Event.Result.DENY);
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void teleport(org.bukkit.event.player.PlayerTeleportEvent e) {
        if (waiting.containsKey(e.getPlayer().getUniqueId())
                && e.getCause() != org.bukkit.event.player.PlayerTeleportEvent.TeleportCause.PLUGIN)
            e.setCancelled(true);
    }
}
