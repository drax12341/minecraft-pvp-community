package community.pvp.arena;

import java.util.*;

import org.bukkit.*;
import org.bukkit.entity.Player;
import org.bukkit.event.*;
import org.bukkit.event.inventory.*;
import org.bukkit.inventory.*;
import org.bukkit.persistence.PersistentDataType;

final class KitLayouts implements Listener {
    final CommunityArena p;
    final NamespacedKey sourceKey;
    final Map<UUID, Editor> editors = new HashMap<>();
    boolean preview;

    record Editor(String kit, Inventory inventory, Set<Integer> sources) {
    }

    KitLayouts(CommunityArena p) {
        this.p = p;
        sourceKey = new NamespacedKey(p, "layout-source");
        Bukkit.getPluginManager().registerEvents(this, p);
    }

    static boolean valid(List<Integer> layout, Set<Integer> sources) {
        if (layout.size() != 36) return false;
        Set<Integer> found = new HashSet<>();
        for (int source : layout) {
            if (source == -1) continue;
            if (source < 0 || source >= 36 || !sources.contains(source) || !found.add(source))
                return false;
        }
        return found.equals(sources);
    }

    void apply(Player player, String kit) {
        if (preview) return;
        List<Integer> layout =
                p.data.getIntegerList("players." + player.getUniqueId() + ".layouts-v6." + kit);
        ItemStack[] original = player.getInventory().getStorageContents();
        Set<Integer> sources = new HashSet<>();
        for (int i = 0; i < 36; i++)
            if (original[i] != null && !original[i].getType().isAir()) sources.add(i);
        if (!valid(layout, sources)) return;
        ItemStack[] arranged = new ItemStack[36];
        for (int i = 0; i < 36; i++) if (layout.get(i) >= 0) arranged[i] = original[layout.get(i)];
        player.getInventory().setStorageContents(arranged);
    }

    void picker(Player player) {
        if (p.busy(player)) return;
        if (!p.managed(player)) p.enter(player);
        if (!p.managed(player)) return;
        Inventory inv = p.menus.frame(45, "Reference Kit Layouts");
        int n = 0;
        for (String kit : CommunityArena.KITS) {
            inv.setItem(11 + n / 3 * 9 + n % 3 * 2, Loadouts.menuIcon(p, kit, Loadouts.name(kit), "layout:" + kit, "Click to arrange storage and hotbar", "Armor and offhand shown as locked previews"));
            n++;
        }
        player.openInventory(inv);
    }

    void open(Player player, String kit) {
        if (!p.kit(kit) || p.busy(player)) {
            p.tell(player, "Choose a valid kit and leave your match first.");
            return;
        }
        if (!p.managed(player)) p.enter(player);
        if (!p.managed(player)) return;
        player.closeInventory();
        ItemStack[] full = Loadouts.equipment(p, kit);
        ItemStack[] contents = Arrays.copyOf(full, 36);
        Inventory inv = ArenaMenu.create(54, PracticeMenus.title("Arrange " + Loadouts.name(kit)));
        Set<Integer> sources = new HashSet<>();
        for (int i = 0; i < 36; i++)
            if (contents[i] != null && !contents[i].getType().isAir()) {
                sources.add(i);
            }
        for (int i = 36; i < 54; i++)
            inv.setItem(i, p.item(Material.GRAY_STAINED_GLASS_PANE, " ", null));
        inv.setItem(45, p.item(Material.ARROW, "Cancel", "layout-cancel", "No changes will be saved"));
        inv.setItem(
                49,
                p.item(
                        Material.LIME_DYE,
                        "Save layout",
                        "layout-save",
                        "Top 27 slots = backpack; bottom 9 = hotbar",
                        "Click two slots to swap complete stacks",
                        "Armor, items and amounts stay identical"));
        for (int n = 0; n < 5; n++) {
            var item = full[36 + n];
            if (item != null) {
                item = item.clone();
                var meta = item.getItemMeta();
                var lore = meta.lore() == null ? new ArrayList<net.kyori.adventure.text.Component>() : new ArrayList<>(meta.lore());
                lore.add(PracticePresentation.ui("§8Fixed equipment preview"));
                meta.lore(lore);
                item.setItemMeta(meta);
                inv.setItem(38 + n, item);
            }
        }
        inv.setItem(
                53,
                p.item(
                        Material.BARRIER, "Reset layout", "layout-reset", "Use the default kit arrangement"));
        // Chest rows and player storage use opposite hotbar ordering; preserve Minecraft inventory
        // layout.
        List<Integer> saved = p.data.getIntegerList("players." + player.getUniqueId() + ".layouts-v6." + kit);
        boolean arranged = valid(saved, sources);
        for (int i = 0; i < 36; i++) {
            int display = i < 9 ? 27 + i : i - 9;
            int source = arranged ? saved.get(i) : i;
            inv.setItem(display, source < 0 ? null : tag(contents[source], source));
        }
        editors.put(player.getUniqueId(), new Editor(kit, inv, sources));
        player.openInventory(inv);
    }

    ItemStack tag(ItemStack original, int index) {
        if (original == null || original.getType().isAir()) return null;
        ItemStack item = original.clone();
        var m = item.getItemMeta();
        m.getPersistentDataContainer().set(sourceKey, PersistentDataType.INTEGER, index);
        item.setItemMeta(m);
        return item;
    }

    boolean editing(Player player, Inventory top) {
        Editor editor = editors.get(player.getUniqueId());
        return editor != null && editor.inventory == top;
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void click(InventoryClickEvent e) {
        if (!(e.getWhoClicked() instanceof Player player)
                || !editing(player, e.getView().getTopInventory())) return;
        e.setCancelled(true);
        Editor editor = editors.get(player.getUniqueId());
        int slot = e.getRawSlot();
        if (slot >= 0
                && slot < 36
                && (e.getClick() == ClickType.LEFT || e.getClick() == ClickType.RIGHT)) {
            ItemStack cursor = e.getCursor();
            if (cursor != null
                    && !cursor.getType().isAir()
                    && !cursor
                    .getItemMeta()
                    .getPersistentDataContainer()
                    .has(sourceKey, PersistentDataType.INTEGER)) return;
            ItemStack old = editor.inventory.getItem(slot);
            editor.inventory.setItem(slot, cursor);
            player.setItemOnCursor(old);
            return;
        }
        if (slot == 45 || slot == 49 || slot == 53)
            Bukkit.getScheduler()
                    .runTask(
                            p,
                            () -> {
                                if (!editing(player, editor.inventory)) return;
                                if (slot == 49) {
                                    if (player.getItemOnCursor() != null
                                            && !player.getItemOnCursor().getType().isAir()) {
                                        p.tell(player, "Put the held item in a slot before saving.");
                                        return;
                                    }
                                    List<Integer> layout = new ArrayList<>(Collections.nCopies(36, -1));
                                    for (int i = 0; i < 36; i++) {
                                        ItemStack item = editor.inventory.getItem(i);
                                        if (item != null && !item.getType().isAir()) {
                                            Integer source =
                                                    item.getItemMeta()
                                                            .getPersistentDataContainer()
                                                            .get(sourceKey, PersistentDataType.INTEGER);
                                            if (source == null) return;
                                            layout.set(i >= 27 ? i - 27 : i + 9, source);
                                        }
                                    }
                                    if (!valid(layout, editor.sources)) {
                                        p.tell(player, "Invalid layout; no changes saved.");
                                        return;
                                    }
                                    p.data.set("players." + player.getUniqueId() + ".layouts-v6." + editor.kit, layout);
                                    p.save();
                                    p.tell(player, "Layout saved for " + Loadouts.name(editor.kit) + ".");
                                } else if (slot == 53) {
                                    p.data.set("players." + player.getUniqueId() + ".layouts-v6." + editor.kit, null);
                                    p.save();
                                }
                                player.closeInventory();
                            });
    }

    @EventHandler
    public void close(InventoryCloseEvent e) {
        if (e.getPlayer() instanceof Player player && editing(player, e.getInventory())) {
            editors.remove(player.getUniqueId());
            player.setItemOnCursor(null);
        }
    }

    @EventHandler
    public void drag(InventoryDragEvent e) {
        if (e.getWhoClicked() instanceof Player player
                && editing(player, e.getView().getTopInventory())) e.setCancelled(true);
    }
}
