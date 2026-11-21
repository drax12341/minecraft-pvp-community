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
            case "diasmp" -> Material.DIAMOND_CHESTPLATE;
            case "mace" -> Material.MACE;
            case "mace_breach" -> Material.ANVIL;
            case "mace_density" -> Material.HEAVY_CORE;
            case "mace_spear" -> {
                Material spear = Material.matchMaterial("DIAMOND_SPEAR");
                yield spear == null ? Material.TRIDENT : spear;
            }
            case "custom" -> Material.PURPLE_SHULKER_BOX;
            default -> Material.DIAMOND_SWORD;
        };
    }

    static String style(String kit) {
        return switch (kit) {
            case "sword" -> "Precision | Sword fundamentals";
            case "axe" -> "Shieldbreak | Axe and crossbow";
            case "crystal" -> "Detonate | Crystals and anchors";
            case "uhc" -> "Survival | Buckets, webs and healing";
            case "smp" -> "Endurance | Netherite survival";
            case "diasmp" -> "Classic | Diamond survival";
            case "pot" -> "Refill | Diamond potion combat";
            case "nethop" -> "Overdrive | Netherite potion combat";
            case "bow" -> "Deadeye | Ranged precision";
            case "boxing" -> "Combo | Speed and 100 hits";
            case "mace" -> "Impact | Mace fundamentals";
            case "mace_breach" -> "Breach | Armor pressure";
            case "mace_density" -> "Density | Heavy aerial strikes";
            case "mace_spear" -> "Reach | Mace and spear";
            default -> "Custom | Your saved equipment";
        };
    }

    static ItemStack menuIcon(
            CommunityArena p, String kit, String name, String action, String... lore) {
        List<String> lines = new ArrayList<>();
        lines.add(style(kit));
        lines.add("");
        lines.addAll(Arrays.asList(lore));
        ItemStack item = p.item(icon(kit), name, action, lines.toArray(new String[0]));
        ItemMeta meta = item.getItemMeta();
        if (meta instanceof PotionMeta potion) {
            potion.setBasePotionType(PotionType.STRONG_HEALING);
            potion.setColor(Color.fromRGB(239, 71, 111));
        }
        if (meta instanceof LeatherArmorMeta armor) armor.setColor(Color.fromRGB(220, 48, 65));
        meta.addItemFlags(ItemFlag.HIDE_ATTRIBUTES, ItemFlag.HIDE_ADDITIONAL_TOOLTIP);
        item.setItemMeta(meta);
        return item;
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

    static ItemStack[] equipment(CommunityArena p, String kit) {
        var items = ReferenceLoadouts.create(kit);
        var custom = p.data.getList("kits-v6." + kit);
        return custom == null ? items : custom.toArray(new ItemStack[0]);
    }

    static void equip(CommunityArena p, Player player, String kit) {
        if (!p.kit(kit)) throw new IllegalArgumentException("Removed preset: " + kit);
        p.clean(player);
        player.getInventory().setContents(equipment(p, kit));
        if (building(kit)) player.setGameMode(GameMode.SURVIVAL);
        if (p.layouts != null) p.layouts.apply(player, kit);
    }
}
