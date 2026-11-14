# Arena visual release

The previous public GitHub Pages address still served the old interface while the cloud app served the connected website. The Pages workflow now retains its existing checks, then publishes a small canonical redirect. This prevents two competing public interfaces. Discord setup scripts and community-v4 now link directly to the authoritative cloud app.

## Visual changes

- New homepage composition: oversized condensed typography, original vector Mace arena, layered orbital artwork, a featured-mode plate, compact network metrics, and a horizontal discipline explorer.
- Real-data standings with an earned-placement invitation when there are no competitors. No sample usernames or fictional ranks.
- Rankings workspace with leaderboard and tier-board controls. The tier board has ten HT/LT sections and displays counts for the current page and filter.
- Matching regional panels, contribution cards, profile treatments, onboarding timeline, community banner and footer.
- Repaired question-mark icons in the original HTML shell. New interface icons are inline SVG rather than platform-dependent text glyphs.

## Motion

The arena floats continuously; orbital rings drift slowly. Pointer parallax is enabled only for a fine pointer. The hero has a staggered entrance, sections reveal as they enter view, live statistics animate to their actual values, and ranking rows enter in a short sequence. Dialogs, tabs, buttons and tier badges respond to interaction. Progression charts draw on entry.

System reduced-motion preferences and the site animation toggle disable these effects. Running Web Animations are cancelled when motion is reduced or the view changes. CSS animation pauses in hidden tabs. Scroll handling is passive and batched into animation frames.

## Verification

`tests/arena-design.test.mjs` checks the new views with empty data, all ten tier-board sections, routing into the actual new interface, switching layouts, persisted motion preference, and animation cancellation. The full existing test suite remains enabled.

Browser access is unavailable in this environment. Runtime DOM tests and artwork rendering were verified; full browser screenshots, layout measurement and device inspection could not be completed.
