package community.pvp.arena;

import static org.junit.jupiter.api.Assertions.*;

import org.bukkit.event.entity.EntityDamageEvent;
import org.junit.jupiter.api.*;
import org.mockbukkit.mockbukkit.MockBukkit;
import org.mockbukkit.mockbukkit.ServerMock;

class ArenaTest {
  ServerMock server;
  CommunityArena p;

  @BeforeEach
  void start() {
    server = MockBukkit.mock(new PracticeServerMock());
    p = MockBukkit.load(CommunityArena.class);
    p.worldSaver = w -> {};
    p.getConfig().set("presentation.nametags", false);
    p.getConfig().set("presentation.effects", false);
    p.getConfig().set("presentation.hide-score-numbers", false);
    p.ready = true;
  }

  @AfterEach
  void stop() {
    MockBukkit.unmock();
  }

  @Test
  void nonOperatorCannotMoveSpawn() {
    var player = server.addPlayer();
    var original = p.setup.spawn();
    p.setup.command(player, new String[] {"lobby", "1000"});
    assertEquals(original, p.setup.spawn());
  }

  @Test
  void lobbyRejectsDamage() {
    var player = server.addPlayer();
    player.teleport(p.setup.spawn());
    var event = new EntityDamageEvent(player, EntityDamageEvent.DamageCause.FALL, 10);
    p.setup.lobbyDamage(event);
    assertTrue(event.isCancelled());
  }

  @Test
  void casualWinNeverAwardsElo() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    var m = p.new Match(a, b, "sword", 1, 1);
    p.progression.result(m, a.getUniqueId());
    assertEquals(600, p.progression.elo(a.getUniqueId()));
    assertEquals(1, p.progression.number(a.getUniqueId(), "wins"));
  }

  @Test
  void rankedWinTransfersPointsAndCreatesChampion() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    var m = p.new Match(a, b, "sword", 1, 1);
    m.ranked = true;
    p.progression.result(m, a.getUniqueId());
    assertEquals(616, p.progression.elo(a.getUniqueId()));
    assertEquals(584, p.progression.elo(b.getUniqueId()));
    assertEquals("#1 Champion", p.progression.rank(a.getUniqueId()));
  }

  @Test
  void noCaseMeansNoReward() {
    var player = server.addPlayer();
    p.progression.cases(player);
    assertTrue(p.data.getStringList("players." + player.getUniqueId() + ".cosmetics").isEmpty());
  }

  @Test
  void largeLobbyCannotDisableCombatArenas() {
    assertFalse(p.setup.validRegion(p.loc(0, -500, -500, 0), p.loc(0, 500, 500, 0)));
  }

  @Test
  void separateWorldAllowsThousandBlockLobby() {
    var w = server.addSimpleWorld("custom-lobby");
    assertTrue(
        p.setup.validRegion(
            w.getSpawnLocation().add(-500, 0, -500), w.getSpawnLocation().add(499, 0, 499)));
  }

  @Test
  void inventorySurvivesPracticeRoundTrip() {
    var player = server.addPlayer();
    player
        .getInventory()
        .setItem(0, new org.bukkit.inventory.ItemStack(org.bukkit.Material.DIAMOND, 17));
    p.enter(player);
    assertEquals(org.bukkit.Material.CLOCK, player.getInventory().getItem(0).getType());
    p.restore(player);
    assertEquals(org.bukkit.Material.DIAMOND, player.getInventory().getItem(0).getType());
    assertEquals(17, player.getInventory().getItem(0).getAmount());
  }

  @Test
  void onlyRankedPlayersAppearInEloLeaders() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    p.progression.add(a.getUniqueId(), "games", 1);
    p.progression.add(b.getUniqueId(), "rankedGames", 1);
    p.progression.add(b.getUniqueId(), "games", 1);
    assertEquals(java.util.List.of(b.getUniqueId()), p.visuals.leaders("elo"));
  }

  @Test
  void ffaOnlyPlayersAppearInDeathLeaders() {
    var a = server.addPlayer();
    p.progression.add(a.getUniqueId(), "deaths", 1);
    assertEquals(java.util.List.of(a.getUniqueId()), p.visuals.leaders("deaths"));
  }

  @Test
  void dailyQuestCanOnlyBeClaimedOnce() {
    var a = server.addPlayer();
    var id = a.getUniqueId();
    p.progression.beginDay(id);
    p.progression.add(id, "games", 5);
    p.progression.add(id, "wins", 3);
    p.progression.quests(a);
    p.progression.quests(a);
    assertEquals(1, p.progression.number(id, "cases"));
  }

  @Test
  void repeatRankedPairHasCooldown() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    var m = p.new Match(a, b, "sword", 1, 1);
    m.ranked = true;
    p.progression.result(m, a.getUniqueId());
    assertFalse(p.progression.eligible(a.getUniqueId(), b.getUniqueId(), "sword"));
  }

  @Test
  void finishIsIdempotent() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    var m = p.new Match(a, b, "sword", 1, 1);
    p.finish(m, a.getUniqueId(), "test");
    p.finish(m, a.getUniqueId(), "again");
    assertEquals(1, p.progression.number(a.getUniqueId(), "wins"));
  }

  @Test
  void countdownPreventsDamage() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    p.enter(a);
    p.enter(b);
    p.start(a, b, "sword", 1);
    var event = new EntityDamageEvent(a, EntityDamageEvent.DamageCause.FALL, 10);
    new ArenaEvents(p).damage(event);
    assertTrue(event.isCancelled());
  }

  @Test
  void cannotQueueWhileSpectating() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    var viewer = server.addPlayer();
    p.start(a, b, "sword", 1);
    p.social.spec(viewer, new String[] {a.getName()});
    p.progression.queue(viewer, "sword");
    assertFalse(p.queues.containsKey(viewer.getUniqueId()));
  }

  @Test
  void victoryReturnsBothPlayersToSpawn() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    p.start(a, b, "sword", 1);
    var m = p.matches.get(a.getUniqueId());
    p.finish(m, a.getUniqueId(), "test");
    server.getScheduler().performTicks(61);
    assertEquals(p.setup.spawn(), a.getLocation());
    assertEquals(p.setup.spawn(), b.getLocation());
    assertTrue(p.matches.isEmpty());
  }

  @Test
  void failedBackupDoesNotClearInventory() {
    var a = server.addPlayer();
    a.getInventory().setItem(0, new org.bukkit.inventory.ItemStack(org.bukkit.Material.DIAMOND, 9));
    var original = p.dataFile;
    p.dataFile = new java.io.File(original.getParentFile(), "nonexistent-subfolder/players.yml");
    p.enter(a);
    assertFalse(p.managed(a));
    assertEquals(9, a.getInventory().getItem(0).getAmount());
    p.dataFile = original;
  }

  @Test
  void spectatorsReturnWhenMatchEnds() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    var viewer = server.addPlayer();
    p.start(a, b, "sword", 1);
    p.social.spec(viewer, new String[] {a.getName()});
    p.finish(p.matches.get(a.getUniqueId()), a.getUniqueId(), "test");
    assertFalse(p.social.spectators.containsKey(viewer.getUniqueId()));
    assertEquals(org.bukkit.GameMode.ADVENTURE, viewer.getGameMode());
    assertEquals(p.setup.spawn(), viewer.getLocation());
  }

  @Test
  void twoCornerSetupRejectsOperatorOutsideSelection() {
    var op = server.addPlayer();
    op.setOp(true);
    var before = p.setup.spawn();
    p.setup.corners.put(
        op.getUniqueId(), new org.bukkit.Location[] {p.loc(0, -20, -20, 0), p.loc(0, 20, 20, 0)});
    op.teleport(p.loc(4, 0, 0, 0));
    p.setup.command(op, new String[] {"save"});
    assertEquals(before, p.setup.spawn());
  }

  @Test
  void generatedLobbyHasThreeRealLeaderboardDefinitions() {
    GroveLobby.decorate(p);
    assertTrue(p.ready);
    assertEquals(org.bukkit.Material.WATER, p.grove.getBlockAt(22, 64, -12).getType());
    assertEquals(3, p.data.getConfigurationSection("holograms").getKeys(false).stream().filter(key->key.startsWith("f000000")).count());
  }

  @Test
  void onlyOpponentCanDamageActiveDuel() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    var third = server.addPlayer();
    p.start(a, b, "sword", 1);
    server.getScheduler().performTicks(61);
    var hit =
        new org.bukkit.event.entity.EntityDamageByEntityEvent(
            third, a, EntityDamageEvent.DamageCause.ENTITY_ATTACK, 2);
    server.getPluginManager().callEvent(hit);
    assertTrue(hit.isCancelled());
    var valid =
        new org.bukkit.event.entity.EntityDamageByEntityEvent(
            b, a, EntityDamageEvent.DamageCause.ENTITY_ATTACK, 2);
    server.getPluginManager().callEvent(valid);
    assertFalse(valid.isCancelled());
  }

  @Test
  void cannotSpectateEndedMatchDuringVictory() {
    var a = server.addPlayer();
    var b = server.addPlayer();
    var viewer = server.addPlayer();
    p.start(a, b, "sword", 1);
    p.finish(p.matches.get(a.getUniqueId()), a.getUniqueId(), "test");
    p.social.spec(viewer, new String[] {a.getName()});
    assertFalse(p.social.spectators.containsKey(viewer.getUniqueId()));
  }
}
