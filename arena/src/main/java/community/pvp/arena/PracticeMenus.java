package community.pvp.arena;

import java.util.*;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.*;
import org.bukkit.*;
import org.bukkit.entity.Player;
import org.bukkit.inventory.*;

final class PracticeMenus {
    final CommunityArena p;

    PracticeMenus(CommunityArena p) {
        this.p = p;
    }

    static Component title(String text) {
        return Component.text(text, NamedTextColor.DARK_GRAY);
    }

    Inventory frame(int size, String name) {
        Inventory inv = ArenaMenu.create(size, title(name));
        for (int i = 0; i < size; i++)
            if (i < 9 || i >= size - 9 || i % 9 == 0 || i % 9 == 8)
                inv.setItem(i, p.item(Material.GRAY_STAINED_GLASS_PANE, " ", null));
        return inv;
    }

    void hub(Player player) {
        Inventory inv = frame(45, "Community | Navigation");
        inv.setItem(
                11,
                p.item(
                        Material.IRON_SWORD,
                        "Practice Duels",
                        "menu",
                        "Pick a kit, queue or arrange your inventory"));
        inv.setItem(
                13,
                p.item(
                        Material.NETHERITE_SWORD,
                        "Ranked Duels",
                        "ranked",
                        "Earn server Elo and climb the divisions"));
        inv.setItem(
                15,
                p.item(
                        Material.SPYGLASS,
                        "Watch a duel",
                        "spectate-menu",
                        "Only active, spectatable matches appear"));
        inv.setItem(
                20, p.item(Material.GOLD_INGOT, "Leaderboards", "leaderboard", "Real server records only"));
        inv.setItem(
                22,
                p.item(
                        Material.ENDER_CHEST,
                        "Rewards & Cosmetics",
                        "rewards",
                        "Daily quests, cases and unlocked effects"));
        inv.setItem(
                24,
                p.item(
                        Material.REPEATER,
                        "Your Settings",
                        "settings",
                        "Sidebar, tags, sounds, invitations and more"));
        inv.setItem(
                40,
                p.item(
                        Material.BOOK,
                        "How to play",
                        null,
                        "Sword opens kit selection",
                        "Right-click a kit for your inventory layout",
                        "Shift in countdown: both players can ready early"));
        inv.setItem(30, p.item(Material.ANVIL, "Kit Layout Editor", "layout-picker", "Arrange the nine reference presets"));
        inv.setItem(29, p.item(Material.WRITABLE_BOOK, "Notifications", "inbox"));
        inv.setItem(31, p.item(Material.PURPLE_SHULKER_BOX, "Saved Custom Kits", "saved-kits"));
        inv.setItem(33, p.item(Material.DIAMOND, "Detailed Statistics", "statistics"));
        player.openInventory(inv);
    }

    void kits(Player player, boolean ranked) {
        p.reference.queues(player, ranked ? "ranked" : "casual");
    }

    void kit(Player player, String kit, boolean ranked) {
        if (!p.kit(kit)) return;
        Inventory inv = frame(27, Loadouts.name(kit) + " | " + (ranked ? "Ranked" : "Practice"));
        inv.setItem(
                11,
                Loadouts.menuIcon(
                        p,
                        kit,
                        "Join queue",
                        (ranked ? "ranked:" : "queue:") + kit,
                        "First to " + (ranked ? p.rankedRounds(kit) : 1),
                        "Both players receive the same items"));
        inv.setItem(
                13,
                p.item(
                        Material.CHEST,
                        "Inventory layout",
                        "layout:" + kit,
                        "Reorder your kit without changing its items"));
        inv.setItem(
                15,
                p.item(
                        Material.PAPER,
                        "Kit statistics",
                        null,
                        "Elo: " + p.progression.elo(player.getUniqueId(), kit),
                        "Wins: " + p.progression.kitNumber(player.getUniqueId(), kit, "wins"),
                        "Losses: " + p.progression.kitNumber(player.getUniqueId(), kit, "losses")));
        inv.setItem(18, p.item(Material.ARROW, "Back", ranked ? "ranked" : "menu"));
        player.openInventory(inv);
    }

    void settings(Player player) {
        Inventory inv = frame(45, "Community | Settings");
        String[] flags = {
                "scoreboard",
                "invites",
                "hitsounds",
                "spectators",
                "nametags",
                "health",
                "chat",
                "victory",
                "animations"
        };
        int i = 0;
        for (String flag : flags) {
            int slot = 10 + i + i / 7 * 2;
            inv.setItem(
                    slot,
                    p.item(
                            p.flag(player, flag, true) ? Material.LIME_DYE : Material.GRAY_DYE,
                            flag + ": " + (p.flag(player, flag, true) ? "ON" : "OFF"),
                            "setting:" + flag,
                            "Click to toggle; saved between sessions"));
            i++;
        }
        inv.setItem(
                24,
                p.item(
                        Material.CLOCK,
                        "Personal time: " + p.reference.pref(player, "time", "server"),
                        "time-cycle",
                        "Left: next | Right: previous | Shift: reset"));
        inv.setItem(36, p.item(Material.ARROW, "Navigation", "navigation"));
        inv.setItem(
                40,
                p.item(
                        Material.OAK_DOOR,
                        "Exit practice",
                        "exit",
                        "Restore your original inventory and location"));
        player.openInventory(inv);
    }

    void leaderboard(Player player, String stat) {
        p.reference.board(player, stat, 0, false);
    }

    void spectators(Player player) {
        Inventory inv = frame(54, "Community | Spectate");
        int i = 0;
        for (var m : new HashSet<>(p.matches.values())) {
            if (i >= 28) break;
            Player a = Bukkit.getPlayer(m.a), b = Bukkit.getPlayer(m.b);
            if (m.ended
                    || a == null
                    || b == null
                    || !p.flag(a, "spectators", true)
                    || !p.flag(b, "spectators", true)) continue;
            inv.setItem(
                    10 + i + i / 7 * 2,
                    Loadouts.menuIcon(
                            p,
                            m.kit,
                            a.getName() + " vs " + b.getName(),
                            "watch:" + a.getName(),
                            Loadouts.name(m.kit) + " | " + m.sa + " : " + m.sb,
                            "Click to watch"));
            i++;
        }
        if (i == 0) inv.setItem(22, p.item(Material.SPYGLASS, "No live public duels", null));
        inv.setItem(45, p.item(Material.ARROW, "Navigation", "navigation"));
        player.openInventory(inv);
    }

    void rewards(Player player) {
        Inventory inv = frame(27, "Community | Rewards");
        inv.setItem(
                11,
                p.item(
                        Material.BOOK,
                        "Daily quest",
                        "quests",
                        "Play five sets and win three",
                        "Reward: one cosmetic case"));
        inv.setItem(
                13,
                p.item(
                        Material.ENDER_CHEST,
                        "Open a case",
                        "cases",
                        "Owned: " + p.progression.number(player.getUniqueId(), "cases")));
        inv.setItem(
                15,
                p.item(
                        Material.NETHER_STAR,
                        "Your cosmetics",
                        "cosmetics-menu",
                        "Select an unlocked effect or title"));
        inv.setItem(18, p.item(Material.ARROW, "Navigation", "navigation"));
        player.openInventory(inv);
    }

    void cosmetics(Player player) {
        Inventory inv = frame(27, "Community | Cosmetics");
        int i = 0;
        for (String reward : p.data.getStringList("players." + player.getUniqueId() + ".cosmetics")) {
            if (i >= 7) break;
            inv.setItem(
                    10 + i++, p.item(Material.NETHER_STAR, reward, "cosmetic:" + reward, "Click to equip"));
        }
        inv.setItem(22, p.item(Material.BARRIER, "Remove cosmetics", "cosmetic:none"));
        inv.setItem(18, p.item(Material.ARROW, "Rewards", "rewards"));
        player.openInventory(inv);
    }
}
