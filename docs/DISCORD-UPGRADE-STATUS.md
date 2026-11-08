# Discord upgrade status — 8 November 2026

Work performed directly in `C:\Users\garbo\IdeaProjects\Minecraft PvP Community`. Target guild remains `1568767259168608267`. This is **one independent tierlist**; no imported placements, additional guilds or purchased ranking advantages.

## Follow-up: arena interface and player workflows

Implementation completed locally on 8 November 2026; live publication/read-back is recorded below when verified. [Design evidence](WEBSITE-DESIGN-UPGRADE.md) reviews PvPTiers, MCTiers, tiery.pl, Lucnoxity, PvPHQ and CatPvP with explicit access limits.

- Replaced the orbital landing design with a compact illustrated arena introduction and consistent navy/amethyst UI throughout rankings, kits, testing, profiles, dialogs, results and community pages. Existing original art reused; no reference artwork copied.
- Added saved players (browser-local), shareable mode/region/status/search scopes, 50-row leaderboards, status filters, all/high-tier result feeds (HT3 and above), evidence/profile links, copyable testing/community commands, practice summaries, calm view, public-data refresh and stale-snapshot feedback. Existing previews remain visibly marked, and request summaries do not publish or reserve places.
- `/practice create|list|close`: persistent D1 listings, 24-hour expiry, one active listing per mode and at most three per member, owner/moderator closure, private command replies with member-visible listings. Practice records are not exposed on public website feeds.
- `/tester-apply submit|status|review`: verified ownership required; private applications and applicant-only status; independent moderators choose interview/declined with feedback; no staff roles automatically granted. One pending application per mode/member.
- `/profile name` finds this tierlist's published placements; `/claim action:release` lets only the assigned tester release an unfinished claim, retaining original queue order. Completed results cannot be released.
- Appended schema-only `drizzle/0001_player_workflows.sql` and journal entry; applied migration 0000 remains unchanged. Cloud HTTP/D1 architecture, secrets, audience, rankings and audit data preserved.
- **21/21 tests passed**, Worker/static build and syntax checks passed, Git diff checks passed. New coverage includes concurrent practice limits/expiry/ownership, application privacy/independent review/no role grants, claim release, deep links/saved/status filters, pagination, high-tier cutoff, and stale refresh preserving form input.
- Browser origin approval blocked both PvPTiers rendering and local preview. No workaround used; rendered screenshot/mobile visual QA remains unverified. Existing and new automated DOM behavior tests passed. No PC-dependent bot was started; only a temporary static preview server was used for preparation.
- Publication status: prepared; final live deployment, command and panel results will be appended after verification.

The earlier version-8 delivery record below remains historical. Four read-only onboarding channels still have the previously recorded HTTP 403 overwrite blocker; public #help remains the command desk. Exact kit/scoring rubrics and real-player test acceptance are still staff launch prerequisites. Retired filters read existing published status; a retirement-management engine, scheduled events, new tagger release and hosted Minecraft arena were not added.

## Applied and read back in the live server (version 8)

- Updated and individually re-fetched **13 channel topics**: welcome, rules, how-to-test, choose-your-modes, test-queue, test-results, find-a-duel, guides-and-coaching, events, help, appeals, sponsorships and tester-recruitment. Removed the stale welcome claim that commands are inactive.
- Added **tester-recruitment** (`1568986240068362271`), with an honest volunteer interest template, private staff review and supervised testing before any staff role. No automatic promotion.
- Posted and re-fetched six original violet guidance panels. A second application retained the **same message IDs** and created **no new channels**, verifying repeatability:
  - [Command desk / help](https://discord.com/channels/1568767259168608267/1568975844821438536/1568986256279474337)
  - [Testing queue](https://discord.com/channels/1568767259168608267/1568807005530099742/1568986261144862782)
  - [Practice partner template](https://discord.com/channels/1568767259168608267/1568975813431529652/1568986265117008046)
  - [Coaching guidance](https://discord.com/channels/1568767259168608267/1568975816044318790/1568986270162489478)
  - [Tester recruitment](https://discord.com/channels/1568767259168608267/1568986240068362271/1568986274566639658)
  - [Private staff testing checklist](https://discord.com/channels/1568767259168608267/1568975852455075880/1568986277787869217)
- Checked existing Staff category and its three children before mutations: @everyone cannot view; expected moderator/tester/bot grants only. Upgrade stops if this check fails. Staff access was preserved.
- No existing messages, rankings, account links, queue entries, appeals or audit records deleted. Only own upgrade-v3 messages can be updated by the upgrade tool. No roles renamed, no Administrator permission granted, no sessions opened.

## Custom cloud functions implemented

- `/guide topic`: ephemeral start/testing/appeals/staff/practice instructions, with valid topic checks.
- `/availability [mode] [region]`: real session status, waiting/claimed counts, capacity and cooldown; optional validated filters and honest no-session feedback. No private queue identities exposed.
- `/queue status mode region`: actor-scoped verification, own entry and its actual region, deterministic waiting position (excluding claimed tests; no ETA), latest non-revoked result ID/evidence and session-specific cooldown time. Members can now retrieve the result ID needed for appeals.
- Staff `/queue list` includes the target player identifier so a claimed test can be coordinated. Ordinary members continue seeing only their own entries. Replies remain ephemeral and suppress pings.
- Website testing guidance updated to match these commands. No schema changes/migrations required; all existing persistent D1 data retained.
- `discord/upgrade.mjs` provides a dry-run and repeatable REST-only upgrade; `discord/setup.mjs` knows the recruitment channel. `discord/bot.mjs --register-only` registers the cloud schema and exits without starting the old gateway. Package scripts: `discord:upgrade`, `discord:upgrade:apply`, `discord:register`.

## Research completed and limits

See [DISCORD-RESEARCH.md](DISCORD-RESEARCH.md) for identities, evidence, matrix, decisions and limits. First-hand: MCTiers Support Hub, PvPTiers Support Server, Mace SubModes Community, Central Tierlist and Lucnoxity TierList. Main MCTiers/PvPTiers testing guilds were not audited exhaustively. PvPHQ and CatPvP Discord identities were not verified through visible search; public-web evidence is labelled separately. Mace SubModes displayed a time-out but its read-only testing instructions were accessible. No reference posting, ticket creation or account/token extraction occurred.

## Verification and publication

- Baseline: **14/14 tests passed**. Updated suite: **15/15 passed** using `node --test tests/*.test.mjs`, the exact test command underlying `npm.cmd test`. `npm.cmd` is not on this shell's PATH; no npm/runtime was installed or replaced.
- New test covers status isolation from other players, waiting/claimed positions, latest evidence, cooldown, revoked-result exclusion, anonymous availability and input validation. Existing tests still cover staff authorization/interest-role safety, queue capacity and ownership, claim/result atomicity, independent appeals, public-feed privacy, signatures, stale/tampered requests and interaction deduplication.
- `node scripts/build-cloud.mjs` (the package's `build:cloud` script) passed. Worker syntax check and `git diff --check` passed. Website tests exercise the testing view; new layout is text-only within the existing design.
- Before changes: cloud `/healthz` returned HTTP 200 with `runtime: cloud-http`, `pcRequired: false`; both public feeds returned HTTP 200 with zero players and no sessions. Bot application read-back confirmed the existing `/discord/interactions` URL. Existing public Sites version was 7, project `appgprj_6aefb4a5f7448191a4e386a2f6263515`, audience public.
- **Published Sites version 8 successfully**, deployment `appgdep_6af08022b0348191924baddca0df51ed`, source commit `7f373171e15aad5521148db705ca434343116c08`. Production: https://minecraft-pvp-community.draxion0.chatgpt.site . Public audience retained, runtime environment revision **1** retained, no secret updates, existing D1 binding/migration retained.
- Registered and read back all **nine** guild commands, including queue's new `status` subcommand. `--register-only` exited without starting a gateway. Discord successfully revalidated and retained the existing signed cloud interactions endpoint after deployment.
- Post-deployment: `/healthz` HTTP 200, `runtime: cloud-http`, `pcRequired: false`; results/testing feeds HTTP 200, still zero real players/no sessions, no private identifier keys; unsigned interaction POST rejected with HTTP 401. The live #help panel and updated topic were also inspected in the desktop app.
- **GitHub source published** through the connected GitHub app's Git object API at commit `d4eb00c5a120371abde7eaa738ab1469b08f8cec`; main was updated with an expected-head check and no force. The Website workflow succeeded; public GitHub Pages returned HTTP 200 and served the new `/queue status` guidance. Normal push had failed because the configured shell credential helper could not run in the sandbox and existing GitHub CLI authentication reported an invalid token. No credentials were reset.
- A final documentation-only commit records these results. The Sites deployment source commit is preserved locally on `sites/discord-upgrade-v8`; the normal local `main` is aligned to GitHub for IntelliJ continuation. The hosting and GitHub histories have distinct publication commits with the same shipped code; retain the Sites branch when reconciling future hosting changes.
- Checked all tracked files and the built Worker against the loaded bot/admin secret values without printing values: **no matches**; `.env` is untracked. No runtime secret values were changed.

## Exact remaining constraints

- A narrow bot-only Send Messages/Embed Links/View Channel/Read History overwrite on #welcome was attempted through the dedicated bot API and returned **HTTP 403**. The inherited read-only Start here rules still block panels in welcome/rules/how-to-test/choose-your-modes. Topic edits succeeded. #help is the working alternate command desk; no broad permissions or UI security changes were made. An owner can later grant that specific bot access and rerun the original additive setup.
- #appeals is a **public guidance channel**, not a private case inbox. Its topic tells members to use ephemeral `/appeal submit` and `/appeal status`; case reasons and moderator review remain in protected cloud storage/private replies. Do not post cases there or call that channel private.
- Staff must finalize real Minecraft ownership checks, precise mode kit/scoring rules and trained testers before opening sessions. Real two-account verification→queue→claim→result→independent appeal acceptance remains a staff task; no fabricated live rankings were introduced to simulate it.
- Experimental Fabric release still reads committed GitHub exports, not live cloud rankings. No new client release was made.
- Cloud HTTP/D1 hosting, runtime secrets and public audience must remain. No paid hosting subscription or local process dependency added; service quotas/availability still apply. No promise of unlimited/perpetual free uptime.

## Continue from IntelliJ

Read this file and `docs/DISCORD-RESEARCH.md`, then inspect `git status`. Load ignored `.env` only through Node's environment loader; never print it. Existing task brief was initially untracked and has been preserved. Do not reset the working bot token, replace cloud hosting or start the legacy bot as a hosting dependency.
