package community.pvp.arena;

import java.io.File;
import java.util.*;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.*;
import org.bukkit.command.*;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.block.*;
import org.bukkit.event.entity.*;
import org.bukkit.event.inventory.*;
import org.bukkit.event.player.*;
import org.bukkit.generator.ChunkGenerator;
import org.bukkit.inventory.*;
import org.bukkit.inventory.meta.*;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.potion.*;
import org.bukkit.scheduler.BukkitRunnable;
import org.bukkit.scoreboard.*;

public class CommunityArena extends JavaPlugin {
    static final String[] KITS = {"sword", "axe", "uhc", "pot", "nethop", "smp", "crystal", "mace", "mace_spear"};
    final Map<UUID, String> queues = new LinkedHashMap<>();
    final Map<UUID, Match> matches = new HashMap<>();
    final Set<UUID> participants = new HashSet<>(), ffa = new HashSet<>();
    final Map<UUID, Invite> invites = new HashMap<>();
    final Set<UUID> frozen = new HashSet<>();
    final Set<Integer> occupied = new HashSet<>();
    MapWarmup warmup;
    DuelMenus duels;
    PracticeBots bots;
    Parties parties;
    PartyBattles partyBattles;
    PracticeInsights insights;
    PracticeInbox inbox;
    SavedKits savedKits;
    ReferenceMenus reference;
    PracticeMotion motion;
    PracticeMenus menus;
    KitLayouts layouts;
    ArenaTerrain terrain;
    PracticePresentation presentation;
    World citadel;
    World grove;
    boolean groveReady;
    java.util.function.Consumer<World> worldSaver = World::save;
    Progression progression;
    ArenaSetup setup;
    Social social;
    ArenaVisuals visuals;
    final Map<UUID, Long> commandTimes = new HashMap<>();
    World world;
    boolean ready;
    YamlConfiguration data;
    File dataFile;
    NamespacedKey menuKey;

    record Invite(UUID sender, String kit, int rounds, long expires, ItemStack[] custom, DuelRules rules) {
        Invite(UUID sender, String kit, int rounds, long expires, ItemStack[] custom) {
            this(sender, kit, rounds, expires, custom, DuelRules.defaults());
        }

        Invite(UUID sender, String kit, int rounds, long expires) {
            this(sender, kit, rounds, expires, null, DuelRules.defaults());
        }
    }

    final class Match {
        DuelRules rules = DuelRules.defaults();
        UUID a, b;
        ItemStack[] customEquipment;
        final Map<UUID, Integer> roundKills = new HashMap<>(), roundDeaths = new HashMap<>();
        String kit;
        int arena, target, sa, sb;
        boolean paused = true, ended;
        boolean ranked;
        final Set<UUID> readied = new HashSet<>();
        final Map<UUID, Integer> hits = new HashMap<>(), ratingDelta = new HashMap<>();
        boolean announced;
        long roundStarted = System.currentTimeMillis();
        long started = System.currentTimeMillis();

        Match(Player a, Player b, String kit, int arena, int target) {
            this.a = a.getUniqueId();
            this.b = b.getUniqueId();
            this.kit = kit;
            this.arena = arena;
            this.target = target;
        }

        UUID other(UUID id) {
            return id.equals(a) ? b : a;
        }
    }

    Component text(String s) {
        return Component.text(s, NamedTextColor.YELLOW);
    }

    void tell(Player p, String s) {
        p.sendMessage(
                Component.text("Practice ", NamedTextColor.YELLOW)
                        .append(Component.text("› " + s, NamedTextColor.GRAY)));
    }

    boolean managed(Player p) {
        return participants.contains(p.getUniqueId());
    }

    boolean flag(Player p, String key, boolean fallback) {
        return data.getBoolean("players." + p.getUniqueId() + "." + key, fallback);
    }

    boolean busy(Player p) {
        return (partyBattles != null && partyBattles.sessions.containsKey(p.getUniqueId())) || (bots != null && bots.sessions.containsKey(p.getUniqueId())) || matches.containsKey(p.getUniqueId()) || social.extra.containsKey(p.getUniqueId()) || social.spectators.containsKey(p.getUniqueId());
    }

    boolean save() {
        if (data == null) return false;
        try {
            java.nio.file.Path dest = dataFile.toPath(), tmp = dest.resolveSibling("players.yml.tmp");
            java.nio.file.Files.writeString(
                    tmp, data.saveToString(), java.nio.charset.StandardCharsets.UTF_8);
            try {
                java.nio.file.Files.move(
                        tmp,
                        dest,
                        java.nio.file.StandardCopyOption.ATOMIC_MOVE,
                        java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            } catch (java.nio.file.AtomicMoveNotSupportedException ex) {
                java.nio.file.Files.move(tmp, dest, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (Exception e) {
            getLogger().severe("Could not save arena state: " + e.getMessage());
            return false;
        }
        return true;
    }

    @Override
    public void onEnable() {
        new OwnershipLink(this);
        menuKey = new NamespacedKey(this, "action");
        getDataFolder().mkdirs();
        world = createPracticeWorld("community_arena_v7");
        if (new File(getServer().getWorldContainer(), "community_arena_v6").isDirectory())
            createPracticeWorld("community_arena_v6");
        if (new File(getServer().getWorldContainer(), "community_arena_v4").isDirectory())
            createPracticeWorld("community_arena_v4");
        if (new File(getServer().getWorldContainer(), "community_arena_v3").isDirectory())
            createPracticeWorld("community_arena_v3");
        citadel = createPracticeWorld("community_citadel_v7");
        if (new File(getServer().getWorldContainer(), "community_citadel_v6").isDirectory())
            createPracticeWorld("community_citadel_v6");
        if (new File(getServer().getWorldContainer(), "community_citadel_v4").isDirectory())
            createPracticeWorld("community_citadel_v4");
        citadel.setTime(6000);
        citadel.setPVP(false);
        citadel.setDifficulty(Difficulty.PEACEFUL);
        for (var rule :
                List.of(
                        GameRule.DO_MOB_SPAWNING,
                        GameRule.DO_DAYLIGHT_CYCLE,
                        GameRule.DO_WEATHER_CYCLE,
                        GameRule.DO_FIRE_TICK))
            citadel.setGameRule(rule, false);
        grove = createPracticeWorld("community_grove_v3");
        if (new File(getServer().getWorldContainer(), "community_arena").isDirectory())
            createPracticeWorld("community_arena");
        dataFile = new File(getDataFolder(), "players.yml");
        try {
            data = ArenaStorage.load(dataFile);
        } catch (Exception ex) {
            data = null;
            throw new IllegalStateException(
                    "Refusing to overwrite unreadable players.yml; restore a backup", ex);
        }
        getConfig().addDefault("join-lobby", true);
        getConfig().addDefault("maps.prewarm", true);
        getConfig().addDefault("ranked-rounds", 3);
        for (String kit : List.of("crystal", "smp", "nethop", "uhc"))
            getConfig().addDefault("rounds." + kit, 1);
        getConfig().addDefault("presentation.nametags", true);
        getConfig().addDefault("presentation.effects", true);
        getConfig().addDefault("presentation.hide-score-numbers", true);
        getConfig().addDefault("presentation.brand", "Community");
        getConfig().addDefault("presentation.region", "Standalone");
        getConfig().addDefault("presentation.footer", "/duel  /ranked  /profile");
        getConfig().options().copyDefaults(true);
        saveConfig();
        progression = new Progression(this);
        social = new Social(this);
        setup = new ArenaSetup(this);
        visuals = new ArenaVisuals(this);
        progression.refresh();
        menus = new PracticeMenus(this);
        layouts = new KitLayouts(this);
        insights = new PracticeInsights(this);
        inbox = new PracticeInbox(this);
        savedKits = new SavedKits(this);
        reference = new ReferenceMenus(this);
        motion = new PracticeMotion(this);
        duels = new DuelMenus(this);
        bots = new PracticeBots(this);
        parties = new Parties(this);
        partyBattles = new PartyBattles(this);
        new GoldenHeads(this);
        getServer().getPluginManager().registerEvents(new DuelEvents(this), this);
        grove.setTime(6000);
        grove.setGameRule(GameRule.DO_MOB_SPAWNING, false);
        grove.setGameRule(GameRule.DO_DAYLIGHT_CYCLE, false);
        grove.setGameRule(GameRule.DO_WEATHER_CYCLE, false);
        grove.setGameRule(GameRule.DO_FIRE_TICK, false);
        terrain = new ArenaTerrain(this);
        terrain.recoverV6();
        terrain.recoverV4();
        terrain.recoverLegacy();
        terrain.recover();
        presentation = new PracticePresentation(this);
        BattleMaps.build(this);
        warmup = new MapWarmup(this);
        warmup.start();
        groveReady = true;
        CitadelLobby.build(this);
        world.setAutoSave(true);
        world.setTime(6000);
        world.setStorm(false);
        world.setDifficulty(Difficulty.NORMAL);
        world.setPVP(true);
        world.setGameRule(GameRule.DO_MOB_SPAWNING, false);
        world.setGameRule(GameRule.DO_DAYLIGHT_CYCLE, false);
        world.setGameRule(GameRule.DO_WEATHER_CYCLE, false);
        world.setGameRule(GameRule.DO_FIRE_TICK, false);
        world.setGameRule(GameRule.KEEP_INVENTORY, true);
        world.setGameRule(GameRule.RANDOM_TICK_SPEED, 0);
        world.setSpawnLocation(0, 66, 0);
        getServer().getPluginManager().registerEvents(new ArenaEvents(this), this);
        ArenaCommands commands = new ArenaCommands(this);
        for (String cmd :
                List.of(
                        "party",
                        "arena",
                        "play",
                        "duel",
                        "leave",
                        "ffa",
                        "stats",
                        "settings",
                        "testmatch",
                        "ranked",
                        "spec",
                        "friends",
                        "quests",
                        "cases",
                        "cosmetics",
                        "leaderboard",
                        "pvpadmin",
                        "layout",
                        "profile",
                        "notifications",
                        "customkit",
                        "customduel",
                        "findplayer")) {
            getCommand(cmd).setExecutor(commands);
            getCommand(cmd).setTabCompleter(commands);
        }
        ready = groveReady;
        getServer()
                .getScheduler()
                .runTaskTimer(
                        this,
                        () -> {
                            presentation.tick();
                            matchQueues();
                            progression.match();
                            for (Match m : new HashSet<>(matches.values()))
                                if (System.currentTimeMillis() - m.started > 600000)
                                    finish(m, null, "Ten minute time limit");
                            for (UUID id : participants) {
                                Player p = Bukkit.getPlayer(id);
                                if (p != null) board(p);
                            }
                            invites.values().removeIf(i -> i.expires < System.currentTimeMillis());
                        },
                        20,
                        20);
        getServer().getScheduler().runTaskTimer(this, this::save, 1200, 1200);
        getServer().getScheduler().runTaskTimer(this, () -> visuals.refreshHolograms(), 100, 200);
        getLogger()
                .info("CommunityArena enabled for Paper 1.21.11. Practice does not award tier placements.");
    }

    @Override
    public void onDisable() {
        if (partyBattles != null) partyBattles.close();
        if (bots != null) bots.close();
        for (Match m : new HashSet<>(matches.values())) finish(m, null, "Server restart");
        for (UUID id : new HashSet<>(participants)) {
            Player p = Bukkit.getPlayer(id);
            if (p != null) restore(p);
        }
        if (terrain != null)
            for (int i = 1; i <= BattleMaps.LAST; i++)
                if (i != 5)
                    try {
                        terrain.reset(i);
                    } catch (Exception ex) {
                        getLogger().severe(ex.getMessage());
                    }
        if (motion != null) motion.close();
        if (presentation != null) presentation.close();
        if (visuals != null) visuals.close();
        save();
    }

    Location loc(int section, int x, int z, float yaw) {
        var map = BattleMaps.get(section);
        return new Location(world, (map == null ? section * 160 : map.cx()) + x + 0.5, 65, (map == null ? 0 : 1024) + z + 0.5, yaw, 0);
    }

    void enter(Player p) {
        if (!managed(p) && p.getItemOnCursor() != null && !p.getItemOnCursor().getType().isAir()) {
            tell(p, "Put the item held by your cursor into your inventory before entering practice.");
            return;
        }
        if (!ready) {
            tell(p, "The arenas are being prepared. Try again shortly.");
            return;
        }
        if (!managed(p)) {
            String key = "backups." + p.getUniqueId();
            // A retained backup survives a crash and is never replaced by the practice inventory.
            if (!data.contains(key)) {
                data.set(key + ".inventory", Arrays.asList(p.getInventory().getContents()));
                data.set(key + ".location", p.getLocation());
                data.set(key + ".gamemode", p.getGameMode().name());
                data.set(key + ".xp", p.getTotalExperience());
                data.set(key + ".health", p.getHealth());
                data.set(key + ".timeRelative", p.isPlayerTimeRelative());
                data.set(key + ".timeOffset", p.getPlayerTimeOffset());
                data.set(key + ".absorption", p.getAbsorptionAmount());
                data.set(key + ".food", p.getFoodLevel());
                data.set(key + ".saturation", p.getSaturation());
                data.set(key + ".effects", new ArrayList<>(p.getActivePotionEffects()));
                if (!save()) {
                    data.set(key, null);
                    tell(p, "Backup failed; your inventory was left untouched. Contact an operator.");
                    return;
                }
            }
            participants.add(p.getUniqueId());
            insights.join(p);
        }
        lobby(p);
    }

    void clean(Player p) {
        p.setInvulnerable(false);
        p.setNoDamageTicks(0);
        p.setAbsorptionAmount(0);
        p.setVelocity(new org.bukkit.util.Vector());
        p.closeInventory();
        p.getInventory().clear();
        p.getInventory().setArmorContents(new ItemStack[4]);
        p.getInventory().setItemInOffHand(null);
        for (var effect : p.getActivePotionEffects()) p.removePotionEffect(effect.getType());
        p.setGameMode(GameMode.ADVENTURE);
        p.setHealth(Math.min(20, p.getAttribute(org.bukkit.attribute.Attribute.MAX_HEALTH).getValue()));
        p.setFoodLevel(20);
        p.setSaturation(20);
        p.setFireTicks(0);
        p.setFallDistance(0);
        p.setLevel(0);
        p.setExp(0);
        p.setAllowFlight(false);
    }

    void lobby(Player p) {
        queues.remove(p.getUniqueId());
        ffa.remove(p.getUniqueId());
        frozen.remove(p.getUniqueId());
        clean(p);
        p.teleport(setup.spawn());
        progression.remember(p);
        progression.beginDay(p.getUniqueId());
        p.getInventory()
                .setItem(0, item(Material.IRON_SWORD, "Duels", "menu", "Right-click for unranked kits"));
        p.getInventory()
                .setItem(
                        1,
                        item(Material.NETHERITE_SWORD, "Ranked Duels", "ranked", "Climb Bronze to Netherite"));
        p.getInventory().setItem(2, item(Material.IRON_AXE, "Sword FFA", "ffa", "Free for all"));
        p.getInventory().setItem(3, item(Material.SPYGLASS, "Spectate", "spec", "Use /spec <player>"));
        p.getInventory()
                .setItem(4, item(Material.PLAYER_HEAD, "Friends", "friends", "Manage your friends"));
        p.getInventory()
                .setItem(5, item(Material.BOOK, "Daily Quests", "quests", "Earn cosmetic cases"));
        p.getInventory()
                .setItem(6, item(Material.ENDER_CHEST, "Cosmetic Cases", "cases", "Open your rewards"));
        p.getInventory()
                .setItem(
                        7, item(Material.GOLD_INGOT, "Leaderboards", "leaderboard", "Server Elo standings"));
        p.getInventory()
                .setItem(8, item(Material.REPEATER, "Settings", "settings", "Customize your experience"));
        p.getInventory()
                .setItem(
                        0, item(Material.CLOCK, "Navigation", "navigation", "Duels, ranked, rewards and more"));
        p.getInventory()
                .setItem(1, item(Material.IRON_SWORD, "Queue", "menu", "Choose your kit and queue"));
        p.getInventory().setItem(2, null);
        p.getInventory().setItem(3, null);
        p.getInventory().setItem(4, item(Material.REPEATER, "Settings", "settings"));
        p.getInventory().setItem(5, item(Material.ANVIL, "Kit Layout Editor", "layout-picker", "Right-click to arrange a reference kit"));
        p.getInventory().setItem(6, null);
        p.getInventory().setItem(7, item(Material.PLAYER_HEAD, "Your Profile", "profile"));
        p.getInventory().setItem(8, item(Material.BOOK, "Rewards", "rewards"));
        reference.applyTime(p);
        board(p);
        if (presentation != null) presentation.tick();
    }

    void restore(Player p) {
        if (insights != null && managed(p)) insights.leave(p);
        if (motion != null) motion.leave(p);
        p.resetPlayerTime();
        if (presentation != null) presentation.restore(p);
        social.spectators.remove(p.getUniqueId());
        visuals.boards.remove(p.getUniqueId());
        p.playerListName(null);
        p.sendPlayerListHeaderAndFooter(Component.empty(), Component.empty());
        String key = "backups." + p.getUniqueId();
        participants.remove(p.getUniqueId());
        queues.remove(p.getUniqueId());
        ffa.remove(p.getUniqueId());
        frozen.remove(p.getUniqueId());
        if (data.contains(key)) {
            clean(p);
            List<?> saved = data.getList(key + ".inventory", List.of());
            p.getInventory().setContents(saved.toArray(new ItemStack[0]));
            Location back = data.getLocation(key + ".location");
            if (back != null) p.teleport(back);
            p.setGameMode(GameMode.valueOf(data.getString(key + ".gamemode", "SURVIVAL")));
            p.setExp(0);
            p.setLevel(0);
            p.giveExp(data.getInt(key + ".xp"));
            p.setHealth(
                    Math.min(
                            p.getAttribute(org.bukkit.attribute.Attribute.MAX_HEALTH).getValue(),
                            data.getDouble(key + ".health", 20)));
            p.setFoodLevel(data.getInt(key + ".food", 20));
            p.setSaturation((float) data.getDouble(key + ".saturation", 5));
            for (Object effect : data.getList(key + ".effects", List.of()))
                if (effect instanceof PotionEffect potion) p.addPotionEffect(potion);
            p.setAbsorptionAmount(data.getDouble(key + ".absorption", 0));
            if (data.contains(key + ".timeRelative"))
                p.setPlayerTime(data.getLong(key + ".timeOffset"), data.getBoolean(key + ".timeRelative"));
            data.set(key, null);
            save();
        }
        p.setScoreboard(Bukkit.getScoreboardManager().getMainScoreboard());
    }

    ItemStack item(Material m, String name, String action, String... lore) {
        ItemStack s = new ItemStack(m);
        ItemMeta meta = s.getItemMeta();
        meta.displayName(
                PracticePresentation.ui(name).decoration(net.kyori.adventure.text.format.TextDecoration.ITALIC, false));
        meta.lore(
                Arrays.stream(lore)
                        .map(
                                v ->
                                        PracticePresentation.ui("§7" + v)
                                                .decoration(net.kyori.adventure.text.format.TextDecoration.ITALIC, false))
                        .toList());
        if (action != null)
            meta.getPersistentDataContainer().set(menuKey, PersistentDataType.STRING, action);
        s.setItemMeta(meta);
        return s;
    }

    void menu(Player p) {
        menu(p, false);
    }

    void menu(Player p, boolean ranked) {
        menus.kits(p, ranked);
    }

    void settings(Player p) {
        menus.settings(p);
    }

    void action(Player p, String a) {
        if (a == null) return;
        if (!managed(p)) enter(p);
        if (!managed(p)) return;
        if (busy(p)) {
            tell(p, "Use /leave to end your session first.");
            return;
        }
        if (a.equals("layout-picker")) {
            layouts.picker(p);
            return;
        }
        if (reference.handle(p, a, false, false)) return;
        if (a.equals("queues-both")) {
            reference.queues(p, "both");
            return;
        }
        if (menusAction(p, a)) return;
        if (a.equals("ranked")) {
            menu(p, true);
            return;
        }
        if (a.startsWith("ranked:")) {
            progression.queue(p, a.substring(7));
            return;
        }
        if (a.equals("quests")) {
            progression.quests(p);
            return;
        }
        if (a.equals("cases")) {
            progression.cases(p);
            return;
        }
        if (a.equals("friends")) {
            social.friends(p, new String[0]);
            return;
        }
        if (a.equals("spec")) {
            social.spec(p, new String[0]);
            return;
        }
        if (a.equals("leaderboard")) {
            visuals.leaderboard(p, "elo");
            return;
        }
        if (a.equals("menu")) {
            menu(p);
            return;
        }
        if (a.equals("settings")) {
            settings(p);
            return;
        }
        if (a.equals("exit")) {
            if (matches.containsKey(p.getUniqueId())) {
                tell(p, "Use /leave to concede first.");
                return;
            }
            restore(p);
            return;
        }
        if (matches.containsKey(p.getUniqueId())) {
            tell(p, "Finish or leave your match first.");
            return;
        }
        if (a.equals("ffa")) {
            joinFfa(p);
            return;
        }
        if (a.startsWith("queue:")) {
            queue(p, a.substring(6));
            return;
        }
        if (a.startsWith("setting:")) {
            String key = a.substring(8);
            if (!Set.of(
                            "scoreboard",
                            "invites",
                            "hitsounds",
                            "spectators",
                            "nametags",
                            "health",
                            "chat",
                            "victory",
                            "animations")
                    .contains(key)) return;
            data.set("players." + p.getUniqueId() + "." + key, !flag(p, key, true));
            save();
            settings(p);
        }
    }

    void handleMenuClick(Player player, String action, boolean reverse, boolean reset) {
        if (!managed(player)) enter(player);
        if (!managed(player) || busy(player)) return;
        if (duels.handle(player, action, reverse)) return;
        if ("layout-picker".equals(action)) {
            layouts.picker(player);
            return;
        }
        if (reference.handle(player, action, reverse, reset)) return;
        action(player, action);
    }

    boolean menusAction(Player p, String a) {
        if (a.equals("navigation")) {
            menus.hub(p);
            return true;
        }
        if (a.equals("profile")) {
            presentation.profile(p);
            return true;
        }
        if (a.equals("rewards")) {
            menus.rewards(p);
            return true;
        }
        if (a.equals("cosmetics-menu")) {
            menus.cosmetics(p);
            return true;
        }
        if (a.startsWith("cosmetic:")) {
            progression.cosmetics(p, new String[]{a.substring(9)});
            menus.cosmetics(p);
            return true;
        }
        if (a.equals("cancel-queue")) {
            queues.remove(p.getUniqueId());
            tell(p, "Queue cancelled.");
            p.closeInventory();
            return true;
        }
        if (a.startsWith("kit:")) {
            String[] v = a.split(":");
            if (v.length == 3) menus.kit(p, v[2], v[1].equals("r"));
            return true;
        }
        if (a.startsWith("layout:")) {
            layouts.open(p, a.substring(7));
            return true;
        }
        if (a.equals("spec") || a.equals("spectate-menu")) {
            menus.spectators(p);
            return true;
        }
        if (a.startsWith("watch:")) {
            p.closeInventory();
            social.spec(p, new String[]{a.substring(6)});
            return true;
        }
        if (a.equals("leaderboard") || a.startsWith("leaders:")) {
            menus.leaderboard(p, a.equals("leaderboard") ? "elo" : a.substring(8));
            return true;
        }
        return false;
    }

    int rankedRounds(String kit) {
        String key = "rounds." + kit;
        return Math.max(
                1,
                Math.min(
                        10,
                        getConfig().contains(key)
                                ? getConfig().getInt(key)
                                : getConfig().getInt("ranked-rounds", 3)));
    }

    World createPracticeWorld(String name) {
        if (name.equals("community_arena_v7"))
            return new WorldCreator(name).generator(new BattleGenerator()).createWorld();
        if (name.equals("community_arena_v6"))
            return new WorldCreator(name).generator(new BattleGenerator(false)).createWorld();
        if (name.equals("community_citadel_v7"))
            return new WorldCreator(name).generator(new CourtyardGenerator()).createWorld();
        if (name.equals("community_citadel_v6"))
            return new WorldCreator(name).generator(new CourtyardGenerator(false)).createWorld();
        return new WorldCreator(name)
                .generator(
                        new ChunkGenerator() {
                            @Override
                            public boolean shouldGenerateNoise() {
                                return false;
                            }

                            @Override
                            public boolean shouldGenerateSurface() {
                                return false;
                            }

                            @Override
                            public boolean shouldGenerateCaves() {
                                return false;
                            }

                            @Override
                            public boolean shouldGenerateDecorations() {
                                return false;
                            }

                            @Override
                            public boolean shouldGenerateStructures() {
                                return false;
                            }

                            @Override
                            public boolean shouldGenerateMobs() {
                                return false;
                            }
                        })
                .createWorld();
    }

    boolean kit(String k) {
        return Arrays.asList(KITS).contains(k);
    }

    void queue(Player p, String k) {
        if (busy(p)) {
            tell(p, "Leave your current session first.");
            return;
        }
        if (!kit(k)) {
            tell(p, "Unknown kit. Use /play.");
            return;
        }
        if (!managed(p)) enter(p);
        if (!managed(p)) return;
        if (matches.containsKey(p.getUniqueId())) {
            tell(p, "Already in a match.");
            return;
        }
        if (ffa.contains(p.getUniqueId())) lobby(p);
        progression.queuedAt.put(p.getUniqueId(), System.currentTimeMillis());
        queues.put(p.getUniqueId(), k);
        p.closeInventory();
        tell(p, "Queued for " + k + ". /leave cancels. Practice never changes your tier.");
        matchQueues();
    }

    void matchQueues() {
        if (!ready) return;
        for (String k : KITS) {
            List<UUID> ids =
                    queues.entrySet().stream()
                            .filter(e -> e.getValue().equals(k) && Bukkit.getPlayer(e.getKey()) != null)
                            .map(Map.Entry::getKey)
                            .toList();
            for (int i = 0; i + 1 < ids.size(); i += 2) {
                if (freeArena(k) == 0) return;
                start(Bukkit.getPlayer(ids.get(i)), Bukkit.getPlayer(ids.get(i + 1)), k, 1);
            }
        }
    }

    int freeArena(String kit) {
        if (data.getBoolean("built-battle-maps-v5"))
            return BattleMaps.all().stream().filter(m -> m.supports(kit) && !occupied.contains(m.id())).mapToInt(BattleMaps.MapInfo::id).findFirst().orElse(0);
        return java.util.stream.IntStream.rangeClosed(1, 4).filter(i -> !occupied.contains(i)).findFirst().orElse(0);
    }

    void start(Player a, Player b, String k, int target) {
        start(a, b, k, target, false);
    }

    void start(Player a, Player b, String k, int target, boolean ranked) {
        start(a, b, k, target, ranked, null);
    }

    void start(Player a, Player b, String k, int target, boolean ranked, ItemStack[] custom) {
        start(a, b, k, target, ranked, custom, DuelRules.defaults());
    }

    void start(Player a, Player b, String k, int target, boolean ranked, ItemStack[] custom, DuelRules rules) {
        if (custom != null && (ranked || custom.length != 41))
            throw new IllegalArgumentException("Custom sets must be unranked with 41 equipment slots");
        if (!ready || (custom == null && !kit(k))) return;
        if (a == null || b == null || a.equals(b) || busy(a) || busy(b)) return;
        if (!managed(a)) enter(a);
        if (!managed(b)) enter(b);
        if (!managed(a) || !managed(b)) return;
        int index = freeArena(k);
        if (index == 0 && rules.map() == 0) {
            tell(a, "All compatible arenas are occupied. Try shortly.");
            return;
        }
        if (rules.map() != 0) {
            var chosen = BattleMaps.get(rules.map());
            if (chosen == null || !chosen.supports(k) || !data.getBoolean("built-battle-maps-v5") || occupied.contains(chosen.id())) {
                tell(a, "Selected map is unavailable. Choose another map.");
                return;
            }
            index = chosen.id();
        }
        occupied.add(index);
        queues.remove(a.getUniqueId());
        queues.remove(b.getUniqueId());
        ffa.remove(a.getUniqueId());
        ffa.remove(b.getUniqueId());
        Match m = new Match(a, b, k, index, target);
        m.rules = new DuelRules(index, rules.pearlsWalls(), rules.responsive(), rules.spectators(), rules.igniteTnt(), rules.loot());
        m.ranked = ranked;
        m.customEquipment = custom == null ? null : SavedKits.copy(custom);
        progression.remember(a);
        progression.remember(b);
        progression.beginDay(a.getUniqueId());
        progression.beginDay(b.getUniqueId());
        matches.put(m.a, m);
        matches.put(m.b, m);
        round(m);
        presentation.tick();
    }

    void round(Match m) {
        if (m.ended) return;
        for (Entity entity : world.getNearbyEntities(loc(m.arena, 0, 0, 0), 34, 30, 34))
            if (entity instanceof Projectile
                    || entity instanceof Item
                    || entity instanceof AreaEffectCloud) entity.remove();
        Player a = Bukkit.getPlayer(m.a), b = Bukkit.getPlayer(m.b);
        if (a == null || b == null) {
            finish(m, a == null ? m.b : m.a, "Opponent disconnected");
            return;
        }
        m.paused = true;
        m.readied.clear();
        m.hits.clear();
        m.roundStarted = System.currentTimeMillis();
        terrain.clearEntities(m.arena);
        try {
            terrain.reset(m.arena);
        } catch (Exception ex) {
            getLogger().severe(ex.getMessage());
            finish(m, null, "Arena recovery required");
            return;
        }
        if (m.customEquipment == null) {
            equip(a, m.kit);
            equip(b, m.kit);
        } else {
            savedKits.equip(a, m.customEquipment);
            savedKits.equip(b, m.customEquipment);
        }
        a.teleport(BattleMaps.get(m.arena) == null ? setup.duelSpawn(m.arena, true) : BattleMaps.spawn(this, m.arena, true));
        b.teleport(BattleMaps.get(m.arena) == null ? setup.duelSpawn(m.arena, false) : BattleMaps.spawn(this, m.arena, false));
        frozen.add(m.a);
        frozen.add(m.b);
        if (!m.announced) {
            m.announced = true;
            presentation.matchIntro(m);
        }
        new BukkitRunnable() {
            int left = 3;

            public void run() {
                if (m.ended) {
                    cancel();
                    return;
                }
                if (left > 0 && m.readied.size() < 2) {
                    for (Player p : List.of(a, b)) {
                        p.showTitle(
                                net.kyori.adventure.title.Title.title(
                                        text("" + left),
                                        Component.text(m.kit + " • " + m.sa + " : " + m.sb, NamedTextColor.GRAY)));
                        p.sendActionBar(text("Sneak to ready • " + m.readied.size() + "/2"));
                        p.playSound(p.getLocation(), Sound.BLOCK_NOTE_BLOCK_HAT, 0.6f, 1);
                    }
                    left--;
                } else {
                    m.paused = false;
                    frozen.remove(m.a);
                    frozen.remove(m.b);
                    for (Player p : List.of(a, b)) {
                        p.showTitle(
                                net.kyori.adventure.title.Title.title(
                                        Component.text("GO!", NamedTextColor.GREEN), text("First to " + m.target)));
                        p.playSound(p.getLocation(), Sound.ENTITY_PLAYER_LEVELUP, 0.7f, 1.5f);
                    }
                    cancel();
                }
            }
        }.runTaskTimer(this, 0, 20);
    }

    void lost(Player loser, String why) {
        Match m = matches.get(loser.getUniqueId());
        if (m == null || m.paused || m.ended) return;
        DuelEvents.dropLoot(this, loser, m);
        m.paused = true;
        m.roundDeaths.merge(loser.getUniqueId(), 1, Integer::sum);
        progression.add(loser.getUniqueId(), "deaths", 1);
        UUID winner = m.other(loser.getUniqueId());
        m.roundKills.merge(winner, 1, Integer::sum);
        progression.add(winner, "kills", 1);
        if (winner.equals(m.a)) m.sa++;
        else m.sb++;
        for (UUID id : List.of(m.a, m.b)) {
            Player p = Bukkit.getPlayer(id);
            if (p != null) {
                p.setInvulnerable(true);
                frozen.add(id);
                tell(p, "Round: " + m.sa + " : " + m.sb + " • " + why);
            }
        }
        if (Math.max(m.sa, m.sb) >= m.target) {
            finish(m, winner, why);
            return;
        }
        getServer()
                .getScheduler()
                .runTaskLater(
                        this,
                        () -> {
                            for (UUID id : List.of(m.a, m.b)) {
                                Player p = Bukkit.getPlayer(id);
                                if (p != null) p.setInvulnerable(false);
                            }
                            round(m);
                        },
                        40);
    }

    void finish(Match m, UUID winner, String reason) {
        if (m.ended) return;
        m.ended = true;
        m.paused = true;
        progression.result(m, winner);
        presentation.matchResult(m, winner, reason);
        social.finish(m);
        for (UUID id : List.of(m.a, m.b)) {
            Player player = Bukkit.getPlayer(id);
            frozen.add(id);
            if (player != null) {
                player.setInvulnerable(true);
                player.getInventory().clear();
                if (id.equals(winner)) {
                    motion.result(m, player, true);
                } else {
                    motion.result(m, player, false);
                }
                if (winner == null)
                    player.showTitle(
                            net.kyori.adventure.title.Title.title(
                                    text(winner == null ? "DRAW" : "DEFEAT"), text(reason)));
                tell(
                        player,
                        (winner == null ? "No winner" : progression.name(winner) + " wins")
                                + " | "
                                + m.sa
                                + ":"
                                + m.sb
                                + " | "
                                + reason);
            }
        }
        Runnable release =
                () -> {
                    terrain.clearEntities(m.arena);
                    try {
                        terrain.reset(m.arena);
                        occupied.remove(m.arena);
                    } catch (Exception ex) {
                        getLogger().severe(ex.getMessage());
                    }
                    for (UUID id : List.of(m.a, m.b)) {
                        if (matches.remove(id, m)) {
                            frozen.remove(id);
                            Player player = Bukkit.getPlayer(id);
                            if (player != null && managed(player)) lobby(player);
                        }
                    }
                };
        if (isEnabled()) getServer().getScheduler().runTaskLater(this, release, 60);
        else release.run();
        getLogger()
                .info(
                        "MATCH "
                                + m.a
                                + " / "
                                + m.b
                                + " ranked="
                                + m.ranked
                                + " kit="
                                + m.kit
                                + " winner="
                                + winner
                                + " reason="
                                + reason);
        save();
    }

    void equip(Player p, String k) {
        Loadouts.equip(this, p, k);
    }

    void joinFfa(Player p) {
        if (!managed(p)) enter(p);
        if (!managed(p)) return;
        queues.remove(p.getUniqueId());
        equip(p, "sword");
        ffa.add(p.getUniqueId());
        p.teleport(loc(5, new Random().nextInt(51) - 25, new Random().nextInt(51) - 25, 0));
        p.setNoDamageTicks(60);
        tell(p, "Sword FFA • /leave returns to the lobby. Three seconds of spawn protection.");
    }

    void board(Player p) {
        visuals.board(p);
    }
}
