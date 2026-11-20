package community.pvp.arena;

import org.bukkit.*;
import org.bukkit.entity.Player;
import org.bukkit.event.*;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.*;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.potion.*;

/**
 * UHC head items are consumables, never decorative blocks or unrestricted food.
 */
final class GoldenHeads implements Listener {
    static final NamespacedKey KEY = new NamespacedKey("communityarena", "golden-head");
    final CommunityArena p;

    GoldenHeads(CommunityArena p) {
        this.p = p;
        Bukkit.getPluginManager().registerEvents(this, p);
    }

    CommunityArena.Match policy(Player a) {
        var match = p.matches.get(a.getUniqueId());
        var bot = p.bots.sessions.get(a.getUniqueId());
        var party = p.partyBattles.sessions.get(a.getUniqueId());
        if (match == null && bot != null) match = bot.policy;
        if (match == null && party != null && party.alive.contains(a.getUniqueId())) match = party.policy;
        return match;
    }

    @EventHandler(ignoreCancelled = true)
    public void regen(org.bukkit.event.entity.EntityRegainHealthEvent e) {
        if (!(e.getEntity() instanceof Player a) || e.getRegainReason() != org.bukkit.event.entity.EntityRegainHealthEvent.RegainReason.SATIATED)
            return;
        var match = policy(a);
        if (match != null && match.kit.equals("uhc") && !match.ended) e.setCancelled(true);
    }

    static ItemStack item() {
        var item = new ItemStack(Material.PLAYER_HEAD, 2);
        item.editMeta(m -> {
            m.displayName(PracticePresentation.ui("§6Golden Head"));
            m.getPersistentDataContainer().set(KEY, PersistentDataType.BYTE, (byte) 1);
            m.lore(java.util.List.of(PracticePresentation.ui("§7Right-click during UHC to consume")));
        });
        return item;
    }

    @EventHandler(priority = EventPriority.HIGH)
    public void use(PlayerInteractEvent e) {
        var item = e.getItem();
        if (item == null || !item.hasItemMeta() || !item.getItemMeta().getPersistentDataContainer().has(KEY, PersistentDataType.BYTE) || !e.getAction().isRightClick())
            return;
        e.setCancelled(true);
        Player a = e.getPlayer();
        var match = policy(a);
        if (match == null || !match.kit.equals("uhc") || match.paused || match.ended || a.hasCooldown(Material.PLAYER_HEAD))
            return;
        if (e.getHand() == null) return;
        item.setAmount(item.getAmount() - 1);
        a.getInventory().setItem(e.getHand(), item);
        a.setCooldown(Material.PLAYER_HEAD, 20);
        a.addPotionEffect(new PotionEffect(PotionEffectType.REGENERATION, 100, 2));
        a.addPotionEffect(new PotionEffect(PotionEffectType.ABSORPTION, 2400, 0));
        a.setFoodLevel(20);
        a.playSound(a.getLocation(), Sound.ENTITY_GENERIC_EAT, 1, 1);
    }
}
