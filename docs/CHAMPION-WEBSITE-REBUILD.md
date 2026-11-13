# Champion-inspired community website

## Reference and intent

The user's recovered Champion Tierlist site is the reference:
`.runtime/tierbot-reference/public/{index.html,styles.css,app.js}`. It combines a
compact leaderboard, queue sidebar, recent results, saved players, comparisons,
statistics and a visual scene. Its original branding, unrelated modes and data
are not imported. This site keeps the community's seven Mace disciplines and
the same live cloud results and Discord workflows.

## Design contract

- Canvas: deep steel `#080e16`; surfaces `#101a26` and `#172434`.
- Type: Manrope for body/controls, Space Grotesk for display and numeric headings.
- Text: frost `#eff4f7`, muted slate `#9cacbe`; primary ice `#a7d4ef`;
  warm brass `#e7b56f` for earned rank emphasis.
- Layout: a horizontal competition header; wide, asymmetric Mace introduction;
  a dense player index beside current sessions and recent results. Mobile uses
  an accessible expandable navigation and stacked panels.
- Distinction: a custom, interactive Mace with an impact wave, discipline-specific
  colours and user-controlled motion. No stock hero, unrelated game art or copied
  Champion logo. Rankings and session counts always use actual public data.

The initial plan was revised away from another sidebar/card grid: Champion's
table-and-sidebar hierarchy is more useful for finding players. One animated
Mace scene carries the identity; ordinary tables, forms and testing paths stay
quiet and legible.

## Behaviour and boundaries

- Keep existing ranking filters, sharing, comparison, profiles, test forms,
  evidence links, command library, tagger and Discord integration working.
- Add a universal finder for modes, public players and community destinations.
- Add saved-player watchlist, real-data insights, a tier point/path explorer,
  and region-filtered home session cards with occupancy bars.
- Use transform/opacity for motion, a single impact sequence and short page
  transitions. Respect `prefers-reduced-motion`, Calm view, keyboard input and
  hidden-tab state. Never make an animation necessary to use a control.
- Zero real players/results produces useful empty states, never invented ranks,
  tester activity or community size. Samples remain explicitly opt-in.
- Search and user data are escaped; no new backend writes or secrets are exposed.

## Verification

Run the existing Node/jsdom interaction suite and add behaviour checks for the
new finder, session filters, watchlist, planner and real-data insights. Build and
syntax-check the complete cloud Worker, scan for configured secret values, then
publish to the existing Site with its existing audience.

The native browser host reported unavailable during initial QA. No live visual,
mobile viewport, screen-reader or animation smoothness claim can be made unless
that host becomes available. Automated DOM and served-asset checks remain useful
but do not replace a real browser review.

## Delivered behaviour and checks

The redesign includes an original projected Mace SVG, pointer response, a strike
sequence with impact waves and sparks, floating rank markers, responsive
navigation, animated occupancy meters and modal transitions. Device reduced
motion, Calm view and hidden-tab state suppress the ambient effects.

The player finder searches actual published names, modes and destinations. Saved
players can be managed and compared on a separate watchlist. Insights exclude
retired placements and distinguish current-feed activity from all-time totals.
The tier explorer uses the actual configured points and links to the matching
discipline and target. Home queue and index filters survive a data refresh.

The standards page now lists only the seven community Mace modes and reads the
new public `/api/loadouts` catalogue. It publishes approved equipment text and
versions, excludes revoked versions, caps history at eight versions per mode,
and omits private staff calibration evidence and reviewer account IDs. Pending
loadouts are clearly marked rather than invented.

Module and stylesheet URLs are versioned as `impact-v9` to prevent mixing cached
old modules with new exports. No frontend dependency was added. Existing
rankings, filters, results, applications, profiles and Discord commands remain.

Verification: 66 automated tests, including the original 55; cloud Worker build
and syntax check; a parsed stylesheet; eight packaged asset reads; and configured
credential scanning. The original Mace SVG was rendered to PNG and inspected.
Full-page browser screenshots, device layout, screen-reader behaviour and actual
animation frame timing remain unverified because the browser host is unavailable.
