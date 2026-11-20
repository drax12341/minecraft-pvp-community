package community.pvp.arena;

import java.util.*;
import org.bukkit.*;
import org.bukkit.entity.Player;
import org.bukkit.event.*;
import org.bukkit.event.inventory.*;
import org.bukkit.inventory.*;
import org.bukkit.persistence.PersistentDataType;

/**
 * Whitelisted, server-created equipment only; both opponents receive an immutable accepted copy.
 */
final class SavedKits implements Listener {
  final CommunityArena p;
  final List<ItemStack> catalog = new ArrayList<>();
  final Map<UUID, Draft> drafts = new HashMap<>();

  static final class Draft {
    int slot, cell, page;
    ItemStack[] items = new ItemStack[41];
    Inventory view;
    boolean palette;

    Draft(int slot) {
      this.slot = slot;
    }
  }

  SavedKits(CommunityArena p) {
    this.p = p;
    for (Material material :
        List.of(
            Material.DIAMOND_SWORD,
            Material.DIAMOND_AXE,
            Material.NETHERITE_SWORD,
            Material.NETHERITE_AXE,
            Material.MACE,
            Material.BOW,
            Material.CROSSBOW,
            Material.SHIELD,
            Material.TOTEM_OF_UNDYING,
            Material.ENDER_PEARL,
            Material.GOLDEN_APPLE,
            Material.ENCHANTED_GOLDEN_APPLE,
            Material.END_CRYSTAL,
            Material.OBSIDIAN,
            Material.RESPAWN_ANCHOR,
            Material.GLOWSTONE,
            Material.COBWEB,
            Material.OAK_PLANKS,
            Material.COBBLESTONE,
            Material.WATER_BUCKET,
            Material.LAVA_BUCKET,
            Material.WIND_CHARGE,
            Material.ARROW,
            Material.EXPERIENCE_BOTTLE,
            Material.COOKED_BEEF,
            Material.NETHERITE_PICKAXE)) {
      int count =
          Set.of(Material.ENDER_PEARL).contains(material)
              ? 16
              : Set.of(Material.GOLDEN_APPLE, Material.ENCHANTED_GOLDEN_APPLE).contains(material)
                  ? 8
                  : material.isBlock()
                          || Set.of(
                                  Material.END_CRYSTAL,
                                  Material.WIND_CHARGE,
                                  Material.ARROW,
                                  Material.EXPERIENCE_BOTTLE,
                                  Material.COOKED_BEEF,
                                  Material.COBWEB)
                              .contains(material)
                      ? 64
                      : 1;
      catalog.add(new ItemStack(material, Math.min(count, material.getMaxStackSize())));
    }
    catalog.add(Loadouts.potion(org.bukkit.potion.PotionType.STRONG_HEALING, true));
    catalog.add(Loadouts.potion(org.bukkit.potion.PotionType.STRONG_SWIFTNESS, false));
    catalog.add(Loadouts.potion(org.bukkit.potion.PotionType.STRONG_STRENGTH, false));
    catalog.add(Loadouts.potion(org.bukkit.potion.PotionType.LONG_FIRE_RESISTANCE, false));
    Bukkit.getPluginManager().registerEvents(this, p);
  }

  static ItemStack[] copy(ItemStack[] items) {
    ItemStack[] cloned = new ItemStack[41];
    for (int i = 0; i < Math.min(41, items.length); i++)
      cloned[i] = items[i] == null ? null : items[i].clone();
    return cloned;
  }

  String key(UUID id, int slot) {
    if (slot < 1 || slot > 3) throw new IllegalArgumentException("Choose slot 1..3");
    return "players." + id + ".savedKits." + slot;
  }

  ItemStack[] saved(UUID id, int slot) {
    var values = p.data.getList(key(id, slot));
    if (values == null || values.size() != 41) return null;
    ItemStack[] items = new ItemStack[41];
    for (int i = 0; i < 41; i++)
      if (values.get(i) instanceof ItemStack item) items[i] = item.clone();
    return items;
  }

  void slots(Player player) {
    var inv = p.menus.frame(27, "Community | Saved Kits");
    for (int slot = 1; slot <= 3; slot++)
      inv.setItem(
          10 + (slot - 1) * 3,
          p.item(
              saved(player.getUniqueId(), slot) == null
                  ? Material.GRAY_SHULKER_BOX
                  : Material.PURPLE_SHULKER_BOX,
              "Custom Kit #" + slot,
              "custom-slot:" + slot,
              "Left-click: edit this kit",
              "Challenge: /customduel <player> " + slot,
              "Custom sets never award Elo"));
    inv.setItem(18, p.item(Material.ARROW, "Navigation", "navigation"));
    player.openInventory(inv);
  }

  void edit(Player player, int slot) {
    if (p.busy(player)) {
      p.tell(player, "Leave your match first.");
      return;
    }
    if (!p.managed(player)) p.enter(player);
    if (!p.managed(player)) return;
    Draft d = new Draft(slot);
    ItemStack[] saved = saved(player.getUniqueId(), slot);
    if (saved != null) d.items = saved;
    else {
      d.items[0] = new ItemStack(Material.DIAMOND_SWORD);
      String[] armor = {
        "DIAMOND_BOOTS", "DIAMOND_LEGGINGS", "DIAMOND_CHESTPLATE", "DIAMOND_HELMET"
      };
      for (int i = 0; i < 4; i++) d.items[36 + i] = new ItemStack(Material.valueOf(armor[i]));
    }
    drafts.put(player.getUniqueId(), d);
    builder(player, d);
  }

  void builder(Player player, Draft d) {
    var inv = p.menus.frame(54, "Custom Kit #" + d.slot + " | Builder");
    for (int i = 0; i < 36; i++) {
      int display = i < 9 ? 27 + i : i - 9;
      inv.setItem(
          display,
          d.items[i] == null
              ? p.item(
                  Material.LIGHT_GRAY_STAINED_GLASS_PANE,
                  "Empty slot",
                  null,
                  "Click: choose item",
                  "Right-click: remove")
              : d.items[i].clone());
    }
    for (int i = 36; i < 41; i++)
      inv.setItem(
          i,
          d.items[i] == null
              ? p.item(
                  Material.GRAY_DYE,
                  i == 40 ? "Offhand: none" : "Armor: none",
                  null,
                  "Click to cycle")
              : d.items[i].clone());
    inv.setItem(45, p.item(Material.ARROW, "Cancel", "custom-cancel"));
    inv.setItem(
        49,
        p.item(
            Material.LIME_DYE,
            "Save custom kit",
            "custom-save",
            "Shared with the opponent after they accept",
            "Private sets never change Elo"));
    d.palette = false;
    d.view = inv;
    player.openInventory(inv);
  }

  void palette(Player player, Draft d) {
    var inv = p.menus.frame(54, "Custom Kit | Item Palette");
    int start = d.page * 21;
    for (int i = 0; i < 21 && start + i < catalog.size(); i++) {
      ItemStack item = catalog.get(start + i).clone();
      var meta = item.getItemMeta();
      meta.getPersistentDataContainer()
          .set(p.menuKey, PersistentDataType.STRING, "custom-pick:" + (start + i));
      item.setItemMeta(meta);
      inv.setItem(10 + i + i / 7 * 2, item);
    }
    inv.setItem(45, p.item(Material.ARROW, "Previous", "custom-page:-1"));
    inv.setItem(49, p.item(Material.BARRIER, "Back to builder", "custom-back"));
    inv.setItem(53, p.item(Material.ARROW, "Next", "custom-page:1"));
    d.palette = true;
    d.view = inv;
    player.openInventory(inv);
  }

  boolean editing(Player player, Inventory inventory) {
    Draft d = drafts.get(player.getUniqueId());
    return d != null && d.view == inventory;
  }

  @EventHandler(priority = EventPriority.LOWEST)
  public void click(InventoryClickEvent e) {
    if (!(e.getWhoClicked() instanceof Player player)
        || !editing(player, e.getView().getTopInventory())) return;
    e.setCancelled(true);
    Draft d = drafts.get(player.getUniqueId());
    int slot = e.getRawSlot();
    if (slot < 0 || slot >= 54) return;
    ItemStack selected = e.getCurrentItem();
    String action =
        selected == null || !selected.hasItemMeta()
            ? null
            : selected
                .getItemMeta()
                .getPersistentDataContainer()
                .get(p.menuKey, PersistentDataType.STRING);
    boolean right = e.isRightClick();
    Inventory original = d.view;
    Bukkit.getScheduler()
        .runTask(
            p,
            () -> {
              if (!player.isOnline()
                  || p.busy(player)
                  || drafts.get(player.getUniqueId()) != d
                  || player.getOpenInventory().getTopInventory() != original) return;
              editClick(player, d, slot, right, action);
            });
  }

  void editClick(Player player, Draft d, int slot, boolean right, String action) {
    if (!d.palette && slot < 36) {
      int cell = slot >= 27 ? slot - 27 : slot + 9;
      if (right) {
        d.items[cell] = null;
        builder(player, d);
      } else {
        d.cell = cell;
        d.page = 0;
        palette(player, d);
      }
      return;
    }
    if (!d.palette && slot >= 36 && slot <= 39) {
      int cell = slot;
      String part = new String[] {"BOOTS", "LEGGINGS", "CHESTPLATE", "HELMET"}[slot - 36];
      Material old = d.items[cell] == null ? Material.AIR : d.items[cell].getType();
      d.items[cell] =
          old == Material.AIR
              ? new ItemStack(Material.valueOf("IRON_" + part))
              : old.name().startsWith("IRON")
                  ? new ItemStack(Material.valueOf("DIAMOND_" + part))
                  : old.name().startsWith("DIAMOND")
                      ? new ItemStack(Material.valueOf("NETHERITE_" + part))
                      : null;
      builder(player, d);
      return;
    }
    if (!d.palette && slot == 40) {
      d.items[40] =
          d.items[40] == null
              ? new ItemStack(Material.SHIELD)
              : d.items[40].getType() == Material.SHIELD
                  ? new ItemStack(Material.TOTEM_OF_UNDYING)
                  : null;
      builder(player, d);
      return;
    }
    if (action == null) return;
    if (action.startsWith("custom-pick:")) {
      int index = Integer.parseInt(action.substring(12));
      if (index >= 0 && index < catalog.size()) d.items[d.cell] = catalog.get(index).clone();
      builder(player, d);
    } else if (action.startsWith("custom-page:")) {
      d.page =
          Math.max(
              0,
              Math.min((catalog.size() - 1) / 21, d.page + Integer.parseInt(action.substring(12))));
      palette(player, d);
    } else if (action.equals("custom-back")) builder(player, d);
    else if (action.equals("custom-save")) {
      if (Arrays.stream(d.items).allMatch(Objects::isNull)) {
        p.tell(player, "Choose at least one item.");
        return;
      }
      String key = key(player.getUniqueId(), d.slot);
      Object before = p.data.get(key);
      p.data.set(key, Arrays.asList(copy(d.items)));
      if (!p.save()) {
        p.data.set(key, before);
        p.tell(player, "Could not save the custom kit. Your previous kit was kept.");
        return;
      }
      drafts.remove(player.getUniqueId());
      slots(player);
      p.tell(player, "Custom kit saved. /customduel <player> " + d.slot);
    } else if (action.equals("custom-cancel")) {
      drafts.remove(player.getUniqueId());
      slots(player);
    }
  }

  @EventHandler
  public void close(InventoryCloseEvent e) {
    if (e.getPlayer() instanceof Player player) {
      Draft d = drafts.get(player.getUniqueId());
      if (d != null && d.view == e.getInventory())
        Bukkit.getScheduler()
            .runTask(
                p,
                () -> {
                  if (d.view == e.getInventory()
                      && player.getOpenInventory().getTopInventory() != d.view)
                    drafts.remove(player.getUniqueId());
                });
    }
  }

  @EventHandler
  public void quit(org.bukkit.event.player.PlayerQuitEvent e) {
    drafts.remove(e.getPlayer().getUniqueId());
  }

  void challenge(Player from, String[] args) {
    if (args.length < 2 || !args[1].matches("[1-3]")) {
      p.tell(from, "/customduel <player> <slot:1..3>");
      return;
    }
    Player target = Bukkit.getPlayerExact(args[0]);
    ItemStack[] kit = saved(from.getUniqueId(), Integer.parseInt(args[1]));
    if (target == null
        || target.equals(from)
        || kit == null
        || p.busy(from)
        || p.busy(target)
        || !p.flag(target, "invites", true)) {
      p.tell(from, "Choose a saved kit and an available online player.");
      return;
    }
    var old = p.invites.get(target.getUniqueId());
    if (old != null && old.expires() > System.currentTimeMillis()) {
      p.tell(from, "That player already has an invitation.");
      return;
    }
    p.invites.put(
        target.getUniqueId(),
        new CommunityArena.Invite(
            from.getUniqueId(), "custom", 1, System.currentTimeMillis() + 60000, copy(kit)));
    p.tell(
        target,
        from.getName()
            + " invites you to an UNRANKED custom set with equal equipment. /duel accept "
            + from.getName());
    p.tell(from, "Custom invitation sent.");
  }

  void equip(Player player, ItemStack[] items) {
    p.clean(player);
    var inv = player.getInventory();
    inv.setStorageContents(Arrays.copyOfRange(copy(items), 0, 36));
    inv.setArmorContents(Arrays.copyOfRange(copy(items), 36, 40));
    inv.setItemInOffHand(items[40] == null ? null : items[40].clone());
    player.setGameMode(GameMode.SURVIVAL);
  }
}
