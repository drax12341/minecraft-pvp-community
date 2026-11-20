package community.pvp.arena;

import java.util.*;
import org.bukkit.*;
import org.bukkit.entity.Player;

/** Ranked records belong only to this server; never writes official community tiers. */
final class Progression {
  final CommunityArena plugin;
  final Map<UUID, Long> queuedAt = new HashMap<>();
  final Map<String, Long> lastPair = new HashMap<>();
  List<UUID> ranked = List.of();

  Progression(CommunityArena p) {
    plugin = p;
  }

  String key(UUID id) {
    return "players." + id + ".";
  }

  int number(UUID id, String field) {
    return plugin.data.getInt(key(id) + field);
  }

  int elo(UUID id) {
    return plugin.data.getInt(key(id) + "elo", 600);
  }

  int elo(UUID id, String kit) {
    return plugin.data.getInt(key(id) + "kits." + kit + ".elo", 600);
  }

  int kitNumber(UUID id, String kit, String field) {
    return plugin.data.getInt(key(id) + "kits." + kit + "." + field);
  }

  void add(UUID id, String field, int count) {
    plugin.data.set(key(id) + field, number(id, field) + count);
  }

  void remember(Player p) {
    plugin.data.set(key(p.getUniqueId()) + "name", p.getName());
  }

  String name(UUID id) {
    return plugin.data.getString(key(id) + "name", id.toString().substring(0, 8));
  }

  void refresh() {
    var section = plugin.data.getConfigurationSection("players");
    if (section == null) {
      ranked = List.of();
      return;
    }
    ranked =
        section.getKeys(false).stream()
            .filter(s -> s.matches("[0-9a-f-]{36}"))
            .map(UUID::fromString)
            .filter(id -> number(id, "rankedGames") > 0)
            .sorted(
                Comparator.<UUID>comparingInt(this::elo).reversed().thenComparing(UUID::toString))
            .toList();
  }

  String rank(UUID id) {
    return !ranked.isEmpty() && ranked.getFirst().equals(id) ? "#1 Champion" : Rating.rank(elo(id));
  }

  void result(CommunityArena.Match m, UUID winner) {
    if (winner == null) return;
    UUID loser = m.other(winner);
    beginDay(m.a);
    beginDay(m.b);
    for (UUID id : List.of(m.a, m.b)) {
      add(id, id.equals(winner) ? "wins" : "losses", 1);
      add(id, "games", 1);
      plugin.data.set(key(id) + "streak", id.equals(winner) ? number(id, "streak") + 1 : 0);
      plugin.data.set(
          key(id) + "bestStreak", Math.max(number(id, "bestStreak"), number(id, "streak")));
    }
    for (UUID id : List.of(m.a, m.b)) {
      String base = key(id) + "kits." + m.kit + ".";
      String stat = id.equals(winner) ? "wins" : "losses";
      plugin.data.set(base + stat, kitNumber(id, m.kit, stat) + 1);
      plugin.data.set(base + "streak", id.equals(winner) ? kitNumber(id, m.kit, "streak") + 1 : 0);
    }
    plugin.insights.result(m, winner);
    if (m.ranked) {
      String oldDivision = Rating.rank(elo(winner));
      int kitDelta = Rating.transfer(elo(winner, m.kit), elo(loser, m.kit));
      plugin.data.set(key(winner) + "kits." + m.kit + ".elo", elo(winner, m.kit) + kitDelta);
      plugin.data.set(key(loser) + "kits." + m.kit + ".elo", elo(loser, m.kit) - kitDelta);
      m.ratingDelta.put(winner, kitDelta);
      m.ratingDelta.put(loser, -kitDelta);
      int change = Rating.transfer(elo(winner), elo(loser));
      plugin.data.set(key(winner) + "elo", elo(winner) + change);
      plugin.data.set(key(loser) + "elo", elo(loser) - change);
      for (UUID id : List.of(winner, loser)) add(id, "rankedGames", 1);
      lastPair.put(m.kit + ":" + pair(winner, loser), System.currentTimeMillis());
      refresh();
      if (!oldDivision.equals(Rating.rank(elo(winner))))
        plugin.inbox.add(
            winner,
            "Division promoted",
            oldDivision + " to " + Rating.rank(elo(winner)) + " through ranked results");
    }
  }

  String pair(UUID a, UUID b) {
    return a.compareTo(b) < 0 ? a + ":" + b : b + ":" + a;
  }

  boolean eligible(UUID a, UUID b, String kit) {
    return System.currentTimeMillis() - lastPair.getOrDefault(kit + ":" + pair(a, b), 0L) > 120000;
  }

  void queue(Player p, String kit) {
    if (!plugin.kit(kit)) {
      plugin.tell(p, "Unknown kit. /ranked opens the kit picker.");
      return;
    }
    if (plugin.busy(p)) {
      plugin.tell(p, "Leave your match or spectating session first.");
      return;
    }
    if (!plugin.managed(p)) plugin.enter(p);
    if (!plugin.managed(p)) return;
    plugin.lobby(p);
    remember(p);
    queuedAt.put(p.getUniqueId(), System.currentTimeMillis());
    plugin.queues.put(p.getUniqueId(), "ranked:" + kit);
    p.closeInventory();
    plugin.tell(p, "Ranked " + kit + " queued. Elo " + elo(p.getUniqueId()) + " | /leave cancels.");
  }

  void match() {
    lastPair.values().removeIf(t -> System.currentTimeMillis() - t > 120000);
    for (String kit : CommunityArena.KITS) {
      var ids =
          plugin.queues.entrySet().stream()
              .filter(e -> e.getValue().equals("ranked:" + kit))
              .map(Map.Entry::getKey)
              .toList();
      for (UUID a : ids) {
        if (!plugin.queues.containsKey(a)) continue;
        for (UUID b : ids) {
          if (a.equals(b) || !plugin.queues.containsKey(b) || !eligible(a, b, kit)) continue;
          long age =
              (System.currentTimeMillis()
                      - Math.min(
                          queuedAt.getOrDefault(a, System.currentTimeMillis()),
                          queuedAt.getOrDefault(b, System.currentTimeMillis())))
                  / 1000;
          if (Math.abs(elo(a, kit) - elo(b, kit)) > Rating.window(age)) continue;
          if (plugin.occupied.size() >= 4) return;
          plugin.start(
              Bukkit.getPlayer(a), Bukkit.getPlayer(b), kit, plugin.rankedRounds(kit), true);
          break;
        }
      }
    }
  }

  void beginDay(UUID id) {
    String today = java.time.LocalDate.now(java.time.ZoneOffset.UTC).toString();
    String base = key(id) + "daily.";
    if (!today.equals(plugin.data.getString(base + "date"))) {
      plugin.data.set(base + "date", today);
      plugin.data.set(base + "startGames", number(id, "games"));
      plugin.data.set(base + "startWins", number(id, "wins"));
      plugin.data.set(base + "claimed", false);
    }
  }

  void quests(Player player) {
    UUID id = player.getUniqueId();
    String before = plugin.data.saveToString();
    beginDay(id);
    String base = key(id) + "daily.";
    int games = number(id, "games") - plugin.data.getInt(base + "startGames"),
        wins = number(id, "wins") - plugin.data.getInt(base + "startWins");
    boolean claim = games >= 5 && wins >= 3 && !plugin.data.getBoolean(base + "claimed");
    if (claim) {
      add(id, "cases", 1);
      plugin.data.set(base + "claimed", true);
      plugin.inbox.add(id, "Quest completed", "Daily quest earned one cosmetic case");
    }
    if (!plugin.save()) {
      try {
        plugin.data.loadFromString(before);
      } catch (Exception ex) {
        throw new IllegalStateException("Quest rollback failed", ex);
      }
      plugin.tell(player, "Could not save quest progress; no reward was consumed or claimed.");
      return;
    }
    plugin.tell(
        player,
        claim
            ? "Daily quest complete! +1 cosmetic case. /cases"
            : "Daily quest (UTC): play "
                + Math.min(5, games)
                + "/5 duels and win "
                + Math.min(3, wins)
                + "/3. "
                + (plugin.data.getBoolean(base + "claimed")
                    ? "Claimed today."
                    : "Use /quests to claim."));
  }

  void cases(Player p) {
    UUID id = p.getUniqueId();
    if (number(id, "cases") < 1) {
      plugin.tell(p, "No cases. Complete /quests. Rewards are cosmetic only.");
      return;
    }
    if (plugin.busy(p) || plugin.motion.opening(id)) {
      plugin.tell(p, "Finish your current session or reveal first.");
      return;
    }
    if (!plugin.managed(p)) plugin.enter(p);
    if (!plugin.managed(p)) return;
    String before = plugin.data.saveToString();

    List<String> rewards = List.of("spark", "heart", "soul", "Champion", "Duelist", "Unstoppable");
    var owned = new ArrayList<>(plugin.data.getStringList(key(id) + "cosmetics"));
    var missing = rewards.stream().filter(r -> !owned.contains(r)).toList();
    if (missing.isEmpty()) {
      plugin.tell(p, "You already own every relic. Your case was kept.");
      return;
    }
    add(id, "cases", -1);
    String reward = missing.isEmpty() ? "spark" : missing.get(new Random().nextInt(missing.size()));
    if (!owned.contains(reward)) owned.add(reward);
    plugin.data.set(key(id) + "cosmetics", owned);
    plugin.data.set(
        key(id) + (List.of("spark", "heart", "soul").contains(reward) ? "effect" : "title"),
        reward);
    plugin.inbox.add(id, "Relic unlocked", reward + " is owned and equipped");
    if (!plugin.save()) {
      try {
        plugin.data.loadFromString(before);
      } catch (Exception ex) {
        throw new IllegalStateException("Could not restore reward state", ex);
      }
      plugin.tell(p, "Reward save failed; your case was kept.");
      return;
    }
    plugin.motion.caseReveal(p, reward);
    plugin.tell(
        p,
        "Unlocked and equipped " + reward + ". The reward is saved even if you close the reveal.");
  }

  void cosmetics(Player p, String[] args) {
    String base = key(p.getUniqueId());
    var owned = plugin.data.getStringList(base + "cosmetics");
    if (args.length == 0) {
      plugin.tell(p, "Owned: " + owned + ". /cosmetics <name|none>");
      return;
    }
    String choice = args[0];
    if (choice.equals("none")) {
      plugin.data.set(base + "effect", null);
      plugin.data.set(base + "title", null);
    } else if (owned.contains(choice)) {
      plugin.data.set(
          base + (List.of("spark", "heart", "soul").contains(choice) ? "effect" : "title"), choice);
    } else {
      plugin.tell(p, "That cosmetic is locked.");
      return;
    }
    plugin.save();
    plugin.tell(p, "Cosmetic updated.");
  }
}
