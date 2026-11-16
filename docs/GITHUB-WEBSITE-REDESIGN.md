# Mace Network on GitHub Pages

The public website is **https://drax12341.github.io/minecraft-pvp-community/**.
The Pages workflow serves the built website directly. The previous GPT-hosted
redirect is removed. `AGENTS.md` records the owner's GitHub-only hosting rule.
This change does not republish or reconfigure the Discord bot service.

## Direction and references

The visual focus is an original floating voxel Mace, with a persistent atmospheric
background shared by all pages. The scene is drawn procedurally using Canvas 2D:
it needs no WebGL capability, downloaded model, animation framework or tracking.

- [Openstate](https://openstatemusic.com/): studied its sparse opening, strong
  typographic hierarchy and atmospheric presentation. The automated browser
  remained at its sound-choice screen; the complete audio experience was not
  verified. This website does not require sound to enter.
- [Cyera](https://secure-the-unknown.cyera.com/): the public route was inspected,
  but its 3D experience reported that the test browser was unsupported. No claim
  is made to have reproduced or fully inspected those animations.
- [Tiery](https://tiery.pl/): compact discipline navigation, visible tier identities
  and clear access to player tools informed the ranking controls. Its placements,
  player counts and assets were not imported.
- [Belka & Strelka](https://belka-stelka.ava-case.site/): the chapter structure and
  oversized typography informed the homepage's path from discovery to testing.

Tokens: ink `#090d19`, slate `#111827`, ice `#e5edf5`, cyan `#9bd4fa`, dusk
`#b6a2e8` and copper `#e1b587`. Space Grotesk carries the display hierarchy;
Manrope carries controls and reading. The spacious hero gives way to compact
discipline and ranking tools. Existing player functionality is reused.

## Features and motion

- A shaded voxel Mace follows the pointer gently. The scene can be taken apart
  and rebuilt; particles and slow atmospheric movement continue across pages.
- Discipline cards change the scene accent. Mode buttons, name search and region
  filters operate on the actual published player records.
- The homepage provides profile access, saved-player controls, active point
  totals, published sessions and a tier-value explorer. Example nametags and
  calculations are explicitly separate from actual placements.
- The existing full tier board, comparisons, NameMC/skin profiles, watchlist,
  analytics, test applications, commands, approved-kit rules and TierTagger
  configuration remain available through the same navigation and quick finder.
- User-driven route transitions handle interrupted navigation. Motion reduction
  follows the device preference and the saved calm-view setting. Canvas work
  stops when reduced or hidden. No scroll hijacking or delayed entry screen.

## Source and data

`web/pages.html` is the static entry; `npm run build` copies it to `dist/index.html`.
`web/orbit-home.js`, `web/orbit-motion.js` and `web/orbit.css` supply the new design.
`web/index.html` remains a separate existing service shell, not the Pages entry.

All active static-site requests use project-relative `./data/` files. There is no
GPT-hosted frontend data dependency. GitHub Pages does not run the Discord bot,
accept staff tokens or create authenticated queue entries. Actions requiring
staff verification continue in Discord. The data is the latest **published
snapshot**, not a promise of live Discord state. Export/commit updated public
`data/results.json` and `data/testing.json` when publishing new community data.
Missing records remain empty; sample previews never become real placements.

## Skill use and structural map

Ponytail guided reuse of the existing ranking/profile tools and standard browser
APIs without additional production dependencies. OmniRoute's instructions were
read as requested; it configures an AI gateway and has no required role in this
static website. No gateway, credential or provider settings were changed.

Graphify extracted the website's JavaScript structure, generated a graph, report
and interactive HTML, and traced the ranking/profile/static-data connections.
The local artifacts are in `.runtime/website-analysis/graphify-out/`. Structural
extraction used **0 LLM input/output tokens**. The initial map found 210 nodes,
787 edges and 12 communities. Its integrity report flagged five self-loops and
21 overlapping undirected endpoint relations, with no dangling or missing
endpoints. The map is a navigation aid; the raw extraction retains the distinct
call/containment relations that a simple graph can collapse.

## Verification

Automated checks cover empty and populated homepage states, safe names, actual
point totals, search/mode/save/profile controls, the tier explorer and hosting
independence. The existing website, Discord and backend suites remain required.
Browser checks cover 13 public routes, desktop/tablet/mobile project-subdirectory
paths, keyboard search, mobile navigation, scene controls, motion reduction,
horizontal overflow, resource failures and unwanted GPT-host requests.

Preview screenshots and the browser report are retained under
`.runtime/website-preview/`. GitHub's Website workflow builds and publishes on
push to `main`. Legacy path links are mapped to local hash routes by `404.html`.
