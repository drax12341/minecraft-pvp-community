package community.pvp.arena;

import java.util.*;

import org.bukkit.*;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;

final class ReferenceMenus {
    final CommunityArena p;

    ReferenceMenus(CommunityArena p) {
        this.p = p;
    }

    String pref(Player player, String field, String fallback) {
        return p.data.getString("players." + player.getUniqueId() + ".ui." + field, fallback);
    }

    void setPref(Player player, String field, String value) {
        p.data.set("players." + player.getUniqueId() + ".ui." + field, value);
        p.save();
    }

    String cycle(String old, List<String> choices, boolean reverse, boolean reset) {
        return reset
                ? choices.getFirst()
                : choices.get(
                Math.floorMod(Math.max(0, choices.indexOf(old)) + (reverse ? -1 : 1), choices.size()));
    }

    boolean handle(Player player, String action, boolean reverse, boolean reset) {
        if (action == null) return false;
        if (action.equals("queue-filter")) {
            String next =
                    cycle(pref(player, "queue", "both"), List.of("both", "casual", "ranked"), reverse, reset);
            setPref(player, "queue", next);
            queues(player, next);
            return true;
        }
        if (action.equals("statistics")) {
            stats(player);
            return true;
        }
        if (action.equals("stats-scope") || action.equals("stats-period")) {
            boolean scope = action.equals("stats-scope");
            String field = scope ? "statsScope" : "statsPeriod";
            String next =
                    cycle(
                            pref(player, field, scope ? "both" : "all"),
                            scope ? List.of("both", "casual", "ranked") : List.of("all", "day", "week"),
                            reverse,
                            reset);
            setPref(player, field, next);
            stats(player);
            return true;
        }
        if (action.equals("profile-details")) {
            profile(player);
            return true;
        }
        if (action.equals("inbox-filter")) {
            String key = "players." + player.getUniqueId() + ".ui.inboxUnread";
            p.data.set(key, !p.data.getBoolean(key, true));
            p.save();
            p.inbox.open(player, 0);
            return true;
        }
        if (action.equals("inbox")) {
            p.inbox.open(player, 0);
            return true;
        }
        if (action.startsWith("inbox-page:")) {
            try {
                p.inbox.open(player, Integer.parseInt(action.substring(11)));
            } catch (NumberFormatException ignored) {
            }
            return true;
        }
        if (action.startsWith("notice:")) {
            p.inbox.mark(player, action.substring(7));
            return true;
        }
        if (action.equals("time-cycle")) {
            String next =
                    cycle(
                            pref(player, "time", "server"),
                            List.of("server", "day", "afternoon", "night", "midnight"),
                            reverse,
                            reset);
            setPref(player, "time", next);
            applyTime(player);
            p.menus.settings(player);
            return true;
        }
        if (action.equals("saved-kits")) {
            p.savedKits.slots(player);
            return true;
        }
        if (action.startsWith("custom-slot:")) {
            String slot = action.substring(12);
            if (slot.matches("[1-3]")) p.savedKits.edit(player, Integer.parseInt(slot));
            return true;
        }
        if (action.startsWith("board:")) {
            String[] args = action.split(":");
            if (args.length == 4)
                try {
                    board(player, args[1], Integer.parseInt(args[2]), args[3].equals("elite"));
                } catch (NumberFormatException ignored) {
                }
            return true;
        }
        if (action.startsWith("kit:b:")) {
            queueDetail(player, action.substring(6));
            return true;
        }
        if (action.equals("host-info")) {
            p.tell(
                    player,
                    "Host: "
                            + p.getConfig().getString("presentation.region", "Standalone")
                            + " | Ping "
                            + player.getPing()
                            + "ms. This server has no configured cross-region transfers.");
            return true;
        }
        return false;
    }

    void applyTime(Player player) {
        String time = pref(player, "time", "server");
        if (time.equals("server")) player.resetPlayerTime();
        else
            player.setPlayerTime(
                    switch (time) {
                        case "day" -> 6000;
                        case "afternoon" -> 11000;
                        case "night" -> 14000;
                        default -> 18000;
                    },
                    false);
    }

    void queues(Player player, String scope) {
        if (!Set.of("both", "casual", "ranked").contains(scope)) scope = "both";
        if (!p.managed(player)) p.enter(player);
        if (!p.managed(player) || p.busy(player)) return;
        p.data.set("players." + player.getUniqueId() + ".ui.queue", scope);
        Inventory inv = p.menus.frame(54, "Community | Duel Queues");
        inv.setItem(
                0,
                p.item(
                        Material.ENDER_EYE,
                        "Connection",
                        "host-info",
                        p.getConfig().getString("presentation.region", "Standalone"),
                        "Your actual ping: " + player.getPing() + "ms"));
        inv.setItem(
                4,
                p.item(
                        Material.COMPARATOR,
                        "Matchmaking: " + scope,
                        "queue-filter",
                        "Left: next | Right: previous | Shift: reset"));
        inv.setItem(8, p.item(Material.DIAMOND, "Statistics", "statistics"));
        int i = 0;
        for (String kit : CommunityArena.KITS) {
            String kind = scope;
            long waiting =
                    p.queues.values().stream()
                            .filter(
                                    v ->
                                            v.equals(kit) && !kind.equals("ranked")
                                                    || v.equals("ranked:" + kit) && !kind.equals("casual"))
                            .count();
            long playing =
                    new HashSet<>(p.matches.values())
                            .stream()
                            .filter(
                                    m ->
                                            !m.ended
                                                    && m.kit.equals(kit)
                                                    && (kind.equals("both") || m.ranked == kind.equals("ranked")))
                            .count()
                            * 2;
            List<String> lore =
                    new ArrayList<>(
                            List.of(
                                    "Playing: " + playing + " | Waiting: " + waiting,
                                    "Your Elo: " + p.progression.elo(player.getUniqueId(), kit),
                                    "Top kit ratings"));
            int rank = 1;
            for (UUID id : kitLeaders(kit).stream().limit(3).toList())
                lore.add((rank++) + ". " + p.progression.name(id) + " - " + p.progression.elo(id, kit));
            if (rank == 1) lore.add("No ranked results yet");
            lore.add("Left: queue options | Right: layout");
            inv.setItem(
                    11 + i / 3 * 9 + i % 3 * 2,
                    Loadouts.menuIcon(
                            p,
                            kit,
                            Loadouts.name(kit),
                            "kit:"
                                    + (scope.equals("both") ? "b" : scope.equals("ranked") ? "r" : "u")
                                    + ":"
                                    + kit,
                            lore.toArray(new String[0])));
            i++;
        }
        inv.setItem(45, p.item(Material.ARROW, "Navigation", "navigation"));
        inv.setItem(
                48,
                p.item(
                        Material.PURPLE_SHULKER_BOX,
                        "Saved Custom Kits",
                        "saved-kits",
                        "Three private kit slots"));
        inv.setItem(49, p.item(Material.BARRIER, "Leave queue", "cancel-queue"));
        inv.setItem(
                50,
                p.item(
                        Material.WRITABLE_BOOK,
                        "Inbox (" + p.inbox.unread(player.getUniqueId()) + ")",
                        "inbox"));
        inv.setItem(53, p.item(Material.PLAYER_HEAD, "Your profile", "profile-details"));
        player.openInventory(inv);
    }

    List<UUID> kitLeaders(String kit) {
        var section = p.data.getConfigurationSection("players");
        if (section == null) return List.of();
        return section.getKeys(false).stream()
                .filter(s -> s.matches("[a-f0-9-]{36}"))
                .map(UUID::fromString)
                .filter(id -> p.data.contains("players." + id + ".kits." + kit + ".elo"))
                .sorted(
                        Comparator.<UUID>comparingInt(id -> p.progression.elo(id, kit))
                                .reversed()
                                .thenComparing(UUID::toString))
                .toList();
    }

    void queueDetail(Player player, String kit) {
        if (!p.kit(kit)) return;
        var inv = p.menus.frame(27, Loadouts.name(kit) + " | Matchmaking");
        inv.setItem(
                11,
                p.item(Material.IRON_SWORD, "Casual duel", "queue:" + kit, "Practice without Elo changes"));
        inv.setItem(13, p.item(Material.CHEST, "Inventory layout", "layout:" + kit));
        inv.setItem(
                15,
                p.item(
                        Material.NETHERITE_SWORD,
                        "Ranked duel",
                        "ranked:" + kit,
                        "First to " + p.rankedRounds(kit)));
        inv.setItem(18, p.item(Material.ARROW, "Back", "queues-both"));
        player.openInventory(inv);
    }

    List<String> lore(PracticeInsights.Stats s) {
        return List.of(
                "Games played: " + s.games(),
                "Win rate: " + s.winRate(),
                "Wins: " + s.wins() + " | Losses: " + s.losses(),
                "W/L: " + PracticeInsights.ratio(s.wins(), s.losses()),
                "Kills: " + s.kills() + " | Deaths: " + s.deaths(),
                "K/D: " + PracticeInsights.ratio(s.kills(), s.deaths()),
                "Streak: " + s.streak() + " | Best: " + s.best());
    }

    void stats(Player player) {
        String scope = pref(player, "statsScope", "both"), period = pref(player, "statsPeriod", "all");
        if (!Set.of("both", "casual", "ranked").contains(scope)) scope = "both";
        if (!Set.of("all", "day", "week").contains(period)) period = "all";
        var inv = p.menus.frame(54, "Community | Duel Statistics");
        inv.setItem(
                2,
                p.item(
                        Material.IRON_SWORD,
                        "Queue: " + scope,
                        "stats-scope",
                        "Left: next | Right: previous | Shift: reset"));
        inv.setItem(
                4,
                p.item(
                        Material.CLOCK,
                        "Period: " + period,
                        "stats-period",
                        "UTC calendar day / ISO week",
                        "Left: next | Right: previous | Shift: reset"));
        inv.setItem(
                6,
                p.item(
                        Material.NETHER_STAR,
                        "Global record",
                        null,
                        lore(p.insights.view(player.getUniqueId(), scope, period, "global"))
                                .toArray(new String[0])));
        int i = 0;
        for (String kit : CommunityArena.KITS) {
            inv.setItem(
                    11 + i / 3 * 9 + i % 3 * 2,
                    Loadouts.menuIcon(
                            p,
                            kit,
                            Loadouts.name(kit),
                            "kit:b:" + kit,
                            lore(p.insights.view(player.getUniqueId(), scope, period, kit))
                                    .toArray(new String[0])));
            i++;
        }
        inv.setItem(
                39,
                p.item(
                        Material.PURPLE_SHULKER_BOX,
                        "Custom duels",
                        null,
                        lore(p.insights.view(player.getUniqueId(), scope, period, "custom"))
                                .toArray(new String[0])));
        inv.setItem(
                40,
                p.item(
                        Material.PAPER,
                        "History coverage",
                        null,
                        "Existing all-time totals are preserved",
                        "Split/day/week counters begin with v4",
                        "Legacy global K/D includes FFA",
                        "Kit K/D tracking began in v4",
                        "Day/week counters exclude FFA"));
        inv.setItem(45, p.item(Material.ARROW, "Navigation", "navigation"));
        inv.setItem(49, p.item(Material.PLAYER_HEAD, "Your profile", "profile-details"));
        player.openInventory(inv);
    }

    void profile(Player player) {
        UUID id = player.getUniqueId();
        var inv = p.menus.frame(45, "Community | " + player.getName());
        long joined = p.data.getLong("players." + id + ".firstSeen", System.currentTimeMillis());
        String date =
                java.time.Instant.ofEpochMilli(joined)
                        .atZone(java.time.ZoneOffset.UTC)
                        .toLocalDate()
                        .toString();
        inv.setItem(
                4,
                p.item(
                        Material.PLAYER_HEAD,
                        player.getName(),
                        null,
                        "Rank: " + p.progression.rank(id),
                        "Division: " + Rating.division(p.progression.elo(id)),
                        "Elo: " + p.progression.elo(id),
                        "Tracked playtime: " + p.insights.playtime(id) / 60 + " minutes",
                        "Profile tracking since: " + date,
                        "Friends: " + p.social.friends(id).size()));
        inv.setItem(11, p.item(Material.IRON_SWORD, "Duel Statistics", "statistics"));
        inv.setItem(13, p.item(Material.PURPLE_SHULKER_BOX, "Saved custom kits", "saved-kits"));
        inv.setItem(15, p.item(Material.WRITABLE_BOOK, "Inbox (" + p.inbox.unread(id) + ")", "inbox"));
        inv.setItem(
                20,
                p.item(
                        Material.GOLD_INGOT,
                        "Server standings",
                        "board:elo:0:all",
                        "Actual local server records"));
        inv.setItem(22, p.item(Material.NETHER_STAR, "Cosmetics", "cosmetics-menu"));
        inv.setItem(24, p.item(Material.REPEATER, "Settings", "settings"));
        inv.setItem(36, p.item(Material.ARROW, "Navigation", "navigation"));
        player.openInventory(inv);
    }

    List<UUID> standings(String stat) {
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
                                                : Set.of("kills", "deaths").contains(stat) ? stat : "games")
                                        > 0)
                .sorted(
                        Comparator.<UUID>comparingInt(
                                        id ->
                                                stat.equals("elo") ? p.progression.elo(id) : p.progression.number(id, stat))
                                .reversed()
                                .thenComparing(UUID::toString))
                .toList();
    }

    void board(Player player, String stat, int page, boolean elite) {
        if (!Set.of("elo", "wins", "kills", "deaths", "streak", "bestStreak", "games").contains(stat))
            return;
        List<UUID> all = standings(stat);
        List<UUID> list = elite ? all.stream().limit(16).toList() : all;
        page = Math.max(0, Math.min(page, Math.max(0, (list.size() - 1) / 21)));
        var inv = p.menus.frame(54, "Standings | " + stat + " | " + (page + 1));
        String[] fields = {"elo", "wins", "kills", "deaths", "streak", "bestStreak", "games"};
        for (int i = 0; i < fields.length; i++)
            inv.setItem(
                    i + 1,
                    p.item(
                            Material.GOLD_NUGGET,
                            fields[i],
                            "board:" + fields[i] + ":0:" + (elite ? "elite" : "all")));
        for (int i = 0; i < 21 && page * 21 + i < list.size(); i++) {
            int position = page * 21 + i;
            UUID id = list.get(position);
            inv.setItem(
                    10 + i + i / 7 * 2,
                    p.item(
                            position == 0 ? Material.NETHER_STAR : Material.PLAYER_HEAD,
                            "#" + (position + 1) + " " + p.progression.name(id),
                            null,
                            stat
                                    + ": "
                                    + (stat.equals("elo") ? p.progression.elo(id) : p.progression.number(id, stat)),
                            position < 16 ? "Top 16 contender" : "Climb into the top 16",
                            "Find a player: /findplayer <name>"));
        }
        if (list.isEmpty()) inv.setItem(22, p.item(Material.PAPER, "No genuine records yet", null));
        inv.setItem(
                45,
                p.item(
                        Material.ARROW,
                        "Previous",
                        "board:" + stat + ":" + (page - 1) + ":" + (elite ? "elite" : "all")));
        inv.setItem(
                48,
                p.item(
                        Material.GOLDEN_HELMET,
                        elite ? "View everyone" : "Top 16 contenders",
                        "board:" + stat + ":0:" + (elite ? "all" : "elite")));
        inv.setItem(49, p.item(Material.CLOCK, "Navigation", "navigation"));
        inv.setItem(50, p.item(Material.OAK_SIGN, "Find a player", null, "Use /findplayer <name>"));
        inv.setItem(
                53,
                p.item(
                        Material.ARROW,
                        "Next",
                        "board:" + stat + ":" + (page + 1) + ":" + (elite ? "elite" : "all")));
        player.openInventory(inv);
    }

    void find(Player viewer, String name) {
        if (!name.matches("[A-Za-z0-9_]{1,16}")) {
            p.tell(viewer, "/findplayer <Minecraft-name>");
            return;
        }
        var section = p.data.getConfigurationSection("players");
        if (section == null) {
            p.tell(viewer, "No recorded players.");
            return;
        }
        UUID id =
                section.getKeys(false).stream()
                        .filter(s -> s.matches("[a-f0-9-]{36}"))
                        .map(UUID::fromString)
                        .filter(key -> p.progression.name(key).equalsIgnoreCase(name))
                        .findFirst()
                        .orElse(null);
        if (id == null) {
            p.tell(viewer, "That player has no record here.");
            return;
        }
        var inv = p.menus.frame(27, "Player | " + p.progression.name(id));
        List<String> lore = new ArrayList<>(lore(p.insights.view(id, "both", "all", "global")));
        lore.add("Elo: " + p.progression.elo(id));
        int place = standings("elo").indexOf(id);
        lore.add(place < 0 ? "Unranked" : "Standing: #" + (place + 1));
        inv.setItem(
                13,
                p.item(Material.PLAYER_HEAD, p.progression.name(id), null, lore.toArray(new String[0])));
        inv.setItem(18, p.item(Material.ARROW, "Standings", "board:elo:0:all"));
        viewer.openInventory(inv);
    }
}
