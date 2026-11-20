package community.pvp.arena;

import java.util.*;
import org.bukkit.*;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.Player;
import org.bukkit.inventory.*;
import org.bukkit.inventory.meta.*;
import org.bukkit.potion.*;

final class Loadouts {
  static String name(String kit) {
    return switch (kit) {
      case "nethop" -> "Netherite Pot";
      case "pot" -> "Diamond Pot";
      case "uhc" -> "UHC";
      case "smp" -> "SMP";
      case "diasmp" -> "Diamond SMP";
      case "crystal" -> "Crystal";
      case "mace_breach" -> "Mace Breach";
      case "mace_density" -> "Mace Density";
      case "mace_spear" -> "Mace + Spear";
      default -> Character.toUpperCase(kit.charAt(0)) + kit.substring(1);
    };
  }

  static Material icon(String k) {
    return switch (k) {
      case "crystal" -> Material.END_CRYSTAL;
      case "axe" -> Material.DIAMOND_AXE;
      case "uhc" -> Material.GOLDEN_APPLE;
      case "smp" -> Material.NETHERITE_SWORD;
      case "nethop" -> Material.NETHERITE_CHESTPLATE;
      case "pot" -> Material.SPLASH_POTION;
      case "bow" -> Material.BOW;
      case "boxing" -> Material.LEATHER_CHESTPLATE;
      default -> k.startsWith("mace") ? Material.MACE : Material.DIAMOND_SWORD;
    };
  }

  static boolean building(String kit) {
    return Set.of("crystal", "uhc", "smp", "diasmp", "custom").contains(kit);
  }

  static ItemStack enchanted(Material type, Enchantment enchant, int level) {
    ItemStack item = new ItemStack(type);
    if (level > 0) item.addUnsafeEnchantment(enchant, level);
    return item;
  }

  static ItemStack potion(PotionType type, boolean splash) {
    ItemStack item = new ItemStack(splash ? Material.SPLASH_POTION : Material.POTION);
    PotionMeta meta = (PotionMeta) item.getItemMeta();
    meta.setBasePotionType(type);
    item.setItemMeta(meta);
    return item;
  }

  static void stack(PlayerInventory inv, int slot, Material mat, int count) {
    inv.setItem(slot, new ItemStack(mat, count));
  }

  static void armor(PlayerInventory inv, boolean nether, int protection) {
    String metal = nether ? "NETHERITE" : "DIAMOND";
    Material[] types = {
      Material.valueOf(metal + "_BOOTS"),
      Material.valueOf(metal + "_LEGGINGS"),
      Material.valueOf(metal + "_CHESTPLATE"),
      Material.valueOf(metal + "_HELMET")
    };
    ItemStack[] armor = new ItemStack[4];
    for (int i = 0; i < 4; i++) {
      armor[i] = enchanted(types[i], Enchantment.PROTECTION, protection);
      armor[i].addUnsafeEnchantment(Enchantment.UNBREAKING, 3);
      armor[i].addUnsafeEnchantment(Enchantment.MENDING, 1);
    }
    armor[0].addUnsafeEnchantment(Enchantment.FEATHER_FALLING, 4);
    inv.setArmorContents(armor);
  }

  static void equip(CommunityArena p, Player player, String kit) {
    p.clean(player);
    var inv = player.getInventory();
    boolean nether = Set.of("crystal", "smp", "nethop").contains(kit);
    armor(inv, nether, nether ? 4 : 2);
    Material sword = nether ? Material.NETHERITE_SWORD : Material.DIAMOND_SWORD;
    inv.setItem(0, enchanted(sword, Enchantment.SHARPNESS, nether ? 5 : 3));
    switch (kit) {
      case "sword" -> {
        /* Reference sword is intentionally a clean sword-only hotbar. */
      }
      case "boxing" -> {
        inv.clear();
        player.addPotionEffect(new PotionEffect(PotionEffectType.SPEED, 20 * 1200, 1));
      }
      case "axe" -> {
        inv.setItem(0, new ItemStack(Material.CROSSBOW));
        inv.setItem(1, new ItemStack(Material.DIAMOND_SWORD));
        inv.setItem(2, new ItemStack(Material.DIAMOND_AXE));
        inv.setItem(3, new ItemStack(Material.BOW));
        stack(inv, 8, Material.ARROW, 6);
        inv.setItemInOffHand(new ItemStack(Material.SHIELD));
        armor(inv, false, 0);
      }
      case "uhc" -> {
        stack(inv, 0, Material.WATER_BUCKET, 1);
        inv.setItem(1, enchanted(Material.DIAMOND_AXE, Enchantment.SHARPNESS, 3));
        inv.setItem(2, enchanted(Material.DIAMOND_SWORD, Enchantment.SHARPNESS, 3));
        stack(inv, 4, Material.GOLDEN_APPLE, 8);
        stack(inv, 5, Material.COBWEB, 16);
        stack(inv, 6, Material.LAVA_BUCKET, 1);
        stack(inv, 7, Material.OAK_PLANKS, 64);
        inv.setItem(8, new ItemStack(Material.CROSSBOW));
        stack(inv, 9, Material.ARROW, 16);
        inv.setItemInOffHand(new ItemStack(Material.SHIELD));
      }
      case "crystal" -> {
        stack(inv, 0, Material.OBSIDIAN, 64);
        stack(inv, 1, Material.END_CRYSTAL, 64);
        inv.setItem(2, enchanted(sword, Enchantment.SHARPNESS, 5));
        stack(inv, 3, Material.ENDER_PEARL, 16);
        stack(inv, 4, Material.GOLDEN_APPLE, 64);
        stack(inv, 5, Material.TOTEM_OF_UNDYING, 1);
        stack(inv, 6, Material.RESPAWN_ANCHOR, 64);
        stack(inv, 7, Material.GLOWSTONE, 64);
        inv.setItem(8, new ItemStack(Material.CROSSBOW));
        for (int i = 9; i < 16; i++) stack(inv, i, Material.ENDER_PEARL, 16);
        for (int i = 16; i < 32; i++) stack(inv, i, Material.TOTEM_OF_UNDYING, 1);
        ItemStack arrows = new ItemStack(Material.TIPPED_ARROW, 64);
        PotionMeta arrowMeta = (PotionMeta) arrows.getItemMeta();
        arrowMeta.addCustomEffect(new PotionEffect(PotionEffectType.SLOW_FALLING, 600, 0), true);
        arrows.setItemMeta(arrowMeta);
        inv.setItem(15, arrows);
        ItemStack crossbow = enchanted(Material.CROSSBOW, Enchantment.QUICK_CHARGE, 3);
        crossbow.addUnsafeEnchantment(Enchantment.PIERCING, 4);
        inv.setItem(8, crossbow);
        inv.getLeggings().removeEnchantment(Enchantment.PROTECTION);
        inv.getLeggings().addUnsafeEnchantment(Enchantment.BLAST_PROTECTION, 4);
        inv.setItem(32, enchanted(Material.NETHERITE_PICKAXE, Enchantment.EFFICIENCY, 5));
        inv.setItem(33, enchanted(Material.NETHERITE_AXE, Enchantment.SHARPNESS, 5));
        stack(inv, 34, Material.EXPERIENCE_BOTTLE, 64);
        stack(inv, 35, Material.GOLDEN_CARROT, 64);
        inv.setItemInOffHand(new ItemStack(Material.TOTEM_OF_UNDYING));
        player.addPotionEffect(new PotionEffect(PotionEffectType.FIRE_RESISTANCE, 20 * 1200, 0));
      }
      case "smp", "diasmp" -> {
        inv.setItem(0, enchanted(sword, Enchantment.SHARPNESS, 5));
        inv.setItem(
            1,
            enchanted(
                nether ? Material.NETHERITE_AXE : Material.DIAMOND_AXE, Enchantment.SHARPNESS, 5));
        inv.setItem(2, enchanted(sword, Enchantment.FIRE_ASPECT, 2));
        stack(inv, 3, Material.ENDER_PEARL, 16);
        stack(inv, 4, Material.GOLDEN_APPLE, 32);
        stack(inv, 5, Material.TOTEM_OF_UNDYING, 1);
        inv.setItem(6, potion(PotionType.LONG_FIRE_RESISTANCE, false));
        inv.setItem(7, potion(PotionType.STRONG_SWIFTNESS, false));
        inv.setItem(8, potion(PotionType.STRONG_STRENGTH, false));
        stack(inv, 9, Material.OAK_PLANKS, 64);
        stack(inv, 10, Material.COBWEB, 16);
        stack(inv, 11, Material.WATER_BUCKET, 1);
        for (int i = 12; i < 18; i++) stack(inv, i, Material.TOTEM_OF_UNDYING, 1);
        stack(inv, 18, Material.COOKED_BEEF, 64);
        inv.setItemInOffHand(new ItemStack(Material.SHIELD));
      }
      case "pot", "nethop" -> {
        inv.setItem(0, enchanted(sword, Enchantment.SHARPNESS, nether ? 5 : 3));
        stack(inv, 1, Material.ENDER_PEARL, 16);
        stack(inv, 8, nether ? Material.GOLDEN_APPLE : Material.COOKED_BEEF, 64);
        for (int i = 2; i < 36; i++)
          if (i != 8) inv.setItem(i, potion(PotionType.STRONG_HEALING, true));
        inv.setItem(7, potion(PotionType.STRONG_SWIFTNESS, false));
        if (nether) {
          inv.setItem(6, potion(PotionType.STRONG_STRENGTH, false));
          inv.setItemInOffHand(new ItemStack(Material.TOTEM_OF_UNDYING));
        }
        player.addPotionEffect(new PotionEffect(PotionEffectType.FIRE_RESISTANCE, 20 * 1200, 0));
        player.addPotionEffect(new PotionEffect(PotionEffectType.SPEED, 20 * 1200, 1));
      }
      case "bow" -> {
        inv.setItem(1, enchanted(Material.BOW, Enchantment.POWER, 3));
        stack(inv, 2, Material.ARROW, 64);
        stack(inv, 3, Material.GOLDEN_APPLE, 4);
      }
      default -> {
        if (kit.startsWith("mace")) {
          inv.setItem(
              0,
              enchanted(
                  Material.MACE,
                  kit.equals("mace_breach") ? Enchantment.BREACH : Enchantment.DENSITY,
                  kit.equals("mace_breach") ? 4 : 5));
          stack(inv, 1, sword, 1);
          stack(inv, 2, Material.WIND_CHARGE, 64);
          stack(inv, 3, Material.GOLDEN_APPLE, 8);
          if (kit.equals("mace_spear")) {
            Material spear = Material.matchMaterial("DIAMOND_SPEAR");
            if (spear != null) stack(inv, 4, spear, 1);
          }
        }
      }
    }
    if (p.data.contains("kits." + kit))
      inv.setContents(p.data.getList("kits." + kit, List.of()).toArray(new ItemStack[0]));
    if (building(kit)) player.setGameMode(GameMode.SURVIVAL);
    if (p.layouts != null) p.layouts.apply(player, kit);
  }
}
