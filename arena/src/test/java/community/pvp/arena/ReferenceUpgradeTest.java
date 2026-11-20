package community.pvp.arena;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import java.util.concurrent.*;

import org.bukkit.*;
import org.bukkit.entity.*;
import org.bukkit.event.world.EntitiesUnloadEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.Plugin;
import org.junit.jupiter.api.*;
import org.mockbukkit.mockbukkit.*;
import org.mockbukkit.mockbukkit.entity.PlayerMock;

class ReferenceUpgradeTest {
    @Test
    void movingBotCircuitCannotIntersectNewGateways() {
        for (var map : BattleMaps.all())
            for (int tick = 0; tick < 120; tick += 2) {
                var l = PracticeBots.motionLocation(p, map.id(), tick);
                assertTrue(map.inside(l, p.world, 1));
                var blocks = column(map, l.getBlockX() - map.cx(), l.getBlockZ() - 1024);
                for (int y = 65; y <= 66; y++)
                    assertTrue(!blocks.containsKey(y) || blocks.get(y) == Material.AIR, map.name() + " bot collided at " + l);
            }
    }

    @Test
    void fiftyPlayerPartyHasDistinctSafeSpawns() {
        for (var map : BattleMaps.all()) {
            var spawns = new HashSet<Location>();
            for (boolean first : new boolean[]{true, false})
                for (int n = 0; n < 25; n++) {
                    var l = PartyBattles.teamSpawn(p, map.id(), first, n);
                    assertTrue(spawns.add(l));
                    assertTrue(map.inside(l, p.world, 1));
                    assertEquals(64, ArenaLandscape.terrain(map, l.getBlockX() - map.cx(), l.getBlockZ() - 1024));
                }
            assertEquals(50, spawns.size());
        }
    }

    @Test
    void fallingTerrainBlocksRestoreTheirDepartureAndLanding() {
        var a = server.addPlayer();
        var b = server.addPlayer();
        p.start(a, b, "uhc", 1, false, null, new DuelRules(9, false, false, false, false, false));
        var match = p.matches.get(a.getUniqueId());
        match.paused = false;
        var origin = p.loc(9, 0, 0, 0).getBlock();
        origin.setType(Material.SAND);
        var landing = origin.getRelative(0, -2, 0);
        landing.setType(Material.AIR);
        var entity = p.world.spawn(origin.getLocation(), Zombie.class);
        var departure = new org.bukkit.event.entity.EntityChangeBlockEvent(entity, origin, Material.AIR.createBlockData());
        p.terrain.entityBlockChange(departure);
        assertFalse(departure.isCancelled());
        origin.setType(Material.AIR);
        var arrival = new org.bukkit.event.entity.EntityChangeBlockEvent(entity, landing, Material.SAND.createBlockData());
        p.terrain.entityBlockChange(arrival);
        assertFalse(arrival.isCancelled());
        landing.setType(Material.SAND);
        p.terrain.reset(9);
        assertEquals(Material.SAND, origin.getType());
        assertEquals(Material.AIR, landing.getType());
    }

    @Test
    void prewarmHasOneInFlightRequestAndPausesForCombat() {
        var warmup = new MapWarmup(p);
        warmup.pending.clear();
        warmup.pending.add(new MapWarmup.ChunkPos(128, 64));
        warmup.pending.add(new MapWarmup.ChunkPos(129, 64));
        var future = new CompletableFuture<Chunk>();
        int[] calls = {0, 0};
        warmup.loader = pos -> {
            calls[0]++;
            return future;
        };
        warmup.unloader = pos -> calls[1]++;
        warmup.step();
        warmup.step();
        assertEquals(1, calls[0]);
        assertTrue(warmup.loading);
        future.complete(null);
        server.getScheduler().performTicks(1);
        assertEquals(1, warmup.completed);
        assertEquals(1, calls[1]);
        p.ffa.add(UUID.randomUUID());
        warmup.step();
        assertEquals(1, calls[0]);
        p.ffa.clear();
    }

    @Test
    void prewarmFailureNeverClaimsAllMapsBuilt() {
        var warmup = new MapWarmup(p);
        warmup.pending.clear();
        warmup.pending.add(new MapWarmup.ChunkPos(128, 64));
        warmup.loader = pos -> {
            throw new IllegalStateException("disk failure");
        };
        warmup.step();
        assertFalse(warmup.loading);
        assertEquals(1, warmup.failures);
        warmup.step();
        assertFalse(p.data.getBoolean("maps-v6-prewarmed"));
    }

    @Test
    void customSlotsDoNotOverwriteTheNinePresetChoices() {
        var a = server.addPlayer();
        for (int slot = 1; slot <= 3; slot++)
            p.data.set(p.savedKits.key(a.getUniqueId(), slot), Arrays.asList(ReferenceLoadouts.create("sword")));
        p.duels.open(a, null);
        p.duels.kits(a);
        var inv = a.getOpenInventory().getTopInventory();
        for (int n = 0; n < 9; n++) {
            int index = new int[]{11, 13, 15, 20, 22, 24, 29, 31, 33}[n];
            assertEquals("duelui:kit:" + CommunityArena.KITS[n], inv.getItem(index).getItemMeta().getPersistentDataContainer().get(p.menuKey, org.bukkit.persistence.PersistentDataType.STRING));
        }
        for (int slot = 1; slot <= 3; slot++) assertEquals(Material.CHEST, inv.getItem(36 + slot * 2).getType());
    }

    @Test
    void uhcHeadConsumptionIsBoundedAndNaturalRegenDisabled() {
        var a = server.addPlayer();
        var b = server.addPlayer();
        p.start(a, b, "uhc", 1);
        var match = p.matches.get(a.getUniqueId());
        match.paused = false;
        a.getInventory().setItemInMainHand(GoldenHeads.item());
        var event = new org.bukkit.event.player.PlayerInteractEvent(a, org.bukkit.event.block.Action.RIGHT_CLICK_AIR, a.getInventory().getItemInMainHand(), null, org.bukkit.block.BlockFace.SELF, org.bukkit.inventory.EquipmentSlot.HAND);
        server.getPluginManager().callEvent(event);
        assertEquals(1, a.getInventory().getItemInMainHand().getAmount());
        assertTrue(a.hasPotionEffect(org.bukkit.potion.PotionEffectType.REGENERATION));
        var regen = new org.bukkit.event.entity.EntityRegainHealthEvent(a, 1, org.bukkit.event.entity.EntityRegainHealthEvent.RegainReason.SATIATED);
        server.getPluginManager().callEvent(regen);
        assertTrue(regen.isCancelled());
    }

    @Test
    void editorReopensSavedArrangement() {
        var a = server.addPlayer();
        p.enter(a);
        var layout = new ArrayList<>(Collections.nCopies(36, -1));
        layout.set(35, 0);
        p.data.set("players." + a.getUniqueId() + ".layouts-v6.sword", layout);
        p.layouts.open(a, "sword");
        assertEquals(Material.DIAMOND_SWORD, a.getOpenInventory().getTopInventory().getItem(26).getType());
        assertNull(a.getOpenInventory().getTopInventory().getItem(27));
    }

    @Test
    void roundCleanupDoesNotLoadTheEntireLargeMap() {
        var map = BattleMaps.get(8);
        p.world.getChunkAt(map.cx() >> 4, 1024 >> 4);
        int before = p.world.getLoadedChunks().length;
        p.terrain.clearEntities(8);
        assertEquals(before, p.world.getLoadedChunks().length);
        System.out.println("Large map reset: forced additional chunk loads=0; old bounded scan=352 requests");
    }

    @Test
    void nativeBiomeProviderMatchesAllSixThemes() {
        var provider = new BattleGenerator().getDefaultBiomeProvider(null);
        var expected = List.of(org.bukkit.block.Biome.PLAINS, org.bukkit.block.Biome.DESERT, org.bukkit.block.Biome.JUNGLE, org.bukkit.block.Biome.SNOWY_PLAINS, org.bukkit.block.Biome.CHERRY_GROVE, org.bukkit.block.Biome.BADLANDS);
        for (var map : BattleMaps.all())
            assertEquals(expected.get(map.theme()), provider.getBiome(null, map.cx(), 65, 1024));
    }

    @Test
    void exportActualTerrainPreviews() throws Exception {
        StringBuilder json = new StringBuilder("{\"maps\":[");
        boolean firstMap = true;
        for (int theme = 0; theme < 6; theme++) {
            var map = BattleMaps.get(7 + theme * 3);
            if (!firstMap) json.append(',');
            firstMap = false;
            json.append("{\"name\":\"").append(map.name()).append("\",\"cells\":[");
            boolean first = true;
            for (int x = -map.width() / 2; x < map.width() / 2; x += 3)
                for (int z = -map.length() / 2; z < map.length() / 2; z += 3) {
                    var cells = new TreeMap<>(column(map, x, z));
                    var top = cells.descendingMap().entrySet().stream().filter(e -> e.getValue() != Material.BARRIER && e.getValue() != Material.AIR).findFirst().orElseThrow();
                    if (!first) json.append(',');
                    first = false;
                    json.append('[').append(x).append(',').append(z).append(',').append(top.getKey()).append(",\"").append(top.getValue().name()).append("\"]");
                }
            json.append("]}");
        }
        json.append("]}");
        java.nio.file.Files.writeString(java.nio.file.Path.of("target/map-v6-previews.json"), json);
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

    static void slot(ItemStack[] a, int index, Material mat, int count) {
        assertNotNull(a[index], "Slot " + index);
        assertEquals(mat, a[index].getType(), "Slot " + index);
        assertEquals(count, a[index].getAmount(), "Slot " + index);
    }

    @Test
    void onlyNineReferencePresetsArePublic() {
        assertArrayEquals(new String[]{"sword", "axe", "uhc", "pot", "nethop", "smp", "crystal", "mace", "mace_spear"}, CommunityArena.KITS);
        for (String removed : List.of("boxing", "bow", "diasmp", "mace_breach", "mace_density"))
            assertFalse(p.kit(removed));
    }

    @Test
    void screenshotSwordAndAxeSlots() {
        var sword = ReferenceLoadouts.create("sword");
        slot(sword, 0, Material.DIAMOND_SWORD, 1);
        for (int i = 1; i < 36; i++) assertNull(sword[i]);
        var axe = ReferenceLoadouts.create("axe");
        slot(axe, 0, Material.DIAMOND_SWORD, 1);
        slot(axe, 1, Material.DIAMOND_AXE, 1);
        slot(axe, 2, Material.BOW, 1);
        slot(axe, 3, Material.CROSSBOW, 1);
        slot(axe, 8, Material.ARROW, 5);
        slot(axe, 40, Material.SHIELD, 1);
        for (int i = 36; i < 40; i++) assertTrue(axe[i].getEnchantments().isEmpty());
    }

    @Test
    void screenshotUhcCountsAndRows() {
        var a = ReferenceLoadouts.create("uhc");
        slot(a, 2, Material.PLAYER_HEAD, 2);
        slot(a, 3, Material.GOLDEN_APPLE, 8);
        slot(a, 8, Material.COBWEB, 8);
        slot(a, 17, Material.ARROW, 16);
        for (int n : new int[]{4, 12, 13, 14}) slot(a, n, Material.WATER_BUCKET, 1);
        for (int n : new int[]{5, 22}) slot(a, n, Material.LAVA_BUCKET, 1);
        slot(a, 26, Material.BOW, 1);
        slot(a, 31, Material.DIAMOND_PICKAXE, 1);
        slot(a, 35, Material.OAK_PLANKS, 64);
        slot(a, 40, Material.SHIELD, 1);
    }

    @Test
    void screenshotDiamondPotHasNoInventedPearls() {
        var a = ReferenceLoadouts.create("pot");
        slot(a, 40, Material.COOKED_BEEF, 5);
        for (int i = 1; i < 36; i++) slot(a, i, Material.SPLASH_POTION, 1);
        assertEquals(0, Arrays.stream(a).filter(Objects::nonNull).filter(i -> i.getType() == Material.ENDER_PEARL).count());
    }

    @Test
    void screenshotNethopCounts() {
        var a = ReferenceLoadouts.create("nethop");
        slot(a, 40, Material.GOLDEN_APPLE, 64);
        slot(a, 8, Material.TOTEM_OF_UNDYING, 1);
        slot(a, 34, Material.EXPERIENCE_BOTTLE, 64);
        slot(a, 35, Material.TOTEM_OF_UNDYING, 1);
        assertEquals(36, Arrays.stream(Arrays.copyOf(a, 36)).filter(Objects::nonNull).count());
    }

    @Test
    void screenshotSmpAndCrystal() {
        var a = ReferenceLoadouts.create("smp");
        slot(a, 1, Material.GOLDEN_APPLE, 64);
        slot(a, 2, Material.ENDER_PEARL, 16);
        slot(a, 4, Material.EXPERIENCE_BOTTLE, 64);
        slot(a, 27, Material.NETHERITE_SWORD, 1);
        slot(a, 28, Material.GOLDEN_APPLE, 64);
        slot(a, 29, Material.ENDER_PEARL, 16);
        slot(a, 40, Material.SHIELD, 1);
        var c = ReferenceLoadouts.create("crystal");
        slot(c, 3, Material.OBSIDIAN, 64);
        slot(c, 4, Material.END_CRYSTAL, 64);
        slot(c, 5, Material.RESPAWN_ANCHOR, 64);
        slot(c, 6, Material.GLOWSTONE, 64);
        slot(c, 7, Material.CROSSBOW, 1);
        slot(c, 8, Material.TOTEM_OF_UNDYING, 1);
        for (int i : new int[]{9, 10, 18, 19, 27, 28}) slot(c, i, Material.ENDER_PEARL, 16);
        slot(c, 17, Material.NETHERITE_AXE, 1);
        slot(c, 26, Material.NETHERITE_PICKAXE, 1);
        slot(c, 34, Material.TIPPED_ARROW, 64);
        slot(c, 35, Material.SHIELD, 1);
    }

    @Test
    void screenshotMacesAndNativeSpear() {
        var a = ReferenceLoadouts.create("mace");
        slot(a, 4, Material.ELYTRA, 1);
        slot(a, 5, Material.WIND_CHARGE, 64);
        slot(a, 6, Material.MACE, 1);
        slot(a, 7, Material.MACE, 1);
        slot(a, 26, Material.PURPLE_SHULKER_BOX, 1);
        slot(a, 34, Material.WIND_CHARGE, 64);
        slot(a, 35, Material.TOTEM_OF_UNDYING, 1);
        var spear = ReferenceLoadouts.create("mace_spear");
        assertEquals("NETHERITE_SPEAR", spear[8].getType().name());
        slot(spear, 2, Material.MACE, 1);
        slot(spear, 3, Material.WIND_CHARGE, 64);
        slot(spear, 4, Material.FIREWORK_ROCKET, 64);
        slot(spear, 5, Material.ENDER_PEARL, 16);
        slot(spear, 9, Material.WIND_CHARGE, 64);
        assertFalse(Arrays.stream(spear).filter(Objects::nonNull).anyMatch(i -> i.getType() == Material.TRIDENT));
    }

    @Test
    void oldOverridesAndOldLayoutsCannotChangeReferencePresets() {
        var a = server.addPlayer();
        p.data.set("kits.sword", Arrays.asList(new ItemStack(Material.DIRT)));
        p.equip(a, "sword");
        assertEquals(Material.DIAMOND_SWORD, a.getInventory().getItem(0).getType());
    }

    @Test
    void layoutPreviewNeverEquipsOrTeleportsAndIncludesFixedGear() {
        var a = server.addPlayer();
        p.enter(a);
        var before = a.getLocation();
        var items = a.getInventory().getContents();
        p.layouts.open(a, "crystal");
        assertEquals(before, a.getLocation());
        assertArrayEquals(items, a.getInventory().getContents());
        assertEquals(Material.NETHERITE_BOOTS, a.getOpenInventory().getTopInventory().getItem(38).getType());
        assertEquals(Material.TOTEM_OF_UNDYING, a.getOpenInventory().getTopInventory().getItem(42).getType());
    }

    @Test
    void lobbyHotbarOpensNineKitLayoutPicker() {
        var a = server.addPlayer();
        p.enter(a);
        assertEquals(Material.ANVIL, a.getInventory().getItem(5).getType());
        p.action(a, "layout-picker");
        long icons = Arrays.stream(a.getOpenInventory().getTopInventory().getContents()).filter(Objects::nonNull).filter(i -> i.hasItemMeta() && i.getItemMeta().getPersistentDataContainer().getOrDefault(p.menuKey, org.bukkit.persistence.PersistentDataType.STRING, "").startsWith("layout:")).count();
        assertEquals(9, icons);
    }

    @Test
    void freshWorldsAndNoGlobalBuildWait() {
        assertEquals("community_arena_v6", p.world.getName());
        assertEquals("community_citadel_v6", p.citadel.getName());
        assertTrue(p.data.getBoolean("terrain-generator-v6"));
        assertTrue(p.data.getBoolean("built-battle-maps-v5"));
    }

    static SortedMap<Integer, Material> column(BattleMaps.MapInfo map, int x, int z) {
        var blocks = new TreeMap<Integer, Material>();
        ArenaLandscape.column(map, x, z, (lo, hi, mat) -> {
            for (int y = lo; y < hi; y++) blocks.put(y, mat);
        });
        return blocks;
    }

    @Test
    void everyMapHasSafeLevelSpawnFloorWallsAndSky() {
        for (var map : BattleMaps.all()) {
            for (boolean first : new boolean[]{true, false}) {
                var spawn = BattleMaps.spawn(p, map.id(), first);
                var blocks = column(map, spawn.getBlockX() - map.cx(), 0);
                assertNotNull(blocks.get(64), map.name());
                assertFalse(blocks.containsKey(65), map.name() + " spawn obstructed");
                assertEquals(Material.BEDROCK, blocks.get(50));
                assertEquals(Material.BARRIER, blocks.get(map.ceiling()));
            }
            var wall = column(map, -map.width() / 2, 0);
            assertEquals(Material.BARRIER, wall.get(map.ceiling() - 1));
        }
    }

    @Test
    void generatorPlanIsDeterministicAcrossWorkers() throws Exception {
        var executor = Executors.newFixedThreadPool(4);
        try {
            var expected = column(BattleMaps.get(8), 46, 46);
            var futures = new ArrayList<Future<SortedMap<Integer, Material>>>();
            for (int i = 0; i < 40; i++) futures.add(executor.submit(() -> column(BattleMaps.get(8), 46, 46)));
            for (var future : futures) assertEquals(expected, future.get());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void mapLookupAndCatalogueAllocateNoRepeatedModels() {
        var all = BattleMaps.all();
        for (int i = 0; i < 1000; i++) {
            assertSame(all, BattleMaps.all());
            assertSame(all.get(0), BattleMaps.at(2048, 1024));
            assertNull(BattleMaps.at(0, 1024));
        }
    }

    @Test
    void warmupPlanCoversEveryMapWithoutDuplicates() {
        var chunks = MapWarmup.plan();
        assertEquals(chunks.size(), new HashSet<>(chunks).size());
        for (var map : BattleMaps.all())
            for (boolean first : new boolean[]{true, false}) {
                var l = BattleMaps.spawn(p, map.id(), first);
                assertTrue(chunks.contains(new MapWarmup.ChunkPos(l.getBlockX() >> 4, l.getBlockZ() >> 4)));
            }
        System.out.println("Native background prewarm plan: " + chunks.size() + " chunks, concurrency=1");
    }

    @Test
    void temporaryEntitiesCannotPersistAcrossChunkUnload() {
        var loc = BattleMaps.spawn(p, 6, true);
        Entity[] entities = {p.world.spawn(loc, TNTPrimed.class), p.world.spawn(loc, Arrow.class), p.world.spawn(loc, Zombie.class), p.world.dropItem(loc, new ItemStack(Material.DIAMOND))};
        for (Entity e : entities) assertFalse(e.isPersistent());
        var event = new EntitiesUnloadEvent(loc.getChunk(), Arrays.asList(entities));
        p.terrain.entityUnload(event);
        for (Entity e : entities) assertFalse(e.isValid());
    }

    @Test
    void missingOriginalV4WorldFailsClosed() throws Exception {
        var file = p.getDataFolder().toPath().resolve("v4-arena-1.journal");
        java.nio.file.Files.writeString(file, "160,64,0 minecraft:stone\n");
        assertThrows(IllegalStateException.class, p.terrain::recoverV4);
        assertTrue(java.nio.file.Files.exists(file));
        java.nio.file.Files.delete(file);
    }

    static class CountingPlayer extends PlayerMock {
        int entityCalls;

        CountingPlayer(ServerMock s, String n) {
            super(s, n);
        }

        @Override
        public void showEntity(Plugin plugin, Entity entity) {
            entityCalls++;
        }

        @Override
        public void hideEntity(Plugin plugin, Entity entity) {
            entityCalls++;
        }
    }

    @Test
    void stableNameplateVisibilitySendsZeroRepeatedCalls() {
        var viewers = new ArrayList<CountingPlayer>();
        for (int i = 0; i < 24; i++) {
            var a = new CountingPlayer(server, "Count" + i);
            server.addPlayer(a);
            viewers.add(a);
        }
        var entity = p.world.spawn(new Location(p.world, 0, 66, 0), ArmorStand.class);
        for (var a : viewers) {
            p.presentation.entityVisible(a, entity, true);
            a.entityCalls = 0;
        }
        for (int tick = 0; tick < 20; tick++) for (var a : viewers) p.presentation.entityVisible(a, entity, true);
        int calls = viewers.stream().mapToInt(a -> a.entityCalls).sum();
        System.out.println("24 viewers, 20 stable nameplate refreshes: baseline=480 calls; current=" + calls);
        assertEquals(0, calls);
        for (var a : viewers) p.presentation.entityVisible(a, entity, false);
        assertEquals(24, viewers.stream().mapToInt(a -> a.entityCalls).sum());
    }
}
