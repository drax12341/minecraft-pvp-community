package community.pvp.arena;

import java.util.*;

import org.bukkit.*;
import org.bukkit.command.*;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.block.*;
import org.bukkit.event.entity.*;
import org.bukkit.event.inventory.*;
import org.bukkit.event.player.*;
import org.bukkit.inventory.*;
import org.bukkit.inventory.meta.*;
import org.bukkit.potion.*;
import org.bukkit.scoreboard.*;

final class ArenaCommands implements CommandExecutor, TabCompleter {
    final CommunityArena arena;

    ArenaCommands(CommunityArena arena) {
        this.arena = arena;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player p)) {
            sender.sendMessage(
                    "CommunityArena ready="
                            + arena.ready
                            + " arenas="
                            + arena.occupied.size()
                            + " queue="
                            + arena.queues.size());
            return true;
        }
        String cmd = command.getName();
        if (arena.commandTimes.getOrDefault(p.getUniqueId(), 0L) > System.currentTimeMillis())
            return true;
        arena.commandTimes.put(p.getUniqueId(), System.currentTimeMillis() + 250);
        switch (cmd) {
            case "party" -> arena.parties.command(p, args);
            case "notifications" -> arena.inbox.open(p, 0);
            case "customkit" -> arena.savedKits.slots(p);
            case "customduel" -> arena.savedKits.challenge(p, args);
            case "findplayer" -> {
                if (args.length == 1) arena.reference.find(p, args[0]);
                else arena.tell(p, "/findplayer <name>");
            }
            case "layout" -> {
                if (args.length == 0) arena.layouts.picker(p);
                else arena.layouts.open(p, args[0]);
            }
            case "profile" -> arena.reference.profile(p);
            case "ranked" -> {
                if (args.length == 0) arena.menu(p, true);
                else arena.progression.queue(p, args[0].toLowerCase(Locale.ROOT));
            }
            case "spec" -> arena.social.spec(p, args);
            case "friends" -> arena.social.friends(p, args);
            case "quests" -> arena.progression.quests(p);
            case "cases" -> {
                if (arena.busy(p)) arena.tell(p, "Open cases in the lobby.");
                else arena.progression.cases(p);
            }
            case "cosmetics" -> arena.progression.cosmetics(p, args);
            case "leaderboard" -> arena.reference.board(p, args.length == 0 ? "elo" : args[0], 0, false);
            case "pvpadmin" -> arena.setup.command(p, args);
            case "arena" -> {
                if (arena.matches.containsKey(p.getUniqueId())) {
                    arena.tell(p, "Use /leave to concede your current match.");
                    break;
                }
                arena.enter(p);
            }
            case "play" -> {
                if (args.length == 0) arena.menu(p);
                else arena.queue(p, args[0].toLowerCase(Locale.ROOT));
            }
            case "ffa" -> {
                if (arena.matches.containsKey(p.getUniqueId())) arena.tell(p, "Finish your match first.");
                else arena.joinFfa(p);
            }
            case "leave" -> {
                if (arena.partyBattles.sessions.containsKey(p.getUniqueId())) {
                    arena.partyBattles.leave(p);
                    break;
                }
                if (arena.bots.sessions.containsKey(p.getUniqueId())) {
                    arena.bots.stop(p);
                    break;
                }
                if (arena.social.spectators.containsKey(p.getUniqueId()) || arena.social.extra.containsKey(p.getUniqueId())) {
                    arena.social.leave(p);
                    arena.lobby(p);
                    break;
                }
                CommunityArena.Match m = arena.matches.get(p.getUniqueId());
                if (m != null) arena.finish(m, m.other(p.getUniqueId()), "Conceded");
                else if (arena.managed(p)) {
                    arena.lobby(p);
                    arena.tell(p, "Returned to lobby. /settings lets you leave the arena world.");
                }
            }
            case "stats" -> arena.reference.stats(p);
            case "settings" -> {
                if (!arena.managed(p)) arena.enter(p);
                if (arena.managed(p) && !arena.busy(p)) arena.settings(p);
                else arena.tell(p, "Open settings in the lobby.");
            }
            case "duel" -> {
                if (args.length >= 2 && args[0].equalsIgnoreCase("accept")) {
                    CommunityArena.Invite i = arena.invites.get(p.getUniqueId());
                    Player a = Bukkit.getPlayerExact(args[1]);
                    if (i == null
                            || a == null
                            || !i.sender().equals(a.getUniqueId())
                            || i.expires() < System.currentTimeMillis()) {
                        arena.tell(p, "No matching active invitation.");
                        break;
                    }
                    if (arena.busy(p) || arena.busy(a)) {
                        arena.tell(p, "One player is already in a match.");
                        break;
                    }
                    arena.invites.remove(p.getUniqueId());
                    arena.start(a, p, i.kit(), i.rounds(), false, i.custom(), i.rules());
                    break;
                }
                if (args.length < 2 || args[0].equalsIgnoreCase("bot")) {
                    arena.duels.open(p, args.length == 0 ? null : args[0]);
                    break;
                }
                if (args.length > 2 && (!args[2].matches("[1-9]|10"))) {
                    arena.tell(p, "Rounds must be first to 1..10.");
                    break;
                }
                Player other = Bukkit.getPlayerExact(args[0]);
                String k = args[1].toLowerCase(Locale.ROOT);
                if (other == null
                        || other.equals(p)
                        || !arena.kit(k)
                        || !arena.flag(other, "invites", true)) {
                    arena.tell(p, "Choose an online player accepting invitations and a valid /play kit.");
                    break;
                }
                if (arena.busy(p) || arena.busy(other)) {
                    arena.tell(p, "One player is already in a match.");
                    break;
                }
                CommunityArena.Invite old = arena.invites.get(other.getUniqueId());
                if (old != null && old.expires() > System.currentTimeMillis()) {
                    arena.tell(p, "That player already has a pending invitation.");
                    break;
                }
                arena.invites.put(
                        other.getUniqueId(),
                        new CommunityArena.Invite(
                                p.getUniqueId(),
                                k,
                                args.length > 2 ? Integer.parseInt(args[2]) : 1,
                                System.currentTimeMillis() + 60000));
                arena.tell(
                        other,
                        p.getName()
                                + " challenged you to "
                                + k
                                + ". /duel accept "
                                + p.getName()
                                + " within 60 seconds. First to "
                                + (args.length > 2 ? args[2] : "1")
                                + ".");
                arena.tell(p, "Invitation sent.");
            }
            case "testmatch" -> {
                if (!p.hasPermission("communityarena.tester")) break;
                if (args.length != 3) {
                    arena.tell(
                            p,
                            "/testmatch <player1> <player2> <kit> — supervised first to ten; publish reviewed"
                                    + " results in Discord.");
                    break;
                }
                Player a = Bukkit.getPlayerExact(args[0]), b = Bukkit.getPlayerExact(args[1]);
                if (a == null || b == null || a.equals(b) || !arena.kit(args[2])) {
                    arena.tell(p, "Choose two online players and a valid kit.");
                    break;
                }
                arena.start(a, b, args[2], 10);
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
                || c.getName().equals("testmatch") && args.length == 3)
            opts.addAll(Arrays.asList(arena.KITS));
        else if (c.getName().equals("duel") || c.getName().equals("testmatch")) {
            if (args.length == 1 && c.getName().equals("duel")) opts.add("accept");
            for (Player p : Bukkit.getOnlinePlayers()) opts.add(p.getName());
        }
        String last = args.length == 0 ? "" : args[args.length - 1].toLowerCase(Locale.ROOT);
        return opts.stream().filter(v -> v.toLowerCase(Locale.ROOT).startsWith(last)).toList();
    }
}
