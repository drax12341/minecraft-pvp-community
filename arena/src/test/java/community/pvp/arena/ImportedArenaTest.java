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
    void partySpawnsFitBattlefieldWithoutStackingPlayers() {
        for (var map : ImportedBuilds.TEMPLATES)
            for (boolean first : List.of(true, false)) {
                Set<Location> spawns = new HashSet<>();
                for (int member = 0; member < 49; member++) {
                    Location l = PartyBattles.teamSpawn(p, map.id(), first, member);
                    assertFalse(ImportedBuilds.protectedRoom(map.id(), l));
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
    void laterMapsRemainSelectableWhileTheirCopiesPrepare() {
        var a = server.addPlayer();
        p.duels.open(a, null);
        var d = p.duels.drafts.get(a.getUniqueId());
        d.kit = "mace";
        server.importedGeneration = true;
        p.warmup.readyMaps.clear();
        for (int map : List.of(115, 118, 124)) {
            assertEquals(0, BattleMaps.available(p, map, d.kit));
            p.duels.handle(a, "duelui:map:" + map, false);
            assertEquals(map, d.map, "Unprepared map must still be selectable: " + BattleMaps.get(map).name());
        }
        assertEquals(Material.LIME_DYE,a.getOpenInventory().getTopInventory().getItem(21).getType());
        assertTrue(a.getOpenInventory().getTopInventory().getItem(21).getItemMeta().getLore().stream().anyMatch(line->line.contains("0 available | 3 preparing")));
        p.duels.handle(a, "duelui:send", false);
        assertTrue(p.matches.isEmpty());
        assertTrue(p.bots.sessions.isEmpty());
        assertTrue(p.invites.isEmpty());
        var b = server.addPlayer();
        p.start(a, b, "mace", 1, false, null, d.rules());
        assertTrue(p.matches.isEmpty());
    }

    @Test
    void occupiedDesignRemainsSelectableWithoutReservingASharedCopy() {
        var a = server.addPlayer();
        p.duels.open(a, null);
        var d = p.duels.drafts.get(a.getUniqueId());
        d.kit = "mace";
        p.occupied.addAll(List.of(124, 125, 126));
        p.duels.handle(a, "duelui:map:124", false);
        assertEquals(124, d.map);
        assertEquals(0, BattleMaps.available(p, 124, d.kit));
    }

    @Test
    void selectingALaterMapMovesOnlyOneFreeCopyAheadOfOtherPreparation() {
        server.importedGeneration = true;
        var warmup = p.warmup;
        warmup.pending.clear();
        warmup.owners.clear();
        warmup.readyMaps.clear();
        var other = new MapWarmup.ChunkPos(1, 1);
        var busy = new MapWarmup.ChunkPos(2, 1);
        var first = new MapWarmup.ChunkPos(3, 1);
        var second = new MapWarmup.ChunkPos(4, 1);
        var later = new MapWarmup.ChunkPos(5, 1);
        warmup.pending.addAll(List.of(other, busy, first, later, second));
        warmup.owners.put(other, 100);
        warmup.owners.put(busy, 115);
        warmup.owners.put(first, 116);
        warmup.owners.put(second, 116);
        warmup.owners.put(later, 117);
        p.occupied.add(115);
        warmup.loading=true;
        warmup.prioritize(115);
        assertEquals(List.of(first, second, other, busy, later), List.copyOf(warmup.pending));
        assertEquals(Set.of(115), p.occupied);
        assertTrue(warmup.loading);
        assertEquals(0, warmup.completed);
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
    void fightersStartOutsideClosedRoomsAndCannotPearlInside() {
        var a = server.addPlayer("A");
        var b = server.addPlayer("B");
        p.start(a, b, "sword", 1, false, null, new DuelRules(100, true, false, true, false, false));
        var m = BattleMaps.get(100);
        var build = ImportedBuilds.build(100);
        int gate = m.cx() - m.width() / 2 + build.a().gate(), z = 1024 - m.length() / 2 + build.a().z();
        assertEquals(Material.IRON_BARS, p.world.getBlockAt(gate, 98, z).getType());
        server.getScheduler().performTicks(61);
        assertEquals(Material.IRON_BARS, p.world.getBlockAt(gate, 98, z).getType());
        server.getScheduler().performTicks(101);
        assertEquals(Material.IRON_BARS, p.world.getBlockAt(gate, 98, z).getType());
        assertTrue(p.gates.sealed.contains(100));
        assertFalse(ImportedBuilds.protectedRoom(100, a.getLocation()));
        var room = new Location(p.world, m.cx() - m.width() / 2 + build.a().x() + .5, 97, z + .5);
        var event = new PlayerTeleportEvent(a, a.getLocation(), room, PlayerTeleportEvent.TeleportCause.ENDER_PEARL);
        server.getPluginManager().callEvent(event);
        assertTrue(event.isCancelled());
    }

    @Test
    void roundReuseNeverOpensTheUnusedEntryRooms() {
        p.occupied.add(100);
        p.gates.close(100);
        server.getScheduler().performTicks(50);
        p.gates.close(100);
        server.getScheduler().performTicks(51);
        assertTrue(p.gates.sealed.contains(100));
        server.getScheduler().performTicks(50);
        assertTrue(p.gates.sealed.contains(100));
    }

    @Test
    void entryRoomsAndBarrierShellCannotBeJournaledOrDestroyed() {
        var map = BattleMaps.get(100);
        var build = ImportedBuilds.build(100);
        var spawn = new Location(p.world, map.cx() - map.width() / 2 + build.a().x() + .5, 97, 1024 - map.length() / 2 + build.a().z() + .5);
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
