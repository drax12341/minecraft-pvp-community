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
                            : Set.of("deaths", "kills").contains(stat) ? stat : "games")
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
    text.add("§e§lCOMMUNITY §f§l" + stat.toUpperCase(Locale.ROOT));
    int n = 1;
    for (UUID id : leaders(stat))
      text.add(
          "§7"
              + (n++)
              + ". §f"
              + p.progression.name(id)
              + " §e"
              + (stat.equals("elo") ? p.progression.elo(id) : p.progression.number(id, stat)));
    if (text.size() == 1) text.add("§7No completed matches yet");
    return text;
  }

  void leaderboard(Player player, String stat) {
    if (!List.of("elo", "wins", "kills", "deaths", "streak", "bestStreak", "games")
        .contains(stat)) {
      p.tell(player, "/leaderboard elo|wins|kills|deaths|streak|bestStreak|games");
      return;
    }
    for (String line : lines(stat)) player.sendMessage(line);
  }

  void refreshHolograms() {
    var section = p.data.getConfigurationSection("holograms");
    Set<String> live = section == null ? Set.of() : section.getKeys(false);
    for (String id : new HashSet<>(holograms.keySet()))
      if (!live.contains(id)) {
        Entity entity = Bukkit.getEntity(holograms.remove(id));
        if (entity != null) entity.remove();
      }
    for (String id : live) {
      Location l = p.data.getLocation("holograms." + id + ".location");
      if (l == null) continue;
      TextDisplay display =
          holograms.containsKey(id) && Bukkit.getEntity(holograms.get(id)) instanceof TextDisplay d
              ? d
              : null;
      if (display == null) {
        l.getChunk().load();
        for (Entity entity : l.getChunk().getEntities())
          if (entity.getScoreboardTags().contains("communityarena-holo-" + id)) entity.remove();
        display = l.getWorld().spawn(l, TextDisplay.class);
        display.setPersistent(false);
        display.addScoreboardTag("communityarena-holo-" + id);
        display.setBillboard(Display.Billboard.CENTER);
        display.setSeeThrough(false);
        display.setShadowed(true);
        display.setLineWidth(350);
        holograms.put(id, display.getUniqueId());
      } else if (!display.getLocation().equals(l)) display.teleport(l);
      display.text(
          PracticePresentation.ui(
              String.join("\n", lines(p.data.getString("holograms." + id + ".stat", "elo")))));
    }
  }

  void board(Player player) {
    if (p.presentation != null) p.presentation.board(player);
  }

  void victory(Player player) {
    if (!p.flag(player, "victory", true)) return;
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
