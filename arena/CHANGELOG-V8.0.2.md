# 8.0.2

- Reject late lobby resets during an active duel, party, bot or spectator session; guard deferred respawn cleanup against a new session starting before it runs.
- Pin the chunk occupied by a practice target, including its bounded movement path. Release all session tickets at cleanup. Entity-unload cleanup no longer deletes an active target.
- Permit native offhand equipment swaps in bot and party sessions, matching player duels. Preserve native item attributes, enchantments and attack cooldowns.
- Add queue chimes, match-found cues, explicit countdown title timing and bounded player-local FIGHT sounds/particles for duels, parties and bots. Effects honor animation preferences. Gate hits can ready a player in their own imported arena during countdown; sneak-to-ready remains available.
- Clear stale fall distance and velocity at GO. Start the round duration clock at GO.
- Play hit confirmation at MONITOR only for uncancelled positive-damage hits, after combat protection has decided whether the hit is accepted.

Validation covers late lobby/respawn callbacks, every imported template remaining in combat beyond GO and gate closure, native offhand event permissions, held-item preservation, stale fall state, ready-up gate bounds, and real Paper chunk-ticket acquisition/release. The supplied clip is used as an intro reference, not evidence from this plugin's runtime. Connected-client attribute timing, hit registration, and multiplayer load/RTT still require live staging verification; no universal ping or glitch-free guarantee is claimed.
