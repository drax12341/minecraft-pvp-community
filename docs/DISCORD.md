# Discord activation · v0.2

Target guild: **1568767259168608267**. Invite: https://discord.gg/a36rg6BxuX

Live changes remain blocked until PC control or a bot connection works. PC control returns a missing native pipe; the connector returns Authorization required. A public invite grants no server-management access.

## Install

1. Use a dedicated bot application from the official Discord Developer Portal. Never use a personal account token/self-bot.
2. Invite it to this guild using bot and applications.commands scopes. Setup needs Manage Roles, Manage Channels, View Channels, Send Messages and Read Message History. Administrator and Message Content intent are unnecessary. The bot’s role must sit above the roles it creates.
3. Copy .env.example to .env; enter credentials locally. Do not paste tokens in chat. ADMIN_TOKEN must be at least 32 random characters.
4. Run `npm run discord:plan`, inspect the target guild ID, then `npm run discord:apply`. Setup adds missing roles/channels and branded embeds once, without deleting existing content. It stops if an existing Staff category is public.
5. Set printed TESTER_ROLE_ID and MODERATOR_ROLE_ID in .env. Assign staff roles manually to trusted members.
6. Start the service: `node --env-file=.env server/index.mjs`. In a separate terminal: `npm run bot`.
7. Publish kit rubrics, train staff, test the complete flow, then open sessions. Enable Discord native onboarding/AutoMod through your server settings as appropriate; these settings are not automated.

## Commands

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

All command replies are ephemeral and suppress mentions. Setup embeds use public website links. Interest roles never grant staff permissions. This application’s guild slash commands are replaced on bot startup, so use a dedicated application.

## Publishing & privacy

Bot operations write public results/testing JSON to data/. Run `node scripts/publish-results.mjs` to export, validate, commit only those two public files and push to main. The resulting Pages deployment updates the public board and tagger feed. Private SQLite account, queue, audit and appeal records are not exported.

No confidential appeal channel is required: appeals are handled through private command replies and protected API records. Ask staff for correction/deletion requests. Back up the SQLite file; a comprehensive self-service deletion UI and ticket attachments are not implemented.

## Before opening queues

Confirm guild ownership and permissions, verify Staff privacy, publish exact kits and high-tier rubrics, establish real account ownership checks, recruit testers and independent appeal reviewers, test two accounts through verification→queue→claim→result→appeal, and test backups. The website request builder prepares a summary; it does not silently create a queue entry.
