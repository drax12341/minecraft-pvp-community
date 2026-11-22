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
    final Set<UUID> friendTabs = new HashSet<>();
    final Map<UUID, Set<UUID>> unlisted = new HashMap<>();

    interface Roster {
        void set(Player viewer, Player target, boolean listed);
    }

    Roster roster = (viewer, target, listed) -> {
        if (listed) viewer.listPlayer(target);
        else viewer.unlistPlayer(target);
    };

    void listed(Player viewer, Player target, boolean value) {
        var hidden = unlisted.computeIfAbsent(viewer.getUniqueId(), k -> new HashSet<>());
        if (value ? hidden.remove(target.getUniqueId()) : hidden.add(target.getUniqueId()))
            roster.set(viewer, target, value);
    }

    final Map<UUID, Map<UUID, Boolean>> entityVisibility = new HashMap<>();

    void entityVisible(Player viewer, Entity target, boolean show) {
        var states = entityVisibility.computeIfAbsent(viewer.getUniqueId(), k -> new HashMap<>());
        Boolean old = states.put(target.getUniqueId(), show);
        if (old != null && old == show) return;
        if (show) viewer.showEntity(p, target);
        else viewer.hideEntity(p, target);
    }

    void forgetEntity(UUID id) {
        for (var states : entityVisibility.values()) states.remove(id);
    }

    final Map<UUID, UUID> tags = new HashMap<>();
    final Map<UUID, Map<UUID, Boolean>> playerVisibility = new HashMap<>();

    record Identity(String name, String division, String room, boolean chat) {
    }

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
        return new String[]{"§6", "§f", "§e", "§a", "§b", "§5"}[Rating.band(elo)];
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
        if (p.social.extra.containsKey(id)) return p.social.extra.get(id).room();
        if (p.partyBattles != null && p.partyBattles.sessions.containsKey(id))
            return "party:" + p.partyBattles.sessions.get(id).policy.a;
        if (p.bots != null && p.bots.sessions.containsKey(id)) return "bot:" + id;
        if (p.social.spectators.containsKey(id)) return "spec:" + p.social.spectators.get(id).a;
        if (p.matches.containsKey(id)) return "duel:" + p.matches.get(id).a;
        if (p.ffa.contains(id)) return "ffa";
        return "lobby";
    }

    boolean visible(Player viewer, Player target) {
        UUID v = viewer.getUniqueId(), t = target.getUniqueId();
        if (v.equals(t)) return true;
        if (!p.managed(target)) return false;
        if (p.social.extra.containsKey(t)) return false;
        var watched = p.social.spectators.get(v);
        if (watched != null)
            return p.matches.get(t) == watched || p.social.spectators.get(t) == watched;
        return room(v).equals(room(t));
    }

    void playerVisible(Player viewer, Player target, boolean show) {
        var states = playerVisibility.computeIfAbsent(viewer.getUniqueId(), k -> new HashMap<>());
        Boolean previous = states.put(target.getUniqueId(), show);
        if (previous != null && previous == show) return;
        if (show) viewer.showPlayer(p, target);
        else viewer.hidePlayer(p, target);
    }

    void forgetPlayer(UUID id) {
        entityVisibility.remove(id);
        friendTabs.remove(id);
        unlisted.remove(id);
        for (var ids : unlisted.values()) ids.remove(id);
        playerVisibility.remove(id);
        for (var states : playerVisibility.values()) states.remove(id);
    }

    void tick() {
        Map<UUID, Identity> next = new HashMap<>();
        for (UUID id : p.participants) {
            Player player = Bukkit.getPlayer(id);
            if (player == null) continue;
            next.put(
                    id, new Identity(player.getName(), badge(id), room(id), p.flag(player, "chat", true)));
            boolean friendsOnly = friendTabs.contains(id) && !p.busy(player) && !p.ffa.contains(id);
            Set<String> friends = friendsOnly ? new HashSet<>(p.social.friends(id)) : Set.of();
            for (Player other : Bukkit.getOnlinePlayers()) {
                playerVisible(player, other, visible(player, other));
                if (friendsOnly && !other.equals(player) && !friends.contains(other.getUniqueId().toString()))
                    listed(player, other, false);
                else if (visible(player, other)) listed(player, other, true);
            }
            Component listName =
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
                                    + "ms");
            if (!listName.equals(player.playerListName())) player.playerListName(listName);
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
            rows.add("§7Duration §f" + time(m.paused ? 0 : System.currentTimeMillis() - m.roundStarted));
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

    static boolean displayed(Scoreboard board, Objective objective, DisplaySlot slot) {
        Objective current = board.getObjective(slot);
        return current != null && current.getName().equals(objective.getName());
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
        Component heading =
                ui(
                        "§e§l"
                                + p.getConfig().getString("presentation.brand", "Community")
                                + " §8- §f"
                                + (m != null ? "Duels" : p.ffa.contains(id) ? "FFA" : "Lobby"));
        if (!heading.equals(sidebar.displayName())) sidebar.displayName(heading);
        if (p.flag(player, "scoreboard", true)) {
            if (!displayed(board, sidebar, DisplaySlot.SIDEBAR))
                sidebar.setDisplaySlot(DisplaySlot.SIDEBAR);
        } else if (displayed(board, sidebar, DisplaySlot.SIDEBAR)) board.clearSlot(DisplaySlot.SIDEBAR);
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
                Component row = ui(rows.get(i));
                if (!row.equals(team.prefix())) team.prefix(row);
                if (sidebar.getScore(entry).getScore() != 15 - i) sidebar.getScore(entry).setScore(15 - i);
            } else if (sidebar.getScore(entry).isScoreSet()) board.resetScores(entry);
        }
        Objective health = board.getObjective("health");
        if (health == null) health = board.registerNewObjective("health", Criteria.DUMMY, ui("§c♥"));
        if (m != null && p.flag(player, "health", true)) {
            if (!displayed(board, health, DisplaySlot.BELOW_NAME))
                health.setDisplaySlot(DisplaySlot.BELOW_NAME);
        } else if (displayed(board, health, DisplaySlot.BELOW_NAME))
            board.clearSlot(DisplaySlot.BELOW_NAME);
        Set<String> active = new HashSet<>();
        for (UUID otherId : p.participants) {
            Player other = Bukkit.getPlayer(otherId);
            if (other == null || !visible(player, other)) continue;
            String key = "p" + otherId.toString().replace("-", "").substring(0, 15);
            active.add(key);
            Team team = board.getTeam(key);
            if (team == null) team = board.registerNewTeam(key);
            if (!team.hasEntry(other.getName())) team.addEntry(other.getName());
            NamedTextColor teamColor =
                    m != null && otherId.equals(m.b)
                            ? NamedTextColor.RED
                            : m != null && otherId.equals(m.a) ? NamedTextColor.BLUE : NamedTextColor.WHITE;
            if (team.getColor() == ChatColor.RESET || !teamColor.equals(team.color()))
                team.color(teamColor);
            Team.OptionStatus collision = m == null ? Team.OptionStatus.NEVER : Team.OptionStatus.ALWAYS;
            if (team.getOption(Team.Option.COLLISION_RULE) != collision)
                team.setOption(Team.Option.COLLISION_RULE, collision);
            Component prefix =
                    p.getConfig().getBoolean("presentation.nametags", true)
                            ? Component.empty()
                            : ui(p.flag(player, "nametags", true) ? badge(otherId) + " " : "");
            if (!prefix.equals(team.prefix())) team.prefix(prefix);
            int hp = (int) Math.ceil(other.getHealth() + other.getAbsorptionAmount());
            if (!health.getScore(other.getName()).isScoreSet()
                    || health.getScore(other.getName()).getScore() != hp)
                health.getScore(other.getName()).setScore(hp);
        }
        for (Team team : new HashSet<>(board.getTeams()))
            if (team.getName().startsWith("p") && !active.contains(team.getName())) {
                for (String entry : team.getEntries()) board.resetScores(entry);
                team.unregister();
            }
        if (player.getScoreboard() != board) player.setScoreboard(board);
        String middle =
                m == null
                        ? "§7" + p.participants.size() + " players online"
                        : "§9"
                        + p.progression.name(m.a)
                        + " §8vs §c"
                        + p.progression.name(m.b)
                        + "\n§7Spectators §f"
                        + Collections.frequency(new ArrayList<>(p.social.spectators.values()), m);
        if (friendTabs.contains(id) && m == null && !p.busy(player) && !p.ffa.contains(id)) {
            var friends = p.social.friends(id);
            middle = "§b§lFRIENDS §7(" + friends.size() + ")\n" + friends.stream().limit(20).map(friend -> {
                Player online = Bukkit.getPlayer(UUID.fromString(friend));
                return (online == null ? "§8? §7" : "§a? §f") + p.progression.name(UUID.fromString(friend));
            }).collect(java.util.stream.Collectors.joining("  ")) + "\n§8Crouch to show players";
        }
        Component header =
                ui(
                        "\n§e§l"
                                + p.getConfig().getString("presentation.brand", "Community")
                                + " §8- §f"
                                + p.getConfig().getString("presentation.region", "Standalone")
                                + "\n"
                                + middle
                                + "\n");
        Component footer =
                ui(
                        "\n§e"
                                + player.getPing()
                                + "ms §8│ §f"
                                + p.progression.elo(id)
                                + " Elo\n§7"
                                + p.getConfig().getString("presentation.footer", "/duel  /ranked  /profile")
                                + "\n");
        if (!header.equals(player.playerListHeader()) || !footer.equals(player.playerListFooter()))
            player.sendPlayerListHeaderAndFooter(header, footer);
    }

    void nameplates() {
        if (!p.getConfig().getBoolean("presentation.nametags", true)) return;
        for (UUID id : new HashSet<>(tags.keySet()))
            if (!p.participants.contains(id) || p.social.spectators.containsKey(id)) {
                Entity e = Bukkit.getEntity(tags.remove(id));
                if (e != null) {
                    forgetEntity(e.getUniqueId());
                    e.remove();
                }
            }
        for (UUID id : p.participants) {
            Player player = Bukkit.getPlayer(id);
            if (player == null || p.social.spectators.containsKey(id)) continue;
            TextDisplay display =
                    tags.containsKey(id) && Bukkit.getEntity(tags.get(id)) instanceof TextDisplay d
                            ? d
                            : null;
            if (display == null) {
                UUID vanished = tags.remove(id);
                if (vanished != null) forgetEntity(vanished);
                display = player.getWorld().spawn(player.getLocation().add(0, 2.45, 0), TextDisplay.class);
                display.setPersistent(false);
                display.setBillboard(Display.Billboard.CENTER);
                display.setSeeThrough(false);
                display.setShadowed(true);
                display.setViewRange(0.6f);
                display.setTeleportDuration(5);
                tags.put(id, display.getUniqueId());
            }
            Component label = ui(badge(id));
            if (!label.equals(display.text())) display.text(label);
            Location target = player.getLocation().add(0, player.isSneaking() ? 2.1 : 2.45, 0);
            if (!display.getWorld().equals(target.getWorld())
                    || display.getLocation().distanceSquared(target) > 0.0001) display.teleport(target);
            for (UUID viewerId : p.participants) {
                Player viewer = Bukkit.getPlayer(viewerId);
                if (viewer == null) continue;
                if (!viewerId.equals(id)
                        && visible(viewer, player)
                        && p.flag(viewer, "nametags", true)
                        && !player.isSneaking()) entityVisible(viewer, display, true);
                else entityVisible(viewer, display, false);
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
            if (e != null) {
                forgetEntity(e.getUniqueId());
                e.remove();
            }
        }
        for (Player other : Bukkit.getOnlinePlayers()) {
            listed(player, other, true);
            playerVisible(player, other, true);
            playerVisible(other, player, true);
        }
        forgetPlayer(id);
        player.sendActionBar(Component.empty());
    }

    void profile(Player player) {
        p.reference.profile(player);
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
        Player player = e.getPlayer();
        UUID id = player.getUniqueId();
        if (e.isSneaking() && p.managed(player) && !p.busy(player) && !p.ffa.contains(id) && p.setup.contains(player.getLocation())) {
            if (!friendTabs.remove(id)) friendTabs.add(id);
            // Paper listed state changes the tab roster without hiding friends in the lobby world.


            tick();
        }

    }

    void close() {
        for (UUID tag : tags.values()) {
            Entity e = Bukkit.getEntity(tag);
            if (e != null) e.remove();
        }
        tags.clear();
        entityVisibility.clear();
        playerVisibility.clear();
        identities = Map.of();
    }
}
