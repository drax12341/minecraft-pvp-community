package community.pvp.arena;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;

import org.bukkit.*;
import org.bukkit.event.entity.*;
import org.bukkit.event.player.*;
import org.junit.jupiter.api.*;
import org.mockbukkit.mockbukkit.*;

class DuelUpgradeTest {
    @Test void teammateTntDamageIsRejected() {
        var a=server.addPlayer();var b=server.addPlayer();var battle=new PartyBattles.Battle();battle.policy=p.new Match(a,b,"smp",6,1);battle.paused=false;battle.teams.put(a.getUniqueId(),"red");battle.teams.put(b.getUniqueId(),"red");battle.alive.addAll(battle.teams.keySet());p.partyBattles.sessions.put(a.getUniqueId(),battle);p.partyBattles.sessions.put(b.getUniqueId(),battle);
        var tnt=p.world.spawn(BattleMaps.spawn(p,6,true),org.bukkit.entity.TNTPrimed.class);tnt.setSource(a);
        var hit=new EntityDamageByEntityEvent(tnt,b,EntityDamageEvent.DamageCause.ENTITY_EXPLOSION,100);p.partyBattles.damage(hit);assertTrue(hit.isCancelled());p.partyBattles.sessions.clear();
    }
    @Test
    void failedBotRecoveryKeepsArenaReserved() {
        var owner = server.addPlayer();
        owner.setOp(true);
        p.enter(owner);
        p.data.set("built-battle-maps-v5", true);
        var block = p.world.getBlockAt(BattleMaps.get(6).cx(), 65, 1024);
        block.setType(Material.STONE);
        assertTrue(p.terrain.record(6, block));
        block.setType(Material.TNT);
        p.worldSaver = w -> {
            throw new IllegalStateException("disk unavailable");
        };
        p.bots.start(owner, new DuelMenus.Draft());
        assertTrue(p.occupied.contains(6));
        assertTrue(p.bots.sessions.isEmpty());
        assertTrue(java.nio.file.Files.exists(p.terrain.journal(6)));
        p.worldSaver = w -> {
        };
    }

    @Test
    void botTotemSupplyIsFinite() {
        var owner = server.addPlayer();
        var bot = p.world.spawn(BattleMaps.spawn(p, 6, false), org.bukkit.entity.Zombie.class);
        var session = new PracticeBots.Session();
        session.entity = bot.getUniqueId();
        session.remaining = 2;
        session.rules = DuelRules.defaults();
        session.map = 6;
        session.policy = p.new Match(owner, owner, "sword", 6, 1);
        p.bots.register(owner.getUniqueId(), session);
        for (int remaining = 1; remaining >= 0; remaining--) {
            var hit = new EntityDamageEvent(bot, EntityDamageEvent.DamageCause.FALL, 100);
            p.bots.damage(hit);
            assertTrue(hit.isCancelled());
            assertEquals(remaining, session.remaining);
        }
        var hit = new EntityDamageEvent(bot, EntityDamageEvent.DamageCause.FALL, 100);
        p.bots.damage(hit);
        assertFalse(hit.isCancelled());
        p.bots.sessions.clear();
        bot.remove();
    }

    @Test
    void partyBoxingCountsHitsForEachVictim() {
        var a = server.addPlayer();
        var b = server.addPlayer();
        var c = server.addPlayer();
        var battle = new PartyBattles.Battle();
        battle.policy = p.new Match(a, b, "boxing", 6, 3);
        battle.paused = false;
        battle.target = 3;
        battle.teams.put(a.getUniqueId(), "red");
        battle.teams.put(b.getUniqueId(), "blue");
        battle.teams.put(c.getUniqueId(), "blue");
        battle.alive.addAll(battle.teams.keySet());
        for (var id : battle.alive) p.partyBattles.sessions.put(id, battle);
        for (int i = 0; i < 100; i++)
            p.partyBattles.damage(new EntityDamageByEntityEvent(a, b, EntityDamageEvent.DamageCause.ENTITY_ATTACK, 2));
        assertFalse(battle.alive.contains(b.getUniqueId()));
        p.partyBattles.damage(new EntityDamageByEntityEvent(a, c, EntityDamageEvent.DamageCause.ENTITY_ATTACK, 2));
        assertTrue(battle.alive.contains(c.getUniqueId()));
        assertEquals(1, battle.policy.hits.get(c.getUniqueId()));
        p.partyBattles.sessions.clear();
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
    void cleanup() {
        MockBukkit.unmock();
    }

    @Test
    void eighteenMapsHaveThreeSizesAndSixThemes() {
        assertEquals(18, BattleMaps.all().size());
        for (int theme = 0; theme < 6; theme++) {
            var small = BattleMaps.get(6 + theme * 3);
            assertEquals(50, small.width());
            assertEquals(50, small.length());
            assertEquals(150, BattleMaps.get(small.id() + 1).width());
            assertEquals(250, BattleMaps.get(small.id() + 1).length());
            assertEquals(350, BattleMaps.get(small.id() + 2).length());
        }
    }

    @Test
    void compactKitsCannotChooseLargeMaps() {
        for (String kit : List.of("sword", "axe", "uhc", "boxing", "bow")) {
            assertTrue(BattleMaps.get(6).supports(kit));
            assertFalse(BattleMaps.get(7).supports(kit));
            assertFalse(BattleMaps.get(8).supports(kit));
        }
        assertTrue(BattleMaps.get(8).supports("mace"));
    }

    @Test
    void boundariesIncludeCeilingFloorAndWorld() {
        var m = BattleMaps.get(8);
        var l = BattleMaps.spawn(p, 8, true);
        assertTrue(m.inside(l, p.world, 1));
        assertFalse(m.inside(l.clone().add(0, 300, 0), p.world, 1));
        assertFalse(m.inside(l.clone().add(0, -30, 0), p.world, 1));
        assertFalse(m.inside(l.clone().add(500, 0, 0), p.world, 1));
        assertFalse(m.inside(new Location(p.grove, l.getX(), 65, l.getZ()), p.world, 1));
    }

    @Test
    void plainsHaveOnlyThreeBlockHillsAndFlatSpawnLanes() {
        for (int x = -120; x < 120; x++)
            for (int z = -150; z < 150; z++) {
                int h = BattleMaps.height(BattleMaps.get(8), x, z);
                assertTrue(h >= 64 && h <= 67);
                if (Math.abs(z) < 7) assertEquals(64, h);
                assertEquals(h, BattleMaps.height(BattleMaps.get(8), -x, z));
            }
    }

    @Test
    void partyCapacityAndTransferEnforceOwnership() {
        var leader = server.addPlayer("Leader");
        var member = server.addPlayer("Member");
        var stranger = server.addPlayer("Stranger");
        p.parties.command(leader, new String[]{"create"});
        p.parties.command(leader, new String[]{"invite", "Member"});
        p.parties.command(member, new String[]{"accept", "Leader"});
        var party = p.parties.membership.get(leader.getUniqueId());
        p.parties.command(member, new String[]{"max", "50"});
        assertEquals(10, party.max);
        p.parties.command(leader, new String[]{"max", "51"});
        assertEquals(10, party.max);
        p.parties.command(leader, new String[]{"max", "1"});
        assertEquals(10, party.max);
        p.parties.command(leader, new String[]{"max", "50"});
        assertEquals(50, party.max);
        p.parties.command(leader, new String[]{"transfer", "Stranger"});
        assertEquals(leader.getUniqueId(), party.leader);
        p.parties.command(leader, new String[]{"transfer", "Member"});
        assertEquals(member.getUniqueId(), party.leader);
    }

    @Test
    void partyDisbandInvalidatesOutstandingInvites() {
        var leader = server.addPlayer("Leader");
        var member = server.addPlayer("Member");
        p.parties.command(leader, new String[]{"create"});
        p.parties.command(leader, new String[]{"invite", "Member"});
        p.parties.command(leader, new String[]{"disband"});
        p.parties.command(member, new String[]{"accept", "Leader"});
        assertFalse(p.parties.membership.containsKey(member.getUniqueId()));
    }

    @Test
    void partyAttackPassesLobbyGuard() {
        var a = server.addPlayer();
        var b = server.addPlayer();
        p.participants.add(a.getUniqueId());
        p.participants.add(b.getUniqueId());
        a.teleport(BattleMaps.spawn(p, 6, true));
        b.teleport(BattleMaps.spawn(p, 6, false));
        var battle = new PartyBattles.Battle();
        battle.policy = p.new Match(a, b, "sword", 6, 1);
        battle.policy.paused = false;
        battle.paused = false;
        battle.teams.put(a.getUniqueId(), "red");
        battle.teams.put(b.getUniqueId(), "blue");
        battle.alive.addAll(battle.teams.keySet());
        p.partyBattles.sessions.put(a.getUniqueId(), battle);
        p.partyBattles.sessions.put(b.getUniqueId(), battle);
        var hit = new EntityDamageByEntityEvent(a, b, EntityDamageEvent.DamageCause.ENTITY_ATTACK, 2);
        server.getPluginManager().callEvent(hit);
        assertFalse(hit.isCancelled());
        p.partyBattles.sessions.clear();
    }

    @Test
    void teammateDamageIsRejected() {
        var a = server.addPlayer();
        var b = server.addPlayer();
        var battle = new PartyBattles.Battle();
        battle.policy = p.new Match(a, b, "sword", 6, 1);
        battle.paused = false;
        battle.teams.put(a.getUniqueId(), "red");
        battle.teams.put(b.getUniqueId(), "red");
        battle.alive.addAll(battle.teams.keySet());
        p.partyBattles.sessions.put(a.getUniqueId(), battle);
        p.partyBattles.sessions.put(b.getUniqueId(), battle);
        var hit = new EntityDamageByEntityEvent(a, b, EntityDamageEvent.DamageCause.ENTITY_ATTACK, 2);
        p.partyBattles.damage(hit);
        assertTrue(hit.isCancelled());
        p.partyBattles.sessions.clear();
    }

    @Test
    void duelGuiCommandAndBotAuthorization() {
        var a = server.addPlayer();
        p.duels.open(a, "bot");
        assertFalse(p.duels.drafts.containsKey(a.getUniqueId()));
        p.duels.open(a, null);
        assertTrue(a.getOpenInventory().getTopInventory().getHolder() instanceof ArenaMenu);
    }

    @Test
    void selectedSettingsAreImmutableInInvitation() {
        var d = new DuelMenus.Draft();
        d.map = 8;
        d.loot = true;
        var r = d.rules();
        d.loot = false;
        d.map = 6;
        assertTrue(r.loot());
        assertEquals(8, r.map());
    }

    @Test
    void crouchTogglesTabWithoutChangingWorldVisibility() {
        var a = server.addPlayer("Viewer");
        var friend = server.addPlayer("Friend");
        var other = server.addPlayer("Other");
        Map<UUID, Boolean> listed = new HashMap<>();
        p.presentation.roster = (viewer, target, value) -> {
            if (viewer.equals(a)) listed.put(target.getUniqueId(), value);
        };
        p.enter(a);
        p.enter(friend);
        p.enter(other);
        p.data.set("players." + a.getUniqueId() + ".friends", List.of(friend.getUniqueId().toString()));
        p.presentation.sneak(new PlayerToggleSneakEvent(a, true));
        assertTrue(p.presentation.friendTabs.contains(a.getUniqueId()));
        assertEquals(false, listed.get(other.getUniqueId()));
        assertTrue(p.presentation.visible(a, other));
        assertTrue(p.presentation.visible(a, friend));
        p.presentation.sneak(new PlayerToggleSneakEvent(a, false));
        assertTrue(p.presentation.friendTabs.contains(a.getUniqueId()));
        p.presentation.sneak(new PlayerToggleSneakEvent(a, true));
        assertFalse(p.presentation.friendTabs.contains(a.getUniqueId()));
        assertEquals(true, listed.get(other.getUniqueId()));
    }

    @Test
    void lobbySelectionCannotOverlapNewMaps() {
        var center = BattleMaps.spawn(p, 8, true);
        assertFalse(p.setup.validRegion(center.clone().add(-50, 0, -50), center.clone().add(50, 0, 50)));
    }

    @Test
    void modernTerrainJournalResetsAndKeepsBoundaryImmutable() {
        var m = BattleMaps.get(6);
        var block = p.world.getBlockAt(m.cx(), 65, 1024);
        block.setType(Material.STONE);
        assertTrue(p.terrain.record(6, block));
        block.setType(Material.TNT);
        p.terrain.reset(6);
        assertEquals(Material.STONE, block.getType());
        var boundary = p.world.getBlockAt(m.cx() - m.width() / 2, 66, 1024);
        assertFalse(p.terrain.record(6, boundary));
    }

    @Test
    void generatedColumnsHaveUnbreakableFloorAndSky() {
        var map = BattleMaps.get(6);
        BattleMaps.column(p, map, -25, 0);
        assertEquals(Material.BEDROCK, p.world.getBlockAt(map.cx() - 25, 50, 1024).getType());
        assertEquals(Material.BARRIER, p.world.getBlockAt(map.cx() - 25, 100, 1024).getType());
        assertEquals(Material.BARRIER, p.world.getBlockAt(map.cx() - 25, map.ceiling(), 1024).getType());
    }

    @Test
    void guiLocksLargeMapAndShowsFormattedToggleText() {
        var a = server.addPlayer();
        p.duels.open(a, null);
        var draft = p.duels.drafts.get(a.getUniqueId());
        p.duels.maps(a);
        var inv = a.getOpenInventory().getTopInventory();
        assertEquals(Material.BARRIER, inv.getItem(4).getType());
        p.duels.settings(a);
        String name = net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText().serialize(a.getOpenInventory().getTopInventory().getItem(10).getItemMeta().displayName());
        assertEquals("Pearls on walls: OFF", name);
        assertFalse(name.contains("§"));
    }

    @Test
    void selectedModernMapStartsAndDoesNotAwardElo() {
        var a = server.addPlayer();
        var b = server.addPlayer();
        p.data.set("built-battle-maps-v5", true);
        p.start(a, b, "sword", 1, false, null, new DuelRules(6, false, false, false, false, false));
        var match = p.matches.get(a.getUniqueId());
        assertNotNull(match);
        assertEquals(6, match.arena);
        assertFalse(match.rules.spectators());
        assertTrue(BattleMaps.contains(p, 6, a.getLocation()));
        p.finish(match, a.getUniqueId(), "test");
        assertEquals(1000, p.progression.elo(a.getUniqueId()));
    }

    @Test
    void ordinaryPlayerCannotTriggerBotStartThroughForgedAction() {
        var a = server.addPlayer();
        p.duels.open(a, null);
        var d = p.duels.drafts.get(a.getUniqueId());
        d.bot = true;
        p.data.set("built-battle-maps-v5", true);
        p.duels.handle(a, "duelui:send", false);
        assertTrue(p.bots.sessions.isEmpty());
        assertTrue(p.occupied.isEmpty());
    }

    @Test
    void lootToggleDropsOnlyMatchEquipment() {
        var a = server.addPlayer();
        var b = server.addPlayer();
        a.teleport(BattleMaps.spawn(p, 6, true));
        var match = p.new Match(a, b, "sword", 6, 1);
        a.getInventory().setItem(0, new org.bukkit.inventory.ItemStack(Material.DIAMOND_SWORD));
        DuelEvents.dropLoot(p, a, match);
        assertEquals(Material.DIAMOND_SWORD, a.getInventory().getItem(0).getType());
        match.rules = new DuelRules(6, false, false, true, false, true);
        DuelEvents.dropLoot(p, a, match);
        assertTrue(a.getInventory().isEmpty());
        assertEquals(1, p.world.getEntitiesByClass(org.bukkit.entity.Item.class).size());
    }

    @Test
    void partyBattleIsCasualAndEndsOnLeave() {
        var a = server.addPlayer("A");
        var b = server.addPlayer("B");
        p.parties.command(a, new String[]{"create"});
        p.parties.command(a, new String[]{"invite", "B"});
        p.parties.command(b, new String[]{"accept", "A"});
        p.data.set("built-battle-maps-v5", true);
        var draft = new DuelMenus.Draft();
        p.partyBattles.start(a, draft);
        assertTrue(p.busy(a));
        assertTrue(p.busy(b));
        assertEquals("party:" + a.getUniqueId(), p.presentation.room(b.getUniqueId()));
        p.partyBattles.leave(b);
        assertFalse(p.busy(a));
        assertFalse(p.busy(b));
        assertFalse(p.occupied.contains(6));
        assertEquals(0, p.progression.number(a.getUniqueId(), "wins"));
    }

    @Test
    void pearlAndChorusCannotLeaveMap() {
        var a = server.addPlayer();
        var b = server.addPlayer();
        var match = p.new Match(a, b, "mace", 8, 1);
        p.matches.put(a.getUniqueId(), match);
        a.teleport(BattleMaps.spawn(p, 8, true));
        for (var cause : List.of(PlayerTeleportEvent.TeleportCause.ENDER_PEARL, PlayerTeleportEvent.TeleportCause.CHORUS_FRUIT, PlayerTeleportEvent.TeleportCause.COMMAND)) {
            var event = new PlayerTeleportEvent(a, a.getLocation(), a.getLocation().add(500, 0, 0), cause);
            new DuelEvents(p).teleport(event);
            assertTrue(event.isCancelled());
        }
        p.matches.clear();
    }
}
