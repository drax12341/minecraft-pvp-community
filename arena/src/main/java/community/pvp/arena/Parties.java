package community.pvp.arena;

import java.util.*;

import org.bukkit.*;
import org.bukkit.entity.Player;

final class Parties {
    final CommunityArena p;
    final Map<UUID, Party> membership = new HashMap<>();
    final Map<UUID, Invitation> invites = new HashMap<>();

    static final class Party {
        UUID leader;
        int max = 10;
        final LinkedHashMap<UUID, String> members = new LinkedHashMap<>();

        Party(UUID id) {
            leader = id;
            members.put(id, "red");
        }
    }

    record Invitation(Party party, long expires) {
    }

    Parties(CommunityArena p) {
        this.p = p;
    }

    void tell(Party party, String text) {
        for (UUID id : party.members.keySet()) {
            Player player = Bukkit.getPlayer(id);
            if (player != null) p.tell(player, text);
        }
    }

    void command(Player player, String[] args) {
        UUID id = player.getUniqueId();
        Party party = membership.get(id);
        String cmd = args.length == 0 ? "help" : args[0].toLowerCase(Locale.ROOT);
        if (cmd.equals("create")) {
            if (party != null) {
                p.tell(player, "You already belong to a party.");
                return;
            }
            party = new Party(id);
            membership.put(id, party);
            p.tell(player, "Party created. /party invite <player>");
            return;
        }
        if (cmd.equals("accept")) {
            Invitation invite = invites.get(id);
            Player leader = args.length == 2 ? Bukkit.getPlayerExact(args[1]) : null;
            if (party != null || invite == null || invite.expires() < System.currentTimeMillis() || leader == null
                    || !invite.party().leader.equals(leader.getUniqueId()) || membership.get(leader.getUniqueId()) != invite.party()
                    || invite.party().members.size() >= invite.party().max || p.busy(player) || invite.party().members.keySet().stream().anyMatch(p.partyBattles.sessions::containsKey)) {
                p.tell(player, "No matching invitation, party full, or already in a session.");
                return;
            }
            party = invite.party();
            party.members.put(id, party.members.size() % 2 == 0 ? "red" : "blue");
            membership.put(id, party);
            invites.remove(id);
            tell(party, player.getName() + " joined the party.");
            return;
        }
        if (party == null) {
            p.tell(player, "/party create | accept <leader>");
            return;
        }
        if (p.partyBattles != null && party.members.keySet().stream().anyMatch(p.partyBattles.sessions::containsKey)) {
            p.tell(player, "Finish the party battle before changing the party.");
            return;
        }
        if (cmd.equals("list")) {
            p.tell(player, "Party " + party.members.size() + "/" + party.max + " | Leader: " + p.progression.name(party.leader));
            for (var e : party.members.entrySet())
                p.tell(player, p.progression.name(e.getKey()) + " [" + e.getValue() + "]");
            return;
        }
        if (cmd.equals("leave")) {
            remove(id, party);
            p.tell(player, "Left party.");
            return;
        }
        if (!party.leader.equals(id)) {
            p.tell(player, "Only the party leader can do that. /party list | leave");
            return;
        }
        Player target = args.length >= 2 ? Bukkit.getPlayerExact(args[1]) : null;
        switch (cmd) {
            case "invite" -> {
                if (target == null || target.equals(player) || membership.containsKey(target.getUniqueId()) || party.members.size() >= party.max) {
                    p.tell(player, "Choose an available online player; party must have room.");
                    return;
                }
                invites.put(target.getUniqueId(), new Invitation(party, System.currentTimeMillis() + 60000));
                p.tell(target, player.getName() + " invited you. /party accept " + player.getName() + " (60 seconds)");
                p.tell(player, "Invitation sent.");
            }
            case "transfer", "kick" -> {
                if (target == null || target.equals(player) || membership.get(target.getUniqueId()) != party) {
                    p.tell(player, "Choose another party member.");
                    return;
                }
                if (cmd.equals("transfer")) {
                    party.leader = target.getUniqueId();
                    tell(party, "Leader transferred to " + target.getName());
                } else {
                    remove(target.getUniqueId(), party);
                    p.tell(target, "Removed from the party.");
                }
            }
            case "max", "size" -> {
                if (args.length != 2 || !args[1].matches("[1-9]|[1-4][0-9]|50")) {
                    p.tell(player, "/party max <1..50>");
                    return;
                }
                int size = Integer.parseInt(args[1]);
                if (size < party.members.size()) {
                    p.tell(player, "Remove members before reducing capacity.");
                    return;
                }
                party.max = size;
                tell(party, "Party capacity: " + size);
            }
            case "team" -> {
                if (target == null || membership.get(target.getUniqueId()) != party || args.length != 3 || !Set.of("red", "blue").contains(args[2].toLowerCase(Locale.ROOT))) {
                    p.tell(player, "/party team <member> <red|blue>");
                    return;
                }
                party.members.put(target.getUniqueId(), args[2].toLowerCase(Locale.ROOT));
                tell(party, target.getName() + " joined team " + args[2]);
            }
            case "split" -> {
                int n = 0;
                for (UUID member : party.members.keySet()) party.members.put(member, n++ % 2 == 0 ? "red" : "blue");
                tell(party, "Teams split evenly.");
            }
            case "fight" -> {
                p.duels.open(player, "party");
                var draft = p.duels.drafts.get(id);
                if (draft != null) {
                    draft.party = true;
                    p.duels.kits(player);
                }
            }
            case "disband" -> {
                for (UUID member : new HashSet<>(party.members.keySet())) membership.remove(member);
                Party old = party;
                invites.values().removeIf(i -> i.party() == old);
                tell(party, "Party disbanded.");
                party.members.clear();
            }
            default ->
                    p.tell(player, "/party create | invite <player> | accept <leader> | list | leave | kick <member> | transfer <member> | max <1..50> | team <member> <red|blue> | split | fight | disband");
        }
    }

    void remove(UUID id, Party party) {
        membership.remove(id);
        party.members.remove(id);
        if (party.members.isEmpty()) {
            invites.values().removeIf(i -> i.party() == party);
            return;
        }
        if (party.leader.equals(id)) {
            party.leader = party.members.keySet().iterator().next();
            tell(party, "New leader: " + p.progression.name(party.leader));
        }
    }

    void quit(Player player) {
        Party party = membership.get(player.getUniqueId());
        if (party != null) remove(player.getUniqueId(), party);
        invites.remove(player.getUniqueId());
    }
}
