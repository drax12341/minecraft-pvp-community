# Discord activation · v0.2

Target guild: **1568767259168608267**. Invite: https://discord.gg/a36rg6BxuX

The dedicated bot is authenticated and installed. The roles/channels setup has run.
Existing read-only channel permissions prevent panels in welcome, rules,
how-to-test and choose-your-modes. A server administrator must allow the bot
Send Messages there; the setup does not remove existing messages. Run setup again
after correcting those overrides to finish the missing panels.
Commands now use the deployed [cloud HTTP endpoint and D1 storage](FREE-CLOUD.md),
so a local runtime is not required. The gateway install instructions below remain
an optional fallback; do not run them expecting to replace cloud command delivery.

## Community desk rebuild

The [community desk rebuild](TIERBOT-REBUILD.md) adds `/desk`, live 20-slot
waitlist boards, `/pull`, player history, tester statistics and reviewed
retirement. Session capacity is now 1–20 (default 20); previously stored larger
settings are capped by queue admission. Boards show assigned tester/player
activity, keep other waiting players private, and offer a region selector.

## Install

1. Use a dedicated bot application from the official Discord Developer Portal. Never use a personal account token/self-bot.
2. Invite it to this guild using bot and applications.commands scopes. Setup needs Manage Roles, Manage Channels, View Channels, Send Messages and Read Message History. Administrator and Message Content intent are unnecessary. The bot’s role must sit above the roles it creates.
3. Copy .env.example to .env; enter credentials locally. Do not paste tokens in chat. ADMIN_TOKEN must be at least 32 random characters.
4. Run `npm run discord:plan`, inspect the target guild ID, then `npm run discord:apply`. Setup adds missing roles/channels and branded embeds once, without deleting existing content. It stops if an existing Staff category is public.
5. Set printed TESTER_ROLE_ID and MODERATOR_ROLE_ID in .env. Assign staff roles manually to trusted members.
6. Start the service: `node --env-file=.env server/index.mjs`. In a separate terminal: `npm run bot`.
7. Publish kit rubrics, train staff, test the complete flow, then open sessions. Enable Discord native onboarding/AutoMod through your server settings as appropriate; these settings are not automated.

## Commands

- `/practice create mode region note`: publish a community practice listing for 24 hours. The note is visible to members through `/practice list`; include kit/UTC availability/goal, never private personal details. At most three active listings and one per mode. `/practice list [mode] [region]` filters active posts. `/practice close id` closes your listing; moderators may close inappropriate ones. Closed/expired records remain stored; listings are never ranking results.
- `/tester-apply submit mode region experience availability`: verified Minecraft owners submit a private application. `/tester-apply status` shows only their decisions. Moderator `/tester-apply review` lists pending applications; add id, decision (`interview` or `declined`) and reason for an independent decision. No automatic staff-role assignment. One pending application per player/mode.
- `/profile name`: find a published player placement/profile from this tierlist; no external placements or private account IDs exposed.
- `/claim id action:release`: only the assigned tester can return an unfinished claim to its original waiting position. Completed results cannot be released.
- `/guide topic`: private onboarding, testing, appeals, staff and practice instructions (cloud).
- `/availability mode region`: optional filters; real session states, counts, capacity and cooldown (cloud).
- `/queue status mode region`: your private account verification, mode entry, deterministic waiting position, latest valid result ID/evidence and session-specific retest time (cloud). Positions exclude claimed tests and are not an ETA.
- `/preferences mode region`: toggle a safe zero-permission mode role and set a region role.
- `/verify-account user uuid name`: moderators record independently verified ownership. A UUID/name alone is not proof; agree a real ownership verification process before launch.
- `/session open|pause|close mode region capacity cooldown`: tester/moderator controls. Default capacity 30 and cooldown 72 hours. Optional settings replace the session values.
- `/queue join mode region`: verified members join an open session if space and cooldown permit.
- `/queue list`: members see their entries; testers see all open entries.
- `/queue leave mode`: cancels a waiting entry. Claimed entries need staff attention.
- `/claim id`: tester atomically claims another member’s waiting entry.
- `/result id tier evidence`: assigned tester records a result once, with a shareable HTTPS evidence link.
- `/appeal submit id reason`: member privately appeals their own completed test.
- `/appeal status`: private status of the member’s appeals.
- `/appeal review`: moderator lists pending appeals; add id, decision and reason to decide one. The original tester and appellant cannot review it. Revoke preserves audit records and removes the result from rank calculations.

All command replies are ephemeral and suppress mentions. Setup embeds use public website links. Interest roles never grant staff permissions. This application’s guild slash commands are replaced on registration, so use a dedicated application.

Register the cloud command schema without starting a gateway: `node --env-file=.env discord/bot.mjs --register-only`. The new guide, availability and queue-status commands run in the cloud Worker; the optional legacy gateway does not implement those additions. Do not start it as a hosting dependency.

Run `node --env-file=.env discord/upgrade.mjs` for a read-only plan and add `--apply` for the repeatable topic/panel upgrade. It checks Staff privacy, creates only a missing tester-recruitment channel and only edits its own upgrade-v3 panels. It does not remove existing messages, change roles or open sessions. #help is the command desk while older Start here channel permission overrides still block bot panels. See [upgrade verification](DISCORD-UPGRADE-STATUS.md).

## Publishing & privacy

Bot operations write public results/testing JSON to data/. Run `node scripts/publish-results.mjs` to export, validate, commit only those two public files and push to main. The resulting Pages deployment updates the public board and tagger feed. Private SQLite account, queue, audit and appeal records are not exported.

No confidential appeal channel is required: appeals are handled through private command replies and protected API records. Ask staff for correction/deletion requests. Back up the SQLite file; a comprehensive self-service deletion UI and ticket attachments are not implemented.

## Before opening queues

Confirm guild ownership and permissions, verify Staff privacy, publish exact kits and high-tier rubrics, establish real account ownership checks, recruit testers and independent appeal reviewers, test two accounts through verification→queue→claim→result→appeal, and test backups. The website request builder prepares a summary; it does not silently create a queue entry.
