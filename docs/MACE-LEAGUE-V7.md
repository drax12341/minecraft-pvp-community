# Mace League v7

## Design

The primary task is finding a player placement or taking the next test. The new
workspace uses a 218px competition sidebar and a compact search header. The home
page introduces seven disciplines, recent real placements and testing entry points.
Rankings, high-tier rosters, applications, player dossiers and results share one
surface system rather than independent page themes.

Design tokens: arena charcoal `#0c1019`, iron slate `#151c29`, border steel
`#293143`, ice text `#f1f3fb`, amethyst `#bba3ff` and rank gold `#e3bf70`.
Inter carries controls and body copy; Rajdhani carries competition headings.
The original vector Mace illustration is the main visual accent. Rank colors
communicate placement, rather than decorative status or invented statistics.

Review against the brief removed the former large arena artwork, repeated welcome
sections and wide navigation row. Real rankings and actionable testing controls
now lead. The sidebar becomes a keyboard-closeable mobile drawer. Board columns
scroll on narrow screens, controls wrap, and reduced-motion settings are respected.

## One public roster

All tier membership now lives in `player-roster` (`1569440550308937748`). The four
bot-only split channels were snapshotted locally and removed. The setup script
reuses existing channels and refuses to create extra public channels. Its roster
menu calls `/roster`, with gamemode, region, tier and pagination filters. Current
placements remain sourced from published non-revoked results.

## Connected promotion workflow

`/test-hub mode region` chooses the next action from verification, restrictions,
published tier, active application and session state.

Inside an application ticket, `/high-test` commands can infer the application ID:

1. `claim` and `prepare` reserve the official assessment and reuse the existing
   ticket. An approved gamemode kit and open session are required.
2. Both participants use `ready` in the same ticket.
3. `opponent`, `score` and `advance` record and adjudicate the phased sets. The
   dashboard supplies user selection and score-entry forms.
4. `assess` records the linked rubric. An independent qualified senior uses
   `review` for LT2+ and approves the exact evidence.
5. `publish` checks the final phase, publishes through the normal result guards,
   and closes the application with the matching result. Direct `/result` cannot
   bypass this linked phase check.

`schedule` records an agreed UTC appointment. `history` exposes private staff
decisions to authorized participants. `release` preserves scores and ticket history
for handoff; it cancels the abandoned assessment claim without imposing failure.
Applicants can `withdraw` an unclaimed application. Claimed withdrawals remain a
staff forfeit decision. Failed tests retain the enforced 30-day mode restriction.

Phase guidance checks required opponent counts, round margins, per-opponent minimum
rounds and opponent-tier snapshots. Replacements and 3–2 HT3 discretionary wins
need an explicit documented exception. Strike scores, demotion, retirement and
defended peak awards remain staff-adjudicated.

## Verification

44 automated checks cover the connected LT2 lifecycle, independent review,
handoff/recovery, cooldowns, withdrawal boundaries, public privacy, phase margins,
roster filtering, navigation and profile-to-application links. Bundled Worker
smoke checks cover CSS, JavaScript, SVG and guide assets. Secret and syntax checks
passed. No synthetic production applications, ranks or qualifications were created.

Browser and native UI hosts were unavailable, so full browser screenshots could
not be captured. The original SVG was rendered and inspected; page behavior was
verified through DOM and HTTP checks. This is a visual verification limitation.
