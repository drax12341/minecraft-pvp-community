package community.pvp.arena;

import java.util.*;

import org.bukkit.*;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.entity.*;
import org.bukkit.event.player.*;

/**
 * Casual team elimination sets with no ranked or community-placement side effects.
 */
final class PartyBattles implements Listener {
    final CommunityArena p;
    final Map<UUID, Battle> sessions = new HashMap<>();

    static final class Battle {
        final Map<UUID, String> teams = new LinkedHashMap<>();
        final Set<UUID> alive = new HashSet<>();
        CommunityArena.Match policy;
        int red, blue, target;
        boolean paused = true, ended;
        long started;
    }

    PartyBattles(CommunityArena p) {
        this.p = p;
        Bukkit.getPluginManager().registerEvents(this, p);
        Bukkit.getScheduler().runTaskTimer(p, () -> {
            for (Battle b : new HashSet<>(sessions.values()))
                if (System.currentTimeMillis() - b.started > 600000) finish(b, "Time limit");
        }, 20, 20);
    }

    void start(Player leader, DuelMenus.Draft d) {
        Parties.Party party = p.parties.membership.get(leader.getUniqueId());
        if (party == null || !party.leader.equals(leader.getUniqueId()) || party.members.size() < 2) {
            p.tell(leader, "Create a party with at least two members first.");
            return;
        }
        if (!party.members.containsValue("red") || !party.members.containsValue("blue")) {
            p.tell(leader, "Choose both red and blue teams, or /party split.");
            return;
        }
        var map = BattleMaps.get(d.map);
        if (map == null || !map.supports(d.kit) || p.occupied.contains(d.map) || !p.data.getBoolean("built-battle-maps-v5")) {
            p.tell(leader, "Map unavailable.");
            return;
        }
        for (UUID id : party.members.keySet()) {
            Player a = Bukkit.getPlayer(id);
            if (a == null || p.busy(a)) {
                p.tell(leader, "All members must be online and idle.");
                return;
            }
            if (!p.managed(a)) p.enter(a);
            if (!p.managed(a)) return;
        }
        Battle b = new Battle();
        b.teams.putAll(party.members);
        b.target = d.rounds;
        b.started = System.currentTimeMillis();
        b.policy = p.new Match(leader, leader, d.kit, d.map, d.rounds);
        b.policy.customEquipment = d.custom == null ? null : SavedKits.copy(d.custom);
        b.policy.rules = d.rules();
        p.occupied.add(d.map);
        for (UUID id : b.teams.keySet()) {
            sessions.put(id, b);
            p.queues.remove(id);
            p.ffa.remove(id);
        }
        round(b);
    }

    void message(Battle b, String text) {
        for (UUID id : b.teams.keySet()) {
            Player a = Bukkit.getPlayer(id);
            if (a != null) p.tell(a, text);
        }
    }

    void round(Battle b) {
        if (b.ended) return;
        b.paused = true;
        b.policy.paused = true;
        b.policy.hits.clear();
        b.alive.clear();
        b.alive.addAll(b.teams.keySet());
        try {
            p.terrain.clearEntities(b.policy.arena);
            p.terrain.reset(b.policy.arena);
        } catch (Exception ex) {
            finish(b, "Recovery required");
            return;
        }
        int red = 0, blue = 0;
        for (var e : b.teams.entrySet()) {
            Player a = Bukkit.getPlayer(e.getKey());
            if (a == null) {
                finish(b, "Member disconnected");
                return;
            }
            boolean first = e.getValue().equals("red");
            int n = first ? red++ : blue++;
            if (b.policy.customEquipment == null) p.equip(a, b.policy.kit);
            else p.savedKits.equip(a, b.policy.customEquipment);
            a.closeInventory();
            a.teleport(teamSpawn(p, b.policy.arena, first, n));
            p.frozen.add(e.getKey());
        }
        message(b, "Teams: Red " + b.red + " : " + b.blue + " Blue. First to " + b.target + ". Fight in 3 seconds!");
        Bukkit.getScheduler().runTaskLater(p, () -> {
            if (b.ended) return;
            b.paused = false;
            b.policy.paused = false;
            for (UUID id : b.teams.keySet()) p.frozen.remove(id);
            message(b, "GO!");
        }, 60);
    }

    static Location teamSpawn(CommunityArena p, int map, boolean first, int member) {
        return BattleMaps.spawn(p, map, first)
                .add((first ? 1 : -1) * (member / 7) * 2, 0, (member % 7 - 3) * 2);
    }

    void eliminate(Player loser) {
        Battle b = sessions.get(loser.getUniqueId());
        if (b == null || b.paused || !b.alive.remove(loser.getUniqueId())) return;
        DuelEvents.dropLoot(p, loser, b.policy);
        p.clean(loser);
        loser.setGameMode(GameMode.SPECTATOR);
        message(b, loser.getName() + " eliminated.");
        boolean red = b.alive.stream().anyMatch(id -> b.teams.get(id).equals("red")), blue = b.alive.stream().anyMatch(id -> b.teams.get(id).equals("blue"));
        if (red && blue) return;
        b.paused = true;
        b.policy.paused = true;
        if (red) b.red++;
        if (blue) b.blue++;
        if (Math.max(b.red, b.blue) >= b.target) {
            finish(b, (red ? "Red" : "Blue") + " team wins " + b.red + ":" + b.blue);
            return;
        }
        Bukkit.getScheduler().runTaskLater(p, () -> round(b), 40);
    }

    @EventHandler(priority = EventPriority.HIGHEST)
    public void damage(EntityDamageEvent e) {
        if (!(e.getEntity() instanceof Player a)) return;
        Battle b = sessions.get(a.getUniqueId());
        if (b == null) return;
        if (b.paused || !b.alive.contains(a.getUniqueId())) {
            e.setCancelled(true);
            return;
        }
        if (e instanceof EntityDamageByEntityEvent hit) {
            Entity src = hit.getDamager();
            Player attacker = src instanceof Player pl ? pl : src instanceof Projectile pr && pr.getShooter() instanceof Player pl ? pl : src instanceof TNTPrimed tnt && tnt.getSource() instanceof Player pl ? pl : null;
            if (attacker != null && (sessions.get(attacker.getUniqueId()) != b || !b.alive.contains(attacker.getUniqueId()) || b.teams.get(attacker.getUniqueId()).equals(b.teams.get(a.getUniqueId())))) {
                e.setCancelled(true);
                return;
            }
        }
        if (e.isCancelled()) return;
        if (b.policy.kit.equals("boxing") && e instanceof EntityDamageByEntityEvent hit && hit.getDamager() instanceof Player attacker) {
            e.setDamage(.01);
            if (b.policy.hits.merge(a.getUniqueId(), 1, Integer::sum) >= 100) eliminate(a);
            return;
        }
        if (e.getFinalDamage() >= a.getHealth() && a.getInventory().getItemInMainHand().getType() != Material.TOTEM_OF_UNDYING && a.getInventory().getItemInOffHand().getType() != Material.TOTEM_OF_UNDYING) {
            e.setCancelled(true);
            eliminate(a);
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void move(PlayerMoveEvent e) {
        Battle b = sessions.get(e.getPlayer().getUniqueId());
        if (b == null || !e.hasChangedPosition()) return;
        if (b.paused || !BattleMaps.contains(p, b.policy.arena, e.getTo())) e.setTo(e.getFrom());
    }

    @EventHandler
    public void death(PlayerDeathEvent e) {
        Battle b = sessions.get(e.getEntity().getUniqueId());
        if (b != null) finish(b, "Member died");
    }

    void leave(Player a) {
        Battle b = sessions.get(a.getUniqueId());
        if (b != null) finish(b, a.getName() + " left the battle");
    }

    void finish(Battle b, String reason) {
        if (b.ended) return;
        b.ended = true;
        b.policy.ended = true;
        p.social.finishExtra("party:" + b.policy.a);
        message(b, reason + " (casual party match)");
        for (UUID id : b.teams.keySet()) {
            sessions.remove(id);
            p.frozen.remove(id);
            Player a = Bukkit.getPlayer(id);
            if (a != null && p.managed(a)) p.lobby(a);
        }
        try {
            p.terrain.clearEntities(b.policy.arena);
            p.terrain.reset(b.policy.arena);
            p.occupied.remove(b.policy.arena);
        } catch (Exception ex) {
            p.getLogger().severe(ex.getMessage());
        }
    }

    void close() {
        for (Battle b : new HashSet<>(sessions.values())) finish(b, "Server restart");
    }
}
