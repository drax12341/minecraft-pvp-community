package community.pvp.arena;

import static org.junit.jupiter.api.Assertions.*;
import java.util.*;
import org.bukkit.*;
import org.bukkit.event.entity.*;
import org.junit.jupiter.api.*;
import org.mockbukkit.mockbukkit.*;

class CombatPolishTest {
    PracticeServerMock server;
    CommunityArena p;
    @BeforeEach void setup() {
        server = MockBukkit.mock(new PracticeServerMock(true));
        p = MockBukkit.load(CommunityArena.class);
        p.worldSaver = w -> {};
        p.ready = true;
        p.data.set("holograms", null);
        p.getConfig().set("presentation.effects", false);
        p.getConfig().set("presentation.nametags", false);
        p.getConfig().set("presentation.hide-score-numbers", false);
    }
    @AfterEach void close() { MockBukkit.unmock(); }

    @Test void persistedBrokenColorPrefixesAreNotVisible() {
        String text = net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText()
                .serialize(PracticePresentation.ui("\u00c2\u00a7eSettings"));
        assertEquals("Settings", text);
    }

    @Test void settingsItemNamesContainNoEncodingDebris() {
        var a = server.addPlayer();
        p.enter(a);
        p.menus.settings(a);
        for (var item : a.getOpenInventory().getTopInventory().getContents()) {
            if (item == null) continue;
            var text = net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText().serialize(item.getItemMeta().displayName());
            assertFalse(text.contains("\u00c2"), text);
        }
    }

    @Test void formerCageSpaceIsNeutralAndWalkable() {
        var a = server.addPlayer();
        var b = server.addPlayer();
        p.start(a, b, "crystal", 1, false, null, new DuelRules(100, true, false, true, false, false));
        var map = BattleMaps.get(100);
        var entry = ImportedBuilds.build(100).a();
        var at = new Location(p.world, map.cx() - map.width()/2 + entry.x() + .5, 98, 1024-map.length()/2+entry.z()+.5);
        assertTrue(BattleMaps.contains(p, 100, at));
        assertTrue(p.world.getBlockAt(map.cx()-map.width()/2+entry.gate(),98,at.getBlockZ()).getType().isAir());
    }

    @Test void crystalExplosionCanBreakFloorButNotNaturalWallsOrBedrock() {
        var a = server.addPlayer();
        var b = server.addPlayer();
        p.start(a, b, "crystal", 1, false, null, new DuelRules(100, true, false, true, false, false));
        server.getScheduler().performTicks(61);
        int x = BattleMaps.get(100).cx();
        var floor = p.world.getBlockAt(x, 95, 1024);
        var wall = p.world.getBlockAt(x, 100, 1038);
        var base = p.world.getBlockAt(x, 92, 1024);
        floor.setType(Material.STONE);
        wall.setType(Material.STONE_BRICKS);
        base.setType(Material.BEDROCK);
        var blocks = new ArrayList<>(List.of(floor, wall, base));
        assertNotNull(p.matches.get(a.getUniqueId()));
        assertFalse(p.matches.get(a.getUniqueId()).paused);
        assertEquals(100, p.terrain.index(floor.getLocation()));
        assertTrue(p.terrain.live(100));
        assertTrue(ArenaLayout.mutable(100, floor, "minecraft:stone", false));
        p.terrain.explosion(floor.getLocation().clone().add(0, 2, 0), blocks);
        assertEquals(List.of(floor), blocks);
        floor.setType(Material.AIR);
        p.terrain.reset(100);
        assertEquals(Material.STONE, floor.getType());
    }

    @Test void botCannotTakeDamageFromAnUnrelatedPlayer() {
        var owner = server.addPlayer();
        var outsider = server.addPlayer();
        var entity = p.world.spawn(BattleMaps.spawn(p,100,false), org.bukkit.entity.Zombie.class);
        var s = new PracticeBots.Session();
        s.entity = entity.getUniqueId(); s.map=100; s.rules=DuelRules.defaults();
        s.policy=p.new Match(owner,owner,"sword",100,1);
        p.bots.register(owner.getUniqueId(),s);
        var e = new EntityDamageByEntityEvent(outsider,entity,EntityDamageEvent.DamageCause.ENTITY_ATTACK,5);
        p.bots.damage(e);
        assertTrue(e.isCancelled());
    }

    @Test void botReachAndCooldownAreBounded() {
        var at = BattleMaps.spawn(p,100,true);
        assertTrue(BotCombat.inReach(at,at.clone().add(2.9,0,0)));
        assertFalse(BotCombat.inReach(at,at.clone().add(3.1,0,0)));
        assertEquals(13,BotCombat.cooldown(Material.DIAMOND_SWORD));
        assertEquals(20,BotCombat.cooldown(Material.DIAMOND_AXE));
        assertEquals(34,BotCombat.cooldown(Material.MACE));
    }

    @Test void botUsesTheChosenKitAndFiniteHealing() {
        var sword = ReferenceLoadouts.create("sword");
        assertEquals(Material.DIAMOND_SWORD,BotCombat.weapon(sword).getType());
        assertEquals(0,BotCombat.healing(sword));
        assertTrue(BotCombat.healing(ReferenceLoadouts.create("smp")) <= 16);
        var draft = new DuelMenus.Draft();
        assertTrue(draft.moving);
    }

    @Test void ownerCannotBeHitByAnotherPlayerDuringBotPractice() {
        var owner=server.addPlayer();var outsider=server.addPlayer();p.enter(owner);
        var entity=p.world.spawn(BattleMaps.spawn(p,100,false),org.bukkit.entity.Zombie.class);
        var s=new PracticeBots.Session();s.entity=entity.getUniqueId();s.map=100;s.rules=DuelRules.defaults();
        s.policy=p.new Match(owner,owner,"sword",100,3);p.bots.register(owner.getUniqueId(),s);
        var hit=new EntityDamageByEntityEvent(outsider,owner,EntityDamageEvent.DamageCause.ENTITY_ATTACK,5);
        server.getPluginManager().callEvent(hit);
        assertTrue(hit.isCancelled());
    }

    @Test void sideCollarAndBedrockCannotBeEditedEvenWhenRecorded() {
        var map=BattleMaps.get(100);
        var edge=p.world.getBlockAt(map.cx()-map.width()/2+2,95,1024);
        var base=p.world.getBlockAt(map.cx(),92,1024);
        edge.setType(Material.STONE);base.setType(Material.BEDROCK);
        assertFalse(ArenaLayout.mutable(100,edge,"minecraft:air",true));
        assertFalse(ArenaLayout.mutable(100,base,"minecraft:air",true));
    }

    @Test void ownProjectileEffectsRemainNativeInDuelsAndBotSessions() {
        var a=server.addPlayer();var b=server.addPlayer();
        p.start(a,b,"mace",1);
        server.getScheduler().performTicks(61);
        var arrow=p.world.spawn(a.getLocation(),org.bukkit.entity.Arrow.class);arrow.setShooter(a);
        var self=new EntityDamageByEntityEvent(arrow,a,EntityDamageEvent.DamageCause.PROJECTILE,1);
        server.getPluginManager().callEvent(self);
        assertFalse(self.isCancelled());
        var outsider=server.addPlayer();arrow.setShooter(outsider);
        var wrong=new EntityDamageByEntityEvent(arrow,a,EntityDamageEvent.DamageCause.PROJECTILE,1);
        server.getPluginManager().callEvent(wrong);
        assertTrue(wrong.isCancelled());
    }

    @Test void anchorExplosionEventKeepsTheFloorDamageList() {
        var a=server.addPlayer();var b=server.addPlayer();
        p.start(a,b,"crystal",1,false,null,new DuelRules(100,true,false,true,false,false));
        server.getScheduler().performTicks(61);
        int x=BattleMaps.get(100).cx();
        var anchor=p.world.getBlockAt(x,97,1024);anchor.setType(Material.RESPAWN_ANCHOR);
        var floor=p.world.getBlockAt(x,95,1024);floor.setType(Material.STONE);
        var wall=p.world.getBlockAt(x,100,1038);wall.setType(Material.STONE_BRICKS);
        var event=new org.bukkit.event.block.BlockExplodeEvent(anchor,anchor.getState(),new ArrayList<>(List.of(floor,wall)),1,ExplosionResult.DESTROY);
        server.getPluginManager().callEvent(event);
        assertEquals(List.of(floor),event.blockList());
    }
}
