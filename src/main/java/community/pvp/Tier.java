package community.pvp;

public record Tier(String mode, int tier, int position, boolean retired) {
    public Tier {
        if (mode == null || mode.isBlank() || tier < 1 || tier > 5 || position < 0 || position > 1)
            throw new IllegalArgumentException("Invalid tier");
    }
    public String label() { return (position == 0 ? "HT" : "LT") + tier; }
    public int strength() { return (6 - tier) * 2 - position; }
}
