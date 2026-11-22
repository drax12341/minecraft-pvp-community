package community.pvp.arena;

import static org.junit.jupiter.api.Assertions.*;
import java.util.*;
import org.bukkit.*;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.event.player.*;
import org.junit.jupiter.api.*;
import org.mockbukkit.mockbukkit.*;

class MedalExperienceTest {
    PracticeServerMock server;
    CommunityArena p;

    @BeforeEach void setup() {
        server = MockBukkit.mock(new PracticeServerMock(true));
        p = MockBukkit.load(CommunityArena.class);
        p.worldSaver = w -> {};
        p.ready = true;
        p.data.set("holograms", null);
        p.getConfig().set("presentation.effects", false);
        p.getConfig().set("presentation.nametags", false);
        p.getConfig().set("presentation.hide-score-numbers", false);
    }
    @AfterEach void close() { MockBukkit.unmock(); }

    @Test void allMapsSpawnOnTheBattlefieldImmediately() {
        for (var map : ImportedBuilds.SLOTS)
            for (boolean first : List.of(true, false)) {
                var spawn = BattleMaps.spawn(p, map.id(), first);
                assertTrue(BattleMaps.contains(p, map.id(), spawn), map.name());
                assertTrue(BattleMaps.contains(p, map.id(), spawn));
            }
    }

    @Test void countdownRequiresBothPlayersAndReleasesPromptlyAfterReady() {
        var a = server.addPlayer("A");
        var b = server.addPlayer("B");
        p.start(a, b, "mace_spear", 1, false, null, new DuelRules(124, false, false, true, false, false));
        var m = p.matches.get(a.getUniqueId());
        server.getScheduler().performTicks(9);
        server.getPluginManager().callEvent(new PlayerToggleSneakEvent(a, true));
        server.getScheduler().performTicks(2);
        assertTrue(m.paused);
        server.getPluginManager().callEvent(new PlayerToggleSneakEvent(b, true));
        server.getScheduler().performTicks(2);
        assertFalse(m.paused);
        assertFalse(p.frozen.contains(a.getUniqueId()));
    }

    @Test void spearKitIncludesNativeLungeThree() {
        var spear = Arrays.stream(ReferenceLoadouts.create("mace_spear"))
                .filter(Objects::nonNull).filter(i -> i.getType().name().endsWith("_SPEAR")).findFirst().orElseThrow();
        assertEquals(3, spear.getEnchantmentLevel(Enchantment.LUNGE));
    }

    @Test void firstRankedWinDoesNotCreateAChampion() {
        var a = server.addPlayer("A");
        var b = server.addPlayer("B");
        var m = p.new Match(a, b, "sword", 1, 1);
        m.ranked = true;
        p.progression.result(m, a.getUniqueId());
        assertNotEquals("#1 Champion", p.progression.rank(a.getUniqueId()));
        p.data.set(p.progression.key(a.getUniqueId()) + "elo", 2800);
        p.progression.refresh();
        assertEquals("#1 Champion", p.progression.rank(a.getUniqueId()));
    }

    @Test void referenceDivisionBoundariesAreConsistent() {
        assertEquals("Copper I", Rating.division(1000));
        assertEquals("Copper III", Rating.division(1299));
        assertEquals("Iron I", Rating.division(1300));
        assertEquals("Netherite III", Rating.division(2800));
    }

    @Test void rankedQueueChoosesClosestEligibleKitRating() {
        var a = server.addPlayer("First");
        var b = server.addPlayer("EarlierFarther");
        var c = server.addPlayer("LaterCloser");
        p.data.set(p.progression.key(b.getUniqueId()) + "kits.sword.elo", 1090);
        p.data.set(p.progression.key(c.getUniqueId()) + "kits.sword.elo", 1010);
        for (var player : List.of(a, b, c)) p.progression.queue(player, "sword");
        p.progression.match();
        assertSame(p.matches.get(a.getUniqueId()), p.matches.get(c.getUniqueId()));
        assertTrue(p.queues.containsKey(b.getUniqueId()));
    }

    @Test void aNewPlayerDoesNotInheritAnOldOpponentsWideQueueWindow() {
        var a = server.addPlayer("OldQueue");
        var b = server.addPlayer("NewQueue");
        p.data.set(p.progression.key(b.getUniqueId()) + "kits.sword.elo", 1500);
        p.progression.queue(a, "sword");
        p.progression.queue(b, "sword");
        p.progression.queuedAt.put(a.getUniqueId(), System.currentTimeMillis() - 600000);
        p.progression.match();
        assertTrue(p.matches.isEmpty());
        assertEquals(2, p.queues.size());
    }

    @Test void filteredStandingsUseOnlyTheChosenKitsRealRankedResults() {
        var a = server.addPlayer("A");
        var b = server.addPlayer("B");
        var m = p.new Match(a, b, "sword", 1, 1);
        m.ranked = true;
        p.progression.result(m, a.getUniqueId());
        assertEquals(List.of(a.getUniqueId(), b.getUniqueId()), p.reference.standings("elo", "sword", "all"));
        assertTrue(p.reference.standings("elo", "axe", "all").isEmpty());
        assertEquals(1, p.reference.score(a.getUniqueId(), "wins", "sword", "day"));
        assertEquals(0, p.reference.score(a.getUniqueId(), "wins", "axe", "day"));
    }

    @Test void settingsResetAndFriendRequestPreferenceWorkThroughActions() {
        var a = server.addPlayer("A");
        var b = server.addPlayer("B");
        p.enter(a);
        p.enter(b);
        p.handleMenuClick(b, "setting:friendrequests", false, false);
        assertFalse(p.flag(b, "friendrequests", true));
        p.social.friends(a, new String[]{"add", "B"});
        assertTrue(p.social.requests.isEmpty());
        p.handleMenuClick(b, "setting:friendrequests", false, true);
        assertTrue(p.flag(b, "friendrequests", true));
        p.social.friends(a, new String[]{"add", "B"});
        assertTrue(p.social.requests.containsKey(b.getUniqueId()));
        p.handleMenuClick(b, "setting:elo", false, true);
        assertEquals(1000, p.progression.elo(b.getUniqueId()));
    }

    @Test void oldRatingsArePreservedAndCasualGamesCannotChangeThem() {
        var a = server.addPlayer("A");
        var b = server.addPlayer("B");
        p.data.set(p.progression.key(a.getUniqueId()) + "elo", 616);
        p.progression.result(p.new Match(a, b, "sword", 1, 1), a.getUniqueId());
        assertEquals(616, p.progression.elo(a.getUniqueId()));
    }

    @Test void partyCountdownUsesAllMemberReadyVotes() {
        var a = server.addPlayer("A");
        var b = server.addPlayer("B");
        p.parties.command(a, new String[]{"create"});
        p.parties.command(a, new String[]{"invite", "B"});
        p.parties.command(b, new String[]{"accept", "A"});
        p.data.set("built-battle-maps-v5", true);
        var draft = new DuelMenus.Draft();
        draft.map = 100;
        p.partyBattles.start(a, draft);
        var battle = p.partyBattles.sessions.get(a.getUniqueId());
        assertNotNull(battle);
        server.getPluginManager().callEvent(new PlayerToggleSneakEvent(a, true));
        server.getScheduler().performTicks(2);
        assertTrue(battle.paused);
        server.getPluginManager().callEvent(new PlayerToggleSneakEvent(b, true));
        server.getScheduler().performTicks(2);
        assertFalse(battle.paused);
    }

    @Test void countdownBlocksEarlyItemUseAndPearls() {
        var a = server.addPlayer("A");
        var b = server.addPlayer("B");
        p.start(a, b, "mace_spear", 1);
        var use = new PlayerInteractEvent(a, org.bukkit.event.block.Action.RIGHT_CLICK_AIR,
                new org.bukkit.inventory.ItemStack(Material.WIND_CHARGE), null, org.bukkit.block.BlockFace.SELF);
        server.getPluginManager().callEvent(use);
        assertEquals(org.bukkit.event.Event.Result.DENY, use.useItemInHand());
        var pearl = new PlayerTeleportEvent(a, a.getLocation(), a.getLocation().clone().add(3, 0, 0), PlayerTeleportEvent.TeleportCause.ENDER_PEARL);
        server.getPluginManager().callEvent(pearl);
        assertTrue(pearl.isCancelled());
    }

    @Test void hologramClickOpensStandingsEvenWhileHoldingANavigationItem() {
        var a = server.addPlayer("A");
        p.enter(a);
        var at = a.getEyeLocation().add(a.getEyeLocation().getDirection().multiply(3));
        p.visuals.holograms.put("example", UUID.randomUUID());
        p.data.set("holograms.example.location", at);
        p.data.set("holograms.example.stat", "elo");
        var use = new PlayerInteractEvent(a, org.bukkit.event.block.Action.RIGHT_CLICK_AIR,
                a.getInventory().getItem(0), null, org.bukkit.block.BlockFace.SELF, org.bukkit.inventory.EquipmentSlot.HAND);
        server.getPluginManager().callEvent(use);
        assertTrue(net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText()
                .serialize(a.getOpenInventory().title()).startsWith("Standings"));
    }
}
