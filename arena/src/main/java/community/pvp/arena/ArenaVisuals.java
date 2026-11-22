package community.pvp.arena;

import java.util.*;

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

    void ensureRankInfo() {
        String key = "holograms.rankinfo-v9";
        if (p.data.contains(key)) return;
        p.data.set(key + ".location", p.setup.spawn().clone().add(12, 4, -9));
        p.data.set(key + ".text", List.of("§e§lRANKED DIVISIONS", "§7Local server ratings",
                "§dChampion §7(2800+ and #1)", "§5Netherite I–III §7(2500+)",
                "§bDiamond I–III §7(2200–2499)", "§aEmerald I–III §7(1900–2199)",
                "§eGold I–III §7(1600–1899)", "§fIron I–III §7(1300–1599)",
                "§6Copper I–III §7(1000–1299)", "§7New players start at 1000",
                "§7Historical ratings are preserved", "§7Community tiers require reviewed results"));
    }

    List<UUID> leaders(String stat) {
        var section = p.data.getConfigurationSection("players");
        if (section == null) return List.of();
        record Entry(UUID id, int score) {
        }
        Comparator<Entry> order = Comparator.comparingInt(Entry::score).reversed().thenComparing(e -> e.id().toString());
        PriorityQueue<Entry> best = new PriorityQueue<>(order.reversed());
        String qualifying = stat.equals("elo") ? "rankedGames" : Set.of("deaths", "kills").contains(stat) ? stat : "games";
        for (String key : section.getKeys(false)) {
            if (!key.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")) continue;
            UUID id = UUID.fromString(key);
            int eligibility = p.progression.number(id, qualifying);
            if (eligibility <= 0) continue;
            int score = qualifying.equals(stat) ? eligibility : stat.equals("elo") ? p.progression.elo(id) : p.progression.number(id, stat);
            Entry candidate = new Entry(id, score);
            if (best.size() < 10) best.add(candidate);
            else if (order.compare(candidate, best.peek()) < 0) {
                best.remove();
                best.add(candidate);
            }
        }
        return best.stream().sorted(order).map(Entry::id).toList();
    }

    List<String> lines(String stat) {
        List<String> text = new ArrayList<>();
        text.add("§e§l" + (stat.equals("elo") ? "TOP RATING" : stat.toUpperCase(Locale.ROOT) + " TOP"));
        text.add("§7Overall | All time");
        int n = 1;
        for (UUID id : leaders(stat))
            text.add(
                    "§7"
                            + (n++)
                            + ". §f"
                            + p.progression.name(id)
                            + " §e"
                            + (stat.equals("elo") ? p.progression.elo(id) : p.progression.number(id, stat)));
        if (text.size() == 2) text.add("§7No completed matches yet");
        text.add(" ");
        text.add("§eRight-click to browse kits and timeframes");
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
        Map<String, List<String>> snapshots = new HashMap<>();
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
            List<String> customLines = p.data.getStringList("holograms." + id + ".text");
            var text = PracticePresentation.ui(
                    String.join(
                            "\n",
                            customLines.isEmpty()
                                    ? snapshots.computeIfAbsent(p.data.getString("holograms." + id + ".stat", "elo"), this::lines)
                                    : customLines));
            if (!text.equals(display.text())) display.text(text);
        }
    }

    boolean clickHologram(org.bukkit.event.player.PlayerInteractEvent e) {
        Player player = e.getPlayer();
        if (!e.getAction().isRightClick() || e.getHand() != EquipmentSlot.HAND
                || !p.managed(player) || p.busy(player) || p.ffa.contains(player.getUniqueId())) return false;
        Location eye = player.getEyeLocation();
        String target = null;
        double nearest = 64;
        for (String id : holograms.keySet()) {
            if (!p.data.getStringList("holograms." + id + ".text").isEmpty()) continue;
            Location at = p.data.getLocation("holograms." + id + ".location");
            if (at == null || !at.getWorld().equals(eye.getWorld())) continue;
            var offset = at.toVector().subtract(eye.toVector());
            double distance = offset.lengthSquared();
            if (distance < nearest && distance > 0 && eye.getDirection().dot(offset.normalize()) > .92) {
                target = id;
                nearest = distance;
            }
        }
        if (target != null) {
            e.setCancelled(true);
            p.reference.board(player, p.data.getString("holograms." + target + ".stat", "elo"), 0, false);
            return true;
        }
        return false;
    }

    void board(Player player) {
        if (p.presentation != null) p.presentation.board(player);
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
