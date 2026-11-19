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
    player.openInventory(inv);
  }

  void kits(Player player, boolean ranked) {
    if (!p.managed(player)) p.enter(player);
    if (!p.managed(player) || p.busy(player)) return;
    Inventory inv = frame(54, ranked ? "Community | Ranked" : "Community | Practice");
    int[] slots = {10, 11, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23, 24, 25};
    int i = 0;
    for (String kit : CommunityArena.KITS) {
      long waiting =
          p.queues.values().stream().filter(((ranked ? "ranked:" : "") + kit)::equals).count();
      long playing =
          new HashSet<>(p.matches.values())
                  .stream().filter(m -> !m.ended && m.kit.equals(kit)).count()
              * 2;
      int rating = p.progression.elo(player.getUniqueId(), kit);
      inv.setItem(
          slots[i++],
          p.item(
              Loadouts.icon(kit),
              Loadouts.name(kit),
              "kit:" + (ranked ? "r:" : "u:") + kit,
              "Playing: " + playing + " | Waiting: " + waiting,
              "Your kit rating: " + rating + " | " + Rating.division(rating),
              "Left-click: queue details",
              "Right-click: arrange inventory"));
    }
    inv.setItem(45, p.item(Material.ARROW, "Navigation", "navigation"));
    inv.setItem(48, p.item(Material.IRON_SWORD, "Casual queues", "menu"));
    inv.setItem(50, p.item(Material.NETHERITE_SWORD, "Ranked queues", "ranked"));
    inv.setItem(49, p.item(Material.BARRIER, "Leave queue", "cancel-queue"));
    inv.setItem(53, p.item(Material.BOOK, "Your statistics", "profile"));
    player.openInventory(inv);
  }

  void kit(Player player, String kit, boolean ranked) {
    if (!p.kit(kit)) return;
    Inventory inv = frame(27, Loadouts.name(kit) + " | " + (ranked ? "Ranked" : "Practice"));
    inv.setItem(
        11,
        p.item(
            Loadouts.icon(kit),
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
      "scoreboard", "invites", "hitsounds", "spectators", "nametags", "health", "chat", "victory"
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
    Inventory inv = frame(54, "Community | Leaderboards");
    String[] stats = {"elo", "wins", "kills", "deaths", "streak", "bestStreak", "games"};
    for (int i = 0; i < stats.length; i++)
      inv.setItem(
          1 + i,
          p.item(
              Material.GOLD_INGOT,
              stats[i],
              "leaders:" + stats[i],
              stats[i].equals(stat) ? "Currently selected" : "Click to view"));
    int i = 0;
    for (UUID id : p.visuals.leaders(stat)) {
      inv.setItem(
          10 + i + i / 7 * 2,
          p.item(
              Material.PLAYER_HEAD,
              "#" + (i + 1) + " " + p.progression.name(id),
              null,
              stat
                  + ": "
                  + (stat.equals("elo") ? p.progression.elo(id) : p.progression.number(id, stat)),
              "Server records; not reviewed community tiers"));
      i++;
    }
    if (i == 0)
      inv.setItem(
          22, p.item(Material.PAPER, "No records yet", null, "Complete matches to appear here"));
    inv.setItem(45, p.item(Material.ARROW, "Navigation", "navigation"));
    player.openInventory(inv);
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
          p.item(
              Loadouts.icon(m.kit),
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
