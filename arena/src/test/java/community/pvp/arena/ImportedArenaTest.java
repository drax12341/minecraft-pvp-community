package community.pvp.arena;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;

import org.bukkit.*;
import org.bukkit.event.player.*;
import org.junit.jupiter.api.*;
import org.mockbukkit.mockbukkit.*;

class ImportedArenaTest {
    PracticeServerMock server;
    CommunityArena p;

    @BeforeEach
    void start() {
        server = MockBukkit.mock(new PracticeServerMock(true));
        p = MockBukkit.load(CommunityArena.class);
        p.worldSaver = w -> {
        };
        p.ready = true;
        p.data.set("holograms", null);
        p.getConfig().set("presentation.nametags", false);
        p.getConfig().set("presentation.effects", false);
        p.getConfig().set("presentation.hide-score-numbers", false);
    }

    @AfterEach
    void stop() {
        MockBukkit.unmock();
    }

    @Test
    void catalogueHasThreeSizesAndThreeDisjointCopiesOfEveryImportedMap() {
        assertEquals(9, BattleMaps.playable(p).size());
        assertEquals(27, BattleMaps.slots(p).size());
        assertEquals(Set.of(0, 1, 2), new HashSet<>(ImportedBuilds.TEMPLATES.stream().map(BattleMaps.MapInfo::size).toList()));
        for (var m : ImportedBuilds.SLOTS) {
            assertTrue(m.width() > 50);
            assertSame(m, BattleMaps.at(m.cx(), 1024));
            for (var other : ImportedBuilds.SLOTS)
                if (m.id() != other.id())
                    assertFalse(BattleMaps.contains(p, m.id(), BattleMaps.spawn(p, other.id(), true)));
        }
    }

    @Test
    void partySpawnsFitBothEntryRoomsWithoutStackingPlayers() {
        for (var map : ImportedBuilds.TEMPLATES)
            for (boolean first : List.of(true, false)) {
                Set<Location> spawns = new HashSet<>();
            for (int member = 0; member < 49; member++) {
                    Location l = PartyBattles.teamSpawn(p, map.id(), first, member);
                    assertTrue(ImportedBuilds.protectedRoom(map.id(), l));
                    assertTrue(BattleMaps.contains(p, map.id(), l));
                    assertTrue(spawns.add(l));
                }
            }
    }

    @Test
    void warmupMarksOnlyAnEntirelyPreparedCopyReady() {
        var warmup = p.warmup;
        warmup.pending.clear();
        warmup.remaining.clear();
        warmup.owners.clear();
        warmup.readyMaps.clear();
        var one = new MapWarmup.ChunkPos(10, 10);
        var two = new MapWarmup.ChunkPos(11, 10);
        warmup.pending.add(one);
        warmup.pending.add(two);
        warmup.owners.put(one, 100);
        warmup.owners.put(two, 100);
        warmup.remaining.put(100, 2);
        warmup.loader = pos -> java.util.concurrent.CompletableFuture.completedFuture(null);
        warmup.unloader = pos -> {
        };
        warmup.step();
        server.getScheduler().performOneTick();
        assertFalse(warmup.readyMaps.contains(100));
        warmup.step();
        server.getScheduler().performOneTick();
        assertTrue(warmup.readyMaps.contains(100));
        assertFalse(warmup.readyMaps.contains(101));
    }

    @Test
    void sameDesignAllocatesCopiesAndNeverSharesAFight() {
        int template = 100;
        var a = server.addPlayer("A");
        var b = server.addPlayer("B");
        var c = server.addPlayer("C");
        var d = server.addPlayer("D");
        var rules = new DuelRules(template, false, false, true, false, false);
        p.start(a, b, "sword", 1, false, null, rules);
        p.start(c, d, "sword", 1, false, null, rules);
        assertEquals(100, p.matches.get(a.getUniqueId()).arena);
        assertEquals(101, p.matches.get(c.getUniqueId()).arena);
        assertEquals(102, BattleMaps.available(p, template, "sword"));
        p.occupied.add(102);
        assertEquals(0, BattleMaps.available(p, template, "sword"));
    }

    @Test
    void compactModesHideBiggerSizesAndRejectForgedSelections() {
        var a = server.addPlayer();
        p.duels.open(a, null);
        var d = p.duels.drafts.get(a.getUniqueId());
        p.duels.maps(a);
        var inv = a.getOpenInventory().getTopInventory();
        assertEquals(Material.LIME_DYE, inv.getItem(2).getType());
        assertEquals(Material.BLUE_STAINED_GLASS_PANE, inv.getItem(6).getType());
        p.duels.handle(a, "duelui:map:124", false);
        assertEquals(100, d.map);
        p.duels.handle(a, "duelui:size:2", false);
        assertEquals(100, d.map);
        p.duels.handle(a, "duelui:kit:mace", false);
        p.duels.handle(a, "duelui:size:2", false);
        assertEquals(2, BattleMaps.get(d.map).size());
        p.duels.handle(a, "duelui:kit:axe", false);
        assertEquals(0, BattleMaps.get(d.map).size());
    }

    @Test
    void selectionStaysInBrowserAndChangesFromGrayToGreen() {
        var a = server.addPlayer();
        p.duels.open(a, null);
        p.duels.maps(a);
        assertEquals(Material.LIME_DYE, a.getOpenInventory().getTopInventory().getItem(19).getType());
        assertEquals(Material.GRAY_DYE, a.getOpenInventory().getTopInventory().getItem(21).getType());
        p.duels.handle(a, "duelui:map:103", false);
        assertEquals(Material.GRAY_DYE, a.getOpenInventory().getTopInventory().getItem(19).getType());
        assertEquals(Material.LIME_DYE, a.getOpenInventory().getTopInventory().getItem(21).getType());
    }

    @Test
    void gatesOpenAtGoThenSealAndDenyPearlEntry() {
        var a = server.addPlayer("A");
        var b = server.addPlayer("B");
        p.start(a, b, "sword", 1, false, null, new DuelRules(100, true, false, true, false, false));
        var m = BattleMaps.get(100);
        var build = ImportedBuilds.build(100);
        int gate = m.cx() - m.width() / 2 + build.a().gate(), z = 1024 - m.length() / 2 + build.a().z();
        assertEquals(Material.IRON_BARS, p.world.getBlockAt(gate, 98, z).getType());
        server.getScheduler().performTicks(61);
        assertEquals(Material.AIR, p.world.getBlockAt(gate, 98, z).getType());
        server.getScheduler().performTicks(101);
        assertEquals(Material.IRON_BARS, p.world.getBlockAt(gate, 98, z).getType());
        assertTrue(p.gates.sealed.contains(100));
        assertFalse(ImportedBuilds.protectedRoom(100, a.getLocation()));
        var event = new PlayerTeleportEvent(a, a.getLocation(), BattleMaps.spawn(p, 100, true), PlayerTeleportEvent.TeleportCause.ENDER_PEARL);
        server.getPluginManager().callEvent(event);
        assertTrue(event.isCancelled());
    }

    @Test
    void staleGateTimerCannotCloseAReusedRound() {
        p.occupied.add(100);
        p.gates.close(100);
        p.gates.open(100);
        server.getScheduler().performTicks(50);
        p.gates.close(100);
        p.gates.open(100);
        server.getScheduler().performTicks(51);
        assertFalse(p.gates.sealed.contains(100));
        server.getScheduler().performTicks(50);
        assertTrue(p.gates.sealed.contains(100));
    }

    @Test
    void entryRoomsAndBarrierShellCannotBeJournaledOrDestroyed() {
        var spawn = BattleMaps.spawn(p, 100, true);
        spawn.getBlock().setType(Material.IRON_BARS);
        assertFalse(p.terrain.record(100, spawn.getBlock()));
        var point = spawn.clone().add(12, 0, 0).getBlock();
        point.setType(Material.BARRIER);
        assertFalse(p.terrain.record(100, point));
        assertFalse(p.terrain.recordBatch(100, List.of(point)));
        assertFalse(p.terrain.recordBatch(100, List.of(spawn.getBlock())));
    }

    @Test
    void fallCatchReturnsToLandingAndLobbyUsesImportedBounds() {
        var a = server.addPlayer("A");
        var b = server.addPlayer("B");
        p.start(a, b, "sword", 1, false, null, new DuelRules(100, false, false, true, false, false));
        var from = a.getLocation().clone().add(0, -45, 0);
        var event = new PlayerMoveEvent(a, from, from.clone().add(0, -1, 0));
        server.getPluginManager().callEvent(event);
        assertEquals(97, event.getTo().getY());
        assertEquals("community_citadel_v8", p.setup.spawn().getWorld().getName());
        assertTrue(p.setup.contains(new Location(p.citadel, 80, 97, 0)));
        assertFalse(p.setup.contains(new Location(p.citadel, 180, 97, 0)));
    }
}
