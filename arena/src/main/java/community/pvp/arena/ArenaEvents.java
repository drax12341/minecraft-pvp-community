package community.pvp.arena;

import java.util.*;

import org.bukkit.*;
import org.bukkit.command.*;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.block.*;
import org.bukkit.event.entity.*;
import org.bukkit.event.inventory.*;
import org.bukkit.event.player.*;
import org.bukkit.inventory.*;
import org.bukkit.inventory.meta.*;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.potion.*;
import org.bukkit.scoreboard.*;

final class ArenaEvents implements Listener {
    final CommunityArena arena;

    ArenaEvents(CommunityArena arena) {
        this.arena = arena;
    }

    @EventHandler
    public void join(PlayerJoinEvent e) {
        Player p = e.getPlayer();
        if (arena.data.contains("backups." + p.getUniqueId())) arena.restore(p);
        arena.progression.remember(p);
        arena
                .getServer()
                .getScheduler()
                .runTaskLater(
                        arena,
                        () -> {
                            if (p.isOnline()) {
                                arena.tell(
                                        p,
                                        "Welcome! /arena opens practice duels, kits and FFA. /duel challenges a"
                                                + " friend.");
                                if (arena.ready
                                        && !arena.managed(p)
                                        && arena.getConfig().getBoolean("join-lobby", true)) arena.enter(p);
                            }
                        },
                        40);
    }

    @EventHandler
    public void quit(PlayerQuitEvent e) {
        Player p = e.getPlayer();
        CommunityArena.Match m = arena.matches.get(p.getUniqueId());
        if (m != null) arena.finish(m, m.other(p.getUniqueId()), "Opponent disconnected");
        arena.partyBattles.leave(p);
        arena.bots.stop(p);
        arena.duels.drafts.remove(p.getUniqueId());
        arena.parties.quit(p);
        if (arena.managed(p)) arena.restore(p);
        arena.matches.remove(p.getUniqueId());
        arena.commandTimes.remove(p.getUniqueId());
        arena.progression.queuedAt.remove(p.getUniqueId());
        arena.invites.remove(p.getUniqueId());
        arena.invites.values().removeIf(i -> i.sender().equals(p.getUniqueId()));
    }

    @EventHandler(ignoreCancelled = true)
    public void move(PlayerMoveEvent e) {
        Player p = e.getPlayer();
        Location to = e.getTo();
        if (!arena.managed(p) || to == null || !e.hasChangedPosition()) return;
        var watchedExtra = arena.social.extra.get(p.getUniqueId());
        if (watchedExtra != null) {
            if (!BattleMaps.contains(arena, watchedExtra.map(), to))
                e.setTo(arena.loc(watchedExtra.map(), 0, 0, 0).add(0, 4, 0));
            return;
        }
        if (arena.partyBattles.sessions.containsKey(p.getUniqueId())) return;
        var bot = arena.bots.sessions.get(p.getUniqueId());
        if (bot != null) {
            if (!BattleMaps.contains(arena, bot.map, to)) e.setTo(e.getFrom());
            return;
        }
        var modern = arena.matches.get(p.getUniqueId());
        if (modern != null && BattleMaps.get(modern.arena) != null) {
            if (arena.frozen.contains(p.getUniqueId()) || !BattleMaps.contains(arena, modern.arena, to))
                e.setTo(e.getFrom());
            return;
        }
        if (arena.social.spectators.containsKey(p.getUniqueId())) {
            CommunityArena.Match watched = arena.social.spectators.get(p.getUniqueId());
            if (BattleMaps.get(watched.arena) != null) {
                if (!BattleMaps.contains(arena, watched.arena, to))
                    e.setTo(arena.loc(watched.arena, 0, 0, 0).add(0, 5, 0));
                return;
            }
            if (!to.getWorld().equals(arena.world)
                    || to.distanceSquared(arena.loc(watched.arena, 0, 0, 0)) > 50 * 50)
                e.setTo(arena.loc(watched.arena, 0, 0, 0).add(0, 5, 0));
            return;
        }
        if (!arena.matches.containsKey(p.getUniqueId()) && !arena.ffa.contains(p.getUniqueId())) {
            if (!arena.setup.contains(to) || to.getY() < arena.setup.spawn().getY() - 20)
                e.setTo(arena.setup.spawn());
            return;
        }
        if (arena.frozen.contains(p.getUniqueId()) && e.hasChangedPosition()) {
            e.setTo(e.getFrom());
            return;
        }
        CommunityArena.Match active = arena.matches.get(p.getUniqueId());
        int section = active != null ? active.arena : arena.ffa.contains(p.getUniqueId()) ? 5 : 0;
        int radius = section == 5 ? 39 : 31;
        boolean outside =
                !to.getWorld().equals(arena.world)
                        || Math.abs(to.getX() - section * 160) > radius
                        || Math.abs(to.getZ()) > radius;
        if (to.getY() < 50 || outside) {
            e.setTo(e.getFrom());
            if (arena.matches.containsKey(p.getUniqueId())) arena.lost(p, "Out of bounds");
            else if (arena.ffa.contains(p.getUniqueId())) arena.joinFfa(p);
            else arena.lobby(p);
        }
    }

    @EventHandler(priority = EventPriority.HIGHEST)
    public void damage(EntityDamageEvent e) {
        if (e.isCancelled()) return;
        if (!(e.getEntity() instanceof Player p) || !arena.managed(p)) return;
        if (arena.partyBattles.sessions.containsKey(p.getUniqueId())) return;
        if (arena.bots.sessions.containsKey(p.getUniqueId())) {
            if (e.getFinalDamage() >= p.getHealth() && p.getInventory().getItemInMainHand().getType() != Material.TOTEM_OF_UNDYING && p.getInventory().getItemInOffHand().getType() != Material.TOTEM_OF_UNDYING) {
                e.setCancelled(true);
                arena.tell(p, "Practice ended: you were knocked out.");
                arena.bots.stop(p);
            }
            return;
        }
        CommunityArena.Match m = arena.matches.get(p.getUniqueId());
        if (arena.social.spectators.containsKey(p.getUniqueId())) {
            e.setCancelled(true);
            return;
        }
        if (m == null && !arena.ffa.contains(p.getUniqueId()) || m != null && m.paused) {
            e.setCancelled(true);
            return;
        }
        if (e instanceof EntityDamageByEntityEvent hit) {
            Entity src = hit.getDamager();
            Player attacker =
                    src instanceof Player a
                            ? a
                            : src instanceof Projectile proj && proj.getShooter() instanceof Player a ? a : null;
            if (attacker != null) {
                if (arena.social.spectators.containsKey(attacker.getUniqueId())
                        || m != null && !attacker.getUniqueId().equals(m.other(p.getUniqueId()))
                        || m == null && !arena.ffa.contains(attacker.getUniqueId())) {
                    e.setCancelled(true);
                    return;
                }
                if (arena.flag(attacker, "hitsounds", true))
                    attacker.playSound(attacker.getLocation(), Sound.BLOCK_NOTE_BLOCK_HAT, 0.35f, 1.4f);
            }
        }
        if (m != null
                && m.kit.equals("boxing")
                && e instanceof EntityDamageByEntityEvent hit
                && hit.getDamager() instanceof Player attacker) {
            e.setDamage(0.01);
            int hits = m.hits.merge(attacker.getUniqueId(), 1, Integer::sum);
            if (hits >= 100) arena.lost(p, "100 hits");
            return;
        }
        if (e.getFinalDamage() >= p.getHealth()) {
            if (e.getCause() != EntityDamageEvent.DamageCause.VOID
                    && e.getCause() != EntityDamageEvent.DamageCause.SUICIDE
                    && (p.getInventory().getItemInMainHand().getType() == Material.TOTEM_OF_UNDYING
                    || p.getInventory().getItemInOffHand().getType() == Material.TOTEM_OF_UNDYING))
                return;
            e.setCancelled(true);
            if (m != null) arena.lost(p, "Knockout");
            else {
                arena.progression.add(p.getUniqueId(), "deaths", 1);
                Player killer =
                        e instanceof EntityDamageByEntityEvent hit
                                ? (hit.getDamager() instanceof Player a
                                ? a
                                : hit.getDamager() instanceof Projectile pr
                                && pr.getShooter() instanceof Player a
                                ? a
                                : null)
                                : null;
                if (killer != null) {
                    arena.progression.add(killer.getUniqueId(), "kills", 1);
                    arena.tell(killer, "Eliminated " + p.getName());
                }
                arena.joinFfa(p);
            }
        }
    }

    @EventHandler
    public void death(PlayerDeathEvent e) {
        Player p = e.getEntity();
        if (!arena.managed(p)) return;
        e.getDrops().clear();
        e.setKeepInventory(true);
        e.setDroppedExp(0);
        CommunityArena.Match m = arena.matches.get(p.getUniqueId());
        if (m != null) arena.finish(m, m.other(p.getUniqueId()), "Death");
        arena
                .getServer()
                .getScheduler()
                .runTask(
                        arena,
                        () -> {
                            if (p.isOnline()) p.spigot().respawn();
                        });
    }

    @EventHandler
    public void click(InventoryClickEvent e) {
        if (!(e.getWhoClicked() instanceof Player p)) return;
        if (arena.layouts.editing(p, e.getView().getTopInventory())
                || arena.savedKits.editing(p, e.getView().getTopInventory())) return;
        if (!(e.getView().getTopInventory().getHolder() instanceof ArenaMenu)) {
            if (arena.managed(p) && !arena.busy(p) && !arena.ffa.contains(p.getUniqueId()))
                e.setCancelled(true);
            return;
        }
        e.setCancelled(true);
        if (e.getRawSlot() < 0 || e.getRawSlot() >= e.getView().getTopInventory().getSize()) return;
        ItemStack s = e.getCurrentItem();
        if (s != null && s.hasItemMeta() && e.isRightClick()) {
            String action =
                    s.getItemMeta()
                            .getPersistentDataContainer()
                            .get(arena.menuKey, PersistentDataType.STRING);
            if (action != null && action.startsWith("kit:")) {
                String[] pieces = action.split(":");
                if (pieces.length == 3)
                    arena.getServer().getScheduler().runTask(arena, () -> arena.layouts.open(p, pieces[2]));
                return;
            }
        }
        if (s != null && s.hasItemMeta())
            arena
                    .getServer()
                    .getScheduler()
                    .runTask(
                            arena,
                            () ->
                                    arena.handleMenuClick(
                                            p,
                                            s.getItemMeta()
                                                    .getPersistentDataContainer()
                                                    .get(arena.menuKey, PersistentDataType.STRING),
                                            e.isRightClick(),
                                            e.isShiftClick()));
    }

    @EventHandler
    public void drag(InventoryDragEvent e) {
        if (e.getView().getTopInventory().getHolder() instanceof ArenaMenu
                || e.getWhoClicked() instanceof Player p
                && arena.managed(p)
                && !arena.matches.containsKey(p.getUniqueId())) e.setCancelled(true);
    }

    @EventHandler
    public void interact(PlayerInteractEvent e) {
        Player p = e.getPlayer();
        if (!arena.managed(p) || e.getItem() == null || !e.getAction().isRightClick()) return;
        ItemMeta meta = e.getItem().getItemMeta();
        String a =
                meta == null
                        ? null
                        : meta.getPersistentDataContainer().get(arena.menuKey, PersistentDataType.STRING);
        if (a != null) {
            e.setCancelled(true);
            arena.action(p, a);
        }
    }

    @EventHandler
    public void drop(PlayerDropItemEvent e) {
        if (arena.managed(e.getPlayer())) e.setCancelled(true);
    }

    @EventHandler
    public void pickup(EntityPickupItemEvent e) {
        if (e.getEntity() instanceof Player p && arena.managed(p)) {
            var m = arena.matches.get(p.getUniqueId());
            var bot = arena.bots.sessions.get(p.getUniqueId());
            if (m == null && bot != null) m = bot.policy;
            var team = arena.partyBattles.sessions.get(p.getUniqueId());
            if (m == null && team != null && team.alive.contains(p.getUniqueId())) m = team.policy;
            if (m == null || m.paused || !m.rules.loot() || arena.terrain.index(e.getItem().getLocation()) != m.arena)
                e.setCancelled(true);
        }
    }

    @EventHandler
    public void hunger(FoodLevelChangeEvent e) {
        if (e.getEntity() instanceof Player player && arena.managed(player)) {
            var match = arena.matches.get(player.getUniqueId());
            if (match == null || Set.of("sword", "axe", "bow", "boxing").contains(match.kit)) {
                e.setCancelled(true);
                player.setFoodLevel(20);
            }
        }
    }

    @EventHandler
    public void breakBlock(BlockBreakEvent e) {
        if (e.getBlock().getWorld().equals(arena.world)
                && arena.terrain.editable(e.getPlayer(), e.getBlock()) == null
                && !(e.getPlayer().isOp() && arena.setup.builders.contains(e.getPlayer().getUniqueId())))
            e.setCancelled(true);
    }

    @EventHandler
    public void placeBlock(BlockPlaceEvent e) {
        if (e.getBlock().getWorld().equals(arena.world)
                && arena.terrain.editable(e.getPlayer(), e.getBlock()) == null
                && !(e.getPlayer().isOp() && arena.setup.builders.contains(e.getPlayer().getUniqueId())))
            e.setCancelled(true);
    }

    @EventHandler
    public void explode(EntityExplodeEvent e) {
        if (e.getLocation().getWorld().equals(arena.world) && arena.terrain.index(e.getLocation()) == 0)
            e.blockList().clear();
    }

    @EventHandler
    public void explode(BlockExplodeEvent e) {
        if (e.getBlock().getWorld().equals(arena.world)) e.blockList().clear();
    }

    @EventHandler
    public void swap(PlayerSwapHandItemsEvent e) {
        if (arena.managed(e.getPlayer())
                && !arena.matches.containsKey(e.getPlayer().getUniqueId())
                && !arena.ffa.contains(e.getPlayer().getUniqueId())) e.setCancelled(true);
    }

    @EventHandler
    public void respawn(PlayerRespawnEvent e) {
        if (arena.managed(e.getPlayer())) {
            e.setRespawnLocation(arena.setup.spawn());
            arena.getServer().getScheduler().runTask(arena, () -> arena.lobby(e.getPlayer()));
        }
    }

    @EventHandler
    public void commandGuard(PlayerCommandPreprocessEvent e) {
        if (!arena.busy(e.getPlayer())) return;
        String root = e.getMessage().split(" ")[0].toLowerCase(Locale.ROOT);
        if (!List.of("/leave", "/stats", "/msg", "/tell", "/w").contains(root)) {
            e.setCancelled(true);
            arena.tell(e.getPlayer(), "Use /leave to end your current session first.");
        }
    }
}
