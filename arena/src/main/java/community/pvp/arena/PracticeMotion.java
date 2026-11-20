package community.pvp.arena;

import java.util.*;

import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.title.Title;
import org.bukkit.*;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;

final class PracticeMotion {
    final CommunityArena p;
    long ticks;
    final Map<UUID, CaseReveal> cases = new HashMap<>();
    final Map<UUID, ResultReveal> results = new HashMap<>();

    record CaseReveal(String reward, Inventory inventory, long start) {
    }

    record ResultReveal(BossBar bar, int before, int after, long start, boolean won) {
    }

    PracticeMotion(CommunityArena p) {
        this.p = p;
        Bukkit.getScheduler().runTaskTimer(p, this::tick, 4, 4);
    }

    boolean enabled(Player player) {
        return p.getConfig().getBoolean("presentation.effects", true)
                && p.flag(player, "animations", true);
    }

    static double ease(double value) {
        double t = Math.max(0, Math.min(1, value));
        return 1 - Math.pow(1 - t, 3);
    }

    static float progress(double elo) {
        int[] floors = {0, 800, 1000, 1200, 1450, 1700, 2000, 2300};
        for (int i = 0; i < floors.length - 1; i++)
            if (elo < floors[i + 1])
                return (float) Math.max(0, Math.min(1, (elo - floors[i]) / (floors[i + 1] - floors[i])));
        return 1;
    }

    static List<org.bukkit.util.Vector> ring(double radius, int count, double phase) {
        List<org.bukkit.util.Vector> points = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            double angle = phase + 2 * Math.PI * i / count;
            points.add(new org.bukkit.util.Vector(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
        }
        return points;
    }

    boolean opening(UUID id) {
        return cases.containsKey(id);
    }

    void caseReveal(Player player, String reward) {
        Inventory inv = p.menus.frame(27, "Community | Relic Reveal");
        inv.setItem(
                4,
                p.item(
                        Material.NETHER_STAR,
                        "Your reward is already saved",
                        null,
                        "Closing or disconnecting cannot lose it"));
        inv.setItem(22, p.item(Material.ARROW, "Rewards", "rewards"));
        player.openInventory(inv);
        cases.put(player.getUniqueId(), new CaseReveal(reward, inv, ticks));
        if (!enabled(player)) {
            finishCase(player, cases.remove(player.getUniqueId()));
        }
    }

    void finishCase(Player player, CaseReveal reveal) {
        if (reveal == null) return;
        reveal.inventory.setItem(
                13,
                p.item(
                        Material.NETHER_STAR,
                        reveal.reward,
                        null,
                        "Unlocked and equipped",
                        "Saved before the animation began"));
        player.showTitle(
                Title.title(
                        Component.text("RELIC UNLOCKED", NamedTextColor.GOLD),
                        Component.text(reveal.reward, NamedTextColor.WHITE)));
        if (enabled(player))
            player.playSound(player.getLocation(), Sound.BLOCK_AMETHYST_BLOCK_CHIME, 0.7f, 1.3f);
    }

    void result(CommunityArena.Match match, Player player, boolean win) {
        int after = p.progression.elo(player.getUniqueId(), match.kit),
                before = after - match.ratingDelta.getOrDefault(player.getUniqueId(), 0);
        player.showTitle(
                Title.title(
                        Component.text(
                                win ? "\u2726 VICTORY \u2726" : "DEFEAT",
                                win ? NamedTextColor.GOLD : NamedTextColor.RED),
                        PracticePresentation.ui("§fFinal score §9" + match.sa + " §8- §c" + match.sb),
                        Title.Times.times(
                                java.time.Duration.ofMillis(120),
                                java.time.Duration.ofSeconds(2),
                                java.time.Duration.ofMillis(500))));
        if (!enabled(player) || !p.flag(player, "victory", true)) return;
        BossBar bar =
                BossBar.bossBar(
                        Component.text("Division progress | " + before + " Elo", NamedTextColor.GOLD),
                        progress(before),
                        win ? BossBar.Color.YELLOW : BossBar.Color.RED,
                        BossBar.Overlay.PROGRESS);
        player.showBossBar(bar);
        results.put(player.getUniqueId(), new ResultReveal(bar, before, after, ticks, win));
        for (int i = 0; i < 3; i++) {
            int beat = i;
            Bukkit.getScheduler()
                    .runTaskLater(
                            p,
                            () -> {
                                if (player.isOnline() && p.managed(player))
                                    player.playSound(
                                            player.getLocation(),
                                            win ? Sound.BLOCK_NOTE_BLOCK_CHIME : Sound.BLOCK_NOTE_BLOCK_BASS,
                                            0.5f,
                                            (float) (1 + beat * 0.25));
                            },
                            i * 6L);
        }
    }

    void tick() {
        ticks += 4;
        for (UUID id : new HashSet<>(cases.keySet())) {
            Player player = Bukkit.getPlayer(id);
            CaseReveal reveal = cases.get(id);
            if (player == null
                    || !player.isOnline()
                    || player.getOpenInventory().getTopInventory() != reveal.inventory
                    || p.busy(player)) {
                cases.remove(id);
                continue;
            }
            long age = ticks - reveal.start;
            if (age >= 88) {
                finishCase(player, reveal);
                cases.remove(id);
                continue;
            }
            for (int i = 0; i < 7; i++) {
                int index = (int) ((age / 4 + i) % 6);
                String name =
                        List.of("spark", "heart", "soul", "Champion", "Duelist", "Unstoppable").get(index);
                reveal.inventory.setItem(
                        10 + i,
                        p.item(
                                index % 2 == 0 ? Material.AMETHYST_SHARD : Material.NETHER_STAR,
                                name,
                                null,
                                "Cosmetic relic"));
            }
            reveal.inventory.setItem(
                    13,
                    p.item(
                            age > 68 ? Material.NETHER_STAR : Material.AMETHYST_SHARD,
                            age > 68 ? reveal.reward : "Decoding relic...",
                            null,
                            "Your unlock is safely stored"));
            if (enabled(player) && age < 72)
                player.playSound(player.getLocation(), Sound.UI_BUTTON_CLICK, 0.15f, 1 + (float) age / 130);
        }
        for (UUID id : new HashSet<>(results.keySet())) {
            Player player = Bukkit.getPlayer(id);
            ResultReveal reveal = results.get(id);
            long age = ticks - reveal.start;
            if (player == null || !player.isOnline() || !p.managed(player) || age > 56) {
                if (player != null) player.hideBossBar(reveal.bar);
                results.remove(id);
                continue;
            }
            double shown = reveal.before + (reveal.after - reveal.before) * ease(age / 44.0);
            reveal.bar.progress(progress(shown));
            reveal.bar.name(
                    Component.text("Division progress | " + Math.round(shown) + " Elo", NamedTextColor.GOLD));
            if (enabled(player) && reveal.won) {
                Location center = player.getLocation().add(0, 0.5 + age / 24.0, 0);
                for (var point : ring(0.9, 8, age / 8.0))
                    player.spawnParticle(
                            switch (p.data.getString("players." + id + ".effect", "spark")) {
                                case "heart" -> Particle.HEART;
                                case "soul" -> Particle.SOUL;
                                default -> Particle.END_ROD;
                            },
                            center.clone().add(point),
                            1,
                            0,
                            0,
                            0,
                            0);
            }
        }
        for (UUID id : p.participants) {
            Player player = Bukkit.getPlayer(id);
            if (player == null || !enabled(player)) continue;
            var m = p.matches.get(id);
            if (m != null && m.paused && !m.ended) {
                double phase = ticks / 12.0;
                for (var point : ring(1.5, 16, phase))
                    player.spawnParticle(
                            Particle.DUST,
                            player.getLocation().add(0, 0.12, 0).add(point),
                            1,
                            0,
                            0,
                            0,
                            0,
                            new Particle.DustOptions(Color.fromRGB(255, 193, 70), 1));
            }
            Inventory inv = player.getOpenInventory().getTopInventory();
            if (inv != null
                    && inv.getHolder() instanceof ArenaMenu
                    && !p.layouts.editing(player, inv)
                    && !p.savedKits.editing(player, inv)) {
                for (int slot = 0; slot < inv.getSize(); slot++) {
                    var item = inv.getItem(slot);
                    if (item == null
                            || !item.getType().name().endsWith("STAINED_GLASS_PANE")
                            || !item.hasItemMeta()) continue;
                    String name =
                            net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText()
                                    .serialize(
                                            item.getItemMeta().displayName() == null
                                                    ? Component.empty()
                                                    : item.getItemMeta().displayName());
                    if (name.isBlank()) {
                        Material wanted = (slot + ticks / 4) % 12 < 2 ? Material.YELLOW_STAINED_GLASS_PANE : Material.GRAY_STAINED_GLASS_PANE;
                        if (item.getType() != wanted) item.setType(wanted);
                    }
                }
            }
        }
    }

    void leave(Player player) {
        CaseReveal c = cases.remove(player.getUniqueId());
        ResultReveal r = results.remove(player.getUniqueId());
        if (r != null) player.hideBossBar(r.bar);
    }

    void close() {
        for (UUID id : new HashSet<>(results.keySet())) {
            Player player = Bukkit.getPlayer(id);
            if (player != null) leave(player);
        }
        cases.clear();
        results.clear();
    }
}
