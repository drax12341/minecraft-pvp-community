package community.pvp.arena;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.*;
import java.time.*;
import java.util.*;
import org.bukkit.*;
import org.bukkit.entity.*;
import org.bukkit.event.inventory.*;
import org.bukkit.inventory.*;
import org.junit.jupiter.api.*;
import org.mockbukkit.mockbukkit.*;

class ScreenshotExperienceTest {
  ServerMock server;
  CommunityArena p;

  @BeforeEach
  void start() {
    server = MockBukkit.mock(new PracticeServerMock());
    p = MockBukkit.load(CommunityArena.class);
    p.worldSaver = w -> {};
    p.getConfig().set("presentation.effects", false);
    p.getConfig().set("presentation.nametags", false);
    p.getConfig().set("presentation.hide-score-numbers", false);
    p.ready = true;
    org.bukkit.event.HandlerList.unregisterAll(p.terrain);
    p.terrain = new ArenaTerrain(p, () -> {});
  }

  @AfterEach
  void stop() {
    MockBukkit.unmock();
  }

  void click(Player player, int slot, ClickType type) {
    var e =
        new InventoryClickEvent(
            player.getOpenInventory(),
            InventoryType.SlotType.CONTAINER,
            slot,
            type,
            InventoryAction.PICKUP_ALL);
    server.getPluginManager().callEvent(e);
    assertTrue(e.isCancelled());
    server.getScheduler().performTicks(1);
  }

  CommunityArena.Match match(Player a, Player b, boolean ranked) {
    var m = p.new Match(a, b, "sword", 1, 1);
    m.ranked = ranked;
    return m;
  }

  @Test
  void isoWeeksCrossCalendarYearCorrectly() {
    assertEquals("2020W53", PracticeInsights.week(Instant.parse("2021-01-01T12:00:00Z")));
    assertEquals("2021W01", PracticeInsights.week(Instant.parse("2021-01-04T00:00:00Z")));
    assertEquals("20210104", PracticeInsights.day(Instant.parse("2021-01-04T00:00:00Z")));
  }

  @Test
  void dayAndQueueScopesDoNotMix() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    var m = match(a, b, true);
    m.roundKills.put(a.getUniqueId(), 2);
    m.roundDeaths.put(a.getUniqueId(), 1);
    Instant today = Instant.parse("2026-11-19T23:59:59Z");
    p.insights.record(m, a.getUniqueId(), today);
    var stats = p.insights.view(a.getUniqueId(), "ranked", "day", "sword", today);
    assertEquals(1, stats.wins());
    assertEquals(2, stats.kills());
    assertEquals("100.00%", stats.winRate());
    assertEquals(0, p.insights.view(a.getUniqueId(), "casual", "day", "sword", today).games());
    assertEquals(
        0,
        p.insights.view(a.getUniqueId(), "ranked", "day", "sword", today.plusSeconds(1)).games());
  }

  @Test
  void allTimeLegacyTotalsArePreservedWhileSplitsAreAccurate() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    p.data.set("players." + a.getUniqueId() + ".wins", 30);
    p.progression.result(match(a, b, true), a.getUniqueId());
    p.progression.result(match(a, b, false), a.getUniqueId());
    assertEquals(32, p.insights.view(a.getUniqueId(), "both", "all", "global").wins());
    assertEquals(1, p.insights.view(a.getUniqueId(), "ranked", "all", "global").wins());
    assertEquals(1, p.insights.view(a.getUniqueId(), "casual", "all", "global").wins());
  }

  @Test
  void aggregateRetentionIsBounded() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    Instant start = Instant.parse("2024-01-01T00:00:00Z");
    for (int i = 0; i < 100; i++)
      p.insights.record(match(a, b, false), a.getUniqueId(), start.plusSeconds(i * 86400L));
    assertEquals(
        35,
        p.data
            .getConfigurationSection(p.insights.root(a.getUniqueId()) + "days")
            .getKeys(false)
            .size());
    assertEquals(
        12,
        p.data
            .getConfigurationSection(p.insights.root(a.getUniqueId()) + "weeks")
            .getKeys(false)
            .size());
  }

  @Test
  void queueFilterHandlesReverseAndReset() {
    var a = server.addPlayer();
    p.enter(a);
    p.reference.queues(a, "both");
    click(a, 4, ClickType.LEFT);
    assertEquals("casual", p.reference.pref(a, "queue", "both"));
    click(a, 4, ClickType.RIGHT);
    assertEquals("both", p.reference.pref(a, "queue", "both"));
    click(a, 4, ClickType.SHIFT_LEFT);
    assertEquals("both", p.reference.pref(a, "queue", "both"));
  }

  @Test
  void personalTimeDoesNotChangeWorldTime() {
    var a = server.addPlayer();
    p.enter(a);
    long before = a.getWorld().getTime();
    p.reference.setPref(a, "time", "night");
    p.reference.applyTime(a);
    assertEquals(14000, a.getPlayerTime());
    assertEquals(before, a.getWorld().getTime());
    p.restore(a);
    assertTrue(a.isPlayerTimeRelative());
  }

  @Test
  void inboxIsBoundedAndPrivate() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    for (int i = 0; i < 55; i++) p.inbox.add(a.getUniqueId(), "Notice " + i, "Genuine test event");
    assertEquals(50, p.inbox.entries(a.getUniqueId()).size());
    String note = (String) p.inbox.entries(a.getUniqueId()).getFirst().get("id");
    p.inbox.mark(b, note);
    assertEquals(50, p.inbox.unread(a.getUniqueId()));
    assertEquals(0, p.inbox.unread(b.getUniqueId()));
    p.inbox.mark(a, note);
    assertEquals(49, p.inbox.unread(a.getUniqueId()));
  }

  @Test
  void customEditorSavesWithoutGivingPaletteItems() {
    var a = server.addPlayer();
    a.getInventory().setItem(0, new ItemStack(Material.DIAMOND, 7));
    p.savedKits.edit(a, 1);
    click(a, 27, ClickType.LEFT);
    assertTrue(p.savedKits.drafts.get(a.getUniqueId()).palette);
    click(a, 11, ClickType.LEFT);
    assertFalse(p.savedKits.drafts.get(a.getUniqueId()).palette);
    click(a, 49, ClickType.LEFT);
    assertEquals(Material.DIAMOND_AXE, p.savedKits.saved(a.getUniqueId(), 1)[0].getType());
    assertEquals(Material.CLOCK, a.getInventory().getItem(0).getType());
    p.restore(a);
    assertEquals(Material.DIAMOND, a.getInventory().getItem(0).getType());
    assertEquals(7, a.getInventory().getItem(0).getAmount());
  }

  @Test
  void closingEditorCancelsDeferredActions() {
    var a = server.addPlayer();
    p.savedKits.edit(a, 1);
    var event =
        new InventoryClickEvent(
            a.getOpenInventory(),
            InventoryType.SlotType.CONTAINER,
            27,
            ClickType.LEFT,
            InventoryAction.PICKUP_ALL);
    server.getPluginManager().callEvent(event);
    a.closeInventory();
    server.getScheduler().performTicks(2);
    assertFalse(p.savedKits.drafts.containsKey(a.getUniqueId()));
    assertNull(p.savedKits.saved(a.getUniqueId(), 1));
  }

  @Test
  void acceptedCustomEquipmentIsCopiedAndNeverAwardsElo() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    ItemStack[] equipment = new ItemStack[41];
    equipment[0] = new ItemStack(Material.DIAMOND_AXE);
    p.start(a, b, "custom", 1, false, equipment);
    var m = p.matches.get(a.getUniqueId());
    equipment[0].setType(Material.DIRT);
    assertEquals(Material.DIAMOND_AXE, m.customEquipment[0].getType());
    p.finish(m, a.getUniqueId(), "test");
    assertEquals(1000, p.progression.elo(a.getUniqueId()));
    assertEquals(0, p.progression.number(a.getUniqueId(), "rankedGames"));
  }

  @Test
  void customRankedSetAndInvalidSlotsAreRejected() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    assertThrows(
        IllegalArgumentException.class, () -> p.start(a, b, "custom", 1, true, new ItemStack[41]));
    assertThrows(IllegalArgumentException.class, () -> p.savedKits.saved(a.getUniqueId(), 4));
  }

  @Test
  void invitationSnapshotsTheSavedKit() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    ItemStack[] equipment = new ItemStack[41];
    equipment[0] = new ItemStack(Material.BOW);
    p.data.set(p.savedKits.key(a.getUniqueId(), 1), Arrays.asList(equipment));
    p.savedKits.challenge(a, new String[] {b.getName(), "1"});
    equipment[0].setType(Material.DIRT);
    assertEquals(Material.BOW, p.invites.get(b.getUniqueId()).custom()[0].getType());
  }

  @Test
  void failedCaseSaveKeepsTheCaseAndAwardsNothing() {
    var a = server.addPlayer();
    p.enter(a);
    p.progression.add(a.getUniqueId(), "cases", 1);
    var original = p.dataFile;
    p.dataFile = new java.io.File(original.getParentFile(), "missing-parent/players.yml");
    try {
      p.progression.cases(a);
      assertEquals(1, p.progression.number(a.getUniqueId(), "cases"));
      assertTrue(p.data.getStringList("players." + a.getUniqueId() + ".cosmetics").isEmpty());
      assertFalse(p.motion.opening(a.getUniqueId()));
    } finally {
      p.dataFile = original;
    }
  }

  @Test
  void owningEveryRelicDoesNotConsumeAnotherCase() {
    var a = server.addPlayer();
    p.progression.add(a.getUniqueId(), "cases", 1);
    p.data.set(
        "players." + a.getUniqueId() + ".cosmetics",
        List.of("spark", "heart", "soul", "Champion", "Duelist", "Unstoppable"));
    p.progression.cases(a);
    assertEquals(1, p.progression.number(a.getUniqueId(), "cases"));
  }

  @Test
  void paginatedStandingsNeverInventPlayers() {
    for (int i = 0; i < 25; i++) {
      UUID id = UUID.randomUUID();
      p.data.set("players." + id + ".name", "record" + i);
      p.data.set("players." + id + ".rankedGames", 1);
      p.data.set("players." + id + ".elo", 1000 + i);
    }
    var a = server.addPlayer();
    p.reference.board(a, "elo", 1, false);
    assertEquals(25, p.reference.standings("elo").size());
    String first =
        net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText()
            .serialize(
                a.getOpenInventory().getTopInventory().getItem(10).getItemMeta().displayName());
    assertTrue(first.startsWith("#22 "));
  }

  @Test
  void animationGeometryAndProgressStayBounded() {
    assertEquals(0, PracticeMotion.ease(0));
    assertEquals(1, PracticeMotion.ease(1));
    for (int i = -100; i < 5000; i++) {
      assertTrue(PracticeMotion.progress(i) >= 0);
      assertTrue(PracticeMotion.progress(i) <= 1);
    }
    for (var v : PracticeMotion.ring(1.5, 16, 0.5)) assertEquals(1.5, v.length(), 0.00001);
  }

  @Test
  void legacyJournalsRecoverIntoTheLegacyWorld() throws Exception {
    var legacy = server.createWorld(new org.bukkit.WorldCreator("community_arena_v3"));
    var old = legacy.getBlockAt(160, 64, 0);
    old.setType(Material.LAVA, false);
    var current = p.world.getBlockAt(160, 64, 0);
    current.setType(Material.GOLD_BLOCK, false);
    var file = p.getDataFolder().toPath().resolve("arena-1.journal");
    Files.writeString(file, "160,64,0 minecraft:stone\n");
    p.terrain.recoverLegacy();
    assertEquals(Material.STONE, old.getType());
    assertEquals(Material.GOLD_BLOCK, current.getType());
    assertFalse(Files.exists(file));
    assertTrue(p.terrain.journal(1).getFileName().toString().startsWith("v7-"));
  }

  @Test
  void missingLegacyWorldDoesNotDiscardItsJournal() throws Exception {
    var file = p.getDataFolder().toPath().resolve("arena-1.journal");
    Files.writeString(file, "160,64,0 minecraft:stone\n");
    assertThrows(IllegalStateException.class, () -> p.terrain.recoverLegacy());
    assertTrue(Files.exists(file));
  }

  @Test
  void citadelHasOriginalMonumentAndSafeWorldRules() {
    CitadelLobby.decorate(p);
    assertEquals(Material.WATER, p.citadel.getBlockAt(22, 64, 19).getType());
    assertEquals(Material.QUARTZ_BLOCK, p.citadel.getBlockAt(0, 82, -31).getType());
    assertFalse(p.citadel.getPVP());
    assertFalse(p.citadel.getGameRuleValue(GameRule.DO_MOB_SPAWNING));
  }

  @Test
  void builtInHubsStayProtectedAfterSelectingCustomSpawn() {
    var other = server.addSimpleWorld("other-lobby");
    p.data.set("setup.corner1", new Location(other, -10, 0, -10));
    p.data.set("setup.corner2", new Location(other, 10, 0, 10));
    assertTrue(p.setup.contains(new Location(p.citadel, 0, 65, 0)));
    assertTrue(p.setup.contains(new Location(p.grove, 0, 65, 0)));
  }

  @Test
  void preExistingPersonalTimeIsRestoredAfterPractice() {
    var a = server.addPlayer();
    a.setPlayerTime(9000, false);
    p.enter(a);
    p.reference.setPref(a, "time", "night");
    p.reference.applyTime(a);
    assertEquals(14000, a.getPlayerTime());
    p.restore(a);
    assertFalse(a.isPlayerTimeRelative());
    assertEquals(9000, a.getPlayerTime());
  }

  @Test
  void reducedMotionDoesNotCreateVictoryBossbar() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    p.enter(a);
    p.getConfig().set("presentation.effects", true);
    p.data.set("players." + a.getUniqueId() + ".animations", false);
    p.motion.result(match(a, b, false), a, true);
    assertTrue(p.motion.results.isEmpty());
  }

  @Test
  void caseUnlockSurvivesClosingAnAnimatedReveal() {
    var a = server.addPlayer();
    p.enter(a);
    p.getConfig().set("presentation.effects", true);
    p.progression.add(a.getUniqueId(), "cases", 1);
    p.progression.cases(a);
    assertTrue(p.motion.opening(a.getUniqueId()));
    assertEquals(0, p.progression.number(a.getUniqueId(), "cases"));
    assertEquals(1, p.data.getStringList("players." + a.getUniqueId() + ".cosmetics").size());
    a.closeInventory();
    p.motion.tick();
    assertFalse(p.motion.opening(a.getUniqueId()));
    assertEquals(1, p.data.getStringList("players." + a.getUniqueId() + ".cosmetics").size());
  }

  @Test
  void inboxFiltersUnreadWithoutDeletingHistory() {
    var a = server.addPlayer();
    p.enter(a);
    p.inbox.add(a.getUniqueId(), "A real reward", "Owned");
    String id = (String) p.inbox.entries(a.getUniqueId()).getFirst().get("id");
    p.inbox.mark(a, id);
    assertEquals(1, p.inbox.entries(a.getUniqueId()).size());
    assertEquals(0, p.inbox.unread(a.getUniqueId()));
    p.reference.handle(a, "inbox-filter", false, false);
    assertFalse(p.data.getBoolean("players." + a.getUniqueId() + ".ui.inboxUnread", true));
  }

  @Test
  void animationToggleActuallyAppliesThroughSettings() {
    var a = server.addPlayer();
    p.enter(a);
    p.action(a, "setting:animations");
    assertFalse(p.flag(a, "animations", true));
    p.action(a, "setting:animations");
    assertTrue(p.flag(a, "animations", false));
  }
}
