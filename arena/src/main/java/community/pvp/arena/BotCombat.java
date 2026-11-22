package community.pvp.arena;

import org.bukkit.*;
import org.bukkit.entity.*;
import org.bukkit.inventory.*;
import org.bukkit.potion.*;

/** Bounded native melee AI: pathfinding and ordinary damage events, never teleport pursuit. */
final class BotCombat {
    static int cooldown(Material weapon) {
        if (weapon.name().endsWith("_AXE")) return 20;
        if (weapon == Material.MACE) return 34;
        if (weapon.name().endsWith("_SPEAR")) return 20;
        return 13;
    }

    static boolean inReach(Location a, Location b) {
        return a.getWorld().equals(b.getWorld()) && a.distanceSquared(b) <= 9;
    }

    static ItemStack weapon(ItemStack[] items) {
        for (var item : items)
            if (item != null && item.getType().name().endsWith("_SWORD")) return item.clone();
        for (var item : items)
            if (item != null && (item.getType() == Material.MACE || item.getType().name().endsWith("_AXE"))) return item.clone();
        return new ItemStack(Material.AIR);
    }

    static int healing(ItemStack[] items) {
        int count = 0;
        for (var item : items) if (item != null && item.getType() == Material.GOLDEN_APPLE) count += item.getAmount();
        return Math.min(16, count);
    }

    static void equip(Zombie bot, ItemStack[] kit) {
        var eq = bot.getEquipment();
        eq.setArmorContents(new ItemStack[]{copy(kit[36]), copy(kit[37]), copy(kit[38]), copy(kit[39])});
        eq.setItemInMainHand(weapon(kit));
        eq.setItemInOffHand(new ItemStack(Material.AIR));
        for (var slot : new EquipmentSlot[]{EquipmentSlot.HAND, EquipmentSlot.OFF_HAND, EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET})
            eq.setDropChance(slot, 0);
        bot.getAttribute(org.bukkit.attribute.Attribute.ATTACK_DAMAGE).setBaseValue(1);
        bot.getAttribute(org.bukkit.attribute.Attribute.ARMOR).setBaseValue(0);
        bot.getAttribute(org.bukkit.attribute.Attribute.MOVEMENT_SPEED).setBaseValue(.28);
    }

    static ItemStack copy(ItemStack item) { return item == null ? new ItemStack(Material.AIR) : item.clone(); }

    static void tick(LivingEntity player, Zombie bot, PracticeBots.Session s) {
        // The visible training mob is undead; reproduce finite food/totem regeneration explicitly.
        if (s.regenerationTicks > 0) {
            s.regenerationTicks -= 2;
            s.regenerationPulse += 2;
            if (s.regenerationPulse >= 25) {
                s.regenerationPulse -= 25;
                if (bot.getHealth() < bot.getMaxHealth()) bot.heal(1);
            }
        }
        if (!s.moving) return;
        if (s.ticks % 10 == 0) {
            var destination = player.getLocation().clone();
            if (bot.getLocation().distanceSquared(destination) < 25) {
                var toward = destination.toVector().subtract(bot.getLocation().toVector()).setY(0);
                if (toward.lengthSquared() > .01) {
                    toward.normalize();
                    double strafe = s.ticks % 80 < 40 ? 1.4 : -1.4;
                    destination.add(-toward.getZ() * strafe, 0, toward.getX() * strafe);
                }
            }
            bot.getPathfinder().moveTo(destination, 1.15);
        }
        var direction = player.getEyeLocation().toVector().subtract(bot.getEyeLocation().toVector());
        var look = bot.getLocation().setDirection(direction);
        bot.setRotation(look.getYaw(), look.getPitch());
        if (s.eating > 0) {
            s.eating -= 2;
            if (s.eating <= 0) {
                bot.clearActiveItem();
                s.healing--;
                s.regenerationTicks = 100;
                s.regenerationPulse = 0;
                bot.addPotionEffect(new PotionEffect(PotionEffectType.REGENERATION, 100, 1));
                bot.addPotionEffect(new PotionEffect(PotionEffectType.ABSORPTION, 2400, 0));
                bot.getEquipment().setItemInMainHand(weapon(s.equipment));
            }
            return;
        }
        boolean shield = s.equipment[40] != null && s.equipment[40].getType() == Material.SHIELD;
        if (shield && s.ticks % 40 < 12 && inReach(bot.getLocation(), player.getLocation())) {
            if (bot.getEquipment().getItemInOffHand().getType() != Material.SHIELD)
                bot.getEquipment().setItemInOffHand(new ItemStack(Material.SHIELD));
            if (!bot.hasActiveItem()) bot.startUsingItem(EquipmentSlot.OFF_HAND);
            return;
        }
        if (bot.hasActiveItem()) bot.clearActiveItem();
        Material offhand = s.remaining > 0 ? Material.TOTEM_OF_UNDYING : Material.AIR;
        if (bot.getEquipment().getItemInOffHand().getType() != offhand)
            bot.getEquipment().setItemInOffHand(new ItemStack(offhand));
        if (bot.getHealth() < 8 && s.healing > 0 && s.ticks >= s.nextHeal) {
            s.eating = 32;
            s.nextHeal = s.ticks + 160;
            bot.getEquipment().setItemInMainHand(new ItemStack(Material.GOLDEN_APPLE));
            bot.startUsingItem(EquipmentSlot.HAND);
            return;
        }
        if (s.ticks >= s.nextAttack && inReach(bot.getLocation(), player.getLocation()) && bot.hasLineOfSight(player)) {
            s.nextAttack = s.ticks + cooldown(bot.getEquipment().getItemInMainHand().getType());
            bot.swingMainHand();
            bot.attack(player);
        }
    }
}
