package community.pvp.arena;

import java.time.Duration;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.title.Title;
import org.bukkit.*;
import org.bukkit.entity.Player;

/**
 * Short, local cues only; combat timing and native equipment attributes remain vanilla.
 */
final class RoundEffects {
    static void count(CommunityArena p, Player a, int left, String subtitle) {
        a.showTitle(Title.title(Component.text(Integer.toString(left), NamedTextColor.GOLD), Component.text(subtitle, NamedTextColor.GRAY), Title.Times.times(Duration.ZERO, Duration.ofMillis(850), Duration.ofMillis(100))));
        if (p.motion.enabled(a))
            a.playSound(a.getLocation(), Sound.BLOCK_NOTE_BLOCK_PLING, .65f, 1 + (3 - left) * .15f);
    }

    static void go(CommunityArena p, Player a) {
        a.setFallDistance(0);
        a.setVelocity(new org.bukkit.util.Vector());
        a.showTitle(Title.title(Component.text("FIGHT!", NamedTextColor.GOLD), Component.text("Gates open", NamedTextColor.GRAY), Title.Times.times(Duration.ZERO, Duration.ofMillis(700), Duration.ofMillis(200))));
        if (p.motion.enabled(a)) {
            a.playSound(a.getLocation(), Sound.BLOCK_NOTE_BLOCK_BELL, .8f, 1.5f);
            a.spawnParticle(Particle.END_ROD, a.getLocation().add(0, 1, 0), 16, .6, .8, .6, .02);
        }
    }

    static void queued(CommunityArena p, Player a, String kit) {
        a.sendActionBar(Component.text("Queued | " + Loadouts.name(kit) + " | /leave to cancel", NamedTextColor.YELLOW));
        if (p.motion.enabled(a)) a.playSound(a.getLocation(), Sound.BLOCK_NOTE_BLOCK_CHIME, .5f, 1.2f);
    }

    static void found(CommunityArena p, Player a) {
        a.showTitle(Title.title(Component.text("MATCH FOUND", NamedTextColor.GOLD), Component.text("Preparing your round", NamedTextColor.GRAY)));
        if (p.motion.enabled(a)) a.playSound(a.getLocation(), Sound.BLOCK_AMETHYST_BLOCK_CHIME, .7f, 1.3f);
    }
}
