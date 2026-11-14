# Champion screenshot rebuild

The supplied 1917×947 Champion screenshot is the primary design reference.
Its useful structure is a full-width header, large left-aligned title, layered
Minecraft player scene, four compact statistics, a substantial TierTagger panel,
and a dense leaderboard beside queue and activity panels.

Use charcoal #090e15, panels #101822/#18222e, frost #eef2f8, slate #a5afbf,
gold #f2c562 and ice #a5cdf5. Inter carries the interface; Space Grotesk is
reserved for display headings and numbers. Use 8–12px panel corners, thin inner
highlights, a quiet technical grid, tier-specific colours and deliberate depth.
The desktop content is 1500px wide. The hero is roughly 430px high, rather than
a full-screen centered logo. At narrow widths the scene and controls stack;
tables scroll inside their panel. Avoid the rejected violet orbital aesthetic.

Implement the control room as an independent frontend module, keeping existing
rankings, profiles, comparisons, applications and Discord delivery intact.
Include real-data search, mode/region/saved filters, sorting, pagination,
table/card views, safe CSV export, shareable views, random profiles, a working
tag preview, installation details, queue capacity diagrams, a private-command
builder, recent evidence, public tester activity, tier/region/activity charts,
mode summaries and testing guidance. Controls must perform their stated action.

Do not invent players, totals, Discord membership, estimated waits, tester
assignments or published ranks. The capped recent feed is labelled as recent
tests. Public tester names/counts come only from the existing public testing
desk endpoint. Account verification and queue entry still happen in Discord.

Use native controls, visible keyboard focus, reduced motion, stored preferences,
and escaped public data. Exported spreadsheet cells must neutralize formulas.
Source and deployment remain in the existing GitHub repository and GitHub Pages.
The cloud activation script is unrelated to this frontend change and is not run.

Validate the data functions and interactions, all existing workflows, static
assets, GitHub Actions and the live published release. The native browser host
currently reports unavailable; do not claim visual viewport verification.

Validation: 77 automated tests pass. All 15 public routes render in jsdom with
no duplicate IDs, missing local assets, script errors or stylesheet parse errors.
The original challenger SVG was rasterized and inspected separately. The live
publication check compares served asset hashes with the committed source.
Player skin URL formats were verified against [MCHeads documentation](https://mc-heads.net/).
