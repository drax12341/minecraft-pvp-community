package community.pvp.arena;

import java.util.*;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.*;
import org.bukkit.entity.*;
import org.bukkit.inventory.*;
import org.bukkit.scoreboard.*;

final class ArenaVisuals {
  final CommunityArena p;
  final Map<String, UUID> holograms = new HashMap<>();
  final Map<UUID, Scoreboard> boards = new HashMap<>();

  ArenaVisuals(CommunityArena p) {
    this.p = p;
  }

  List<UUID> leaders(String stat) {
    var section = p.data.getConfigurationSection("players");
    if (section == null) return List.of();
    return section.getKeys(false).stream()
        .filter(s -> s.matches("[a-f0-9-]{36}"))
        .map(UUID::fromString)
        .filter(
            id ->
                p.progression.number(
                        id,
                        stat.equals("elo")
                            ? "rankedGames"
                            : stat.equals("deaths") ? "deaths" : "games")
                    > 0)
        .sorted(
            Comparator.<UUID>comparingInt(
                    id ->
                        stat.equals("elo") ? p.progression.elo(id) : p.progression.number(id, stat))
                .reversed()
                .thenComparing(UUID::toString))
        .limit(10)
        .toList();
  }

  List<String> lines(String stat) {
    List<String> text = new ArrayList<>();
    text.add("§d§lCOMMUNITY §f§l" + stat.toUpperCase(Locale.ROOT));
    int n = 1;
    for (UUID id : leaders(stat))
      text.add(
          "§7"
              + (n++)
              + ". §f"
              + p.progression.name(id)
              + " §d"
              + (stat.equals("elo") ? p.progression.elo(id) : p.progression.number(id, stat)));
    if (text.size() == 1) text.add("§7No completed matches yet");
    return text;
  }

  void leaderboard(Player player, String stat) {
    if (!List.of("elo", "wins", "deaths", "streak", "bestStreak").contains(stat)) {
      p.tell(player, "/leaderboard elo|wins|deaths|streak|bestStreak");
      return;
    }
    for (String line : lines(stat)) player.sendMessage(line);
  }

  void refreshHolograms() {
    for (UUID id : holograms.values()) {
      Entity entity = Bukkit.getEntity(id);
      if (entity != null) entity.remove();
    }
    holograms.clear();
    var section = p.data.getConfigurationSection("holograms");
    if (section == null) return;
    for (String id : section.getKeys(false)) {
      Location l = p.data.getLocation("holograms." + id + ".location");
      if (l == null) continue;
      l.getChunk().load();
      // Remove only displays tagged by this plugin, including survivors of an unclean restart.
      for (Entity entity : l.getChunk().getEntities())
        if (entity.getScoreboardTags().contains("communityarena-holo-" + id)) entity.remove();
      TextDisplay display = l.getWorld().spawn(l, TextDisplay.class);
      display.setPersistent(false);
      display.addScoreboardTag("communityarena-holo-" + id);
      display.setBillboard(Display.Billboard.CENTER);
      display.setSeeThrough(false);
      display.setShadowed(true);
      display.setLineWidth(350);
      display.text(
          net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer.legacySection()
              .deserialize(
                  String.join("\n", lines(p.data.getString("holograms." + id + ".stat", "elo")))));
      holograms.put(id, display.getUniqueId());
    }
  }

  void board(Player player) {
    UUID id = player.getUniqueId();
    var match = p.matches.get(id);
    if (match == null) match = p.social.spectators.get(id);
    String status =
        match != null
            ? (match.ranked ? "Ranked " : "Duel ") + match.kit
            : p.ffa.contains(id) ? "Sword FFA" : "Practice lobby";
    if (p.flag(player, "scoreboard", true)) {
      Scoreboard board =
          boards.computeIfAbsent(
              id,
              k -> {
                Scoreboard b = Bukkit.getScoreboardManager().getNewScoreboard();
                Objective o =
                    b.registerNewObjective("arena", Criteria.DUMMY, p.text("COMMUNITY PVP"));
                o.setDisplaySlot(DisplaySlot.SIDEBAR);
                return b;
              });
      for (String entry : board.getEntries()) board.resetScores(entry);
      List<String> rows =
          new ArrayList<>(
              List.of(
                  "§8??????????????????",
                  "§f" + status,
                  "§7Rank: §d" + p.progression.rank(id),
                  "§7Elo: §f" + p.progression.elo(id),
                  "§7Wins: §f" + p.progression.number(id, "wins"),
                  "§7Deaths: §f" + p.progression.number(id, "deaths"),
                  "§7Streak: §f" + p.progression.number(id, "streak")));
      if (match != null) {
        UUID opponent = match.a.equals(id) ? match.b : match.a;
        Player other = Bukkit.getPlayer(opponent);
        rows.add("§7Opponent: §f" + p.progression.name(opponent));
        rows.add(
            "§7Ping: §f" + player.getPing() + " / " + (other == null ? 0 : other.getPing()) + "ms");
        rows.add("§7Score: §d" + match.sa + " : " + match.sb);
        rows.add("§7Time: §f" + (System.currentTimeMillis() - match.started) / 1000 + "s");
        rows.add(
            "§7Spectators: §f"
                + Collections.frequency(new ArrayList<>(p.social.spectators.values()), match));
      } else {
        rows.add("§7Queue: §f" + p.queues.size());
        rows.add("§7Ping: §f" + player.getPing() + "ms");
      }
      rows.add("§8/duel /ranked /quests");
      int i = rows.size();
      for (String row : rows) board.getObjective("arena").getScore(row).setScore(i--);
      player.setScoreboard(board);
    } else player.setScoreboard(Bukkit.getScoreboardManager().getMainScoreboard());
    String versus =
        match == null
            ? "Choose a kit • /ranked • /duel"
            : p.progression.name(match.a)
                + " vs "
                + p.progression.name(match.b)
                + " • Spectators "
                + Collections.frequency(new ArrayList<>(p.social.spectators.values()), match);
    player.sendPlayerListHeaderAndFooter(
        p.text("COMMUNITY PVP\n" + versus),
        Component.text(
            "Your ping "
                + player.getPing()
                + "ms • "
                + p.progression.rank(id)
                + " • "
                + p.progression.elo(id)
                + " Elo",
            NamedTextColor.GRAY));
    player.playerListName(
        Component.text(
            p.data.getString("players." + id + ".title", "")
                + " "
                + player.getName()
                + " | "
                + player.getPing()
                + "ms"));
  }

  void victory(Player player) {
    player.showTitle(
        net.kyori.adventure.title.Title.title(
            Component.text("VICTORY", NamedTextColor.GOLD),
            p.text("Well played • Returning to lobby"),
            net.kyori.adventure.title.Title.Times.times(
                java.time.Duration.ofMillis(200),
                java.time.Duration.ofSeconds(2),
                java.time.Duration.ofMillis(400))));
    player.playSound(player.getLocation(), Sound.UI_TOAST_CHALLENGE_COMPLETE, 0.6f, 1.2f);
    String effect = p.data.getString("players." + player.getUniqueId() + ".effect", "spark");
    Particle particle =
        effect.equals("heart")
            ? Particle.HEART
            : effect.equals("soul") ? Particle.SOUL : Particle.END_ROD;
    for (int t = 0; t < 4; t++) {
      int step = t;
      Bukkit.getScheduler()
          .runTaskLater(
              p,
              () -> {
                if (player.isOnline())
                  player
                      .getWorld()
                      .spawnParticle(
                          particle,
                          player.getLocation().add(0, 1 + step * 0.2, 0),
                          20,
                          0.7,
                          0.4,
                          0.7,
                          0.03);
              },
              t * 8L);
    }
  }

  void close() {
    for (UUID id : holograms.values()) {
      Entity e = Bukkit.getEntity(id);
      if (e != null) e.remove();
    }
    holograms.clear();
    boards.clear();
  }
}
