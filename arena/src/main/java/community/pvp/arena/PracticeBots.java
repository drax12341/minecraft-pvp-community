package community.pvp.arena;

import java.util.*;

import org.bukkit.*;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.entity.*;
import org.bukkit.inventory.ItemStack;
import org.bukkit.potion.*;

/**
 * Operator-only native living target. Bot sessions never enter ratings, quests or statistics.
 */
final class PracticeBots implements Listener {
    final CommunityArena p;
    final Map<UUID, Session> sessions = new HashMap<>();
    final Map<UUID, Session> byEntity = new HashMap<>();

    static final class Session {
        CommunityArena.Match policy;
        int map, remaining, initialTotems, target, won, lost, healing, eating, nextHeal, nextAttack;
        ItemStack[] equipment;
        boolean moving, paused;
        UUID entity;
        DuelRules rules;
        long started;
        int ticks, regenerationTicks, regenerationPulse, shownHealth = -1;
        final Set<org.bukkit.Chunk> tickets = new HashSet<>();
    }

    PracticeBots(CommunityArena p) {
        this.p = p;
        Bukkit.getPluginManager().registerEvents(this, p);
        Bukkit.getScheduler().runTaskTimer(p, this::tick, 2, 2);
    }

    void start(Player player, DuelMenus.Draft draft) {
        if (!player.isOp() || p.busy(player) || !p.ready || !p.data.getBoolean("built-battle-maps-v5")) return;
        var map = BattleMaps.get(BattleMaps.available(p, draft.map, draft.kit));
        if (map == null || !map.supports(draft.kit) || p.occupied.contains(map.id())) {
            p.tell(player, "Map busy; choose another.");
            return;
        }
        if (!p.managed(player)) p.enter(player);
        if (!p.managed(player)) return;
        p.queues.remove(player.getUniqueId());
        p.ffa.remove(player.getUniqueId());
        p.occupied.add(map.id());
        Session s = new Session();
        s.map = map.id();
        s.remaining = draft.totems;
        s.initialTotems = draft.totems;
        s.target = draft.rounds;
        s.moving = draft.moving;
        s.rules = draft.rules();
        s.policy = p.new Match(player, player, draft.kit, map.id(), 1);
        s.policy.customEquipment = draft.custom == null ? null : SavedKits.copy(draft.custom);
        s.policy.rules = s.rules;
        s.policy.paused = false;
        s.started = System.currentTimeMillis();
        try {
            p.terrain.clearEntities(s.map);
            p.terrain.reset(s.map);
        } catch (Exception ex) {
            p.getLogger().severe(ex.getMessage());
            p.tell(player, "Map recovery failed; arena remains reserved.");
            return;
        }
        try {
            if (s.policy.customEquipment == null) p.equip(player, draft.kit);
            else p.savedKits.equip(player, s.policy.customEquipment);
            s.equipment = SavedKits.copy(player.getInventory().getContents());
            s.healing = BotCombat.healing(s.equipment);
            Zombie bot = spawn(s);
            s.entity = bot.getUniqueId();
            pin(s, bot.getLocation());
            register(player.getUniqueId(), s);
            player.closeInventory();
            player.teleport(BattleMaps.spawn(p, s.map, true));
            countdown(player, s);
            p.tell(player, "Bot duel started. Totems: " + s.remaining + ". /leave to finish. No records awarded.");
        } catch (Exception ex) {
            if (s.entity != null) {
                Entity entity = Bukkit.getEntity(s.entity);
                if (entity != null) entity.remove();
            }
            sessions.remove(player.getUniqueId());
            byEntity.remove(s.entity);
            p.occupied.remove(map.id());
            unpin(s);
            p.lobby(player);
            p.getLogger().severe("Bot start failed: " + ex.getMessage());
        }
    }

    void countdown(Player player, Session s) {
        s.paused = true;
        s.policy.paused = true;
        if (Bukkit.getEntity(s.entity) instanceof Zombie bot) bot.setAI(false);
        p.frozen.add(player.getUniqueId());
        p.gates.prepare(s.map);
        p.countdown.start(List.of(player), new HashSet<>(),
                () -> sessions.get(player.getUniqueId()) == s && s.paused, () -> {
                    s.paused = false;
                    s.policy.paused = false;
                    if (Bukkit.getEntity(s.entity) instanceof Zombie bot) bot.setAI(s.moving);
                    RoundEffects.go(p, player);
                    p.tell(player, "GO!");
                }, s.moving ? "Bot duel | " + s.won + " : " + s.lost : "Practice target");

    }

    void register(UUID owner, Session s) {
        sessions.put(owner, s);
        byEntity.put(s.entity, s);
    }

    Zombie spawn(Session s) {
        return p.world.spawn(BattleMaps.spawn(p, s.map, false), Zombie.class, b -> {
            b.setAI(s.moving);
            Bukkit.getMobGoals().removeAllGoals(b);
            b.setSilent(true);
            b.setAdult();
            b.setPersistent(false);
            b.setRemoveWhenFarAway(false);
            b.setShouldBurnInDay(false);
            b.setCanPickupItems(false);
            b.setCanBreakDoors(false);
            b.customName(PracticePresentation.ui("§bPractice Opponent"));
            b.setCustomNameVisible(true);
            BotCombat.equip(b, s.equipment);
            b.getEquipment().setItemInOffHand(new ItemStack(s.remaining > 0 ? Material.TOTEM_OF_UNDYING : Material.AIR));
        });
    }

    Session session(Entity e) {
        return byEntity.get(e.getUniqueId());
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void damage(EntityDamageEvent e) {
        Session s = session(e.getEntity());
        if (s == null) return;
        if (s.paused) {
            e.setCancelled(true);
            return;
        }
        if (e instanceof EntityDamageByEntityEvent hit) {
            Entity source = hit.getDamager();
            UUID id = source instanceof LivingEntity a ? a.getUniqueId() : source instanceof Projectile pr && pr.getShooter() instanceof LivingEntity a ? a.getUniqueId() : null;
            if (id != null && sessions.get(id) != s) {
                e.setCancelled(true);
                return;
            }
        }
        if (e.getEntity() instanceof LivingEntity living && e.getFinalDamage() >= living.getHealth() && s.remaining > 0) {
            e.setCancelled(true);
            s.remaining--;
            living.setHealth(1);
            s.regenerationTicks = 900;
            s.regenerationPulse = 0;
            living.addPotionEffect(new PotionEffect(PotionEffectType.ABSORPTION, 100, 1));
            living.setFireTicks(0);
            living.addPotionEffect(new PotionEffect(PotionEffectType.REGENERATION, 900, 1));
            living.getEquipment().setItemInOffHand(new ItemStack(s.remaining > 0 ? Material.TOTEM_OF_UNDYING : Material.AIR));
            living.getWorld().playSound(living.getLocation(), Sound.ITEM_TOTEM_USE, 1, 1);
            living.getWorld().spawnParticle(Particle.TOTEM_OF_UNDYING, living.getLocation().add(0, 1, 0), 40, .4, .8, .4, .2);
        }
    }

    @EventHandler
    public void death(EntityDeathEvent e) {
        Session s = session(e.getEntity());
        if (s == null) return;
        e.getDrops().clear();
        e.setDroppedExp(0);
        Player owner = Bukkit.getPlayer(s.policy.a);
        if (owner != null) roundEnd(owner, s, true);
    }

    void lost(Player owner) {
        Session s = sessions.get(owner.getUniqueId());
        if (s != null && !s.paused) roundEnd(owner, s, false);
    }

    void roundEnd(Player owner, Session s, boolean win) {
        if (s.paused) return;
        s.paused = true;
        s.policy.paused = true;
        if (Bukkit.getEntity(s.entity) instanceof Zombie bot) {
            bot.getPathfinder().stopPathfinding();
            bot.setAI(false);
        }
        if (win) s.won++; else s.lost++;
        s.policy.sa = s.won;
        s.policy.sb = s.lost;
        p.frozen.add(owner.getUniqueId());
        p.tell(owner, (win ? "Round won" : "Bot won the round") + " | " + s.won + " : " + s.lost + " | First to " + s.target);
        Bukkit.getScheduler().runTaskLater(p, () -> {
            if (sessions.get(owner.getUniqueId()) != s) return;
            if (Math.max(s.won, s.lost) >= s.target) { stop(owner); return; }
            try {
                byEntity.remove(s.entity);
                p.terrain.clearEntities(s.map);
                p.terrain.reset(s.map);
                if (s.policy.customEquipment == null) p.equip(owner, s.policy.kit);
                else p.savedKits.equip(owner, s.policy.customEquipment);
                s.equipment = SavedKits.copy(owner.getInventory().getContents());
                s.healing = BotCombat.healing(s.equipment);
                s.eating = s.nextHeal = s.nextAttack = s.ticks = s.regenerationTicks = s.regenerationPulse = 0;
                s.remaining = s.initialTotems;
                var next = spawn(s);
                s.entity = next.getUniqueId();
                byEntity.put(s.entity, s);
                pin(s, next.getLocation());
                owner.teleport(BattleMaps.spawn(p, s.map, true));
                countdown(owner, s);
            } catch (Exception ex) {
                p.getLogger().severe(ex.getMessage());
                stop(owner);
            }
        }, 40);
    }

    void tick() {
        for (var entry : new ArrayList<>(sessions.entrySet())) {
            Player player = Bukkit.getPlayer(entry.getKey());
            Session s = entry.getValue();
            Entity bot = s.entity == null ? null : Bukkit.getEntity(s.entity);
            if (player == null || !player.isOnline() || !player.isOp() || System.currentTimeMillis() - s.started > 600000) {
                if (player != null) stop(player); else release(entry.getKey(), s);
                continue;
            }
            if (s.paused) continue;
            if (!(bot instanceof Zombie opponent) || !bot.isValid()) { stop(player); continue; }
            if (!BattleMaps.contains(p, s.map, bot.getLocation()) || bot.getY() < 93) {
                bot.teleport(BattleMaps.spawn(p, s.map, false));
                bot.setFallDistance(0);
            }
            s.ticks += 2;
            pin(s, bot.getLocation());
            BotCombat.tick(player, opponent, s);
            if (s.ticks % 10 == 0) {
                int health = (int) Math.ceil(opponent.getHealth() + opponent.getAbsorptionAmount());
                if (health != s.shownHealth) {
                    s.shownHealth = health;
                    opponent.customName(PracticePresentation.ui("\u00a7bPractice Opponent \u00a77| \u00a7c" + health + " HP"));
                }
            }
            if (s.ticks % 20 == 0)
                player.sendActionBar(PracticePresentation.ui("§bBot duel §8| §f" + s.won + " : " + s.lost + " | Totems " + s.remaining + " §8| §7/leave"));
        }
    }

    void release(UUID id, Session s) {
        p.frozen.remove(id);
        p.social.finishExtra("bot:" + id);
        sessions.remove(id);
        byEntity.remove(s.entity);
        Entity bot = s.entity == null ? null : Bukkit.getEntity(s.entity);
        if (bot != null) bot.remove();
        unpin(s);
        try {
            p.terrain.clearEntities(s.map);
            p.terrain.reset(s.map);
            p.occupied.remove(s.map);
        } catch (Exception ex) {
            p.getLogger().severe(ex.getMessage());
        }
    }

    void stop(Player player) {
        Session s = sessions.get(player.getUniqueId());
        if (s == null) return;
        release(player.getUniqueId(), s);
        if (p.managed(player)) p.lobby(player);
    }

    void close() {
        for (var e : new HashMap<>(sessions).entrySet()) release(e.getKey(), e.getValue());
    }

    void pin(Session s, Location location) {
        var chunk = location.getChunk();
        if (s.tickets.contains(chunk)) return;
        chunk.addPluginChunkTicket(p);
        for (var old : s.tickets) old.removePluginChunkTicket(p);
        s.tickets.clear();
        s.tickets.add(chunk);
    }

    void unpin(Session s) {
        for (var chunk : s.tickets) chunk.removePluginChunkTicket(p);
        s.tickets.clear();
    }
}
