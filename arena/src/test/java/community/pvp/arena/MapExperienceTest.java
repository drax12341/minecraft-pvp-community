package community.pvp.arena;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;

import org.bukkit.*;
import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.*;
import org.mockbukkit.mockbukkit.*;

class MapExperienceTest {
    @Test
    void busySizeTabCannotSendAnInvitation() {
        var a = server.addPlayer("Sender");
        var b = server.addPlayer("Receiver");
        p.duels.open(a, b.getName());
        var d = p.duels.drafts.get(a.getUniqueId());
        d.kit = "mace";
        p.occupied.add(7);
        p.duels.handle(a, "duelui:size:1", false);
        assertEquals(7, d.map);
        p.duels.handle(a, "duelui:send", false);
        assertFalse(p.invites.containsKey(b.getUniqueId()));
        p.occupied.clear();
    }

    @Test
    void busyInvitedArenaDoesNotConsumeTheInvitation() {
        var a = server.addPlayer("Sender");
        var b = server.addPlayer("Receiver");
        var invite = new CommunityArena.Invite(a.getUniqueId(), "mace", 1, System.currentTimeMillis() + 60000, null, new DuelRules(7, false, false, true, false, false));
        p.invites.put(b.getUniqueId(), invite);
        p.occupied.add(7);
        server.dispatchCommand(b, "duel accept Sender");
        assertSame(invite, p.invites.get(b.getUniqueId()));
        assertTrue(p.matches.isEmpty());
        p.occupied.clear();
    }

    @Test
    void exportCourtyardGeometryPreview() throws Exception {
        var json = new StringBuilder("{\"maps\":[{\"name\":\"Grand Courtyard\",\"cells\":[");
        boolean first = true;
        for (int x = -49; x <= 49; x++)
            for (int z = -49; z <= 49; z++) {
                var cells = new TreeMap<Integer, Material>();
                CourtyardGenerator.fullColumn(x, z, (lo, hi, material) -> {
                    for (int y = lo; y < hi; y++) cells.put(y, material);
                });
                var top = cells.descendingMap().entrySet().stream().filter(e -> e.getValue() != Material.AIR && e.getValue() != Material.BARRIER).findFirst().orElseThrow();
                if (!first) json.append(',');
                first = false;
                json.append('[').append(x).append(',').append(z).append(',').append(top.getKey()).append(",\"").append(top.getValue().name()).append("\"]");
            }
        json.append("]}]}");
        java.nio.file.Files.writeString(java.nio.file.Path.of("target/courtyard-v7-preview.json"), json);
    }

    @Test
    void changingToCompactOnlyKitKeepsTheBiome() {
        var a = server.addPlayer();
        p.duels.open(a, null);
        var d = p.duels.drafts.get(a.getUniqueId());
        d.kit = "mace";
        d.map = 14;
        p.duels.handle(a, "duelui:kit:sword", false);
        assertEquals(12, d.map);
        assertEquals("sword", d.kit);
    }

    @Test
    void nativeChunkDataPreservesLegacyV6AndAddsV7Landmarks() {
        var map = BattleMaps.get(19);
        int x = map.cx() + map.width() / 3 + 4, z = 1024 + map.length() / 3, y = ArenaLandscape.terrain(map, map.width() / 3, map.length() / 3) + 3;
        var old = server.createChunkData(p.world);
        var fresh = server.createChunkData(p.world);
        new BattleGenerator(false).generateNoise(null, new Random(0), x >> 4, z >> 4, old);
        new BattleGenerator().generateNoise(null, new Random(0), x >> 4, z >> 4, fresh);
        assertNotEquals(Material.CHERRY_LOG, old.getType(x & 15, y, z & 15));
        assertEquals(Material.CHERRY_LOG, fresh.getType(x & 15, y, z & 15));
        assertEquals(Material.BEDROCK, fresh.getType(x & 15, 50, z & 15));
        assertEquals(Material.BARRIER, fresh.getType(x & 15, map.ceiling(), z & 15));
    }

    @Test
    void nativeCourtyardChunkDataAddsTheNewArchOnlyInV7() {
        var old = server.createChunkData(p.citadel);
        var fresh = server.createChunkData(p.citadel);
        new CourtyardGenerator(false).generateNoise(null, new Random(0), 0, -3, old);
        new CourtyardGenerator().generateNoise(null, new Random(0), 0, -3, fresh);
        assertEquals(Material.AIR, old.getType(0, 86, 11));
        assertEquals(Material.GOLD_BLOCK, fresh.getType(0, 86, 11));
    }

    @Test
    void duplicateHologramsShareOnlyTheCurrentRefreshSnapshot() throws Exception {
        var data = new CountingData();
        data.loadFromString(p.data.saveToString());
        p.data = data;
        p.data.set("holograms", null);
        for (int i = 0; i < 1000; i++) {
            var id = new UUID(0, i + 1);
            p.data.set("players." + id + ".games", 1);
            p.data.set("players." + id + ".wins", i);
            p.data.set("players." + id + ".name", "Historic" + i);
        }
        for (int i = 0; i < 3; i++) {
            p.data.set("holograms.shared" + i + ".location", new Location(p.citadel, i * 5, 68, 0));
            p.data.set("holograms.shared" + i + ".stat", "wins");
            p.visuals.holograms.put("shared" + i, p.citadel.spawn(new Location(p.citadel, i * 5, 68, 0), org.bukkit.entity.TextDisplay.class).getUniqueId());
        }
        data.reads = 0;
        p.visuals.refreshHolograms();
        assertTrue(data.reads <= 2100, "Same-stat boards repeated their full ranking lookup: " + data.reads);
        var changed = new UUID(0, 1);
        p.data.set("players." + changed + ".wins", 2000);
        p.data.set("players." + changed + ".name", "NewLeader");
        p.visuals.refreshHolograms();
        for (var id : p.visuals.holograms.values()) {
            var display = (org.bukkit.entity.TextDisplay) Bukkit.getEntity(id);
            assertTrue(net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText().serialize(display.text()).contains("NewLeader"));
        }
    }

    @Test
    void v6JournalRestoresOnlyTheOriginalWorld() throws Exception {
        var old = server.createWorld(new WorldCreator("community_arena_v6"));
        var map = BattleMaps.get(6);
        var block = old.getBlockAt(map.cx(), 65, 1024);
        old.getChunkAt(map.cx() >> 4, 1024 >> 4);
        block.setType(Material.LAVA);
        var file = p.getDataFolder().toPath().resolve("v6-arena-6.journal");
        java.nio.file.Files.writeString(file, map.cx() + ",65,1024 minecraft:stone\n");
        p.worldSaver = w -> assertSame(old, w);
        p.terrain.recoverV6();
        assertEquals(Material.STONE, block.getType());
        assertEquals(Material.AIR, p.world.getBlockAt(map.cx(), 65, 1024).getType());
        assertFalse(java.nio.file.Files.exists(file));
        p.worldSaver = w -> {
        };
    }

    String action(org.bukkit.inventory.ItemStack item) {
        return item == null || !item.hasItemMeta() ? null : item.getItemMeta().getPersistentDataContainer().get(p.menuKey, org.bukkit.persistence.PersistentDataType.STRING);
    }

    @Test
    void sizeButtonsFilterSixBiomesAndPreserveSelection() {
        var a = server.addPlayer();
        p.duels.open(a, null);
        var d = p.duels.drafts.get(a.getUniqueId());
        d.kit = "mace";
        d.map = 12;
        p.duels.maps(a);
        assertEquals("duelui:size:0", action(a.getOpenInventory().getTopInventory().getItem(2)));
        p.duels.handle(a, "duelui:size:1", false);
        assertEquals(13, d.map);
        var inv = a.getOpenInventory().getTopInventory();
        assertEquals("duelui:map:13", action(inv.getItem(24)));
        assertEquals(6, Arrays.stream(inv.getContents()).filter(Objects::nonNull).map(this::action).filter(Objects::nonNull).filter(s -> s.startsWith("duelui:map:")).count());
        p.duels.handle(a, "duelui:size:2", false);
        assertEquals(14, d.map);
        p.duels.handle(a, "duelui:size:0", false);
        assertEquals(12, d.map);
    }

    @Test
    void compactKitCannotUseForgedLargeSizeOrMap() {
        var a = server.addPlayer();
        p.duels.open(a, null);
        var d = p.duels.drafts.get(a.getUniqueId());
        p.duels.maps(a);
        assertEquals(Material.BARRIER, a.getOpenInventory().getTopInventory().getItem(4).getType());
        assertNull(action(a.getOpenInventory().getTopInventory().getItem(4)));
        for (String forged : List.of("duelui:size:2", "duelui:size:99", "duelui:size:-1", "duelui:size:nope", "duelui:map:8")) {
            p.duels.handle(a, forged, false);
            assertEquals(6, d.map);
        }
    }

    @Test
    void randomMapNeverChangesSizeOrChoosesOccupiedArena() {
        var a = server.addPlayer();
        p.duels.open(a, null);
        var d = p.duels.drafts.get(a.getUniqueId());
        d.kit = "mace";
        d.map = 8;
        for (var map : BattleMaps.all()) if (map.size() == 2 && map.id() != 20) p.occupied.add(map.id());
        p.duels.handle(a, "duelui:random-map", false);
        assertEquals(20, d.map);
        p.occupied.add(20);
        p.duels.handle(a, "duelui:random-map", false);
        assertEquals(20, d.map);
        p.duels.handle(a, "duelui:map:8", false);
        assertEquals(20, d.map);
        p.occupied.clear();
    }

    @Test
    void changedSizeDoesNotMutateAnInvitationSnapshot() {
        var d = new DuelMenus.Draft();
        d.map = 8;
        var invitation = new CommunityArena.Invite(UUID.randomUUID(), "mace", 3, System.currentTimeMillis() + 60000, null, d.rules());
        d.map = 6;
        assertEquals(8, invitation.rules().map());
    }

    @Test
    void missingV6RecoveryWorldRetainsItsJournal() throws Exception {
        var file = p.getDataFolder().toPath().resolve("v6-arena-6.journal");
        java.nio.file.Files.writeString(file, "2048,65,1024 minecraft:stone\n");
        assertThrows(IllegalStateException.class, p.terrain::recoverV6);
        assertTrue(java.nio.file.Files.exists(file));
        java.nio.file.Files.delete(file);
    }

    @Test
    void sixBiomeLandmarksArePresentOutsideTheSafeSpawnLane() {
        Material[] markers = {Material.MOSSY_STONE_BRICKS, Material.CHISELED_SANDSTONE, Material.MOSSY_COBBLESTONE, Material.PACKED_ICE, Material.CHERRY_PLANKS, Material.ORANGE_TERRACOTTA};
        for (int theme = 0; theme < 6; theme++) {
            var map = BattleMaps.get(7 + theme * 3);
            var found = new HashSet<Material>();
            for (int x = map.width() / 3 - 7; x <= map.width() / 3 + 7; x++)
                for (int z = map.length() / 3 - 7; z <= map.length() / 3 + 7; z++)
                    ArenaLandmarks.column(map, x, z, (lo, hi, mat) -> {
                        if (hi > lo) found.add(mat);
                    });
            assertTrue(found.contains(markers[theme]), map.name());
        }
    }

    @Test
    void courtyardTowerRoomsAreClearAndNorthArchExists() {
        var room = new HashMap<Integer, Material>();
        CourtyardGenerator.fullColumn(44, 43, (lo, hi, mat) -> {
            for (int y = lo; y < hi; y++) room.put(y, mat);
        });
        assertEquals(Material.AIR, room.get(65));
        assertEquals(Material.AIR, room.get(66));
        var arch = new HashSet<Material>();
        CourtyardGenerator.fullColumn(0, -37, (lo, hi, mat) -> {
            if (hi > lo) arch.add(mat);
        });
        assertTrue(arch.contains(Material.GOLD_BLOCK));
    }

    ServerMock server;
    CommunityArena p;

    @BeforeEach
    void setup() {
        server = MockBukkit.mock(new PracticeServerMock());
        p = MockBukkit.load(CommunityArena.class);
        p.worldSaver = w -> {
        };
        p.getConfig().set("presentation.nametags", false);
        p.getConfig().set("presentation.effects", false);
        p.getConfig().set("presentation.hide-score-numbers", false);
        p.ready = true;
    }

    @AfterEach
    void close() {
        MockBukkit.unmock();
    }

    static class CountingData extends YamlConfiguration {
        int reads;

        @Override
        public int getInt(String key, int fallback) {
            reads++;
            return super.getInt(key, fallback);
        }
    }

    @Test
    void topTenReadsEachScoreOnceAndKeepsCorrectTieOrder() throws Exception {
        var data = new CountingData();
        data.loadFromString(p.data.saveToString());
        p.data = data;
        var expected = new ArrayList<UUID>();
        for (int i = 0; i < 1000; i++) {
            var id = new UUID(0, i + 1);
            expected.add(id);
            p.data.set("players." + id + ".games", 1);
            p.data.set("players." + id + ".wins", Math.floorMod(i * 137, 997));
        }
        expected.sort(Comparator.<UUID>comparingInt(id -> p.data.getInt("players." + id + ".wins")).reversed().thenComparing(UUID::toString));
        data.reads = 0;
        var actual = p.visuals.leaders("wins");
        int reads = data.reads;
        System.out.println("1000-record top10: integer reads=" + reads);
        assertEquals(expected.subList(0, 10), actual);
        assertTrue(reads <= 2100, "Top-ten lookup should not reread YAML scores inside sort comparisons: " + reads);
    }
}
