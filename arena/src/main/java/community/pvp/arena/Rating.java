package community.pvp.arena;

final class Rating {
  private Rating() {}

  static int delta(int winner, int loser) {
    return Math.max(
        1, (int) Math.round(32 * (1 - 1 / (1 + Math.pow(10, (loser - winner) / 400.0)))));
  }

  static int transfer(int winner, int loser) {
    return Math.min(loser, delta(winner, loser));
  }

  static int window(long seconds) {
    return (int) Math.min(700, 100 + Math.max(0, seconds) / 15 * 50);
  }

  static String rank(int elo) {
    return new String[]{"Copper", "Iron", "Gold", "Emerald", "Diamond", "Netherite"}[band(elo)];
  }

  static int band(int elo) {
    return Math.min(5, Math.max(0, (elo - 1000) / 300));
  }

  static float progress(double elo) {
    int floor = 1000 + band((int) elo) * 300;
    return (float) Math.max(0, Math.min(1, (elo - floor) / 300));
  }

  static String division(int elo) {
    int part = Math.min(2, Math.max(0, (elo - (1000 + band(elo) * 300)) / 100));
    return rank(elo) + " " + new String[] {"I", "II", "III"}[part];
  }
}
