package community.pvp.arena;

import java.util.*;
import org.bukkit.*;
import org.bukkit.entity.Player;
import org.bukkit.event.*;
import org.bukkit.event.player.*;

final class Social implements Listener {
  final CommunityArena p;
  final Map<UUID, CommunityArena.Match> spectators = new HashMap<>();
  final Map<UUID, Request> requests = new HashMap<>();

  record Request(UUID from, long expires) {}

  Social(CommunityArena p) {
    this.p = p;
    Bukkit.getPluginManager().registerEvents(this, p);
  }

  void spec(Player viewer, String[] args) {
    if (args.length == 0) {
      p.tell(
          viewer,
          "/spec <player> | /leave. Live matches: "
              + p.matches.entrySet().stream()
                  .filter(e -> !e.getValue().ended)
                  .map(e -> p.progression.name(e.getKey()))
                  .toList());
      return;
    }
    if (p.busy(viewer)) {
      p.tell(viewer, "Leave the current session first.");
      return;
    }
    Player target = Bukkit.getPlayerExact(args[0]);
    var match = target == null ? null : p.matches.get(target.getUniqueId());
    if (match == null || match.ended || !p.flag(target, "spectators", true)) {
      p.tell(viewer, "No spectatable match for that player.");
      return;
    }
    Player other = Bukkit.getPlayer(match.other(target.getUniqueId()));
    if (other == null || !p.flag(other, "spectators", true)) {
      p.tell(viewer, "Spectating is disabled for this match.");
      return;
    }
    if (!p.managed(viewer)) p.enter(viewer);
    if (!p.managed(viewer)) return;
    p.queues.remove(viewer.getUniqueId());
    p.ffa.remove(viewer.getUniqueId());
    p.clean(viewer);
    spectators.put(viewer.getUniqueId(), match);
    viewer.setGameMode(GameMode.SPECTATOR);
    viewer.teleport(target.getLocation().clone().add(0, 4, 0));
    for (UUID id : List.of(match.a, match.b)) {
      Player fighter = Bukkit.getPlayer(id);
      if (fighter != null) fighter.hidePlayer(p, viewer);
    }
    p.tell(viewer, "Spectating " + target.getName() + " | /leave to return.");
    p.presentation.tick();
  }

  void leave(Player player) {
    spectators.remove(player.getUniqueId());
    for (Player other : Bukkit.getOnlinePlayers()) other.showPlayer(p, player);
  }

  void finish(CommunityArena.Match match) {
    for (UUID id : new HashSet<>(spectators.keySet()))
      if (spectators.get(id) == match) {
        Player viewer = Bukkit.getPlayer(id);
        spectators.remove(id);
        if (viewer != null) {
          leave(viewer);
          p.lobby(viewer);
          p.tell(viewer, "Match ended.");
        }
      }
  }

  List<String> friends(UUID id) {
    return p.data.getStringList("players." + id + ".friends");
  }

  void friends(Player player, String[] args) {
    UUID id = player.getUniqueId();
    requests.values().removeIf(r -> r.expires < System.currentTimeMillis());
    if (args.length < 2) {
      p.tell(
          player,
          "Friends: "
              + friends(id).stream().map(UUID::fromString).map(p.progression::name).toList()
              + " | /friends add|accept|remove <online-player>");
      return;
    }
    Player target = Bukkit.getPlayerExact(args[1]);
    if (target == null || target.equals(player)) {
      p.tell(player, "Choose another online player.");
      return;
    }
    UUID tid = target.getUniqueId();
    var own = new ArrayList<>(friends(id));
    var theirs = new ArrayList<>(friends(tid));
    switch (args[0].toLowerCase(Locale.ROOT)) {
      case "add" -> {
        if (own.contains(tid.toString()) || own.size() >= 100 || theirs.size() >= 100) {
          p.tell(player, "Already friends or friend limit reached (100).");
          return;
        }
        if (requests.containsKey(tid)) {
          p.tell(player, "That player already has a pending request.");
          return;
        }
        requests.put(tid, new Request(id, System.currentTimeMillis() + 60000));
        p.tell(
            target, player.getName() + " wants to be friends. /friends accept " + player.getName());
        p.tell(player, "Request sent for 60 seconds.");
        return;
      }
      case "accept" -> {
        Request r = requests.get(id);
        if (r == null || !r.from.equals(tid) || own.size() >= 100 || theirs.size() >= 100) {
          p.tell(player, "No valid request or friend limit reached.");
          return;
        }
        requests.remove(id);
        if (!own.contains(tid.toString())) own.add(tid.toString());
        if (!theirs.contains(id.toString())) theirs.add(id.toString());
      }
      case "remove" -> {
        own.remove(tid.toString());
        theirs.remove(id.toString());
      }
      default -> {
        p.tell(player, "/friends add|accept|remove <online-player>");
        return;
      }
    }
    p.data.set("players." + id + ".friends", own);
    p.data.set("players." + tid + ".friends", theirs);
    p.save();
    p.tell(player, "Friends updated.");
  }

  @EventHandler
  public void teleport(PlayerTeleportEvent e) {
    if (spectators.containsKey(e.getPlayer().getUniqueId())
        && e.getCause() == PlayerTeleportEvent.TeleportCause.SPECTATE) e.setCancelled(true);
  }

  @EventHandler
  public void stopSpectating(
      com.destroystokyo.paper.event.player.PlayerStopSpectatingEntityEvent e) {
    if (spectators.containsKey(e.getPlayer().getUniqueId())) e.setCancelled(true);
  }

  @EventHandler
  public void quit(PlayerQuitEvent e) {
    UUID id = e.getPlayer().getUniqueId();
    leave(e.getPlayer());
    requests.remove(id);
    requests.values().removeIf(r -> r.from.equals(id));
  }
}
