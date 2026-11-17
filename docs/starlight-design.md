# Celestial homepage refresh

The public entry remains `web/pages.html` → `dist/index.html`, hosted at
https://drax12341.github.io/minecraft-pvp-community/. No hosting changes.

Reference study:
- https://tiery.pl/: test total, recent/high-tier feeds, tier navigation, information controls and performance preference.
- https://www.mcpvp.com/tiers: compact mode navigation and searchable rankings.
- https://tatnatyt.github.io/eclipse-website/: source inspection of eclipse halo, starfield, shooting stars, cursor ring/glow and click dust. Original effects implemented here; no reference scripts or assets imported.

Design: deep violet background (#0b0a12), layered panels (#13111e), lilac accent
(#bba5ff), white text (#f0edf9), muted text (#aaa4bd). Existing Manrope and Space
Grotesk fonts stay. A centered eclipse replaces the large Mace illustration;
results and modes follow immediately below the hero. Native information dialogs
explain testing, scoring and the counter. Existing player tools remain available.

Data flow: server/cloud Store.rankings → published results snapshot → relative
`./data/results.json` fetch → homepage. `completedTests` counts all non-revoked
tests before the 100-item recent-feed cap. Repeat tests count individually;
cloud adjustments/resets do not count. Missing totals display a dash. The empty
checked-in snapshot explicitly reports zero. Totals update with published
snapshots, not live Discord activity. No player placements are generated.

Motion: one capped-DPR canvas, 30fps, at most 104 burst particles; mobile uses
fewer stars. Reduced motion stops the loop and renders a static sky. Hidden tabs
cancel frames. The cursor only appears for fine pointers; the native pointer
remains usable. Cursor/fireworks preferences use local storage; the existing
calm preference controls all motion. No dependencies or external services added.

Validation: automated Pages-entry boot, filters, dialogs, escaping, repeat-test
counts above 100, revoked/adjustment exclusions, preference persistence and
reduced-motion/hidden-tab cancellation. Full suite and production build pass;
npm audit reports zero known advisories. Browser host unavailable, so rendered
visuals, keyboard focus behavior and mobile layouts still need browser QA.
Graphify runtime unavailable (no Python/Graphify installed); relationships above
were traced directly. OmniRoute setup was reviewed; an AI gateway is not needed
for this static website refresh.
