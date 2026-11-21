package community.pvp.arena;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.*;
import java.util.*;
import org.bukkit.*;
import org.bukkit.entity.*;
import org.bukkit.event.player.*;
import org.bukkit.inventory.*;
import org.junit.jupiter.api.*;
import org.mockbukkit.mockbukkit.*;

class VideoPracticeTest {
  @Test
  void entryPreservesRealItemsHeldOnCursor() {
    var player = server.addPlayer();
    player.setItemOnCursor(new ItemStack(Material.DIAMOND, 7));
    p.enter(player);
    assertFalse(p.managed(player));
    assertEquals(7, player.getItemOnCursor().getAmount());
    assertEquals(Material.DIAMOND, player.getItemOnCursor().getType());
  }

  ServerMock server;
  CommunityArena p;

  @BeforeEach
  void setup() {
    server = MockBukkit.mock(new PracticeServerMock());
    p = MockBukkit.load(CommunityArena.class);
    p.worldSaver = w -> {};
    p.getConfig().set("presentation.nametags", false);
    p.getConfig().set("presentation.effects", false);
    p.getConfig().set("presentation.hide-score-numbers", false);
    p.ready = true;
    org.bukkit.event.HandlerList.unregisterAll(p.terrain);
    p.terrain = new ArenaTerrain(p, () -> {});
  }

  @AfterEach
  void stop() {
    MockBukkit.unmock();
  }

  @Test
  void swordKitHasOnlySwordInStorage() {
    var a = server.addPlayer();
    p.equip(a, "sword");
    assertEquals(Material.DIAMOND_SWORD, a.getInventory().getItem(0).getType());
    assertEquals(
        1, Arrays.stream(a.getInventory().getStorageContents()).filter(Objects::nonNull).count());
  }

  @Test
  void axeScreenshotHasFiveArrowsAndShield() {
    var a = server.addPlayer();
    p.equip(a, "axe");
    assertEquals(Material.DIAMOND_SWORD, a.getInventory().getItem(0).getType());
    assertEquals(Material.CROSSBOW,a.getInventory().getItem(3).getType());
    assertEquals(5, a.getInventory().getItem(8).getAmount());
    assertEquals(Material.SHIELD, a.getInventory().getItemInOffHand().getType());
  }

  @Test
  void crystalHasTotemsPearlsAndRealCrystals() {
    var a = server.addPlayer();
    p.equip(a, "crystal");
    assertEquals(GameMode.SURVIVAL, a.getGameMode());
    assertEquals(Material.END_CRYSTAL, a.getInventory().getItem(4).getType());
    assertEquals(Material.TOTEM_OF_UNDYING, a.getInventory().getItemInOffHand().getType());
    assertEquals(Material.NETHERITE_CHESTPLATE, a.getInventory().getChestplate().getType());
  }

  @Test
  void nethopScreenshotHasHealingAndOffhandApples() {
    var a = server.addPlayer();
    p.equip(a, "nethop");
    assertEquals(Material.SPLASH_POTION,a.getInventory().getItem(1).getType());
    assertEquals(Material.GOLDEN_APPLE,a.getInventory().getItemInOffHand().getType());
    assertEquals(64,a.getInventory().getItemInOffHand().getAmount());
    assertEquals(Material.SPLASH_POTION, a.getInventory().getItem(2).getType());
  }

  @Test
  void kitEloDoesNotLeakToAnotherKit() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    var m = p.new Match(a, b, "axe", 1, 1);
    m.ranked = true;
    p.progression.result(m, a.getUniqueId());
    assertEquals(616, p.progression.elo(a.getUniqueId(), "axe"));
    assertEquals(600, p.progression.elo(a.getUniqueId(), "sword"));
    assertEquals(584, p.progression.elo(b.getUniqueId(), "axe"));
  }

  @Test
  void validLayoutMustContainEverySourceExactlyOnce() {
    var values = new ArrayList<>(Collections.nCopies(36, -1));
    values.set(8, 0);
    assertTrue(KitLayouts.valid(values, Set.of(0)));
    values.set(9, 0);
    assertFalse(KitLayouts.valid(values, Set.of(0)));
    values.set(9, -1);
    values.set(8, 1);
    assertFalse(KitLayouts.valid(values, Set.of(0)));
  }

  @Test
  void savedLayoutMovesSwordWithoutDuplicatingIt() {
    var a = server.addPlayer();
    var values = new ArrayList<>(Collections.nCopies(36, -1));
    values.set(8, 0);
    p.data.set("players." + a.getUniqueId() + ".layouts-v6.sword", values);
    p.equip(a, "sword");
    assertNull(a.getInventory().getItem(0));
    assertEquals(Material.DIAMOND_SWORD, a.getInventory().getItem(8).getType());
  }

  @Test
  void kitMenuHasRealKitDetailActions() {
    var a = server.addPlayer();
    p.menu(a, true);
    assertEquals(54, a.getOpenInventory().getTopInventory().getSize());
    var item = a.getOpenInventory().getTopInventory().getItem(11);
    assertTrue(
        item.getItemMeta()
            .getPersistentDataContainer()
            .get(p.menuKey, org.bukkit.persistence.PersistentDataType.STRING)
            .startsWith("kit:r:"));
    assertTrue(a.getOpenInventory().getTopInventory().getHolder() instanceof ArenaMenu);
  }

  @Test
  void inventoryEditorReturnsCursorItemsToNowhereOutsidePractice() {
    var a = server.addPlayer();
    p.layouts.open(a, "sword");
    assertEquals(54, a.getOpenInventory().getTopInventory().getSize());
    assertEquals(Material.CLOCK, a.getInventory().getItem(0).getType());
    a.setItemOnCursor(a.getOpenInventory().getTopInventory().getItem(27));
    a.closeInventory();
    assertTrue(a.getItemOnCursor() == null || a.getItemOnCursor().getType().isAir());
    assertFalse(p.layouts.editors.containsKey(a.getUniqueId()));
  }

  @Test
  void spectatorChatHasDifferentRoomFromFighters() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    var v = server.addPlayer();
    p.start(a, b, "sword", 1);
    p.social.spec(v, new String[] {a.getName()});
    assertNotEquals(p.presentation.room(v.getUniqueId()), p.presentation.room(a.getUniqueId()));
    assertFalse(p.presentation.visible(a, v));
    assertTrue(p.presentation.visible(v, a));
  }

  @Test
  void bothReadyCanSkipCountdown() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    p.start(a, b, "sword", 1);
    var m = p.matches.get(a.getUniqueId());
    server.getPluginManager().callEvent(new PlayerToggleSneakEvent(a, true));
    server.getPluginManager().callEvent(new PlayerToggleSneakEvent(b, true));
    server.getScheduler().performTicks(1);
    assertFalse(m.paused);
  }

  @Test
  void terrainJournalRemembersFirstOriginalAndResets() throws Exception {
    var block = p.world.getBlockAt(160, 64, 0);
    block.setType(Material.GRASS_BLOCK, false);
    assertTrue(p.terrain.record(1, block));
    block.setType(Material.OBSIDIAN, false);
    assertTrue(p.terrain.record(1, block));
    assertEquals(1, Files.readAllLines(p.terrain.journal(1)).size());
    p.terrain.reset(1);
    assertEquals(Material.GRASS_BLOCK, block.getType());
    assertFalse(Files.exists(p.terrain.journal(1)));
  }

  @Test
  void journalRejectsChangesOutsideGeneratedInterior() {
    assertFalse(p.terrain.record(1, p.grove.getBlockAt(0, 64, 0)));
    assertFalse(p.terrain.record(1, p.world.getBlockAt(160, 49, 0)));
    assertFalse(p.terrain.record(1, p.world.getBlockAt(320, 64, 0)));
  }

  @Test
  void crashRecoveryUsesDurableOriginal() throws Exception {
    var b = p.world.getBlockAt(160, 64, 0);
    b.setType(Material.STONE, false);
    assertTrue(p.terrain.record(1, b));
    b.setType(Material.LAVA, false);
    p.terrain.changes.clear();
    p.terrain.recover();
    assertEquals(Material.STONE, b.getType());
  }

  @Test
  void countdownDisallowsTerrainEdits() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    p.start(a, b, "crystal", 1);
    assertNull(p.terrain.editable(a, p.loc(p.matches.get(a.getUniqueId()).arena,0,0,0).getBlock()));
    p.matches.get(a.getUniqueId()).paused = false;
    assertNotNull(p.terrain.editable(a,p.loc(p.matches.get(a.getUniqueId()).arena,0,0,0).getBlock()));
  }

  @Test
  void groveHasTreesWaterAndLeaderboardDefinitions() {
    GroveLobby.decorate(p);
    assertEquals(Material.OAK_LOG, p.grove.getBlockAt(-34, 65, -16).getType());
    assertEquals(Material.WATER, p.grove.getBlockAt(22, 64, -12).getType());
    assertNotNull(p.data.getLocation("grove.spawn"));
    assertEquals(3, p.data.getConfigurationSection("holograms").getKeys(false).stream().filter(key->key.startsWith("f000000")).count());
  }

  @Test
  void sidebarIsCompactAndSpectatorsSeeBothNames() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    var v = server.addPlayer();
    p.start(a, b, "sword", 1);
    p.social.spec(v, new String[] {a.getName()});
    var rows = p.presentation.rows(v);
    assertTrue(rows.size() <= 15);
    assertTrue(rows.stream().anyMatch(s -> s.contains(a.getName())));
    assertTrue(rows.stream().anyMatch(s -> s.contains(b.getName())));
  }

  @Test
  void actualTotemLethalIsLeftForVanillaResurrection() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    p.start(a, b, "crystal", 1);
    var m = p.matches.get(a.getUniqueId());
    m.paused = false;
    var hit =
        new org.bukkit.event.entity.EntityDamageByEntityEvent(
            b, a, org.bukkit.event.entity.EntityDamageEvent.DamageCause.ENTITY_ATTACK, 100);
    new ArenaEvents(p).damage(hit);
    assertFalse(hit.isCancelled());
    assertFalse(m.ended);
  }

  @Test
  void oldArenaSpawnFallsBackToCurrentCombatWorld() {
    var old = server.addSimpleWorld("community_arena");
    p.data.set("setup.arenas.1.a", new Location(old, 142, 65, 0));
    assertEquals(p.world, p.setup.duelSpawn(1, true).getWorld());
  }

  @Test
  void newRoundDoesNotKeepPreviousHits() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    p.start(a, b, "sword", 3);
    var m = p.matches.get(a.getUniqueId());
    m.hits.put(a.getUniqueId(), 100);
    p.round(m);
    assertTrue(m.hits.isEmpty());
  }

  @Test
  void boundaryBucketIsDeniedEvenInSurvival() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    p.start(a, b, "uhc", 1);
    p.matches.get(a.getUniqueId()).paused = false;
    var block = p.world.getBlockAt(190, 64, 0);
    var event =
        new PlayerBucketEmptyEvent(
            a,
            block,
            org.bukkit.block.BlockFace.UP,
            Material.WATER_BUCKET,
            new ItemStack(Material.BUCKET));
    p.terrain.bucket(event);
    assertTrue(event.isCancelled());
  }

  @Test
  void batchedExplosionRecordsEveryOriginalBeforeReset() throws Exception {
    var a = p.world.getBlockAt(160, 64, 0);
    var b = p.world.getBlockAt(161, 64, 0);
    a.setType(Material.STONE, false);
    b.setType(Material.DIRT, false);
    assertTrue(p.terrain.recordBatch(1, List.of(a, b)));
    assertEquals(2, Files.readAllLines(p.terrain.journal(1)).size());
    a.setType(Material.AIR, false);
    b.setType(Material.AIR, false);
    p.terrain.reset(1);
    assertEquals(Material.STONE, a.getType());
    assertEquals(Material.DIRT, b.getType());
  }

  @Test
  void failedWorldFlushRetainsJournalForRecovery() {
    var block = p.world.getBlockAt(160, 64, 0);
    block.setType(Material.STONE, false);
    assertTrue(p.terrain.record(1, block));
    var failing =
        new ArenaTerrain(
            p,
            () -> {
              throw new IllegalStateException("disk failure");
            });
    failing.changes.putAll(p.terrain.changes);
    assertThrows(IllegalStateException.class, () -> failing.reset(1));
    assertTrue(Files.exists(p.terrain.journal(1)));
  }

  @Test
  void titleRewardStillAppearsInTab() {
    var a = server.addPlayer();
    p.enter(a);
    p.data.set("players." + a.getUniqueId() + ".title", "Duelist");
    p.presentation.tick();
    assertTrue(
        net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText()
            .serialize(a.playerListName())
            .contains("Duelist"));
  }

  @Test
  void roundCountsMatchObservedKitPacing() {
    assertEquals(1, p.rankedRounds("crystal"));
    assertEquals(3, p.rankedRounds("axe"));
    assertEquals(1, p.rankedRounds("nethop"));
  }

  @Test
  void unknownSettingsCannotWriteArbitraryProfileFields() {
    var a = server.addPlayer();
    p.action(a, "setting:elo");
    assertEquals(600, p.progression.elo(a.getUniqueId()));
  }

  @Test
  void totemDoesNotPreventVoidRoundLoss() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    p.start(a, b, "crystal", 3);
    var m = p.matches.get(a.getUniqueId());
    m.paused = false;
    var hit =
        new org.bukkit.event.entity.EntityDamageEvent(
            a, org.bukkit.event.entity.EntityDamageEvent.DamageCause.VOID, 100);
    new ArenaEvents(p).damage(hit);
    assertTrue(hit.isCancelled());
    assertEquals(1, m.sb);
  }

  @Test
  void locationDataRoundTripsAcrossWorldReload() throws Exception {
    p.data.set("setup.spawn", new Location(p.grove, 2, 65, 3));
    p.data.set("setup.arenas.1.a", new Location(p.world, 142, 65, 0));
    assertTrue(p.save());
    p.onDisable();
    assertTrue(server.unloadWorld(p.grove, false));
    assertTrue(server.unloadWorld(p.world, false));
    p.onEnable();
    p.worldSaver = w -> {};
    p.getConfig().set("presentation.nametags", false);
    p.getConfig().set("presentation.effects", false);
    p.getConfig().set("presentation.hide-score-numbers", false);
    assertEquals(p.grove, p.data.getLocation("setup.spawn").getWorld());
    assertEquals(p.world, p.data.getLocation("setup.arenas.1.a").getWorld());
  }

  @Test
  void unloadedLocationIsRejectedWithoutOverwritingFile() throws Exception {
    var file = p.getDataFolder().toPath().resolve("unknown-world-fixture.yml");
    String yaml =
        "spawn:\n"
            + "  ==: org.bukkit.Location\n"
            + "  world: unloaded_missing_world\n"
            + "  x: 0.0\n"
            + "  y: 65.0\n"
            + "  z: 0.0\n";
    Files.writeString(file, yaml);
    assertThrows(java.io.IOException.class, () -> ArenaStorage.load(file.toFile()));
    assertEquals(yaml, Files.readString(file));
  }

  @Test
  void layoutCommandIsActuallyRegistered() {
    var a = server.addPlayer();
    assertTrue(server.dispatchCommand(a, "layout sword"));
    assertTrue(p.layouts.editors.containsKey(a.getUniqueId()));
  }

  @Test
  void layoutClicksPersistARealReorderWithoutGivingItems() {
    var a = server.addPlayer();
    p.layouts.open(a, "sword");
    var view = a.getOpenInventory();
    var pickup =
        new org.bukkit.event.inventory.InventoryClickEvent(
            view,
            org.bukkit.event.inventory.InventoryType.SlotType.CONTAINER,
            27,
            org.bukkit.event.inventory.ClickType.LEFT,
            org.bukkit.event.inventory.InventoryAction.PICKUP_ALL);
    server.getPluginManager().callEvent(pickup);
    assertTrue(pickup.isCancelled());
    assertEquals(Material.DIAMOND_SWORD, a.getItemOnCursor().getType());
    var put =
        new org.bukkit.event.inventory.InventoryClickEvent(
            view,
            org.bukkit.event.inventory.InventoryType.SlotType.CONTAINER,
            26,
            org.bukkit.event.inventory.ClickType.LEFT,
            org.bukkit.event.inventory.InventoryAction.PLACE_ALL);
    server.getPluginManager().callEvent(put);
    var save =
        new org.bukkit.event.inventory.InventoryClickEvent(
            view,
            org.bukkit.event.inventory.InventoryType.SlotType.CONTAINER,
            49,
            org.bukkit.event.inventory.ClickType.LEFT,
            org.bukkit.event.inventory.InventoryAction.PICKUP_ALL);
    server.getPluginManager().callEvent(save);
    server.getScheduler().performTicks(1);
    assertEquals(0, p.data.getIntegerList("players." + a.getUniqueId() + ".layouts-v6.sword").get(35));
    p.equip(a, "sword");
    assertNull(a.getInventory().getItem(0));
    assertEquals(Material.DIAMOND_SWORD, a.getInventory().getItem(35).getType());
  }

  @Test
  void absorptionIsNotCountedTwiceInLethalCheck() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    p.start(a, b, "sword", 3);
    var m = p.matches.get(a.getUniqueId());
    m.paused = false;
    a.setHealth(10);
    a.setAbsorptionAmount(10);
    var hit =
        new org.bukkit.event.entity.EntityDamageEvent(
            a, org.bukkit.event.entity.EntityDamageEvent.DamageCause.FALL, 15);
    new ArenaEvents(p).damage(hit);
    assertTrue(hit.isCancelled());
    assertEquals(1, m.sb);
  }

  @Test
  void spectatorChatCannotReachFighters() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    var v = server.addPlayer();
    p.start(a, b, "sword", 1);
    p.social.spec(v, new String[] {a.getName()});
    var viewers = new HashSet<net.kyori.adventure.audience.Audience>(List.of(a, b, v));
    var msg = net.kyori.adventure.text.Component.text("<red>literal message");
    var chat =
        new io.papermc.paper.event.player.AsyncChatEvent(
            false,
            v,
            viewers,
            io.papermc.paper.chat.ChatRenderer.defaultRenderer(),
            msg,
            msg,
            net.kyori.adventure.chat.SignedMessage.system("<red>literal message", msg));
    p.presentation.chat(chat);
    assertFalse(chat.viewers().contains(a));
    assertFalse(chat.viewers().contains(b));
    assertTrue(chat.viewers().contains(v));
  }
}
