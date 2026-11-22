package community.pvp.arena;

import static org.junit.jupiter.api.Assertions.*;

import org.bukkit.*;
import org.bukkit.event.player.*;
import org.junit.jupiter.api.*;
import org.mockbukkit.mockbukkit.*;

class RoundLifecycleTest {
    PracticeServerMock server;
    CommunityArena p;

    @BeforeEach
    void setup() {
        server = MockBukkit.mock(new PracticeServerMock(true));
        p = MockBukkit.load(CommunityArena.class);
        p.worldSaver = w -> {
        };
        p.ready = true;
        p.data.set("holograms", null);
        p.getConfig().set("presentation.effects", false);
        p.getConfig().set("presentation.nametags", false);
        p.getConfig().set("presentation.hide-score-numbers", false);
    }

    @AfterEach
    void close() {
        MockBukkit.unmock();
    }

    @Test
    void lateLobbyCallbackCannotStripADuelAtGo() {
        var a = server.addPlayer("A");
        var b = server.addPlayer("B");
        p.start(a, b, "mace", 2, false, null, new DuelRules(118, false, false, true, false, false));
        var match = p.matches.get(a.getUniqueId());
        assertNotNull(match);
        server.getScheduler().performTicks(61);
        assertFalse(match.paused);
        var equipment = a.getInventory().getContents().clone();
        p.lobby(a);
        assertSame(match, p.matches.get(a.getUniqueId()));
        assertEquals(p.world, a.getWorld());
        assertArrayEquals(equipment, a.getInventory().getContents());
        assertFalse(match.ended);
        server.getScheduler().performTicks(120);
        assertSame(match, p.matches.get(a.getUniqueId()));
        assertFalse(match.ended);
    }

    @Test
    void respawnCallbackCannotOverrideANewDuel() {
        var a = server.addPlayer("A");
        var b = server.addPlayer("B");
        p.enter(a);
        var event = new PlayerRespawnEvent(a, p.setup.spawn(), false);
        server.getPluginManager().callEvent(event);
        p.start(a, b, "sword", 1, false, null, new DuelRules(100, false, false, true, false, false));
        server.getScheduler().performOneTick();
        assertEquals(p.world, a.getWorld());
        assertTrue(p.matches.containsKey(a.getUniqueId()));
    }

    @Test
    void allImportedTemplatesRemainInTheFightPastCountdownAndGateClosure() {
        var a = server.addPlayer("A");
        var b = server.addPlayer("B");
        for (var map : ImportedBuilds.TEMPLATES) {
            p.start(a, b, "mace", 1, false, null, new DuelRules(map.id(), false, false, true, false, false));
            var m = p.matches.get(a.getUniqueId());
            assertNotNull(m);
            server.getScheduler().performTicks(180);
            assertFalse(m.ended, map.name());
            assertFalse(m.paused, map.name());
            assertEquals(p.world, a.getWorld());
            p.finish(m, null, "test cleanup");
            server.getScheduler().performTicks(61);
        }
    }

    @Test
    void nativeOffhandSwapIsAllowedForBotsAndParties() {
        var a = server.addPlayer();
        p.enter(a);
        var session = new PracticeBots.Session();
        p.bots.sessions.put(a.getUniqueId(), session);
        var event = new PlayerSwapHandItemsEvent(a, new org.bukkit.inventory.ItemStack(Material.DIAMOND_SWORD), new org.bukkit.inventory.ItemStack(Material.TOTEM_OF_UNDYING));
        server.getPluginManager().callEvent(event);
        assertFalse(event.isCancelled());
        p.bots.sessions.clear();
        p.partyBattles.sessions.put(a.getUniqueId(), new PartyBattles.Battle());
        var partySwap = new PlayerSwapHandItemsEvent(a, event.getMainHandItem(), event.getOffHandItem());
        server.getPluginManager().callEvent(partySwap);
        assertFalse(partySwap.isCancelled());
        p.partyBattles.sessions.clear();
    }

    @Test
    void goClearsStaleFallStateAndKeepsHeldEquipment() {
        var a = server.addPlayer("A");
        var b = server.addPlayer("B");
        p.start(a, b, "mace", 1, false, null, new DuelRules(100, false, false, true, false, false));
        var weapon = a.getInventory().getItemInMainHand().clone();
        a.setFallDistance(150);
        server.getScheduler().performTicks(61);
        assertEquals(0, a.getFallDistance());
        assertEquals(weapon, a.getInventory().getItemInMainHand());
        assertEquals(p.world, a.getWorld());
    }

    @Test
    void hittingUnusedGateDoesNotSkipBattlefieldCountdown() {
        var a = server.addPlayer("A");
        var b = server.addPlayer("B");
        p.start(a, b, "sword", 1, false, null, new DuelRules(100, false, false, true, false, false));
        var map = BattleMaps.get(100);
        var entry = ImportedBuilds.build(100).a();
        var gate = p.world.getBlockAt(map.cx() - map.width() / 2 + entry.gate(), 98, 1024 - map.length() / 2 + entry.z());
        a.teleport(gate.getLocation().clone().add(-2, 0, 0));
        var e = new PlayerInteractEvent(a, org.bukkit.event.block.Action.LEFT_CLICK_BLOCK, null, gate, org.bukkit.block.BlockFace.WEST);
        server.getPluginManager().callEvent(e);
        assertFalse(p.matches.get(a.getUniqueId()).readied.contains(a.getUniqueId()));
    }
}
