package community.pvp.arena;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.WeekFields;
import java.util.*;
import org.bukkit.entity.Player;

/** Bounded UTC aggregates; unavailable pre-v4 filter history is never invented. */
final class PracticeInsights {
  final CommunityArena p;
  final Map<UUID, Long> sessions = new HashMap<>();

  record Stats(int wins, int losses, int kills, int deaths, int streak, int best, int seconds) {
    int games() {
      return wins + losses;
    }

    String winRate() {
      return String.format(Locale.ROOT, "%.2f%%", games() == 0 ? 0 : wins * 100.0 / games());
    }
  }

  PracticeInsights(CommunityArena p) {
    this.p = p;
  }

  static String day(Instant time) {
    return time.atZone(ZoneOffset.UTC).toLocalDate().format(DateTimeFormatter.BASIC_ISO_DATE);
  }

  static String week(Instant time) {
    var date = time.atZone(ZoneOffset.UTC).toLocalDate();
    return String.format(
        Locale.ROOT,
        "%04dW%02d",
        date.get(WeekFields.ISO.weekBasedYear()),
        date.get(WeekFields.ISO.weekOfWeekBasedYear()));
  }

  String root(UUID id) {
    return "players." + id + ".analytics.";
  }

  Stats read(String key) {
    List<Integer> values = p.data.getIntegerList(key);
    return values.size() == 7
        ? new Stats(
            values.get(0),
            values.get(1),
            values.get(2),
            values.get(3),
            values.get(4),
            values.get(5),
            values.get(6))
        : new Stats(0, 0, 0, 0, 0, 0, 0);
  }

  Stats view(UUID id, String scope, String period, String kit) {
    return view(id, scope, period, kit, Instant.now());
  }

  Stats view(UUID id, String scope, String period, String kit, Instant now) {
    if (!Set.of("both", "ranked", "casual").contains(scope)
        || !Set.of("all", "day", "week").contains(period)
        || !kit.equals("global") && !kit.equals("custom") && !p.kit(kit))
      throw new IllegalArgumentException("Unknown statistics filter");
    if (scope.equals("both") && period.equals("all")) {
      boolean global = kit.equals("global");
      return new Stats(
          global ? p.progression.number(id, "wins") : p.progression.kitNumber(id, kit, "wins"),
          global ? p.progression.number(id, "losses") : p.progression.kitNumber(id, kit, "losses"),
          global ? p.progression.number(id, "kills") : p.progression.kitNumber(id, kit, "kills"),
          global ? p.progression.number(id, "deaths") : p.progression.kitNumber(id, kit, "deaths"),
          global ? p.progression.number(id, "streak") : p.progression.kitNumber(id, kit, "streak"),
          global
              ? p.progression.number(id, "bestStreak")
              : p.progression.kitNumber(id, kit, "bestStreak"),
          0);
    }
    return read(
        root(id)
            + (period.equals("all")
                ? "all"
                : period.equals("day") ? "days." + day(now) : "weeks." + week(now))
            + "."
            + scope
            + "."
            + kit);
  }

  void result(CommunityArena.Match m, UUID winner) {
    record(m, winner, Instant.now());
  }

  void record(CommunityArena.Match m, UUID winner, Instant time) {
    if (winner == null) return;
    for (UUID id : List.of(m.a, m.b)) {
      boolean win = id.equals(winner);
      int kills = m.roundKills.getOrDefault(id, 0), deaths = m.roundDeaths.getOrDefault(id, 0);
      String player = "players." + id + ".kits." + m.kit + ".";
      p.data.set(player + "kills", p.data.getInt(player + "kills") + kills);
      p.data.set(player + "deaths", p.data.getInt(player + "deaths") + deaths);
      p.data.set(
          player + "bestStreak",
          Math.max(
              p.data.getInt(player + "bestStreak"), p.progression.kitNumber(id, m.kit, "streak")));
      for (String period : List.of("all", "days." + day(time), "weeks." + week(time)))
        for (String scope : List.of("both", m.ranked ? "ranked" : "casual"))
          for (String kit : List.of("global", m.kit)) {
            String key = root(id) + period + "." + scope + "." + kit;
            Stats old = read(key);
            int streak = win ? old.streak + 1 : 0;
            p.data.set(
                key,
                List.of(
                    old.wins + (win ? 1 : 0),
                    old.losses + (win ? 0 : 1),
                    old.kills + kills,
                    old.deaths + deaths,
                    streak,
                    Math.max(old.best, streak),
                    old.seconds
                        + (int) Math.max(0, (System.currentTimeMillis() - m.started) / 1000)));
          }
      trim(root(id) + "days", 35);
      trim(root(id) + "weeks", 12);
    }
  }

  void trim(String path, int cap) {
    var section = p.data.getConfigurationSection(path);
    if (section == null) return;
    var keys = section.getKeys(false).stream().sorted().toList();
    for (int i = 0; i < keys.size() - cap; i++) p.data.set(path + "." + keys.get(i), null);
  }

  void join(Player player) {
    UUID id = player.getUniqueId();
    sessions.putIfAbsent(id, System.currentTimeMillis());
    String key = "players." + id + ".firstSeen";
    if (!p.data.contains(key)) p.data.set(key, System.currentTimeMillis());
  }

  long playtime(UUID id) {
    return p.data.getLong("players." + id + ".playtime")
        + Math.max(
            0,
            (System.currentTimeMillis() - sessions.getOrDefault(id, System.currentTimeMillis()))
                / 1000);
  }

  void leave(Player player) {
    UUID id = player.getUniqueId();
    long seconds = playtime(id);
    sessions.remove(id);
    p.data.set("players." + id + ".playtime", seconds);
  }

  static String ratio(int a, int b) {
    return b == 0
        ? (a == 0 ? "0.00" : "Perfect")
        : String.format(Locale.ROOT, "%.2f", a / (double) b);
  }
}
