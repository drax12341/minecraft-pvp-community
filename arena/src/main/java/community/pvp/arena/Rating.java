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
    if (elo < 800) return "Bronze";
    if (elo < 1000) return "Iron";
    if (elo < 1200) return "Gold";
    if (elo < 1450) return "Emerald";
    if (elo < 1700) return "Diamond";
    if (elo < 2000) return "Obsidian";
    return "Netherite";
  }

  static String division(int elo) {
    int[] starts = {0, 800, 1000, 1200, 1450, 1700, 2000};
    int index = 0;
    for (int i = 0; i < starts.length; i++) if (elo >= starts[i]) index = i;
    int end = index + 1 < starts.length ? starts[index + 1] : 2300;
    int part = Math.min(2, Math.max(0, (elo - starts[index]) * 3 / (end - starts[index])));
    return rank(elo) + " " + new String[] {"I", "II", "III"}[part];
  }
}
