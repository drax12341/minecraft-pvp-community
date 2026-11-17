# Leaderboard homepage

Public site: https://drax12341.github.io/minecraft-pvp-community/
Entry: `web/pages.html`, built to `dist/index.html` with `npm run build`.

The owner's screenshots are the layout reference: compact navigation, top test
counter, left test-activity rail, a slim circuit strip, original pixel-art mode
tabs, a community banner and wide podium/player rows. The previous landing-page
hero and eclipse illustration are removed. The board opens immediately at the
root URL. Search, region, saved-player filters and 25-player pagination all work
on published records. Search retains a player's position within the selected
mode and region. Mode/region changes are reflected in a shareable homepage URL.

Original PNGs under `web/assets/modes/` are unchanged. The first seven tabs match
the owner's screenshot order: Overall, Rod, OG, LT, Rocket, HT, Spear. The existing
base Mace discipline remains accessible as the final tab. Images use pixelated
rendering, full opacity and no recoloring. Podium rows use actual UUID skin
renders, with neutral local placeholders on image errors. Per-mode tier badges
show mode icons, tier labels, and keyboard-accessible tooltips.

Palette: charcoal #0d1016, surface #12151c, red #f04c68, gold #e9bf60,
silver #bfcddd, bronze #dc9564. Existing Manrope and Space Grotesk fonts remain.
Only the community's own Discord/practice links are used; no reference-site
sponsors, public rankings or branding are imported.

Data: server/cloud Store.rankings -> published results.json -> relative browser
fetch -> leaderboard. Total tests count repeat tests before the 100-result feed
cap. Revoked tests and cloud staff adjustments are excluded. Missing totals show
a dash; the empty initial snapshot reports zero. Demo players, malformed UUIDs,
unknown disciplines and invalid ranks cannot become rows on this board. No
fixture records are committed or published. Current production records are empty.

Effects: one bounded canvas for stars, shooting stars and small bursts. The
prominent performance toggle reuses the existing persisted calm preference.
Reduced motion/hidden tabs stop animation; cursor/fireworks have their own
preferences. The native cursor remains usable. Test activity uses native modal
drawers with Escape/backdrop closing. Information dialogs explain testing,
scoring and what the test total means.

Verification: full Node suite, production build and dependency audit. A temporary
Playwright Core install in ignored `.runtime/browser-qa` drives an isolated
headless Chrome process against localhost; it is not a project dependency.
Rendered screenshots reviewed for the empty production state and populated test
fixtures. Layout checked at 320, 360, 390, 480, 650, 768, 900, 1024, 1280, 1440
and 1920 pixels: no horizontal document overflow, no page errors, icons keep
filter:none. Real-browser checks cover search, pagination, drawer Escape, native
information dialogs and the slash shortcut. Fixture responses are test-process
only and never reach the published data files.

References: https://tiery.pl/, https://www.mcpvp.com/tiers and
https://tatnatyt.github.io/eclipse-website/, plus the owner's two screenshots.
Graphify runtime remains unavailable; relationships were traced directly.
OmniRoute is not needed for this static website. GitHub Pages is the only public
website host. Existing Discord infrastructure is unchanged.
