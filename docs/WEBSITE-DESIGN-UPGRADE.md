# Website and player-flow upgrade — 8 November 2026

One independent tierlist. Reference sites inform usability; no reference players, placements, artwork, branding or sponsors are imported.

## Evidence quality

Reviewed official public text/indexed pages and existing DESIGN-STUDY.md / DISCORD-RESEARCH.md. Direct extraction of several JavaScript homepages was empty. The browser origin gate refused PvPTiers and also the localhost preview. Those refusals were respected; **no fresh rendered visual inspection is claimed**. Functional DOM tests and source review support this implementation. Historical screenshots remain historical evidence.

| Official reference | Verified public structure | Adaptation and limits |
| --- | --- | --- |
| [PvPTiers](https://pvptiers.com/) | Indexed official information describes high/all-result feeds, active/retired and regional filters, kit information/resources. | Separate result views and ranking scope. Published text is not a visual audit or proof that every announced feature shipped. |
| [MCTiers](https://mctiers.net/) | Indexed rankings expose player identity, region, combined points and individual mode tier badges. | Names lead rows; points and regions align. Direct homepage extraction empty; no claims about current palette/animation. |
| [Polska Tierlista](https://tiery.pl/) | Mode navigation, player search, recent/high tests, scoring, testing steps, FAQ/glossary, recruitment and a performance preference. | Accessible rules, command help and calm view. Control labels read; full rendering/interactions not exercised. |
| [Lucnoxity](https://www.luctierlist.com/rankings/overall) | Main/submode groups, combined/main/sub scopes, regional controls, player/points table and pagination. | Group kits and bound long tables. Do not split our community into providers. |
| [PvPHQ](https://pvphq.com/) | Indexed official ladders and match context, including kit, region, participants and performance fields. | Connect placements to evidence/history. No replay engine, arena telemetry or equivalence with our tiers inferred. |
| [CatPvP ranked](https://www.catpvp.net/ranked) | Global/per-kit numeric ratings and divisions; indexed official profiles include per-kit stats/history. | Context inside profiles and progressive disclosure. Ratings are never converted into HT/LT placements. Repeated ad placeholders do not establish visual position. |

## Original design system

Midnight navy `#0b1220`, steel `#15243b`, white `#ecf2ff`, amethyst `#a995ff`, cyan `#7de2df`, gold `#e7bb70`. Retain Rajdhani for compact display headings and Inter for readable data, avoiding new font dependencies. Use tabular numerals for points. Left-align data and instructions.

The existing original arena illustration is the single strong focal point, now integrated into a shorter two-part introduction instead of a long orbital landing screen. Kit artwork and earned tier colors carry the game identity. Data surfaces stay quiet. Mobile masthead/kit controls scroll intentionally; the five-column board retains spatial meaning with a list alternative. A calm-view preference and reduced-motion handling reduce visual activity.

```
Masthead: Home / Rankings / Testing / Kits / Results / Community / Tagger / Discord
Compact arena introduction and kit entry points
Mode groups / Search / Region / Status / Saved / View
Tier board or paginated table       Testing and tier guide
Results → Profile → Evidence       Private Discord progress
```

Review against the brief: player names and actions remain legible; no fake players/counters fill empty data. A real next action replaces empty-state decoration. Sponsor content never displaces the competition board. Existing assets are reused without copying reference artwork.

## Implementation scope

- New consistent masthead, arena introduction, responsive surfaces, dialogs, tier columns, profile presentation, kit cards, testing and community pages.
- Ranking scope in shareable URLs; 50-row leaderboard pages; active/all/retired filters for published status; local saved players; profile deep links, comparison and player-card downloads retained. Retired filtering does **not** claim a new retirement-management engine.
- Results page with all/high-tier feeds (HT3 and higher), player/mode filters, evidence and profiles.
- Manual refresh and 60-second background public-data checks, stale-snapshot feedback after failures, form preservation and calm-view preference. No private records in public feeds.
- Testing command-copy tools, capacity/cooldown information and a community practice-summary builder that explicitly does not publish anything.
- Cloud additions: expiring owner-managed practice listings, private verified tester applications with independent moderator decisions, public-placement profile lookup and assigned-tester claim release.

See DISCORD-UPGRADE-STATUS.md for deployment/read-back evidence. No automatic staff grant, fake live test, payment feature, sponsor, scheduled event, imported tier, Minecraft arena host, automated match recording or new Fabric release is claimed. The old experimental tagger continues reading committed exports.
