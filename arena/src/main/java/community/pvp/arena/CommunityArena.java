package community.pvp.arena;

import java.io.File;
import java.util.*;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.*;
import org.bukkit.command.*;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.enchantments.Enchantment;
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

public class CommunityArena extends JavaPlugin implements TabCompleter {
  static final String[] KITS = {
    "sword",
    "axe",
    "uhc",
    "pot",
    "nethop",
    "smp",
    "mace",
    "mace_breach",
    "mace_density",
    "mace_spear",
    "diasmp",
    "bow"
  };
  final Map<UUID, String> queues = new LinkedHashMap<>();
  final Map<UUID, Match> matches = new HashMap<>();
  final Set<UUID> participants = new HashSet<>(), ffa = new HashSet<>();
  final Map<UUID, Invite> invites = new HashMap<>();
  final Set<UUID> frozen = new HashSet<>();
  final Set<Integer> occupied = new HashSet<>();
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

  record Invite(UUID sender, String kit, int rounds, long expires) {}

  final class Match {
    UUID a, b;
    String kit;
    int arena, target, sa, sb;
    boolean paused = true, ended;
    boolean ranked;
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
    return Component.text(s, NamedTextColor.LIGHT_PURPLE);
  }

  void tell(Player p, String s) {
    p.sendMessage(text("Arena » " + s));
  }

  boolean managed(Player p) {
    return participants.contains(p.getUniqueId());
  }

  boolean flag(Player p, String key, boolean fallback) {
    return data.getBoolean("players." + p.getUniqueId() + "." + key, fallback);
  }

  boolean busy(Player p) {
    return matches.containsKey(p.getUniqueId()) || social.spectators.containsKey(p.getUniqueId());
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
    dataFile = new File(getDataFolder(), "players.yml");
    data = new YamlConfiguration();
    try {
      if (dataFile.exists()) data.load(dataFile);
    } catch (Exception ex) {
      data = null;
      throw new IllegalStateException(
          "Refusing to overwrite unreadable players.yml; restore a backup", ex);
    }
    getConfig().addDefault("join-lobby", true);
    getConfig().options().copyDefaults(true);
    saveConfig();
    progression = new Progression(this);
    social = new Social(this);
    setup = new ArenaSetup(this);
    visuals = new ArenaVisuals(this);
    progression.refresh();
    world =
        new WorldCreator("community_arena")
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
    world.setSpawnLocation(0, 66, 0);
    getServer().getPluginManager().registerEvents(new ArenaEvents(this), this);
    for (String cmd :
        List.of(
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
            "pvpadmin")) getCommand(cmd).setTabCompleter(this);
    if (data.getBoolean("built-v1")) {
      ready = true;
    } else build();
    getServer()
        .getScheduler()
        .runTaskTimer(
            this,
            () -> {
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
    for (Match m : new HashSet<>(matches.values())) finish(m, null, "Server restart");
    for (UUID id : new HashSet<>(participants)) {
      Player p = Bukkit.getPlayer(id);
      if (p != null) restore(p);
    }
    if (visuals != null) visuals.close();
    save();
  }

  void build() {
    // Staged construction in a dedicated empty world; never modifies the survival world.
    new BukkitRunnable() {
      int section = 0, x = -32;

      public void run() {
        int radius = section == 5 ? 40 : 32, cx = section * 160;
        for (int n = 0; n < 2 && x <= radius; n++, x++)
          for (int z = -radius; z <= radius; z++) {
            Material floor =
                (Math.abs(x) == radius || Math.abs(z) == radius)
                    ? Material.POLISHED_BLACKSTONE_BRICKS
                    : ((x + z) % 9 == 0 ? Material.POLISHED_DEEPSLATE : Material.SMOOTH_STONE);
            world.getBlockAt(cx + x, 64, z).setType(floor, false);
            if (Math.abs(x) == radius || Math.abs(z) == radius)
              for (int y = 65; y < 75; y++)
                world
                    .getBlockAt(cx + x, y, z)
                    .setType(y == 65 ? Material.SEA_LANTERN : Material.TINTED_GLASS, false);
          }
        if (x > radius) {
          section++;
          x = section == 5 ? -40 : -32;
          if (section > 5) {
            ready = true;
            ArenaDecor.build(CommunityArena.this);
            data.set("built-v1", true);
            save();
            getLogger().info("Lobby, four duel arenas and FFA arena built.");
            if (getConfig().getBoolean("join-lobby", true))
              for (Player player : Bukkit.getOnlinePlayers()) if (!managed(player)) enter(player);
            cancel();
          }
        }
      }
    }.runTaskTimer(this, 1, 1);
  }

  Location loc(int section, int x, int z, float yaw) {
    return new Location(world, section * 160 + x + 0.5, 65, z + 0.5, yaw, 0);
  }

  void enter(Player p) {
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
    }
    lobby(p);
  }

  void clean(Player p) {
    p.setInvulnerable(false);
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
    p.sendPlayerListHeaderAndFooter(
        text("Minecraft PvP Community"),
        Component.text("mcpvpcommunity.minekeep.gg • Paper 1.21.11", NamedTextColor.GRAY));
  }

  void restore(Player p) {
    social.leave(p);
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
      data.set(key, null);
      save();
    }
    p.setScoreboard(Bukkit.getScoreboardManager().getMainScoreboard());
  }

  ItemStack item(Material m, String name, String action, String... lore) {
    ItemStack s = new ItemStack(m);
    ItemMeta meta = s.getItemMeta();
    meta.displayName(text(name));
    meta.lore(Arrays.stream(lore).map(v -> Component.text(v, NamedTextColor.GRAY)).toList());
    if (action != null)
      meta.getPersistentDataContainer().set(menuKey, PersistentDataType.STRING, action);
    s.setItemMeta(meta);
    return s;
  }

  void menu(Player p) {
    menu(p, false);
  }

  void menu(Player p, boolean ranked) {
    if (!managed(p)) enter(p);
    if (!managed(p) || busy(p)) return;
    Inventory inv =
        ArenaMenu.create(
            27, text(ranked ? "Ranked • choose your kit" : "Practice • choose your kit"));
    for (int i = 0; i < KITS.length; i++) {
      String k = KITS[i];
      Material m =
          k.startsWith("mace")
              ? Material.MACE
              : k.equals("bow")
                  ? Material.BOW
                  : k.equals("axe")
                      ? Material.DIAMOND_AXE
                      : k.equals("pot") || k.equals("nethop")
                          ? Material.POTION
                          : Material.DIAMOND_SWORD;
      long count = queues.values().stream().filter(k::equals).count();
      inv.setItem(
          i,
          item(
              m,
              k.replace('_', ' '),
              (ranked ? "ranked:" : "queue:") + k,
              "Waiting: " + count,
              "Click to join practice matchmaking",
              "Use /duel <player> " + k + " for a private duel"));
    }
    p.openInventory(inv);
  }

  void settings(Player p) {
    Inventory inv = ArenaMenu.create(9, text("Your arena settings"));
    int i = 0;
    for (String key : List.of("scoreboard", "invites", "hitsounds", "spectators"))
      inv.setItem(
          i++,
          item(
              Material.COMPARATOR,
              key + ": " + (flag(p, key, true) ? "on" : "off"),
              "setting:" + key,
              "Click to toggle; saved between sessions"));
    inv.setItem(
        8,
        item(
            Material.OAK_DOOR,
            "Return to the main world",
            "exit",
            "Your saved inventory will be restored"));
    p.openInventory(inv);
  }

  void action(Player p, String a) {
    if (a == null) return;
    if (!managed(p)) enter(p);
    if (!managed(p)) return;
    if (busy(p)) {
      tell(p, "Use /leave to end your session first.");
      return;
    }
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
      data.set("players." + p.getUniqueId() + "." + key, !flag(p, key, true));
      save();
      settings(p);
    }
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
        if (occupied.size() == 4) return;
        start(Bukkit.getPlayer(ids.get(i)), Bukkit.getPlayer(ids.get(i + 1)), k, 1);
      }
    }
  }

  void start(Player a, Player b, String k, int target) {
    start(a, b, k, target, false);
  }

  void start(Player a, Player b, String k, int target, boolean ranked) {
    if (!ready) return;
    if (a == null || b == null || a.equals(b) || busy(a) || busy(b)) return;
    if (!managed(a)) enter(a);
    if (!managed(b)) enter(b);
    if (!managed(a) || !managed(b)) return;
    int index = 1;
    while (occupied.contains(index) && index <= 4) index++;
    if (index > 4) {
      tell(a, "All four arenas are occupied. Try shortly.");
      return;
    }
    occupied.add(index);
    queues.remove(a.getUniqueId());
    queues.remove(b.getUniqueId());
    ffa.remove(a.getUniqueId());
    ffa.remove(b.getUniqueId());
    Match m = new Match(a, b, k, index, target);
    m.ranked = ranked;
    progression.remember(a);
    progression.remember(b);
    progression.beginDay(a.getUniqueId());
    progression.beginDay(b.getUniqueId());
    matches.put(m.a, m);
    matches.put(m.b, m);
    round(m);
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
    equip(a, m.kit);
    equip(b, m.kit);
    a.teleport(setup.duelSpawn(m.arena, true));
    b.teleport(setup.duelSpawn(m.arena, false));
    frozen.add(m.a);
    frozen.add(m.b);
    new BukkitRunnable() {
      int left = 3;

      public void run() {
        if (m.ended) {
          cancel();
          return;
        }
        if (left > 0) {
          for (Player p : List.of(a, b)) {
            p.showTitle(
                net.kyori.adventure.title.Title.title(
                    text("" + left),
                    Component.text(m.kit + " • " + m.sa + " : " + m.sb, NamedTextColor.GRAY)));
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
    m.paused = true;
    progression.add(loser.getUniqueId(), "deaths", 1);
    UUID winner = m.other(loser.getUniqueId());
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
    social.finish(m);
    for (UUID id : List.of(m.a, m.b)) {
      Player player = Bukkit.getPlayer(id);
      frozen.add(id);
      if (player != null) {
        player.setInvulnerable(true);
        player.getInventory().clear();
        if (id.equals(winner)) visuals.victory(player);
        else
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
          occupied.remove(m.arena);
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

  ItemStack gear(Material m, boolean armor) {
    ItemStack s = new ItemStack(m);
    ItemMeta meta = s.getItemMeta();
    meta.setUnbreakable(true);
    s.setItemMeta(meta);
    if (armor) s.addUnsafeEnchantment(Enchantment.PROTECTION, 2);
    return s;
  }

  void equip(Player p, String k) {
    clean(p);
    p.setInvulnerable(false);
    PlayerInventory inv = p.getInventory();
    boolean nether = k.equals("nethop") || k.equals("smp");
    String metal = nether ? "NETHERITE" : "DIAMOND";
    inv.setHelmet(gear(Material.valueOf(metal + "_HELMET"), true));
    inv.setChestplate(gear(Material.valueOf(metal + "_CHESTPLATE"), true));
    inv.setLeggings(gear(Material.valueOf(metal + "_LEGGINGS"), true));
    inv.setBoots(gear(Material.valueOf(metal + "_BOOTS"), true));
    ItemStack sword = gear(Material.valueOf(metal + "_SWORD"), false);
    sword.addUnsafeEnchantment(Enchantment.SHARPNESS, 3);
    inv.setItem(0, sword);
    if (k.equals("axe") || k.equals("smp") || k.equals("diasmp")) {
      inv.setItem(1, gear(Material.DIAMOND_AXE, false));
      inv.setItemInOffHand(new ItemStack(Material.SHIELD));
    }
    if (k.startsWith("mace")) {
      ItemStack mace = gear(Material.MACE, false);
      if (k.equals("mace_breach")) mace.addUnsafeEnchantment(Enchantment.BREACH, 4);
      else mace.addUnsafeEnchantment(Enchantment.DENSITY, 5);
      mace.addUnsafeEnchantment(Enchantment.WIND_BURST, 1);
      inv.setItem(0, mace);
      inv.setItem(1, sword);
      inv.setItem(2, new ItemStack(Material.WIND_CHARGE, 64));
      inv.setItem(3, new ItemStack(Material.GOLDEN_APPLE, 8));
      inv.getBoots().addUnsafeEnchantment(Enchantment.FEATHER_FALLING, 4);
      if (k.equals("mace_spear")) {
        Material spear = Material.matchMaterial("DIAMOND_SPEAR");
        if (spear != null) inv.setItem(4, gear(spear, false));
      }
    }
    if (k.equals("uhc") || k.equals("bow")) {
      inv.setItem(1, gear(Material.BOW, false));
      inv.setItem(2, new ItemStack(Material.ARROW, 64));
      inv.setItem(3, new ItemStack(Material.GOLDEN_APPLE, k.equals("bow") ? 4 : 8));
    }
    if (k.equals("pot") || k.equals("nethop")) {
      for (int i = 1; i < 36; i++) {
        ItemStack potion = new ItemStack(Material.SPLASH_POTION);
        PotionMeta meta = (PotionMeta) potion.getItemMeta();
        meta.setBasePotionType(PotionType.STRONG_HEALING);
        potion.setItemMeta(meta);
        inv.setItem(i, potion);
      }
      p.addPotionEffect(new PotionEffect(PotionEffectType.SPEED, 20 * 60 * 30, 1));
    }
    if (k.equals("smp") || k.equals("diasmp")) {
      inv.setItem(2, new ItemStack(Material.GOLDEN_APPLE, 16));
      inv.setItem(3, new ItemStack(Material.ENDER_PEARL, 8));
    }
    inv.setItem(8, new ItemStack(Material.COOKED_BEEF, 64));
    if (data.contains("kits." + k)) {
      List<?> saved = data.getList("kits." + k, List.of());
      inv.setContents(saved.toArray(new ItemStack[0]));
    }
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

  @Override
  public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
    if (!(sender instanceof Player p)) {
      sender.sendMessage(
          "CommunityArena ready="
              + ready
              + " arenas="
              + occupied.size()
              + " queue="
              + queues.size());
      return true;
    }
    String cmd = command.getName();
    if (commandTimes.getOrDefault(p.getUniqueId(), 0L) > System.currentTimeMillis()) return true;
    commandTimes.put(p.getUniqueId(), System.currentTimeMillis() + 250);
    switch (cmd) {
      case "ranked" -> {
        if (args.length == 0) menu(p, true);
        else progression.queue(p, args[0].toLowerCase(Locale.ROOT));
      }
      case "spec" -> social.spec(p, args);
      case "friends" -> social.friends(p, args);
      case "quests" -> progression.quests(p);
      case "cases" -> {
        if (busy(p)) tell(p, "Open cases in the lobby.");
        else progression.cases(p);
      }
      case "cosmetics" -> progression.cosmetics(p, args);
      case "leaderboard" -> visuals.leaderboard(p, args.length == 0 ? "elo" : args[0]);
      case "pvpadmin" -> setup.command(p, args);
      case "arena" -> {
        if (matches.containsKey(p.getUniqueId())) {
          tell(p, "Use /leave to concede your current match.");
          break;
        }
        enter(p);
      }
      case "play" -> {
        if (args.length == 0) menu(p);
        else queue(p, args[0].toLowerCase(Locale.ROOT));
      }
      case "ffa" -> {
        if (matches.containsKey(p.getUniqueId())) tell(p, "Finish your match first.");
        else joinFfa(p);
      }
      case "leave" -> {
        if (social.spectators.containsKey(p.getUniqueId())) {
          social.leave(p);
          lobby(p);
          break;
        }
        Match m = matches.get(p.getUniqueId());
        if (m != null) finish(m, m.other(p.getUniqueId()), "Conceded");
        else if (managed(p)) {
          lobby(p);
          tell(p, "Returned to lobby. /settings lets you leave the arena world.");
        }
      }
      case "stats" ->
          tell(
              p,
              progression.rank(p.getUniqueId())
                  + " | "
                  + progression.elo(p.getUniqueId())
                  + " Elo | "
                  + progression.number(p.getUniqueId(), "wins")
                  + " wins | "
                  + progression.number(p.getUniqueId(), "deaths")
                  + " deaths | Official tiers are reviewed separately on Discord.");
      case "settings" -> {
        if (!managed(p)) enter(p);
        if (managed(p) && !busy(p)) settings(p);
        else tell(p, "Open settings in the lobby.");
      }
      case "duel" -> {
        if (args.length >= 2 && args[0].equalsIgnoreCase("accept")) {
          Invite i = invites.get(p.getUniqueId());
          Player a = Bukkit.getPlayerExact(args[1]);
          if (i == null
              || a == null
              || !i.sender.equals(a.getUniqueId())
              || i.expires < System.currentTimeMillis()) {
            tell(p, "No matching active invitation.");
            break;
          }
          if (busy(p) || busy(a)) {
            tell(p, "One player is already in a match.");
            break;
          }
          invites.remove(p.getUniqueId());
          start(a, p, i.kit, i.rounds);
          break;
        }
        if (args.length < 2) {
          tell(p, "/duel <player> <kit> or /duel accept <player>");
          break;
        }
        if (args.length > 2 && (!args[2].matches("[1-9]|10"))) {
          tell(p, "Rounds must be first to 1..10.");
          break;
        }
        Player other = Bukkit.getPlayerExact(args[0]);
        String k = args[1].toLowerCase(Locale.ROOT);
        if (other == null || other.equals(p) || !kit(k) || !flag(other, "invites", true)) {
          tell(p, "Choose an online player accepting invitations and a valid /play kit.");
          break;
        }
        if (busy(p) || busy(other)) {
          tell(p, "One player is already in a match.");
          break;
        }
        Invite old = invites.get(other.getUniqueId());
        if (old != null && old.expires > System.currentTimeMillis()) {
          tell(p, "That player already has a pending invitation.");
          break;
        }
        invites.put(
            other.getUniqueId(),
            new Invite(
                p.getUniqueId(),
                k,
                args.length > 2 ? Integer.parseInt(args[2]) : 1,
                System.currentTimeMillis() + 60000));
        tell(
            other,
            p.getName()
                + " challenged you to "
                + k
                + ". /duel accept "
                + p.getName()
                + " within 60 seconds. First to "
                + (args.length > 2 ? args[2] : "1")
                + ".");
        tell(p, "Invitation sent.");
      }
      case "testmatch" -> {
        if (!p.hasPermission("communityarena.tester")) break;
        if (args.length != 3) {
          tell(
              p,
              "/testmatch <player1> <player2> <kit> — supervised first to ten; publish reviewed"
                  + " results in Discord.");
          break;
        }
        Player a = Bukkit.getPlayerExact(args[0]), b = Bukkit.getPlayerExact(args[1]);
        if (a == null || b == null || a.equals(b) || !kit(args[2])) {
          tell(p, "Choose two online players and a valid kit.");
          break;
        }
        start(a, b, args[2], 10);
      }
    }
    return true;
  }

  @Override
  public List<String> onTabComplete(CommandSender s, Command c, String a, String[] args) {
    List<String> opts = new ArrayList<>();
    if (c.getName().equals("play")
        || c.getName().equals("ranked")
        || c.getName().equals("duel") && args.length == 2
        || c.getName().equals("testmatch") && args.length == 3) opts.addAll(Arrays.asList(KITS));
    else if (c.getName().equals("duel") || c.getName().equals("testmatch")) {
      if (args.length == 1 && c.getName().equals("duel")) opts.add("accept");
      for (Player p : Bukkit.getOnlinePlayers()) opts.add(p.getName());
    }
    String last = args.length == 0 ? "" : args[args.length - 1].toLowerCase(Locale.ROOT);
    return opts.stream().filter(v -> v.toLowerCase(Locale.ROOT).startsWith(last)).toList();
  }
}
