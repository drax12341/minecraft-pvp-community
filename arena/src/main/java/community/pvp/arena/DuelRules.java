package community.pvp.arena;

/**
 * Immutable invitation snapshot: changing a menu cannot change an accepted duel.
 */
record DuelRules(int map, boolean pearlsWalls, boolean responsive, boolean spectators,
                 boolean igniteTnt, boolean loot) {
    static DuelRules defaults() {
        return new DuelRules(0, false, false, true, false, false);
    }
}
