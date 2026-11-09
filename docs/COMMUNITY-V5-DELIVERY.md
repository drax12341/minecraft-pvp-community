# Platform journey upgrade · 9 November 2026

Website: https://minecraft-pvp-community.draxion0.chatgpt.site

Discord testing desk: https://discord.com/channels/1568767259168608267/1569347570214506607

Support: https://discord.com/channels/1568767259168608267/1569347634395746364

## Verified baseline before edits

Authenticated Discord API: **73 channels, 56 roles, 19 guild commands**. Local test runner: **23 passing tests**. Public `/healthz` reported `community-v4`, `cloud-http`, `pcRequired:false`. `/api/rankings` had zero players/results; `/api/testing` had zero sessions. The application retained the existing Sites interaction endpoint. Private local evidence: `.runtime/platform-audit.json` (not a deliverable or public asset).

## Implemented stage

- Durable private waitlist preferences, independent from active queues and interest roles.
- Human-approved per-mode qualifications; no automatic roles, no self-qualification, no moderator bypass of mode qualification. A tester can hold only one active claim.
- Private testing rooms with durable provisioning reservations, exact-topic reconciliation after uncertain Discord API outcomes, participant-only access, five-minute readiness, private archival and archive-before-release handoffs retaining original order.
- High-tier sign-off binds the exact assessment revision, proposed tier and evidence link. Results store assessment revision, rubric and kit versions. Existing records are retained without inventing missing historical metadata.
- Account verification records actor/time; renames retain the UUID, and silent account replacement is blocked for private recovery review.
- Support category questions, expiring private draft review before submission, technical category, limits, assignment, workflow state, staff-only notes, resolution summaries and partial-creation reconciliation. Confidential reports default to owner/explicit independent reviewers.
- Website testing drafts persist locally through refreshes; authenticated actions remain in Discord. Saved-player and comparison behaviour retained. Added original pilot manifests and inventory diagrams, explicit preparation-only modes, and cloud-served shared configuration.
- Editable shield retained; generated 512px Discord-ready icon, 64px raster favicon, and SVG/PNG testing, support and standards panels in `web/brand/`.
- Additive D1 migration `0003_journey_safety`, original pilot standards, staff handbook/permission matrix, repeatable audit and panel update scripts.

## Validation

**29 automated tests pass** at this source stage. Added cases cover waitlist privacy/idempotence, per-mode authorisation, competing tester claims, evidence substitution, identity conflicts/timestamps, private drafts/internal notes/confidential reports, and room recovery after an API timeout with retained queue order. Existing SQL, migration, signature/replay, queue capacity, appeal independence, application privacy, browser-DOM website, saved-player, comparison and refresh tests still pass. Worker build/syntax and Git whitespace checks pass.

Browser DOM tests are not desktop/mobile visual QA. SQLite tests exercise the real migration SQL and a D1-compatible adapter; they are not a stress test of deployed D1 concurrency. No fake accounts or placements were inserted in production.

## Concrete unfinished work and launch blockers

- Browser access host and native Discord automation pipe unavailable; fresh reference-channel/kit-image research, visual desktop/mobile QA and member-driven Discord acceptance checks remain blocked. See [research evidence](RESEARCH-V5.md).
- Authorised staff IDs/modes, real benchmark opponents and calibration evidence are still needed. No staff powers were assigned or testing sessions opened. Sword/Axe/Bow have pilot specifications; twelve other modes still need complete manifests. Those modes cannot open through the new session command.
- Manual ownership verification has documented limitations; no trustworthy automated integration was found. Recovery transfers still require an independently reviewed migration plan. Existing verification timestamps remain unknown where not previously recorded.
- Session alert roles are opt-in preferences; automatic session notification delivery is not yet implemented. Claims still select an explicit entry; there is no claim-next command. No automatic stale-room scheduler or readiness timeout release exists; staff perform archival/release.
- Support reopening and automatic escalation notifications remain unimplemented. `/ticket recover` can recover an existing private channel; if no channel is found, the owner must investigate the retained reservation. It does not rebuild every missing welcome message.
- Public tester aliases and complete shareable per-player history/revocation presentation remain unfinished. Current/peak rankings and ordinary/high result feeds remain available. Public feeds continue excluding private Discord IDs, applications, tickets, notes and internal assessments.
- Historical staff-report channels need an explicit existing-access audit. New report routing does not remove old overwrites. Administrators inherently retain Discord channel access. Staff must recuse on conflicts, including original sign-off reviewers during appeals.
- Not all duplicated/legacy navigation was consolidated; preserving channel/message history took precedence over unverified channel removal. Existing unrelated and historical channels were retained.
- A rollback to pre-v5 Workers needs care: old positional SQL inserts are incompatible with the expanded account/session tables. Prefer forward fixes; do not erase records to roll back schema.

## Editable deliverables and staff launch

Source: `cloud/journeys.mjs`, cloud operations/store/worker, Discord command/panel scripts, `config/kit-manifests.mjs`, `web/standards.html`, `web/standards.js`, `web/mark.svg`, `web/brand/`, and migration `0003_journey_safety.sql`.

Staff checklist: approve real kits/benchmarks → appoint staff manually and record independent qualifications → review confidential channel access → run the two-person journey checks → complete desktop/mobile/keyboard QA → advertise only actually staffed sessions. Full procedures: [STAFF-OPERATIONS-V5.md](STAFF-OPERATIONS-V5.md).

This is a tested platform stage, not a claim that all requested journeys are production-complete. No Minecraft hosting, plugins, worlds or gameplay configuration was changed.
