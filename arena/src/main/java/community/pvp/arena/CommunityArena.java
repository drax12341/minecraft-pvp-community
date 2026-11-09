package community.pvp.arena;

import org.bukkit.*;
import org.bukkit.block.Block;
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
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import java.io.File;
import java.util.*;

public final class CommunityArena extends JavaPlugin implements Listener, TabCompleter {
  static final String[] KITS={"sword","axe","uhc","pot","nethop","smp","mace","mace_breach","mace_density","mace_spear","diasmp","bow"};
  final Map<UUID,String> queues=new LinkedHashMap<>();
  final Map<UUID,Match> matches=new HashMap<>();
  final Set<UUID> participants=new HashSet<>(), ffa=new HashSet<>();
  final Map<UUID,Invite> invites=new HashMap<>();
  final Set<UUID> frozen=new HashSet<>();
  final Set<Integer> occupied=new HashSet<>();
  World world; boolean ready; YamlConfiguration data; File dataFile;
  NamespacedKey menuKey;
  record Invite(UUID sender,String kit,long expires){}
  final class Match {
    UUID a,b; String kit; int arena,target,sa,sb; boolean paused=true,ended;
    long started=System.currentTimeMillis();
    Match(Player a,Player b,String kit,int arena,int target){this.a=a.getUniqueId();this.b=b.getUniqueId();this.kit=kit;this.arena=arena;this.target=target;}
    UUID other(UUID id){return id.equals(a)?b:a;}
  }
  Component text(String s){return Component.text(s,NamedTextColor.LIGHT_PURPLE);}
  void tell(Player p,String s){p.sendMessage(text("Arena » "+s));}
  boolean managed(Player p){return participants.contains(p.getUniqueId());}
  boolean flag(Player p,String key,boolean fallback){return data.getBoolean("players."+p.getUniqueId()+"."+key,fallback);}
  void save(){try{data.save(dataFile);}catch(Exception e){getLogger().severe("Could not save arena state: "+e.getMessage());}}
  @Override public void onEnable(){
    menuKey=new NamespacedKey(this,"action");getDataFolder().mkdirs();dataFile=new File(getDataFolder(),"players.yml");data=YamlConfiguration.loadConfiguration(dataFile);
    world=new WorldCreator("community_arena").generator(new ChunkGenerator(){@Override public boolean shouldGenerateNoise(){return false;}@Override public boolean shouldGenerateSurface(){return false;}@Override public boolean shouldGenerateCaves(){return false;}@Override public boolean shouldGenerateDecorations(){return false;}@Override public boolean shouldGenerateStructures(){return false;}@Override public boolean shouldGenerateMobs(){return false;}}).createWorld();
    world.setAutoSave(true);world.setTime(6000);world.setStorm(false);world.setDifficulty(Difficulty.NORMAL);world.setPVP(true);
    world.setGameRule(GameRule.DO_MOB_SPAWNING,false);world.setGameRule(GameRule.DO_DAYLIGHT_CYCLE,false);world.setGameRule(GameRule.DO_WEATHER_CYCLE,false);world.setGameRule(GameRule.DO_FIRE_TICK,false);world.setGameRule(GameRule.KEEP_INVENTORY,true);world.setSpawnLocation(0,66,0);
    getServer().getPluginManager().registerEvents(this,this);
    for(String cmd:List.of("arena","play","duel","leave","ffa","stats","settings","testmatch"))getCommand(cmd).setTabCompleter(this);
    if(data.getBoolean("built-v1")){ready=true;}else build();
    getServer().getScheduler().runTaskTimer(this,()->{matchQueues(); for(Match m:new HashSet<>(matches.values()))if(System.currentTimeMillis()-m.started>600000)finish(m,null,"Ten minute time limit"); for(UUID id:participants){Player p=Bukkit.getPlayer(id);if(p!=null)board(p);}invites.values().removeIf(i->i.expires<System.currentTimeMillis());},20,20);
    getServer().getScheduler().runTaskTimer(this,this::save,1200,1200);
    getLogger().info("CommunityArena enabled for Paper 1.21.11. Practice does not award tier placements.");
  }
  @Override public void onDisable(){for(Match m:new HashSet<>(matches.values()))finish(m,null,"Server restart");for(UUID id:new HashSet<>(participants)){Player p=Bukkit.getPlayer(id);if(p!=null)restore(p);}save();}
  void build(){
    // Staged construction in a dedicated empty world; never modifies the survival world.
    new BukkitRunnable(){int section=0,x=-32;public void run(){int radius=section==5?40:32,cx=section*160;
      for(int n=0;n<2&&x<=radius;n++,x++)for(int z=-radius;z<=radius;z++){
        Material floor=(Math.abs(x)==radius||Math.abs(z)==radius)?Material.POLISHED_BLACKSTONE_BRICKS:((x+z)%9==0?Material.POLISHED_DEEPSLATE:Material.SMOOTH_STONE);
        world.getBlockAt(cx+x,64,z).setType(floor,false);
        if(Math.abs(x)==radius||Math.abs(z)==radius)for(int y=65;y<75;y++)world.getBlockAt(cx+x,y,z).setType(y==65?Material.SEA_LANTERN:Material.TINTED_GLASS,false);
      }
      if(x>radius){section++;x=section==5?-40:-32;if(section>5){ready=true;data.set("built-v1",true);save();getLogger().info("Lobby, four duel arenas and FFA arena built.");cancel();}}
    }}.runTaskTimer(this,1,1);
  }
  Location loc(int section,int x,int z,float yaw){return new Location(world,section*160+x+0.5,65,z+0.5,yaw,0);}
  void enter(Player p){
    if(!ready){tell(p,"The arenas are being prepared. Try again shortly.");return;}
    if(!managed(p)){
      String key="backups."+p.getUniqueId();
      // A retained backup survives a crash and is never replaced by the practice inventory.
      if(!data.contains(key)){data.set(key+".inventory",Arrays.asList(p.getInventory().getContents()));data.set(key+".location",p.getLocation());data.set(key+".gamemode",p.getGameMode().name());data.set(key+".xp",p.getTotalExperience());save();}
      participants.add(p.getUniqueId());
    }
    lobby(p);
  }
  void clean(Player p){p.closeInventory();p.getInventory().clear();p.getInventory().setArmorContents(null);p.getInventory().setItemInOffHand(null);for(var effect:p.getActivePotionEffects())p.removePotionEffect(effect.getType());p.setGameMode(GameMode.ADVENTURE);p.setHealth(20);p.setFoodLevel(20);p.setSaturation(20);p.setFireTicks(0);p.setFallDistance(0);p.setLevel(0);p.setExp(0);p.setAllowFlight(false);}
  void lobby(Player p){queues.remove(p.getUniqueId());ffa.remove(p.getUniqueId());frozen.remove(p.getUniqueId());clean(p);p.teleport(loc(0,0,0,180));p.getInventory().setItem(0,item(Material.COMPASS,"Choose a practice kit","menu","Right-click to queue for an unranked duel"));p.getInventory().setItem(4,item(Material.IRON_SWORD,"Sword FFA","ffa","Right-click to enter free-for-all"));p.getInventory().setItem(8,item(Material.COMPARATOR,"Your settings","settings","Right-click to configure your experience"));p.sendPlayerListHeaderAndFooter(text("Minecraft PvP Community"),Component.text("mcpvpcommunity.minekeep.gg • Paper 1.21.11",NamedTextColor.GRAY));}
  void restore(Player p){
    String key="backups."+p.getUniqueId();participants.remove(p.getUniqueId());queues.remove(p.getUniqueId());ffa.remove(p.getUniqueId());frozen.remove(p.getUniqueId());
    if(data.contains(key)){
      clean(p);List<?> saved=data.getList(key+".inventory",List.of());p.getInventory().setContents(saved.toArray(new ItemStack[0]));Location back=data.getLocation(key+".location");if(back!=null)p.teleport(back);p.setGameMode(GameMode.valueOf(data.getString(key+".gamemode","SURVIVAL")));p.setExp(0);p.setLevel(0);p.giveExp(data.getInt(key+".xp"));data.set(key,null);save();
    }
    p.setScoreboard(Bukkit.getScoreboardManager().getMainScoreboard());
  }
  ItemStack item(Material m,String name,String action,String...lore){ItemStack s=new ItemStack(m);ItemMeta meta=s.getItemMeta();meta.displayName(text(name));meta.lore(Arrays.stream(lore).map(v->Component.text(v,NamedTextColor.GRAY)).toList());if(action!=null)meta.getPersistentDataContainer().set(menuKey,PersistentDataType.STRING,action);s.setItemMeta(meta);return s;}
  void menu(Player p){Inventory inv=Bukkit.createInventory(null,27,text("Practice • choose your kit"));for(int i=0;i<KITS.length;i++){String k=KITS[i];Material m=k.startsWith("mace")?Material.MACE:k.equals("bow")?Material.BOW:k.equals("axe")?Material.DIAMOND_AXE:k.equals("pot")||k.equals("nethop")?Material.POTION:Material.DIAMOND_SWORD;long count=queues.values().stream().filter(k::equals).count();inv.setItem(i,item(m,k.replace('_',' '),"queue:"+k,"Waiting: "+count,"Click to join practice matchmaking","Use /duel <player> "+k+" for a private duel"));}p.openInventory(inv);}
  void settings(Player p){Inventory inv=Bukkit.createInventory(null,9,text("Your arena settings"));int i=0;for(String key:List.of("scoreboard","invites","hitsounds"))inv.setItem(i++,item(Material.COMPARATOR,key+": "+(flag(p,key,true)?"on":"off"),"setting:"+key,"Click to toggle; saved between sessions"));inv.setItem(8,item(Material.OAK_DOOR,"Return to the main world","exit","Your saved inventory will be restored"));p.openInventory(inv);}
  void action(Player p,String a){if(a==null)return;if(a.equals("menu")){menu(p);return;}if(a.equals("settings")){settings(p);return;}if(a.equals("exit")){if(matches.containsKey(p.getUniqueId())){tell(p,"Use /leave to concede first.");return;}restore(p);return;}if(matches.containsKey(p.getUniqueId())){tell(p,"Finish or leave your match first.");return;}if(a.equals("ffa")){joinFfa(p);return;}if(a.startsWith("queue:")){queue(p,a.substring(6));return;}if(a.startsWith("setting:")){String key=a.substring(8);data.set("players."+p.getUniqueId()+"."+key,!flag(p,key,true));save();settings(p);}}
  boolean kit(String k){return Arrays.asList(KITS).contains(k);}
  void queue(Player p,String k){if(!kit(k)){tell(p,"Unknown kit. Use /play.");return;}if(!managed(p))enter(p);if(!managed(p))return;if(matches.containsKey(p.getUniqueId())){tell(p,"Already in a match.");return;}if(ffa.contains(p.getUniqueId()))lobby(p);queues.put(p.getUniqueId(),k);p.closeInventory();tell(p,"Queued for "+k+". /leave cancels. Practice never changes your tier.");matchQueues();}
  void matchQueues(){if(!ready)return;for(String k:KITS){List<UUID> ids=queues.entrySet().stream().filter(e->e.getValue().equals(k)&&Bukkit.getPlayer(e.getKey())!=null).map(Map.Entry::getKey).toList();for(int i=0;i+1<ids.size();i+=2){if(occupied.size()==4)return;start(Bukkit.getPlayer(ids.get(i)),Bukkit.getPlayer(ids.get(i+1)),k,1);}}}
  void start(Player a,Player b,String k,int target){if(a==null||b==null||a.equals(b)||matches.containsKey(a.getUniqueId())||matches.containsKey(b.getUniqueId()))return;if(!managed(a))enter(a);if(!managed(b))enter(b);if(!managed(a)||!managed(b))return;int index=1;while(occupied.contains(index)&&index<=4)index++;if(index>4){tell(a,"All four arenas are occupied. Try shortly.");return;}occupied.add(index);queues.remove(a.getUniqueId());queues.remove(b.getUniqueId());ffa.remove(a.getUniqueId());ffa.remove(b.getUniqueId());Match m=new Match(a,b,k,index,target);matches.put(m.a,m);matches.put(m.b,m);round(m);}
  void round(Match m){if(m.ended)return;Player a=Bukkit.getPlayer(m.a),b=Bukkit.getPlayer(m.b);if(a==null||b==null){finish(m,a==null?m.b:m.a,"Opponent disconnected");return;}m.paused=true;equip(a,m.kit);equip(b,m.kit);a.teleport(loc(m.arena,-18,0,-90));b.teleport(loc(m.arena,18,0,90));frozen.add(m.a);frozen.add(m.b);
    new BukkitRunnable(){int left=3;public void run(){if(m.ended){cancel();return;}if(left>0){for(Player p:List.of(a,b)){p.showTitle(net.kyori.adventure.title.Title.title(text(""+left),Component.text(m.kit+" • "+m.sa+" : "+m.sb,NamedTextColor.GRAY)));p.playSound(p.getLocation(),Sound.BLOCK_NOTE_BLOCK_HAT,0.6f,1);}left--;}else{m.paused=false;frozen.remove(m.a);frozen.remove(m.b);for(Player p:List.of(a,b))tell(p,"Fight! First to "+m.target+".");cancel();}}}.runTaskTimer(this,0,20);
  }
  void lost(Player loser,String why){Match m=matches.get(loser.getUniqueId());if(m==null||m.paused||m.ended)return;m.paused=true;UUID winner=m.other(loser.getUniqueId());if(winner.equals(m.a))m.sa++;else m.sb++;for(UUID id:List.of(m.a,m.b)){Player p=Bukkit.getPlayer(id);if(p!=null){p.setInvulnerable(true);frozen.add(id);tell(p,"Round: "+m.sa+" : "+m.sb+" • "+why);}}
    if(Math.max(m.sa,m.sb)>=m.target){finish(m,winner,why);return;}
    getServer().getScheduler().runTaskLater(this,()->{for(UUID id:List.of(m.a,m.b)){Player p=Bukkit.getPlayer(id);if(p!=null)p.setInvulnerable(false);}round(m);},40);
  }
  void finish(Match m,UUID winner,String reason){if(m.ended)return;m.ended=true;occupied.remove(m.arena);matches.remove(m.a);matches.remove(m.b);String name=winner==null?"No winner":Bukkit.getOfflinePlayer(winner).getName();
    for(UUID id:List.of(m.a,m.b)){Player p=Bukkit.getPlayer(id);if(winner!=null){String stat="players."+id+"."+(id.equals(winner)?"wins":"losses");data.set(stat,data.getInt(stat)+1);}if(p!=null){p.setInvulnerable(false);lobby(p);tell(p,name+" wins • "+m.sa+":"+m.sb+" • "+reason);}}
    getLogger().info("MATCH "+m.a+" / "+m.b+" kit="+m.kit+" score="+m.sa+":"+m.sb+" winner="+winner+" reason="+reason);save();
  }
  ItemStack gear(Material m,boolean armor){ItemStack s=new ItemStack(m);ItemMeta meta=s.getItemMeta();meta.setUnbreakable(true);s.setItemMeta(meta);if(armor)s.addUnsafeEnchantment(Enchantment.PROTECTION,2);return s;}
  void equip(Player p,String k){clean(p);p.setInvulnerable(false);PlayerInventory inv=p.getInventory();boolean nether=k.equals("nethop")||k.equals("smp");String metal=nether?"NETHERITE":"DIAMOND";inv.setHelmet(gear(Material.valueOf(metal+"_HELMET"),true));inv.setChestplate(gear(Material.valueOf(metal+"_CHESTPLATE"),true));inv.setLeggings(gear(Material.valueOf(metal+"_LEGGINGS"),true));inv.setBoots(gear(Material.valueOf(metal+"_BOOTS"),true));ItemStack sword=gear(Material.valueOf(metal+"_SWORD"),false);sword.addUnsafeEnchantment(Enchantment.SHARPNESS,3);inv.setItem(0,sword);
    if(k.equals("axe")||k.equals("smp")||k.equals("diasmp")){inv.setItem(1,gear(Material.DIAMOND_AXE,false));inv.setItemInOffHand(new ItemStack(Material.SHIELD));}
    if(k.startsWith("mace")){ItemStack mace=gear(Material.MACE,false);if(k.equals("mace_breach"))mace.addUnsafeEnchantment(Enchantment.BREACH,4);else mace.addUnsafeEnchantment(Enchantment.DENSITY,5);mace.addUnsafeEnchantment(Enchantment.WIND_BURST,1);inv.setItem(0,mace);inv.setItem(1,sword);inv.setItem(2,new ItemStack(Material.WIND_CHARGE,64));inv.setItem(3,new ItemStack(Material.GOLDEN_APPLE,8));inv.getBoots().addUnsafeEnchantment(Enchantment.FEATHER_FALLING,4);if(k.equals("mace_spear")){Material spear=Material.matchMaterial("DIAMOND_SPEAR");if(spear!=null)inv.setItem(4,gear(spear,false));}}
    if(k.equals("uhc")||k.equals("bow")){inv.setItem(1,gear(Material.BOW,false));inv.setItem(2,new ItemStack(Material.ARROW,64));inv.setItem(3,new ItemStack(Material.GOLDEN_APPLE,k.equals("bow")?4:8));}
    if(k.equals("pot")||k.equals("nethop")){for(int i=1;i<36;i++){ItemStack potion=new ItemStack(Material.SPLASH_POTION);PotionMeta meta=(PotionMeta)potion.getItemMeta();meta.setBasePotionType(PotionType.STRONG_HEALING);potion.setItemMeta(meta);inv.setItem(i,potion);}p.addPotionEffect(new PotionEffect(PotionEffectType.SPEED,20*60*30,1));}
    if(k.equals("smp")||k.equals("diasmp")){inv.setItem(2,new ItemStack(Material.GOLDEN_APPLE,16));inv.setItem(3,new ItemStack(Material.ENDER_PEARL,8));}
    inv.setItem(8,new ItemStack(Material.COOKED_BEEF,64));
  }
  void joinFfa(Player p){if(!managed(p))enter(p);if(!managed(p))return;queues.remove(p.getUniqueId());equip(p,"sword");ffa.add(p.getUniqueId());p.teleport(loc(5,new Random().nextInt(51)-25,new Random().nextInt(51)-25,0));p.setNoDamageTicks(60);tell(p,"Sword FFA • /leave returns to the lobby. Three seconds of spawn protection.");}
  void board(Player p){if(!flag(p,"scoreboard",true)){p.setScoreboard(Bukkit.getScoreboardManager().getMainScoreboard());return;}Scoreboard board=Bukkit.getScoreboardManager().getNewScoreboard();Objective o=board.registerNewObjective("arena",Criteria.DUMMY,text("PvP Community"));o.setDisplaySlot(DisplaySlot.SIDEBAR);Match m=matches.get(p.getUniqueId());String[] lines={"§7Paper 1.21.11","§r",m!=null?"§d"+m.kit+" §f"+m.sa+":"+m.sb:ffa.contains(p.getUniqueId())?"§dSword FFA":"§dPractice lobby","§7Queue: §f"+queues.size(),"§7Ping: §f"+p.getPing()+"ms","§7Wins: §f"+data.getInt("players."+p.getUniqueId()+".wins"),"§8/duel • /play • /leave"};for(int i=0;i<lines.length;i++)o.getScore(lines[i]).setScore(lines.length-i);p.setScoreboard(board);}
  @Override public boolean onCommand(CommandSender sender,Command command,String label,String[] args){if(!(sender instanceof Player p)){sender.sendMessage("CommunityArena ready="+ready+" arenas="+occupied.size()+" queue="+queues.size());return true;}String cmd=command.getName();switch(cmd){
    case "arena"->{if(matches.containsKey(p.getUniqueId())){tell(p,"Use /leave to concede your current match.");break;}enter(p);}
    case "play"->{if(args.length==0)menu(p);else queue(p,args[0].toLowerCase(Locale.ROOT));}
    case "ffa"->{if(matches.containsKey(p.getUniqueId()))tell(p,"Finish your match first.");else joinFfa(p);}
    case "leave"->{Match m=matches.get(p.getUniqueId());if(m!=null)finish(m,m.other(p.getUniqueId()),"Conceded");else if(managed(p)){lobby(p);tell(p,"Returned to lobby. /settings lets you leave the arena world.");}}
    case "stats"->tell(p,"Practice: "+data.getInt("players."+p.getUniqueId()+".wins")+" wins / "+data.getInt("players."+p.getUniqueId()+".losses")+" losses. Official tiers are reviewed on Discord.");
    case "settings"->settings(p);
    case "duel"->{if(args.length>=2&&args[0].equalsIgnoreCase("accept")){Invite i=invites.get(p.getUniqueId());Player a=Bukkit.getPlayerExact(args[1]);if(i==null||a==null||!i.sender.equals(a.getUniqueId())||i.expires<System.currentTimeMillis()){tell(p,"No matching active invitation.");break;}if(matches.containsKey(p.getUniqueId())||matches.containsKey(i.sender)){tell(p,"One player is already in a match.");break;}invites.remove(p.getUniqueId());start(a,p,i.kit,1);break;}if(args.length<2){tell(p,"/duel <player> <kit> or /duel accept <player>");break;}Player other=Bukkit.getPlayerExact(args[0]);String k=args[1].toLowerCase(Locale.ROOT);if(other==null||other.equals(p)||!kit(k)||!flag(other,"invites",true)){tell(p,"Choose an online player accepting invitations and a valid /play kit.");break;}if(matches.containsKey(p.getUniqueId())||matches.containsKey(other.getUniqueId())){tell(p,"One player is already in a match.");break;}Invite old=invites.get(other.getUniqueId());if(old!=null&&old.expires>System.currentTimeMillis()){tell(p,"That player already has a pending invitation.");break;}invites.put(other.getUniqueId(),new Invite(p.getUniqueId(),k,System.currentTimeMillis()+60000));tell(other,p.getName()+" challenged you to "+k+". /duel accept "+p.getName()+" within 60 seconds.");tell(p,"Invitation sent.");}
    case "testmatch"->{if(!p.hasPermission("communityarena.tester"))break;if(args.length!=3){tell(p,"/testmatch <player1> <player2> <kit> — supervised first to ten; publish reviewed results in Discord.");break;}Player a=Bukkit.getPlayerExact(args[0]),b=Bukkit.getPlayerExact(args[1]);if(a==null||b==null||a.equals(b)||!kit(args[2])){tell(p,"Choose two online players and a valid kit.");break;}start(a,b,args[2],10);}
  }return true;}
  @Override public List<String> onTabComplete(CommandSender s,Command c,String a,String[] args){List<String> opts=new ArrayList<>();if(c.getName().equals("play")||c.getName().equals("duel")&&args.length==2||c.getName().equals("testmatch")&&args.length==3)opts.addAll(Arrays.asList(KITS));else if(c.getName().equals("duel")||c.getName().equals("testmatch")){if(args.length==1&&c.getName().equals("duel"))opts.add("accept");for(Player p:Bukkit.getOnlinePlayers())opts.add(p.getName());}String last=args.length==0?"":args[args.length-1].toLowerCase(Locale.ROOT);return opts.stream().filter(v->v.toLowerCase(Locale.ROOT).startsWith(last)).toList();}
  @EventHandler public void join(PlayerJoinEvent e){Player p=e.getPlayer();if(data.contains("backups."+p.getUniqueId()))restore(p);getServer().getScheduler().runTaskLater(this,()->{if(p.isOnline())tell(p,"Welcome! /arena opens practice duels, kits and FFA. /duel challenges a friend.");},40);}
  @EventHandler public void quit(PlayerQuitEvent e){Player p=e.getPlayer();Match m=matches.get(p.getUniqueId());if(m!=null)finish(m,m.other(p.getUniqueId()),"Opponent disconnected");if(managed(p))restore(p);invites.remove(p.getUniqueId());}
  @EventHandler public void move(PlayerMoveEvent e){Player p=e.getPlayer();if(!managed(p))return;if(frozen.contains(p.getUniqueId())&&e.hasChangedPosition()){e.setTo(e.getFrom());return;}Match active=matches.get(p.getUniqueId());int section=active!=null?active.arena:ffa.contains(p.getUniqueId())?5:0;int radius=section==5?39:31;boolean outside=Math.abs(p.getLocation().getX()-section*160)>radius||Math.abs(p.getLocation().getZ())>radius;if(p.getLocation().getY()<50||outside){if(matches.containsKey(p.getUniqueId()))lost(p,"Out of bounds");else if(ffa.contains(p.getUniqueId()))joinFfa(p);else lobby(p);}}
  @EventHandler(priority=EventPriority.HIGHEST) public void damage(EntityDamageEvent e){if(!(e.getEntity() instanceof Player p)||!managed(p))return;Match m=matches.get(p.getUniqueId());if(m==null&&!ffa.contains(p.getUniqueId())||m!=null&&m.paused){e.setCancelled(true);return;}if(e instanceof EntityDamageByEntityEvent hit){Entity src=hit.getDamager();Player attacker=src instanceof Player a?a:src instanceof Projectile proj&&proj.getShooter() instanceof Player a?a:null;if(attacker!=null){if(m!=null&&!attacker.getUniqueId().equals(m.other(p.getUniqueId()))||m==null&&!ffa.contains(attacker.getUniqueId())){e.setCancelled(true);return;}if(flag(attacker,"hitsounds",true))attacker.playSound(attacker.getLocation(),Sound.BLOCK_NOTE_BLOCK_HAT,0.35f,1.4f);}}
    if(e.getFinalDamage()>=p.getHealth()){e.setCancelled(true);if(m!=null)lost(p,"Knockout");else{Player killer=p.getKiller();if(killer!=null)tell(killer,"Eliminated "+p.getName());joinFfa(p);}}
  }
  @EventHandler public void death(PlayerDeathEvent e){Player p=e.getEntity();if(!managed(p))return;e.getDrops().clear();e.setKeepInventory(true);e.setDroppedExp(0);Match m=matches.get(p.getUniqueId());if(m!=null)finish(m,m.other(p.getUniqueId()),"Death");}
  @EventHandler public void click(InventoryClickEvent e){if(!(e.getWhoClicked() instanceof Player p))return;String name=net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText().serialize(e.getView().title());if(!name.equals("Practice • choose your kit")&&!name.equals("Your arena settings"))return;e.setCancelled(true);if(e.getRawSlot()<0||e.getRawSlot()>=e.getView().getTopInventory().getSize())return;ItemStack s=e.getCurrentItem();if(s!=null&&s.hasItemMeta())getServer().getScheduler().runTask(this,()->action(p,s.getItemMeta().getPersistentDataContainer().get(menuKey,PersistentDataType.STRING)));}
  @EventHandler public void drag(InventoryDragEvent e){String name=net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText().serialize(e.getView().title());if(name.equals("Practice • choose your kit")||name.equals("Your arena settings"))e.setCancelled(true);}
  @EventHandler public void interact(PlayerInteractEvent e){Player p=e.getPlayer();if(!managed(p)||e.getItem()==null||!e.getAction().isRightClick())return;ItemMeta meta=e.getItem().getItemMeta();String a=meta==null?null:meta.getPersistentDataContainer().get(menuKey,PersistentDataType.STRING);if(a!=null){e.setCancelled(true);action(p,a);}}
  @EventHandler public void drop(PlayerDropItemEvent e){if(managed(e.getPlayer()))e.setCancelled(true);}
  @EventHandler public void pickup(EntityPickupItemEvent e){if(e.getEntity() instanceof Player p&&managed(p))e.setCancelled(true);}
  @EventHandler public void hunger(FoodLevelChangeEvent e){if(e.getEntity() instanceof Player p&&managed(p)){e.setCancelled(true);p.setFoodLevel(20);}}
  @EventHandler public void breakBlock(BlockBreakEvent e){if(e.getBlock().getWorld().equals(world))e.setCancelled(true);}
  @EventHandler public void placeBlock(BlockPlaceEvent e){if(e.getBlock().getWorld().equals(world))e.setCancelled(true);}
  @EventHandler public void explode(EntityExplodeEvent e){if(e.getLocation().getWorld().equals(world))e.blockList().clear();}
  @EventHandler public void explode(BlockExplodeEvent e){if(e.getBlock().getWorld().equals(world))e.blockList().clear();}
}
