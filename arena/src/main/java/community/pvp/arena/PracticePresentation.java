package community.pvp.arena;

import io.papermc.paper.event.player.AsyncChatEvent;
import java.util.*;
import net.kyori.adventure.text.*;
import net.kyori.adventure.text.event.*;
import net.kyori.adventure.text.format.*;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.*;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.player.*;
import org.bukkit.scoreboard.*;

final class PracticePresentation implements Listener {
  final CommunityArena p;
  final Map<UUID, UUID> tags = new HashMap<>();

  record Identity(String name, String division, String room, boolean chat) {}

  volatile Map<UUID, Identity> identities = Map.of();

  PracticePresentation(CommunityArena p) {
    this.p = p;
    Bukkit.getPluginManager().registerEvents(this, p);
    Bukkit.getScheduler().runTaskTimer(p, this::nameplates, 5, 5);
  }

  static Component ui(String text) {
    return LegacyComponentSerializer.legacySection().deserialize(text);
  }

  static String time(long millis) {
    long seconds = Math.max(0, millis / 1000);
    return String.format(Locale.ROOT, "%02d:%02d", seconds / 60, seconds % 60);
  }

  static String color(int elo) {
    return elo < 800
        ? "§6"
        : elo < 1000
            ? "§f"
            : elo < 1200 ? "§e" : elo < 1450 ? "§a" : elo < 1700 ? "§b" : elo < 2000 ? "§5" : "§d";
  }

  CommunityArena.Match match(UUID id) {
    var m = p.matches.get(id);
    return m != null ? m : p.social.spectators.get(id);
  }

  int rating(UUID id) {
    var m = match(id);
    return m != null ? p.progression.elo(id, m.kit) : p.progression.elo(id);
  }

  String badge(UUID id) {
    int elo = rating(id);
    return color(elo)
        + (match(id) == null && p.progression.rank(id).equals("#1 Champion")
            ? "#1 Champion"
            : Rating.division(elo))
        + " §7("
        + elo
        + ")";
  }

  String room(UUID id) {
    if (p.social.spectators.containsKey(id)) return "spec:" + p.social.spectators.get(id).a;
    if (p.matches.containsKey(id)) return "duel:" + p.matches.get(id).a;
    if (p.ffa.contains(id)) return "ffa";
    return "lobby";
  }

  boolean visible(Player viewer, Player target) {
    UUID v = viewer.getUniqueId(), t = target.getUniqueId();
    if (v.equals(t)) return true;
    if (!p.managed(target)) return false;
    var watched = p.social.spectators.get(v);
    if (watched != null)
      return p.matches.get(t) == watched || p.social.spectators.get(t) == watched;
    return room(v).equals(room(t));
  }

  void tick() {
    Map<UUID, Identity> next = new HashMap<>();
    for (UUID id : p.participants) {
      Player player = Bukkit.getPlayer(id);
      if (player == null) continue;
      next.put(
          id, new Identity(player.getName(), badge(id), room(id), p.flag(player, "chat", true)));
      for (Player other : Bukkit.getOnlinePlayers()) {
        if (visible(player, other)) player.showPlayer(p, other);
        else player.hidePlayer(p, other);
      }
      player.playerListName(
          ui(
              (p.social.spectators.containsKey(id)
                      ? "§8[SPEC] "
                      : color(rating(id)) + rating(id) + " §8│ ")
                  + "§f"
                  + player.getName()
                  + " §6"
                  + p.data.getString("players." + id + ".title", "")
                  + " §7"
                  + player.getPing()
                  + "ms"));
      String queue = p.queues.get(id);
      if (queue != null)
        player.sendActionBar(
            ui(
                "§fIn queue §8│ §e"
                    + Loadouts.name(queue.replace("ranked:", ""))
                    + " §8│ §f"
                    + time(
                        System.currentTimeMillis()
                            - p.progression.queuedAt.getOrDefault(id, System.currentTimeMillis()))
                    + " §8│ §7/leave"));
    }
    identities = Map.copyOf(next);
  }

  List<String> rows(Player player) {
    UUID id = player.getUniqueId();
    var m = match(id);
    List<String> rows = new ArrayList<>();
    rows.add("§8──────────────────");
    if (m == null) {
      String q = p.queues.get(id);
      rows.add("§7Division");
      rows.add(badge(id));
      rows.add("§7Rating §f" + p.progression.elo(id));
      rows.add(" ");
      rows.add("§7Online §f" + p.participants.size() + " §8│ §7In fights §f" + p.matches.size());
      rows.add(
          "§7Wins §f"
              + p.progression.number(id, "wins")
              + " §8│ §7Kills §f"
              + p.progression.number(id, "kills"));
      rows.add("§7Streak §e" + p.progression.number(id, "streak"));
      rows.add(
          q == null
              ? "§7Queue §fNot queued"
              : "§eQueue §f" + Loadouts.name(q.replace("ranked:", "")));
    } else {
      rows.add("§7Kit §e" + Loadouts.name(m.kit));
      rows.add("§7Duration §f" + time(System.currentTimeMillis() - m.roundStarted));
      rows.add("§7Round §f" + (m.sa + m.sb + 1) + " §8(FT" + m.target + ")");
      rows.add(" ");
      rows.add("§9" + p.progression.name(m.a) + " §f" + m.sa);
      rows.add("§c" + p.progression.name(m.b) + " §f" + m.sb);
      Player a = Bukkit.getPlayer(m.a), b = Bukkit.getPlayer(m.b);
      rows.add(
          "§7Ping §9"
              + (a == null ? 0 : a.getPing())
              + " §8/ §c"
              + (b == null ? 0 : b.getPing())
              + "ms");
      rows.add(
          "§7Spectators §f"
              + Collections.frequency(new ArrayList<>(p.social.spectators.values()), m));
      if (m.kit.equals("boxing"))
        rows.add(
            "§7Hits §9" + m.hits.getOrDefault(m.a, 0) + " §8/ §c" + m.hits.getOrDefault(m.b, 0));
      rows.add(m.ended ? "§eReturning to lobby..." : m.paused ? "§eStarting..." : "§aIn progress");
    }
    rows.add("  ");
    rows.add(
        "§7"
            + p.getConfig().getString("presentation.region", "Standalone")
            + " §8(§e"
            + player.getPing()
            + "ms§8)");
    rows.add("§8──────────────────");
    return rows;
  }

  void board(Player player) {
    UUID id = player.getUniqueId();
    var m = match(id);
    Scoreboard board =
        p.visuals.boards.computeIfAbsent(id, k -> Bukkit.getScoreboardManager().getNewScoreboard());
    Objective sidebar = board.getObjective("practice");
    if (sidebar == null) {
      sidebar =
          board.registerNewObjective(
              "practice",
              Criteria.DUMMY,
              ui(
                  "§e§l"
                      + p.getConfig().getString("presentation.brand", "Community")
                      + " §8- §fLobby"));
      if (p.getConfig().getBoolean("presentation.hide-score-numbers", true))
        sidebar.numberFormat(io.papermc.paper.scoreboard.numbers.NumberFormat.blank());
    }
    sidebar.displayName(
        ui(
            "§e§l"
                + p.getConfig().getString("presentation.brand", "Community")
                + " §8- §f"
                + (m != null ? "Duels" : p.ffa.contains(id) ? "FFA" : "Lobby")));
    if (p.flag(player, "scoreboard", true)) sidebar.setDisplaySlot(DisplaySlot.SIDEBAR);
    else board.clearSlot(DisplaySlot.SIDEBAR);
    List<String> rows = rows(player);
    for (int i = 0; i < 15; i++) {
      String entry = "§" + Integer.toHexString(i) + "§r";
      String teamName = "row" + i;
      Team team = board.getTeam(teamName);
      if (team == null) {
        team = board.registerNewTeam(teamName);
        team.addEntry(entry);
      }
      if (i < rows.size()) {
        team.prefix(ui(rows.get(i)));
        sidebar.getScore(entry).setScore(15 - i);
      } else board.resetScores(entry);
    }
    Objective health = board.getObjective("health");
    if (health == null) health = board.registerNewObjective("health", Criteria.DUMMY, ui("§c♥"));
    if (m != null && p.flag(player, "health", true)) health.setDisplaySlot(DisplaySlot.BELOW_NAME);
    else board.clearSlot(DisplaySlot.BELOW_NAME);
    Set<String> active = new HashSet<>();
    for (UUID otherId : p.participants) {
      Player other = Bukkit.getPlayer(otherId);
      if (other == null || !visible(player, other)) continue;
      String key = "p" + otherId.toString().replace("-", "").substring(0, 15);
      active.add(key);
      Team team = board.getTeam(key);
      if (team == null) team = board.registerNewTeam(key);
      team.addEntry(other.getName());
      team.color(
          m != null && otherId.equals(m.b)
              ? NamedTextColor.RED
              : m != null && otherId.equals(m.a) ? NamedTextColor.BLUE : NamedTextColor.WHITE);
      team.setOption(
          Team.Option.COLLISION_RULE,
          m == null ? Team.OptionStatus.NEVER : Team.OptionStatus.ALWAYS);
      team.prefix(
          p.getConfig().getBoolean("presentation.nametags", true)
              ? Component.empty()
              : ui(p.flag(player, "nametags", true) ? badge(otherId) + " " : ""));
      health
          .getScore(other.getName())
          .setScore((int) Math.ceil(other.getHealth() + other.getAbsorptionAmount()));
    }
    for (Team team : new HashSet<>(board.getTeams()))
      if (team.getName().startsWith("p") && !active.contains(team.getName())) team.unregister();
    player.setScoreboard(board);
    String middle =
        m == null
            ? "§7" + p.participants.size() + " players online"
            : "§9"
                + p.progression.name(m.a)
                + " §8vs §c"
                + p.progression.name(m.b)
                + "\n§7Spectators §f"
                + Collections.frequency(new ArrayList<>(p.social.spectators.values()), m);
    player.sendPlayerListHeaderAndFooter(
        ui(
            "\n§e§l"
                + p.getConfig().getString("presentation.brand", "Community")
                + " §8- §f"
                + p.getConfig().getString("presentation.region", "Standalone")
                + "\n"
                + middle
                + "\n"),
        ui(
            "\n§e"
                + player.getPing()
                + "ms §8│ §f"
                + p.progression.elo(id)
                + " Elo\n§7"
                + p.getConfig().getString("presentation.footer", "/duel  /ranked  /profile")
                + "\n"));
  }

  void nameplates() {
    if (!p.getConfig().getBoolean("presentation.nametags", true)) return;
    for (UUID id : new HashSet<>(tags.keySet()))
      if (!p.participants.contains(id) || p.social.spectators.containsKey(id)) {
        Entity e = Bukkit.getEntity(tags.remove(id));
        if (e != null) e.remove();
      }
    for (UUID id : p.participants) {
      Player player = Bukkit.getPlayer(id);
      if (player == null || p.social.spectators.containsKey(id)) continue;
      TextDisplay display =
          tags.containsKey(id) && Bukkit.getEntity(tags.get(id)) instanceof TextDisplay d
              ? d
              : null;
      if (display == null) {
        display = player.getWorld().spawn(player.getLocation().add(0, 2.45, 0), TextDisplay.class);
        display.setPersistent(false);
        display.setBillboard(Display.Billboard.CENTER);
        display.setSeeThrough(false);
        display.setShadowed(true);
        display.setViewRange(0.6f);
        display.setTeleportDuration(5);
        tags.put(id, display.getUniqueId());
      }
      display.text(ui(badge(id)));
      display.teleport(player.getLocation().add(0, player.isSneaking() ? 2.1 : 2.45, 0));
      for (UUID viewerId : p.participants) {
        Player viewer = Bukkit.getPlayer(viewerId);
        if (viewer == null) continue;
        if (!viewerId.equals(id)
            && visible(viewer, player)
            && p.flag(viewer, "nametags", true)
            && !player.isSneaking()) viewer.showEntity(p, display);
        else viewer.hideEntity(p, display);
      }
    }
  }

  void restore(Player player) {
    UUID id = player.getUniqueId();
    var remaining = new HashMap<>(identities);
    remaining.remove(id);
    identities = Map.copyOf(remaining);
    UUID tag = tags.remove(id);
    if (tag != null) {
      Entity e = Bukkit.getEntity(tag);
      if (e != null) e.remove();
    }
    for (Player other : Bukkit.getOnlinePlayers()) {
      player.showPlayer(p, other);
      other.showPlayer(p, player);
    }
    player.sendActionBar(Component.empty());
  }

  void profile(Player player) {
    var inv = p.menus.frame(54, "Community | Your Profile");
    UUID id = player.getUniqueId();
    inv.setItem(
        4,
        p.item(
            Material.PLAYER_HEAD,
            player.getName(),
            null,
            "Division: " + Rating.division(p.progression.elo(id)),
            "Global Elo: " + p.progression.elo(id),
            "Wins: "
                + p.progression.number(id, "wins")
                + " | Deaths: "
                + p.progression.number(id, "deaths"),
            "Best streak: " + p.progression.number(id, "bestStreak")));
    int i = 0;
    for (String kit : CommunityArena.KITS) {
      inv.setItem(
          10 + i + i / 7 * 2,
          p.item(
              Loadouts.icon(kit),
              Loadouts.name(kit),
              "kit:r:" + kit,
              "Kit Elo: " + p.progression.elo(id, kit),
              "Wins: " + p.progression.kitNumber(id, kit, "wins"),
              "Losses: " + p.progression.kitNumber(id, kit, "losses")));
      i++;
    }
    inv.setItem(45, p.item(Material.ARROW, "Navigation", "navigation"));
    player.openInventory(inv);
  }

  void matchIntro(CommunityArena.Match m) {
    for (UUID id : List.of(m.a, m.b)) {
      Player player = Bukkit.getPlayer(id), other = Bukkit.getPlayer(m.other(id));
      if (player == null || other == null) continue;
      player.sendMessage(
          ui(
              "\n§8────────────────────────\n§e§l"
                  + (m.ranked ? "RANKED MATCH" : "PRACTICE MATCH")
                  + "\n§7Opponent §f"
                  + other.getName()
                  + " §8(§e"
                  + other.getPing()
                  + "ms§8)\n§7Division §f"
                  + Rating.division(p.progression.elo(other.getUniqueId(), m.kit))
                  + " §8(§f"
                  + p.progression.elo(other.getUniqueId(), m.kit)
                  + "§8)\n§7Kit §e"
                  + Loadouts.name(m.kit)
                  + " §8│ §7First to §f"
                  + m.target
                  + "\n§8────────────────────────"));
    }
  }

  void matchResult(CommunityArena.Match m, UUID winner, String reason) {
    for (UUID id : List.of(m.a, m.b)) {
      Player player = Bukkit.getPlayer(id);
      if (player == null) continue;
      int delta = m.ratingDelta.getOrDefault(id, 0);
      player.sendMessage(
          ui(
              "\n§8────────────────────────\n"
                  + (winner == null ? "§e§lDRAW" : id.equals(winner) ? "§a§lVICTORY" : "§c§lDEFEAT")
                  + " §8│ §f"
                  + m.sa
                  + " : "
                  + m.sb
                  + "\n§7Kit §f"
                  + Loadouts.name(m.kit)
                  + " §8│ §7Duration §f"
                  + time(System.currentTimeMillis() - m.started)
                  + "\n§7Kit rating §f"
                  + p.progression.elo(id, m.kit)
                  + (m.ranked ? (delta >= 0 ? " §a+" : " §c") + delta : " §8(unranked)")
                  + "\n§7Division "
                  + badge(id)
                  + "\n§7Streak §e"
                  + p.progression.number(id, "streak")
                  + " §8│ §7Best §f"
                  + p.progression.number(id, "bestStreak")
                  + "\n§8────────────────────────"));
      player.sendMessage(
          Component.text("[ Queue again ]", NamedTextColor.YELLOW)
              .clickEvent(ClickEvent.runCommand((m.ranked ? "/ranked " : "/play ") + m.kit))
              .hoverEvent(
                  HoverEvent.showText(Component.text("Available after returning to the lobby"))));
    }
  }

  @EventHandler(ignoreCancelled = true, priority = EventPriority.HIGH)
  public void chat(AsyncChatEvent e) {
    Map<UUID, Identity> snapshot = identities;
    Identity src = snapshot.get(e.getPlayer().getUniqueId());
    if (src == null) return;
    if (!src.chat) {
      e.setCancelled(true);
      return;
    }
    e.viewers()
        .removeIf(
            viewer ->
                viewer instanceof Player target
                    && (snapshot.get(target.getUniqueId()) == null
                        || !snapshot.get(target.getUniqueId()).room.equals(src.room)
                        || !snapshot.get(target.getUniqueId()).chat));
    e.renderer(
        (source, display, message, viewer) ->
            ui(src.division + " §f" + src.name + " §8» ").append(message));
  }

  @EventHandler
  public void sneak(PlayerToggleSneakEvent e) {
    var m = p.matches.get(e.getPlayer().getUniqueId());
    if (m != null && !m.ended && m.paused && e.isSneaking()) {
      m.readied.add(e.getPlayer().getUniqueId());
      e.getPlayer().sendActionBar(ui("§aReady §8│ §f" + m.readied.size() + "/2"));
    }
  }

  void close() {
    for (UUID tag : tags.values()) {
      Entity e = Bukkit.getEntity(tag);
      if (e != null) e.remove();
    }
    tags.clear();
    identities = Map.of();
  }
}
