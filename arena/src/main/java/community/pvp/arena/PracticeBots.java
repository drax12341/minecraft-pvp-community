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

    static final class Session {
        CommunityArena.Match policy;
        int map, remaining, initialTotems, target, won;
        boolean moving, paused;
        UUID entity;
        DuelRules rules;
        long started;
        int ticks;
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
            Zombie bot = spawn(s);
            s.entity = bot.getUniqueId();
            sessions.put(player.getUniqueId(), s);
            player.closeInventory();
            player.teleport(BattleMaps.spawn(p, s.map, true));
            countdown(player, s);
            p.tell(player, "Bot practice started. Totems: " + s.remaining + ". /leave to finish. No records awarded.");
        } catch (Exception ex) {
            if (s.entity != null) {
                Entity entity = Bukkit.getEntity(s.entity);
                if (entity != null) entity.remove();
            }
            sessions.remove(player.getUniqueId());
            p.occupied.remove(map.id());
            p.lobby(player);
            p.getLogger().severe("Bot start failed: " + ex.getMessage());
        }
    }

    void countdown(Player player, Session s) {
        if (!ImportedBuilds.is(s.map)) return;
        s.paused = true;
        s.policy.paused = true;
        p.frozen.add(player.getUniqueId());
        p.gates.close(s.map);
        for (int second = 0; second < 3; second++) {
            int left = 3 - second;
            Bukkit.getScheduler().runTaskLater(p, () -> {
                if (sessions.get(player.getUniqueId()) == s) p.tell(player, "Starting in " + left + "...");
            }, second * 20L);
        }
        Bukkit.getScheduler().runTaskLater(p, () -> {
            if (sessions.get(player.getUniqueId()) != s) return;
            s.paused = false;
            s.policy.paused = false;
            p.frozen.remove(player.getUniqueId());
            p.gates.open(s.map);
            p.tell(player, "GO!");
        }, 60);
    }

    Zombie spawn(Session s) {
        return p.world.spawn(BattleMaps.spawn(p, s.map, false), Zombie.class, b -> {
            b.setAI(false);
            b.setSilent(true);
            b.setAdult();
            b.setPersistent(false);
            b.setRemoveWhenFarAway(false);
            b.setShouldBurnInDay(false);
            b.setCanPickupItems(false);
            b.customName(PracticePresentation.ui("§bPractice Bot"));
            b.setCustomNameVisible(true);
            var eq = b.getEquipment();
            eq.setHelmet(new ItemStack(Material.DIAMOND_HELMET));
            eq.setChestplate(new ItemStack(Material.DIAMOND_CHESTPLATE));
            eq.setLeggings(new ItemStack(Material.DIAMOND_LEGGINGS));
            eq.setBoots(new ItemStack(Material.DIAMOND_BOOTS));
            eq.setItemInMainHand(new ItemStack(Material.DIAMOND_SWORD));
            eq.setItemInOffHand(new ItemStack(s.remaining > 0 ? Material.TOTEM_OF_UNDYING : Material.AIR));
        });
    }

    Session session(Entity e) {
        for (var s : sessions.values()) if (e.getUniqueId().equals(s.entity)) return s;
        return null;
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
            UUID id = source instanceof Player a ? a.getUniqueId() : source instanceof Projectile pr && pr.getShooter() instanceof Player a ? a.getUniqueId() : null;
            if (id != null && sessions.get(id) != s) {
                e.setCancelled(true);
                return;
            }
        }
        if (e.getEntity() instanceof LivingEntity living && e.getFinalDamage() >= living.getHealth() && s.remaining > 0) {
            e.setCancelled(true);
            s.remaining--;
            living.setHealth(living.getMaxHealth());
            living.setFireTicks(0);
            living.addPotionEffect(new PotionEffect(PotionEffectType.REGENERATION, 100, 1));
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
        if (s.rules.loot()) {
            var eq = e.getEntity().getEquipment();
            for (var item : eq.getArmorContents()) if (item != null) e.getDrops().add(item.clone());
            if (eq.getItemInMainHand().getType() != Material.AIR) e.getDrops().add(eq.getItemInMainHand().clone());
        }
        for (var entry : new HashMap<>(sessions).entrySet())
            if (entry.getValue().entity.equals(e.getEntity().getUniqueId())) {
                Player owner = Bukkit.getPlayer(entry.getKey());
                if (owner != null) {
                    s.won++;
                    p.tell(owner, "Bot defeated. Round " + s.won + "/" + s.target);
                    if (s.won >= s.target) {
                        s.paused = true;
                        Bukkit.getScheduler().runTaskLater(p, () -> {
                            if (sessions.get(owner.getUniqueId()) == s) stop(owner);
                        }, 40);
                    } else {
                        s.paused = true;
                        Bukkit.getScheduler().runTaskLater(p, () -> {
                            if (sessions.get(owner.getUniqueId()) != s) return;
                            try {
                                p.terrain.clearEntities(s.map);
                                p.terrain.reset(s.map);
                                s.remaining = s.initialTotems;
                                s.entity = spawn(s).getUniqueId();
                                s.paused = false;
                                countdown(owner, s);
                                if (s.policy.customEquipment == null) p.equip(owner, s.policy.kit);
                                else p.savedKits.equip(owner, s.policy.customEquipment);
                                owner.teleport(BattleMaps.spawn(p, s.map, true));
                            } catch (Exception ex) {
                                p.getLogger().severe(ex.getMessage());
                                stop(owner);
                            }
                        }, 40);
                    }
                }
                break;
            }
    }

    void tick() {
        for (var entry : new HashMap<>(sessions).entrySet()) {
            Player player = Bukkit.getPlayer(entry.getKey());
            Session s = entry.getValue();
            if (s.paused) continue;
            Entity bot = Bukkit.getEntity(s.entity);
            if (player == null || !player.isOnline() || !player.isOp() || bot == null || !bot.isValid() || System.currentTimeMillis() - s.started > 600000) {
                if (player != null) stop(player);
                else release(entry.getKey(), s);
                continue;
            }
            if (!BattleMaps.contains(p, s.map, bot.getLocation())) bot.teleport(BattleMaps.spawn(p, s.map, false));
            if (s.moving) {
                s.ticks += 2;
                var origin = motionLocation(p, s.map, s.ticks);
                bot.teleport(origin);
            }
            player.sendActionBar(PracticePresentation.ui("§bBot practice §8| §fTotems: " + s.remaining + " §8| §7/leave"));
        }
    }

    static Location motionLocation(CommunityArena p, int map, int ticks) {
        var origin = BattleMaps.spawn(p, map, false);
        if (ImportedBuilds.is(map)) return p.gates.exit(map, origin).add(0, 0, Math.sin(ticks * .055) * 5);
        boolean compact = BattleMaps.get(map).size() == 0;
        origin.add(Math.sin(ticks * .055) * (compact ? 3 : 7), 0,
                Math.cos(ticks * .055) * (compact ? 3 : 5));
        origin.setYaw((float) (ticks * 3));
        return origin;
    }

    void release(UUID id, Session s) {
        p.frozen.remove(id);
        p.social.finishExtra("bot:" + id);
        sessions.remove(id);
        Entity bot = Bukkit.getEntity(s.entity);
        if (bot != null) bot.remove();
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
}
