# Community Discord rebuild

The recovered reference is the user's `tierbot-code-only-upload.zip` (Champion
Tierlist). Its extracted source stays in the ignored `.runtime/tierbot-reference`
folder. The current community's persisted accounts, results, appeals, role names,
seven Mace modes and cloud HTTP command delivery remain the foundation.

## Capabilities and build order

| Capability | Responsibility | Depends on |
| --- | --- | --- |
| player-desk | One private entry point, verified profile and placement history | Existing accounts/results |
| queue-desk | Real session boards, join/leave/status buttons, staff pull into a private room | Existing queues/qualifications/rooms |
| tester-tools | Monthly and overall documented test counts, staff dashboard | Existing results/revocations |
| retirement | Owner requests, independent moderator decisions, retained history | Existing accounts/results |
| activation | Idempotent branded panels, command registration and migration instructions | All above |

Build order: player-desk and queue-desk, then tester-tools, retirement, activation.
The user requested implementation directly; this document records the concrete
scope and validation rather than introducing another approval cycle.

## Acceptance criteria

- Every mode name comes from `config/community.json`; no Champion branding,
  unrelated kits, sample ranks or old guild IDs enter the new workflows.
- Player buttons call the same authorised handlers as slash commands. No client
  supplied role, hidden button or channel location confers staff permission.
- Pulling follows deterministic queue order, checks mode qualification and
  recovers an existing claim/room after a Discord API failure.
- Queue boards show the session host, each assigned tester and the verified
  Minecraft name currently being tested, as requested by the user. They show
  occupied slots out of 20, waiting/active counts, and a short guide. Other
  waiting players remain private. Region selection opens a personalised board.
- Private rooms continue to grant the player and assigned tester explicit access;
  readiness and independent high-tier review remain mandatory.
- Statistics count real, non-revoked results and use UTC month boundaries.
- Retiring requires an owner request and an independent moderator decision tied
  to the exact placement. It retains peak/history and excludes the retired mode
  from active points. A later valid result reactivates that mode.
- Existing commands stay compatible. New command definitions must fit Discord's
  option ordering, component limits and custom ID length limits.
- Migrations are additive. Tests exercise the actual SQLite/D1 statements and
  mocked Discord requests; builds validate the deployable cloud bundle.

## Scope boundaries

The existing high-test phase/opponent/evidence flow supplies TierBot's bridge and
evaluation functionality. Existing qualification, ticket and appeal controls are
reused. The rebuild does not import Champion data, grant staff automatically,
replace the community's scoring policy, or silently enable the reference's
30-day scam-trap punishment and cross-channel deletion.

No AI model decides placements, moderation, ownership or appeals. OmniRoute Setup
was consulted: the gateway is not installed/connected in this session and these
deterministic workflows do not require a model provider.

## Verification

Use `npm.cmd test`, `npm.cmd run build:cloud`, and
`node --check dist/server/index.js`. The existing baseline is 45 passing tests.
Live Discord activation and cloud deployment must be reported separately from
local verification; a local build is not evidence of a deployed release.

## Reference map

Graphify extracted a code-only comparison of 29 source files: 708 nodes, 1,968
directed edges and 27 communities, with no import cycles. Its hub analysis
identified the reference's database `save`/settings functions, Discord service
and current `CloudStore`/operations handlers as the main integration points.
The report and graph are in `.runtime/tierbot-map/graphify-out/`.

Graph diagnostics reported 22 dangling endpoints, four self-loops and 190
same-endpoint relation collapses. This map is a navigation aid; source inspection
and executable tests establish behaviour. No semantic LLM extraction was run
(zero extraction-model tokens); the source includes structurally inferred edges.

## Activation and commands

`npm.cmd run discord:desk` previews the panel plan. The apply command
`npm.cmd run discord:desk:apply` updates only this bot's panels in existing
waitlist/request/staff channels, snapshots the replaced messages, and saves public
board pointers to the community configuration. It starts public boards on EU;
each board's region menu includes all supported regions. It creates no channels
and changes no roles or permissions.

- `/desk`: private player workspace.
- `/queue-board mode region`: current availability and join/leave/status controls.
  Moderators can add `publish:true` in a text channel; re-runs recover the same board.
- `/pull mode region`: claim the next eligible player and create/recover their room.
- `/player self|view|history`: profile and the last ten valid placements.
- `/leaderboard mode`: active placements using the existing paginated roster.
- `/tester desk|stats|leaderboard`: current assignment and monthly/overall activity.
- `/retire request|status|cancel|review`: reviewed retirement and voluntary return.

Apply migration `0007_community_desk` through the existing Sites publishing flow
before registering new commands. `npm.cmd run discord:register` registers them
without starting the legacy gateway. Queue boards refresh after relevant
interactions, with a manual Refresh fallback; they do not need a polling daemon.

Existing support/report tickets, staff recruitment, moderation case records,
appeals, qualifications, high-tier opponents, scoring and independent sign-off
continue through their established commands. Unlike the recovered monolith, this
implementation keeps related mutations transactional and retains revocation and
review records. No Champion staff, accounts or role IDs are imported.

## Delivery verification

The panel installer successfully updated nine existing-channel panels: seven
waitlists, the player entry desk and the staff desk. Previous message payloads
were snapshotted under ignored `.runtime/community-desk-before-*.json` files.
The changes add eight integration checks to the original 45-test suite, including
simultaneous admission at the 20-slot cap and refresh after a deferred interaction.
No sample match, fake placement or live test application was created for QA.

Official API reference: [Discord interactions](https://github.com/discord/discord-api-docs/blob/main/developers/interactions/receiving-and-responding.mdx).
