package community.pvp;

import java.util.Collection;
import java.util.Comparator;
import java.util.Optional;

public final class TierSelector {
    private TierSelector() {}
    public static Optional<Tier> select(Collection<Tier> tiers, String mode, boolean fallback, boolean showRetired) {
        var eligible = tiers.stream().filter(t -> showRetired || !t.retired()).toList();
        var preferred = eligible.stream().filter(t -> t.mode().equals(mode)).findFirst();
        if (preferred.isPresent() || !fallback) return preferred;
        return eligible.stream().sorted(Comparator.comparingInt(Tier::strength).reversed().thenComparing(Tier::mode)).findFirst();
    }
}
