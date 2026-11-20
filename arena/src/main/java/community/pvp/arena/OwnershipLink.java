package community.pvp.arena;

import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.bukkit.Bukkit;
import org.bukkit.command.*;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

/** Proof derives from the authenticated live Player, never a supplied UUID. */
final class OwnershipLink implements CommandExecutor {
  private final JavaPlugin plugin;
  private final Set<UUID> pending=ConcurrentHashMap.newKeySet();
  private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
  OwnershipLink(JavaPlugin plugin) {
    this.plugin=plugin;
    plugin.getConfig().addDefault("ownership.endpoint", "");
    plugin.getConfig().addDefault("ownership.secret", "");
    plugin.getConfig().options().copyDefaults(true);
    plugin.saveConfig();
    plugin.getCommand("linkdiscord").setExecutor(this);
  }
  @Override public boolean onCommand(CommandSender sender,Command command,String label,String[] args) {
    if(!(sender instanceof Player player)){sender.sendMessage("Run this command from your authenticated Minecraft account.");return true;}
    if(!Bukkit.getOnlineMode()){player.sendMessage("Account linking requires a directly authenticated online-mode server. Contact staff.");return true;}
    String endpoint=plugin.getConfig().getString("ownership.endpoint",""),secret=plugin.getConfig().getString("ownership.secret","");
    URI uri;
    try{uri=URI.create(endpoint);if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||!"/api/internal/ownership-proof".equals(uri.getPath())||secret.length()<32)throw new IllegalArgumentException();}
    catch(Exception e){player.sendMessage("Ownership verification is not configured. Contact staff.");return true;}
    if(args.length!=1||!args[0].matches("[a-f0-9]{32}")){player.sendMessage("Use /verify start in Discord, then /linkdiscord <private-code> here.");return true;}
    UUID uuid=player.getUniqueId();String name=player.getName();
    if(!pending.add(uuid)){player.sendMessage("Your verification is already being checked.");return true;}
    String body="{\"code\":\""+args[0]+"\",\"uuid\":\""+uuid+"\",\"name\":\""+name+"\"}";
    HttpRequest request=HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(10)).header("Authorization","Bearer "+secret).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build();
    client.sendAsync(request,HttpResponse.BodyHandlers.discarding()).whenComplete((response,error)->{
      pending.remove(uuid);
      if(plugin.isEnabled())Bukkit.getScheduler().runTask(plugin,()->{
        Player current=Bukkit.getPlayer(uuid);
        if(current!=null)current.sendMessage(error==null&&response.statusCode()==200?"Minecraft ownership verified. Return to Discord and select your Mace mode.":"Verification was not confirmed. Check /verify status in Discord; request a fresh code if needed.");
      });
    });
    player.sendMessage("Checking your ownership challenge…");return true;
  }
}
