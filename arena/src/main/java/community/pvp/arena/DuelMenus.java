package community.pvp.arena;

import java.util.*;

import org.bukkit.*;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;

final class DuelMenus {
    final CommunityArena p;
    final Map<UUID, Draft> drafts = new HashMap<>();

    static final class Draft {
        org.bukkit.inventory.ItemStack[] custom;
        UUID opponent;
        boolean bot, party;
        String kit = "sword";
        int rounds = 1, map = 6, totems = 5;
        boolean pearls, responsive, spec = true, tnt, loot, moving;

        DuelRules rules() {
            return new DuelRules(map, pearls, responsive, spec, tnt, loot);
        }
    }

    DuelMenus(CommunityArena p) {
        this.p = p;
    }

    void open(Player player, String target) {
        if (p.busy(player)) return;
        if (!p.managed(player)) p.enter(player);
        if (!p.managed(player)) return;
        Draft d = new Draft();
        d.map = BattleMaps.playable(p).getFirst().id();
        if ("bot".equalsIgnoreCase(target)) {
            if (!player.isOp()) {
                p.tell(player, "Only operators can practice against bots.");
                return;
            }
            d.bot = true;
        } else if ("party".equalsIgnoreCase(target)) {
            d.party = true;
        } else if (target != null) {
            Player other = Bukkit.getPlayerExact(target);
            if (other == null || other.equals(player)) {
                p.tell(player, "Choose another online player.");
                return;
            }
            d.opponent = other.getUniqueId();
        }
        drafts.put(player.getUniqueId(), d);
        if (d.opponent == null && !d.bot && !d.party) players(player, 0);
        else kits(player);
    }

    Inventory frame(int size, String title) {
        Inventory inv = ArenaMenu.create(size, PracticePresentation.ui("§9" + title));
        for (int i = 0; i < size; i++)
            if (i < 9 || i >= size - 9 || i % 9 == 0 || i % 9 == 8)
                inv.setItem(i, p.item(Material.BLUE_STAINED_GLASS_PANE, " ", null));
        return inv;
    }

    void players(Player player, int page) {
        var list = Bukkit.getOnlinePlayers().stream().filter(o -> !o.equals(player) && p.flag(o, "invites", true)).toList();
        page = Math.max(0, Math.min(page, Math.max(0, (list.size() - 1) / 21)));
        Inventory inv = frame(54, "Duel | Choose opponent");
        for (int n = page * 21; n < Math.min(list.size(), (page + 1) * 21); n++) {
            Player o = list.get(n);
            int slot = 10 + (n % 21) / 7 * 9 + n % 7;
            inv.setItem(slot, p.item(Material.PLAYER_HEAD, "§f" + o.getName(), "duelui:player:" + o.getUniqueId(), "Click to choose kit and settings"));
        }
        inv.setItem(45, p.item(Material.ARROW, "Previous", "duelui:players:" + (page - 1)));
        inv.setItem(53, p.item(Material.ARROW, "Next", "duelui:players:" + (page + 1)));
        if (player.isOp()) inv.setItem(49, p.item(Material.TOTEM_OF_UNDYING, "Operator practice bot", "duelui:bot"));
        player.openInventory(inv);
    }

    void kits(Player player) {
        Inventory inv = frame(54, "Duel | Mode Selection");
        int n = 0;
        for (String kit : CommunityArena.KITS) {
            inv.setItem(11 + n / 3 * 9 + n % 3 * 2, p.item(Loadouts.icon(kit), Loadouts.name(kit), "duelui:kit:" + kit));
            n++;
        }
        for (int slot = 1; slot <= 3; slot++)
            if (p.savedKits.saved(player.getUniqueId(), slot) != null)
                inv.setItem(36 + slot * 2, p.item(Material.CHEST, "Custom kit " + slot, "duelui:custom:" + slot, "Your saved equipment, shared equally"));
        player.openInventory(inv);
    }

    void setup(Player player) {
        Draft d = drafts.get(player.getUniqueId());
        if (d == null) return;
        Inventory inv = frame(45, Loadouts.name(d.kit) + " 1v1 | " + (d.bot ? "Practice bot" : d.party ? "Party teams" : "Private duel"));
        inv.setItem(0, p.item(Material.ENDER_EYE, "Spectators: " + on(d.spec), "duelui:spec", "Allow /spec during this match"));
        inv.setItem(8, p.item(Material.BARRIER, "Cancel", "duelui:cancel"));
        inv.setItem(22, p.item(Loadouts.icon(d.kit), "§a" + (d.bot ? "Start practice" : "Send challenge"), "duelui:send", "Kit: " + Loadouts.name(d.kit), "Map: " + BattleMaps.get(d.map).name(), "First to: " + d.rounds, "Click to confirm your settings"));
        inv.setItem(39, p.item(Material.CLOCK, "First to: " + d.rounds, "duelui:rounds", "Click +1 | Right-click -1 (1..10)"));
        inv.setItem(40, p.item(BattleMaps.icon(d.map), BattleMaps.get(d.map).name(), "duelui:maps", "Choose biome and arena size"));
        inv.setItem(41, p.item(Material.COMPARATOR, "Duel Settings", "duelui:settings", "Pearls, movement, TNT and loot"));
        if (d.bot) {
            inv.setItem(29, p.item(Material.LEATHER_BOOTS, "Bot movement: " + on(d.moving), "duelui:moving", "Stationary or moving target"));
            inv.setItem(33, p.item(Material.TOTEM_OF_UNDYING, "Bot totems: " + d.totems, "duelui:totems", "Click +1 | Right-click -1 (0..64)"));
        }
        player.openInventory(inv);
    }

    static String on(boolean enabled) {
        return enabled ? "§aON" : "§cOFF";
    }

    void settings(Player player) {
        Draft d = drafts.get(player.getUniqueId());
        Inventory inv = frame(27, "Duel Settings");
        inv.setItem(10, p.item(Material.ENDER_PEARL, "Pearls on walls: " + on(d.pearls), "duelui:pearls", "OFF rejects pearl landings touching solid walls", "Arena boundaries always remain enforced"));
        inv.setItem(11, p.item(Material.FEATHER, "Responsive movement: " + on(d.responsive), "duelui:responsive", "Small forward impulse when starting a sprint", "Server movement option; does not change ping"));
        inv.setItem(12, p.item(Material.ENDER_EYE, "Spectators: " + on(d.spec), "duelui:spec"));
        inv.setItem(13, p.item(Material.TNT, "Auto ignite TNT: " + on(d.tnt), "duelui:tnt", "Placed TNT primes automatically when ON", "Building kits only"));
        inv.setItem(14, p.item(Material.CHEST, "Death loot: " + on(d.loot), "duelui:loot", "Drop match equipment on knockout", "Removed when the arena resets"));
        inv.setItem(22, p.item(Material.ARROW, "Back", "duelui:setup"));
        player.openInventory(inv);
    }

    void maps(Player player) {
        Draft d = drafts.get(player.getUniqueId());
        var current = BattleMaps.get(d.map);
        if (ImportedBuilds.is(d.map)) {
            importedMaps(player, d);
            return;
        }
        String[] sizes = {"Compact", "Standard", "Sky"};
        Inventory inv = frame(54, "Maps | " + sizes[current.size()]);
        for (int size = 0; size < 3; size++) {
            var variant = BattleMaps.get(6 + current.theme() * 3 + size);
            boolean allowed = variant.supports(d.kit), selected = current.size() == size;
            inv.setItem(2 + size * 2, p.item(!allowed ? Material.BARRIER : selected ? Material.LIME_DYE : Material.LIGHT_BLUE_DYE,
                    sizes[size] + " | " + variant.width() + " x " + variant.length(), allowed ? "duelui:size:" + size : null,
                    !allowed ? "This kit uses Compact maps" : selected ? "Selected size" : "Click to change size", "Your selected biome is kept"));
        }
        for (int theme = 0; theme < 6; theme++) {
            var m = BattleMaps.get(6 + theme * 3 + current.size());
            boolean busy = p.occupied.contains(m.id());
            inv.setItem(20 + theme / 3 * 9 + theme % 3 * 2, p.item(busy ? Material.BARRIER : BattleMaps.ICONS[theme],
                    (m.id() == d.map ? "§aSelected: " : "§f") + BattleMaps.THEMES[theme], busy ? null : "duelui:map:" + m.id(),
                    m.width() + " x " + m.length() + " | Sky Y=" + m.ceiling(), busy ? "Arena in use; choose another biome" : "Click to select this biome"));
        }
        inv.setItem(40, p.item(Material.COMPASS, "Random available biome", "duelui:random-map", "Uses the selected size and kit restrictions"));
        inv.setItem(49, p.item(Material.ARROW, "Back", "duelui:setup"));
        player.openInventory(inv);
    }

    void importedMaps(Player player, Draft d) {
        int size = BattleMaps.get(d.map).size();
        String[] names = {"Small", "Bigger", "Massive"};
        Inventory inv = frame(54, "Arenas | " + names[size]);
        for (int n = 0; n < 3; n++) {
            final int category = n;
            if (ImportedBuilds.TEMPLATES.stream().noneMatch(m -> m.size() == category && m.supports(d.kit))) continue;
            inv.setItem(2 + n * 2, p.item(n == size ? Material.LIME_DYE : Material.GRAY_DYE, names[n], "duelui:size:" + n, n == size ? "Selected size" : "Click to browse"));
        }
        int slot = 0;
        for (var m : ImportedBuilds.TEMPLATES)
            if (m.size() == size && m.supports(d.kit)) {
                boolean selected = m.id() == d.map;
                long free = ImportedBuilds.SLOTS.stream().filter(v -> v.theme() == m.theme() && !p.occupied.contains(v.id()) && p.warmup.ready(v.id())).count();
                inv.setItem(19 + slot * 2, p.item(selected ? Material.LIME_DYE : Material.GRAY_DYE, (selected ? "\u00a7aSelected: " : "\u00a77") + m.name(), "duelui:map:" + m.id(), m.width() + " x " + m.length() + " | Ceiling: " + m.ceiling(), "Theme: " + BattleMaps.icon(m.id()).name().toLowerCase().replace('_', ' '), free + " of 3 separate copies free", selected ? "Selected arena" : "Click to select"));
                inv.setItem(28 + slot * 2, p.item(BattleMaps.icon(m.id()), m.name(), "duelui:map:" + m.id(), "Imported build floating over void"));
                slot++;
            }
        inv.setItem(40, p.item(Material.COMPASS, "Random available arena", "duelui:random-map"));
        inv.setItem(49, p.item(Material.ARROW, "Back", "duelui:setup"));
        player.openInventory(inv);
    }

    boolean handle(Player player, String action, boolean reverse) {
        if (action == null || !action.startsWith("duelui:")) return false;
        Draft d = drafts.get(player.getUniqueId());
        if (d == null || p.busy(player)) return true;
        String[] a = action.split(":");
        String key = a[1];
        switch (key) {
            case "players" -> players(player, Integer.parseInt(a[2]));
            case "player" -> {
                d.opponent = UUID.fromString(a[2]);
                kits(player);
            }
            case "bot" -> {
                if (player.isOp()) {
                    d.bot = true;
                    d.opponent = null;
                    kits(player);
                }
            }
            case "custom" -> {
                var items = p.savedKits.saved(player.getUniqueId(), Integer.parseInt(a[2]));
                if (items != null) {
                    d.kit = "custom";
                    d.custom = SavedKits.copy(items);
                    setup(player);
                }
            }
            case "kit" -> {
                if (p.kit(a[2])) {
                    d.custom = null;
                    d.kit = a[2];
                    if (!BattleMaps.get(d.map).supports(d.kit))
                        d.map = ImportedBuilds.is(d.map) ? BattleMaps.playable(p).stream().filter(m -> m.supports(d.kit)).findFirst().orElseThrow().id() : 6 + BattleMaps.get(d.map).theme() * 3;
                    setup(player);
                }
            }
            case "maps" -> maps(player);
            case "size" -> {
                if (a.length != 3 || !a[2].matches("[0-2]")) return true;
                var current = BattleMaps.get(d.map);
                int size = Integer.parseInt(a[2]);
                var next = ImportedBuilds.is(d.map) ? ImportedBuilds.TEMPLATES.stream().filter(m -> m.size() == size && m.supports(d.kit)).findFirst().orElse(null) : BattleMaps.get(6 + current.theme() * 3 + size);
                if (next != null && next.supports(d.kit)) {
                    d.map = next.id();
                    maps(player);
                }
            }
            case "random-map" -> {
                int size = BattleMaps.get(d.map).size();
                var available = BattleMaps.playable(p).stream().filter(m -> m.size() == size && m.supports(d.kit) && BattleMaps.available(p, m.id(), d.kit) > 0).toList();
                if (available.isEmpty()) p.tell(player, "All maps of this size are in use.");
                else {
                    d.map = available.get(java.util.concurrent.ThreadLocalRandom.current().nextInt(available.size())).id();
                    maps(player);
                }
            }
            case "map" -> {
                if (a.length != 3 || !a[2].matches("[0-9]{1,3}")) return true;
                var m = BattleMaps.get(Integer.parseInt(a[2]));
                if (m != null && BattleMaps.playable(p).contains(m) && m.supports(d.kit) && BattleMaps.available(p, m.id(), d.kit) > 0) {
                    d.map = m.id();
                    maps(player);
                }
            }
            case "settings" -> settings(player);
            case "setup" -> setup(player);
            case "rounds" -> {
                d.rounds = Math.clamp(d.rounds + (reverse ? -1 : 1), 1, 10);
                setup(player);
            }
            case "totems" -> {
                d.totems = Math.clamp(d.totems + (reverse ? -1 : 1), 0, 64);
                setup(player);
            }
            case "moving" -> {
                d.moving = !d.moving;
                setup(player);
            }
            case "pearls", "responsive", "spec", "tnt", "loot" -> {
                switch (key) {
                    case "pearls" -> d.pearls = !d.pearls;
                    case "responsive" -> d.responsive = !d.responsive;
                    case "spec" -> d.spec = !d.spec;
                    case "tnt" -> d.tnt = !d.tnt;
                    case "loot" -> d.loot = !d.loot;
                }
                settings(player);
            }
            case "cancel" -> {
                drafts.remove(player.getUniqueId());
                player.closeInventory();
            }
            case "send" -> {
                if (!p.data.getBoolean("built-battle-maps-v5")) {
                    p.tell(player, "New maps are still being built. Try shortly.");
                    return true;
                }
                var selected = BattleMaps.get(d.map);
                if (selected == null || !selected.supports(d.kit) || BattleMaps.available(p, d.map, d.kit) == 0) {
                    p.tell(player, "That arena is unavailable. Choose another biome or size.");
                    maps(player);
                    return true;
                }
                if (d.party) {
                    p.partyBattles.start(player, d);
                    return true;
                }
                if (d.bot) {
                    if (player.isOp()) p.bots.start(player, d);
                    return true;
                }
                Player other = d.opponent == null ? null : Bukkit.getPlayer(d.opponent);
                if (other == null || other.equals(player) || p.busy(other) || !p.flag(other, "invites", true)) {
                    p.tell(player, "Opponent unavailable.");
                    return true;
                }
                var old = p.invites.get(d.opponent);
                if (old != null && old.expires() > System.currentTimeMillis()) {
                    p.tell(player, "Opponent already has a pending invitation.");
                    return true;
                }
                p.invites.put(d.opponent, new CommunityArena.Invite(player.getUniqueId(), d.kit, d.rounds, System.currentTimeMillis() + 60000, d.custom == null ? null : SavedKits.copy(d.custom), d.rules()));
                p.tell(other, player.getName() + " challenges you: " + d.kit + " / " + BattleMaps.get(d.map).name() + " / first to " + d.rounds + ". Pearls-wall=" + d.pearls + ", movement=" + d.responsive + ", spectators=" + d.spec + ", auto-TNT=" + d.tnt + ", loot=" + d.loot + ". /duel accept " + player.getName());
                p.tell(player, "Challenge sent (60 seconds).");
                player.closeInventory();
            }
        }
        return true;
    }
}
