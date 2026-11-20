package community.pvp.arena;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import net.kyori.adventure.text.Component;
import org.bukkit.*;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.inventory.meta.*;
import org.bukkit.plugin.Plugin;
import org.bukkit.scoreboard.DisplaySlot;
import org.bukkit.scoreboard.Scoreboard;
import org.junit.jupiter.api.*;
import org.mockbukkit.mockbukkit.*;
import org.mockbukkit.mockbukkit.entity.PlayerMock;

class SmoothExperienceTest {
  ServerMock server;
  CommunityArena p;

  static class CountingPlayer extends PlayerMock {
    int visibilityCalls, tabCalls, boardCalls;

    CountingPlayer(ServerMock server, String name) {
      super(server, name);
    }

    @Override
    public void showPlayer(Plugin plugin, Player player) {
      visibilityCalls++;
      super.showPlayer(plugin, player);
    }

    @Override
    public void hidePlayer(Plugin plugin, Player player) {
      visibilityCalls++;
      super.hidePlayer(plugin, player);
    }

    @Override
    public void playerListName(Component name) {
      tabCalls++;
      super.playerListName(name);
    }

    @Override
    public void setScoreboard(Scoreboard board) {
      boardCalls++;
      super.setScoreboard(board);
    }

    void resetCounts() {
      visibilityCalls = tabCalls = boardCalls = 0;
    }
  }

  @BeforeEach
  void start() {
    server = MockBukkit.mock(new PracticeServerMock());
    p = MockBukkit.load(CommunityArena.class);
    p.worldSaver = w -> {};
    p.getConfig().set("presentation.effects", false);
    p.getConfig().set("presentation.nametags", false);
    p.getConfig().set("presentation.hide-score-numbers", false);
    p.ready = true;
  }

  @AfterEach
  void stop() {
    MockBukkit.unmock();
  }

  CountingPlayer player(String name) {
    var a = new CountingPlayer(server, name);
    server.addPlayer(a);
    p.enter(a);
    return a;
  }

  @Test
  void everyPresetHasItsOwnRecognizableIcon() {
    var icons = new HashSet<Material>();
    for (String kit : CommunityArena.KITS)
      assertTrue(icons.add(Loadouts.icon(kit)), "Repeated kit icon: " + kit);
    assertEquals(14, icons.size());
  }

  @Test
  void stableLobbyDoesNotRepeatVisibilityTabOrScoreboardAssignments() {
    var players = new ArrayList<CountingPlayer>();
    for (int i = 0; i < 24; i++) players.add(player("Smooth" + i));
    p.presentation.tick();
    for (var a : players) {
      p.board(a);
      a.resetCounts();
    }
    for (int i = 0; i < 20; i++) {
      p.presentation.tick();
      for (var a : players) p.board(a);
    }
    int visibility = players.stream().mapToInt(a -> a.visibilityCalls).sum();
    int tab = players.stream().mapToInt(a -> a.tabCalls).sum();
    int board = players.stream().mapToInt(a -> a.boardCalls).sum();
    System.out.println(
        "24-player / 20-refresh fixture: visibility="
            + visibility
            + ", tab="
            + tab
            + ", scoreboard="
            + board);
    assertEquals(0, visibility, "Stable visibility should not be resent");
    assertEquals(0, tab, "Stable tab names should not be resent");
    assertEquals(0, board, "The same owned scoreboard should not be reassigned");
  }

  @Test
  void queueAndStatsUseDistinctStyledIconsWithoutChangingTheirActions() {
    var a = player("Icons");
    p.reference.queues(a, "both");
    int i = 0;
    for (String kit : CommunityArena.KITS) {
      var item = a.getOpenInventory().getTopInventory().getItem(10 + i + i / 7 * 2);
      assertEquals(Loadouts.icon(kit), item.getType());
      assertEquals(
          "kit:b:" + kit,
          item.getItemMeta()
              .getPersistentDataContainer()
              .get(p.menuKey, org.bukkit.persistence.PersistentDataType.STRING));
      assertTrue(item.getItemMeta().lore().size() > 3);
      i++;
    }
    var pot = Loadouts.menuIcon(p, "pot", "Pot", null);
    assertEquals(
        org.bukkit.potion.PotionType.STRONG_HEALING,
        ((PotionMeta) pot.getItemMeta()).getBasePotionType());
    var boxing = Loadouts.menuIcon(p, "boxing", "Boxing", null);
    assertEquals(Color.fromRGB(220, 48, 65), ((LeatherArmorMeta) boxing.getItemMeta()).getColor());
    p.reference.stats(a);
    i = 0;
    for (String kit : CommunityArena.KITS) {
      assertEquals(
          Loadouts.icon(kit),
          a.getOpenInventory().getTopInventory().getItem(10 + i + i / 7 * 2).getType());
      i++;
    }
  }

  @Test
  void cachedVisibilityStillChangesForSpectatingLeavingAndExiting() {
    var a = player("FighterA");
    var b = player("FighterB");
    var viewer = player("Viewer");
    p.start(a, b, "sword", 1);
    p.presentation.tick();
    assertFalse(a.canSee(viewer));
    p.social.spec(viewer, new String[] {a.getName()});
    assertTrue(viewer.canSee(a));
    assertTrue(viewer.canSee(b));
    assertFalse(a.canSee(viewer));
    p.social.leave(viewer);
    p.lobby(viewer);
    assertFalse(a.canSee(viewer));
    assertFalse(viewer.canSee(a));
    p.restore(viewer);
    assertTrue(a.canSee(viewer));
    assertTrue(viewer.canSee(a));
    assertFalse(p.presentation.playerVisibility.containsKey(viewer.getUniqueId()));
    assertTrue(
        p.presentation.playerVisibility.values().stream()
            .noneMatch(v -> v.containsKey(viewer.getUniqueId())));
    p.enter(viewer);
    p.presentation.tick();
    assertFalse(a.canSee(viewer));
  }

  @Test
  void healthAndPreferencesStillUpdateAnExistingScoreboard() {
    var a = player("HealthA");
    var b = player("HealthB");
    p.start(a, b, "sword", 1);
    var board = a.getScoreboard();
    a.resetCounts();
    b.setHealth(13);
    p.board(a);
    assertEquals(13, board.getObjective("health").getScore(b.getName()).getScore());
    assertEquals(0, a.boardCalls);
    p.data.set("players." + a.getUniqueId() + ".scoreboard", false);
    p.board(a);
    assertNull(board.getObjective(DisplaySlot.SIDEBAR));
    p.data.set("players." + a.getUniqueId() + ".scoreboard", true);
    p.board(a);
    assertNotNull(board.getObjective(DisplaySlot.SIDEBAR));
  }

  @Test
  void matchBoundaryChecksTheDestinationImmediately() {
    var a = player("EdgeA");
    var b = player("EdgeB");
    p.start(a, b, "sword", 1);
    var match = p.matches.get(a.getUniqueId());
    match.paused = false;
    p.frozen.clear();
    var event = new PlayerMoveEvent(a, a.getLocation(), new Location(p.world, 192, 65, 0));
    server.getPluginManager().callEvent(event);
    assertTrue(match.ended, "Crossing boundary must end the round on this move");
    assertEquals(event.getFrom(), event.getTo());
  }

  @Test
  void lobbyBoundaryRedirectsTheMoveWithoutNestedTeleport() {
    var a = player("LobbyEdge");
    var from = a.getLocation();
    var event = new PlayerMoveEvent(a, from, from.clone().add(120, 0, 0));
    server.getPluginManager().callEvent(event);
    assertEquals(p.setup.spawn(), event.getTo());
    assertEquals(from, a.getLocation());
  }

  @Test
  void cancelledMovementDoesNotLoseARound() {
    var a = player("CancelA");
    var b = player("CancelB");
    p.start(a, b, "sword", 1);
    var match = p.matches.get(a.getUniqueId());
    match.paused = false;
    p.frozen.clear();
    var event = new PlayerMoveEvent(a, a.getLocation(), new Location(p.world, 192, 65, 0));
    event.setCancelled(true);
    server.getPluginManager().callEvent(event);
    assertFalse(match.ended);
  }

  @Test
  void disconnectCleansBothManagedAndUnmanagedVisibilityEntries() {
    var a = player("QuitA");
    var b = player("QuitB");
    var viewer = player("QuitViewer");
    p.start(a, b, "sword", 1);
    p.social.spec(viewer, new String[] {a.getName()});
    UUID managed = viewer.getUniqueId();
    assertTrue(viewer.disconnect());
    assertFalse(p.presentation.playerVisibility.containsKey(managed));
    assertTrue(
        p.presentation.playerVisibility.values().stream().noneMatch(v -> v.containsKey(managed)));
    var outside = server.addPlayer("Outside");
    p.presentation.tick();
    UUID unmanaged = outside.getUniqueId();
    assertTrue(outside.disconnect());
    assertTrue(
        p.presentation.playerVisibility.values().stream().noneMatch(v -> v.containsKey(unmanaged)));
    var reconnected = new PlayerMock(server, "Outside", unmanaged);
    server.addPlayer(reconnected);
    p.enter(reconnected);
    p.presentation.tick();
    assertFalse(a.canSee(reconnected));
  }

  @Test
  void frozenPlayersCanLookAroundWithoutMoving() {
    var a = player("FrozenA");
    var b = player("FrozenB");
    p.start(a, b, "sword", 1);
    var from = a.getLocation();
    var looking = from.clone();
    looking.setYaw(75);
    var rotation = new PlayerMoveEvent(a, from, looking);
    server.getPluginManager().callEvent(rotation);
    assertEquals(75, rotation.getTo().getYaw());
    var step = new PlayerMoveEvent(a, from, from.clone().add(1, 0, 0));
    server.getPluginManager().callEvent(step);
    assertEquals(from, step.getTo());
  }
}
