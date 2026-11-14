# Mace Network v10 — live Discord delivery

The new cloud worker and migrations are deployed at
https://minecraft-pvp-community.draxion0.chatgpt.site.
The existing public audience and all seven original Mace mode names are retained.

## Confirmed in the actual Discord guild

- 63 guild application commands registered.
- 20 persistent dashboards installed and subsequently read back from Discord.
- 54 native interactive controls present across the installed dashboards.
- Nine private tester/staff channels checked for an explicit @everyone ViewChannel deny.
- 70 independent Mace-mode tier mappings synchronized into the production database.
- 140 stable resource references saved; installation validation found no missing roles/channels.
- Existing history and unrelated channels retained. One legacy channel rejected overwrite changes;
  installation creates the intended managed replacement rather than escalating the bot or deleting history.
- No fake player, ownership verification, test result, kit calibration or tester qualification was added.

Entry points:
- Player hub: https://discord.com/channels/1568767259168608267/1569347570214506607
- Tester center: https://discord.com/channels/1568767259168608267/1571130521994666176
- Staff center: https://discord.com/channels/1568767259168608267/1571130539807875205

## Implemented workflows

**Setup:** `/setup` and `/autosetup` provide a persistent eight-stage administrator flow.
It records identity/regions, discovers existing modes, installs safe management/tester/verified
and scoped tier roles, creates missing channels, applies explicit permissions, installs panels
and validates saved IDs. The shared installer supports a rate-limited local activation path;
its authenticated installation bridge synchronizes only bounded, guild-validated resources.

**Sessions:** `/start`, `/pause`, `/resume`, `/end` manage each approved tester independently.
A shared regional/mode session stays open while another tester remains available. Ending
availability does not cancel their active test. An SQL trigger prevents a paused tester from
claiming a new player in a managed session. Public queues list FIFO Minecraft names (private
profiles show a privacy label), paginated places, tester availability and current assignments.

**Tickets:** managed tests persist explicit lifecycle state, revisions, deadline, notes and score.
Both participants confirm readiness before `/match start`. `/match finish` records a structured
score; the rubric and result confirmation follow. Invalid result states are rejected in the
database as well as handlers. Private controls cover status, rules, response extension, notes,
issue reports, cancellation, absence review, manager reassignment and downloadable transcripts.
Cancellation and absence require an audited confirmation and never automatically penalize the
player. Reassignment removes the previous tester's channel access and resets readiness.
Transcripts include recorded events and the latest 100 messages, and remain staff-only.

**Player experience:** `/account` manages verified identity display, region and profile privacy.
`/profile` supports Minecraft-name and Discord-user lookup. Profiles show per-mode current/peak
tiers, actual points and overall placement, official evaluation counts and skin heads.
`/progress` adds real tier history and cosmetic milestones. Private restrictions/cooldowns are
visible only to the owner/authorized staff. Milestones never change official placements.

**Management:** `/mode` creates, edits, enables and disables administrator-defined Mace submodes.
Rules/server/capacity/cooldowns persist in D1; enabled modes feed command autocomplete and native
selectors. Native selectors support up to 25 enabled modes. `/region` manages testing regions;
`/config branding` configures the hub identity. `/cooldown inspect|reset|set|reduce`,
`/player restrict|unrestrict` and `/queue forceclose|clear` preserve scope and audit reasons;
mutating overrides require confirmation. Current active tests and historical results remain intact.
`/quota` tracks configurable UTC monthly targets using actual non-revoked evaluations.
`/staff-center`, `/health`, `/system` and `/delivery` provide private management/recovery views.

The previous qualification, phased high-test, support, private report, appeal, retirement,
loadout calibration and website ranking workflows are preserved. Result commits still create
separate durable announcement, role and archive jobs alongside the official result/cooldown.

## Verification

All 92 Node tests pass and the cloud bundle builds and parses. Coverage includes the complete
synthetic evaluation journey across reconstructed store instances, independent tester sessions,
paused assignment rejection, result state guards, confirmed staff overrides, mode-scoped
restrictions, profile behavior and repeatable server installation with a forbidden legacy channel.
Live verification read all installed panels and checked private access overwrites, command count,
role mapping count and the deployed `mace-network-v10` health endpoint.

## Remaining external setup and boundaries

The actual ownership server is not configured. Install the included Paper `/linkdiscord` plugin
on the real directly authenticated online-mode server and set matching verification endpoint/secrets
before new players can complete ownership proof. The plugin compiles; live Minecraft login proof
has not been exercised. Official testing also requires real calibrated loadout approvals and real
mode-qualified testers; the installer deliberately grants neither automatically.

Periodic jobs require a configured scheduler; interaction-driven reconciliation is active.
The full original master specification is larger than this delivery: generalized audited staff
placement adjustments, complete support reopening/transcript workflows, automatic quota/expiry
notifications, season analytics and exhaustive production-load/gateway-outage validation still
need further implementation. This delivery does not claim those unimplemented features.
