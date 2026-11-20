package community.pvp.arena;

import java.util.*;

import org.bukkit.*;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.inventory.*;
import org.bukkit.inventory.meta.*;
import org.bukkit.potion.PotionType;

/**
 * Screenshot slot/count transcription. Hidden enchantments and potion metadata are documented defaults.
 */
final class ReferenceLoadouts {
    static final String VERSION = "screenshots-v6";

    static ItemStack[] create(String kit) {
        ItemStack[] a = new ItemStack[41];
        boolean nether = Set.of("crystal", "nethop", "smp", "mace", "mace_spear").contains(kit);
        String metal = nether ? "NETHERITE" : "DIAMOND";
        String[] armor = {"BOOTS", "LEGGINGS", "CHESTPLATE", "HELMET"};
        for (int i = 0; i < 4; i++) {
            a[36 + i] = new ItemStack(Material.valueOf(metal + "_" + armor[i]));
            if (!kit.equals("axe")) {
                enchant(a[36 + i], Enchantment.PROTECTION, kit.equals("sword") ? 3 : 4);
                enchant(a[36 + i], Enchantment.UNBREAKING, 3);
                enchant(a[36 + i], Enchantment.MENDING, 1);
            }
        }
        if (!kit.equals("axe")) enchant(a[36], Enchantment.FEATHER_FALLING, 4);
        put(a, 0, nether ? Material.NETHERITE_SWORD : Material.DIAMOND_SWORD, 1);
        if (!kit.equals("axe")) {
            enchant(a[0], Enchantment.SHARPNESS, 5);
            enchant(a[0], Enchantment.UNBREAKING, 3);
        }
        switch (kit) {
            case "sword" -> {
            }
            case "axe" -> {
                put(a, 1, Material.DIAMOND_AXE, 1);
                put(a, 2, Material.BOW, 1);
                put(a, 3, Material.CROSSBOW, 1);
                put(a, 8, Material.ARROW, 5);
                put(a, 40, Material.SHIELD, 1);
            }
            case "uhc" -> {
                a[1] = weapon(Material.DIAMOND_AXE, Enchantment.SHARPNESS, 3);
                enchant(a[0], Enchantment.SHARPNESS, 3);
                a[2] = GoldenHeads.item();
                put(a, 3, Material.GOLDEN_APPLE, 8);
                put(a, 4, Material.WATER_BUCKET, 1);
                put(a, 5, Material.LAVA_BUCKET, 1);
                a[6] = weapon(Material.CROSSBOW, Enchantment.QUICK_CHARGE, 3);
                put(a, 7, Material.OAK_PLANKS, 64);
                put(a, 8, Material.COBWEB, 8);
                for (int i = 12; i <= 14; i++) put(a, i, Material.WATER_BUCKET, 1);
                put(a, 17, Material.ARROW, 16);
                put(a, 22, Material.LAVA_BUCKET, 1);
                a[26] = weapon(Material.BOW, Enchantment.POWER, 3);
                a[31] = weapon(Material.DIAMOND_PICKAXE, Enchantment.EFFICIENCY, 5);
                put(a, 35, Material.OAK_PLANKS, 64);
                put(a, 40, Material.SHIELD, 1);
            }
            case "pot" -> {
                for (int i = 1; i < 36; i++) a[i] = Loadouts.potion(PotionType.STRONG_HEALING, true);
                for (int row = 0; row < 3; row++) {
                    a[15 + row * 9] = Loadouts.potion(PotionType.STRONG_STRENGTH, true);
                    a[16 + row * 9] = Loadouts.potion(PotionType.STRONG_SWIFTNESS, true);
                    a[17 + row * 9] = Loadouts.potion(PotionType.LONG_FIRE_RESISTANCE, true);
                }
                put(a, 40, Material.COOKED_BEEF, 5);
            }
            case "nethop" -> {
                for (int i = 1; i < 36; i++) a[i] = Loadouts.potion(PotionType.STRONG_HEALING, true);
                for (int i = 14; i <= 17; i++) a[i] = Loadouts.potion(PotionType.STRONG_STRENGTH, true);
                for (int i = 23; i <= 26; i++) a[i] = Loadouts.potion(PotionType.STRONG_SWIFTNESS, true);
                a[6] = Loadouts.potion(PotionType.STRONG_STRENGTH, true);
                a[7] = Loadouts.potion(PotionType.STRONG_SWIFTNESS, true);
                put(a, 8, Material.TOTEM_OF_UNDYING, 1);
                put(a, 34, Material.EXPERIENCE_BOTTLE, 64);
                put(a, 35, Material.TOTEM_OF_UNDYING, 1);
                put(a, 40, Material.GOLDEN_APPLE, 64);
            }
            case "smp" -> {
                for (int i = 9; i <= 17; i++) a[i] = Loadouts.potion(PotionType.STRONG_STRENGTH, true);
                for (int i = 18; i <= 26; i++) a[i] = Loadouts.potion(PotionType.STRONG_SWIFTNESS, true);
                a[27] = weapon(Material.NETHERITE_SWORD, Enchantment.SHARPNESS, 5);
                enchant(a[27], Enchantment.FIRE_ASPECT, 2);
                put(a, 28, Material.GOLDEN_APPLE, 64);
                put(a, 29, Material.ENDER_PEARL, 16);
                a[30] = Loadouts.potion(PotionType.STRONG_STRENGTH, true);
                a[31] = a[30].clone();
                a[32] = Loadouts.potion(PotionType.STRONG_SWIFTNESS, true);
                a[33] = a[32].clone();
                a[34] = Loadouts.potion(PotionType.LONG_FIRE_RESISTANCE, true);
                a[35] = a[34].clone();
                put(a, 1, Material.GOLDEN_APPLE, 64);
                put(a, 2, Material.ENDER_PEARL, 16);
                a[3] = weapon(Material.NETHERITE_AXE, Enchantment.SHARPNESS, 5);
                put(a, 4, Material.EXPERIENCE_BOTTLE, 64);
                a[5] = Loadouts.potion(PotionType.STRONG_STRENGTH, true);
                a[6] = Loadouts.potion(PotionType.STRONG_SWIFTNESS, true);
                put(a, 7, Material.TOTEM_OF_UNDYING, 1);
                put(a, 40, Material.SHIELD, 1);
            }
            case "crystal" -> {
                put(a, 1, Material.ENDER_PEARL, 16);
                put(a, 2, Material.GOLDEN_APPLE, 64);
                put(a, 3, Material.OBSIDIAN, 64);
                put(a, 4, Material.END_CRYSTAL, 64);
                put(a, 5, Material.RESPAWN_ANCHOR, 64);
                put(a, 6, Material.GLOWSTONE, 64);
                a[7] = weapon(Material.CROSSBOW, Enchantment.QUICK_CHARGE, 3);
                enchant(a[7], Enchantment.PIERCING, 4);
                put(a, 8, Material.TOTEM_OF_UNDYING, 1);
                for (int i = 9; i <= 28; i++) put(a, i, Material.TOTEM_OF_UNDYING, 1);
                for (int i : new int[]{9, 10, 18, 19, 27, 28}) put(a, i, Material.ENDER_PEARL, 16);
                a[17] = weapon(Material.NETHERITE_AXE, Enchantment.SHARPNESS, 5);
                a[26] = weapon(Material.NETHERITE_PICKAXE, Enchantment.EFFICIENCY, 5);
                put(a, 29, Material.GOLDEN_APPLE, 64);
                put(a, 30, Material.OBSIDIAN, 64);
                put(a, 31, Material.END_CRYSTAL, 64);
                put(a, 32, Material.EXPERIENCE_BOTTLE, 64);
                put(a, 33, Material.EXPERIENCE_BOTTLE, 64);
                a[34] = new ItemStack(Material.TIPPED_ARROW, 64);
                a[34].editMeta(PotionMeta.class, m -> m.setBasePotionType(PotionType.LONG_SLOW_FALLING));
                put(a, 35, Material.SHIELD, 1);
                put(a, 40, Material.TOTEM_OF_UNDYING, 1);
                a[37].removeEnchantment(Enchantment.PROTECTION);
                enchant(a[37], Enchantment.BLAST_PROTECTION, 4);
            }
            case "mace", "mace_spear" -> {
                a[1] = weapon(Material.NETHERITE_AXE, Enchantment.SHARPNESS, 5);
                put(a, 2, Material.ENDER_PEARL, 16);
                put(a, 3, Material.GOLDEN_APPLE, 64);
                put(a, 4, Material.ELYTRA, 1);
                enchant(a[4], Enchantment.UNBREAKING, 3);
                enchant(a[4], Enchantment.MENDING, 1);
                put(a, 5, Material.WIND_CHARGE, 64);
                a[6] = weapon(Material.MACE, Enchantment.BREACH, 4);
                a[7] = weapon(Material.MACE, Enchantment.DENSITY, 5);
                enchant(a[7], Enchantment.WIND_BURST, 3);
                put(a, 8, Material.SHIELD, 1);
                for (int i = 9; i <= 33; i++)
                    a[i] = Loadouts.potion(i <= 17 ? PotionType.STRONG_STRENGTH : PotionType.STRONG_SWIFTNESS, true);
                for (int i : new int[]{9, 18, 27}) put(a, i, Material.ENDER_PEARL, 16);
                put(a, 17, Material.GOLDEN_APPLE, 64);
                a[28] = Loadouts.potion(PotionType.STRONG_STRENGTH, true);
                a[29] = a[28].clone();
                put(a, 26, Material.PURPLE_SHULKER_BOX, 1);
                put(a, 34, Material.WIND_CHARGE, 64);
                put(a, 35, Material.TOTEM_OF_UNDYING, 1);
                put(a, 40, Material.TOTEM_OF_UNDYING, 1);
                if (kit.equals("mace_spear")) {
                    a[2] = weapon(Material.MACE, Enchantment.DENSITY, 5);
                    enchant(a[2], Enchantment.WIND_BURST, 3);
                    for (int i = 9; i < 36; i++) a[i] = Loadouts.potion(PotionType.STRONG_SWIFTNESS, true);
                    for (int i : new int[]{11, 12, 13, 14, 15, 16, 17, 19, 20, 28, 29, 34})
                        a[i] = Loadouts.potion(PotionType.STRONG_STRENGTH, true);
                    put(a, 9, Material.WIND_CHARGE, 64);
                    put(a, 10, Material.GOLDEN_APPLE, 64);
                    put(a, 18, Material.ENDER_PEARL, 16);
                    put(a, 27, Material.ENDER_PEARL, 16);
                    Material spear = Material.matchMaterial("NETHERITE_SPEAR");
                    if (spear == null)
                        throw new IllegalStateException("Spear Mace requires Paper 1.21.11 with native spears");
                    a[8] = weapon(spear, Enchantment.SHARPNESS, 5);
                    put(a, 3, Material.WIND_CHARGE, 64);
                    put(a, 4, Material.FIREWORK_ROCKET, 64);
                    put(a, 5, Material.ENDER_PEARL, 16);
                    put(a, 6, Material.GOLDEN_APPLE, 64);
                    a[7] = new ItemStack(Material.ELYTRA);
                    enchant(a[7], Enchantment.UNBREAKING, 3);
                }
            }
            default -> throw new IllegalArgumentException("No preset: " + kit);
        }
        return a;
    }

    static void put(ItemStack[] a, int slot, Material m, int n) {
        a[slot] = new ItemStack(m, n);
    }

    static void enchant(ItemStack item, Enchantment enchant, int level) {
        item.addUnsafeEnchantment(enchant, level);
    }

    static ItemStack weapon(Material type, Enchantment e, int level) {
        var item = new ItemStack(type);
        enchant(item, e, level);
        enchant(item, Enchantment.UNBREAKING, 3);
        enchant(item, Enchantment.MENDING, 1);
        return item;
    }
}
