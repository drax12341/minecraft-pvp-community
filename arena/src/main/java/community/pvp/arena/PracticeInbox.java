package community.pvp.arena;

import java.util.*;
import org.bukkit.*;
import org.bukkit.entity.Player;

final class PracticeInbox {
  final CommunityArena p;

  PracticeInbox(CommunityArena p) {
    this.p = p;
  }

  List<Map<String, Object>> entries(UUID id) {
    List<Map<String, Object>> result = new ArrayList<>();
    for (var raw : p.data.getMapList("players." + id + ".inbox")) {
      var copy = new LinkedHashMap<String, Object>();
      raw.forEach((k, v) -> copy.put(k.toString(), v));
      result.add(copy);
    }
    return result;
  }

  void add(UUID id, String title, String detail) {
    var list = entries(id);
    var note = new LinkedHashMap<String, Object>();
    note.put("id", UUID.randomUUID().toString());
    note.put("title", title);
    note.put("detail", detail);
    note.put("time", System.currentTimeMillis());
    note.put("read", false);
    list.addFirst(note);
    if (list.size() > 50) list = list.subList(0, 50);
    p.data.set("players." + id + ".inbox", list);
  }

  int unread(UUID id) {
    return (int) entries(id).stream().filter(m -> !Boolean.TRUE.equals(m.get("read"))).count();
  }

  void mark(Player player, String id) {
    if (!id.matches("[a-f0-9-]{36}")) return;
    var list = entries(player.getUniqueId());
    for (var note : list) if (note.get("id").equals(id)) note.put("read", true);
    p.data.set("players." + player.getUniqueId() + ".inbox", list);
    p.save();
    open(player, 0);
  }

  void open(Player player, int page) {
    var list = entries(player.getUniqueId());
    boolean unreadOnly =
        p.data.getBoolean("players." + player.getUniqueId() + ".ui.inboxUnread", true);
    if (unreadOnly)
      list = list.stream().filter(note -> !Boolean.TRUE.equals(note.get("read"))).toList();
    page = Math.max(0, Math.min(page, Math.max(0, (list.size() - 1) / 21)));
    var inv = p.menus.frame(54, "Community | Inbox (" + unread(player.getUniqueId()) + ")");
    for (int i = 0; i < 21 && page * 21 + i < list.size(); i++) {
      var note = list.get(page * 21 + i);
      boolean read = Boolean.TRUE.equals(note.get("read"));
      long age =
          Math.max(
              0, (System.currentTimeMillis() - ((Number) note.get("time")).longValue()) / 60000);
      inv.setItem(
          10 + i + i / 7 * 2,
          p.item(
              read ? Material.PAPER : Material.WRITABLE_BOOK,
              (read ? "Read | " : "New | ") + note.get("title"),
              "notice:" + note.get("id"),
              String.valueOf(note.get("detail")),
              age + " minutes ago",
              "Click to mark as read"));
    }
    inv.setItem(
        4,
        p.item(
            Material.COMPARATOR,
            unreadOnly ? "Unread only" : "All notifications",
            "inbox-filter",
            "Click to change"));
    if (list.isEmpty())
      inv.setItem(
          22,
          p.item(
              Material.PAPER, "You're all caught up", null, "Rewards and promotions appear here"));
    inv.setItem(45, p.item(Material.ARROW, "Previous", "inbox-page:" + (page - 1)));
    inv.setItem(49, p.item(Material.CLOCK, "Navigation", "navigation"));
    inv.setItem(53, p.item(Material.ARROW, "Next", "inbox-page:" + (page + 1)));
    player.openInventory(inv);
  }
}
