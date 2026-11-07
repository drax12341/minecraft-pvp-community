# Activate the Discord community

Main invite: https://discord.gg/a36rg6BxuX

The setup creates missing roles and channels; it never deletes or renames existing channels. `npm run discord:plan` is read-only and needs no token.

1. Create a bot application in the official Discord Developer Portal using your own account. Do not use a personal account token or self-bot.
2. Invite it to the intended guild with `bot` and `applications.commands` scopes. Setup requires Manage Roles and Manage Channels; ordinary operation requires View Channels, Send Messages and Read Message History. Administrator and Message Content privileged intent are not required. Keep the bot role above the roles it creates.
3. Copy `.env.example` to `.env`. Enter the bot token locally, the application/client ID and guild ID. Generate ADMIN_TOKEN using `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Do not send any token in chat or commit it.
4. Run `npm run discord:plan`, then `npm run discord:apply`. Confirm the printed guild name matches your intended server. Record the printed tester and moderator role IDs in `.env`. Manually assign these roles only to trusted staff.
5. Run `npm run build`, then `node --env-file=.env server/index.mjs`. In a separate terminal run `npm run bot`.
6. Post the reviewed onboarding text below in the matching channels. Enable Discord Community/onboarding, AutoMod and moderation alerts using the server UI as appropriate for your community. These settings are not automated here.

## Commands

- `/verify-account user uuid name`: moderators record independently confirmed ownership. A UUID or username by itself proves no ownership. Use an authenticated Minecraft verification service/server or documented staff verification before this command. Automatic account ownership verification is not implemented.
- `/queue join mode region`: creates one open entry per member/mode; verification required.
- `/queue leave mode`: cancels a waiting entry. Claimed tests need staff attention.
- `/queue list`: members see their own entries; testers see all open entries.
- `/claim id`: tester claims another member's waiting entry atomically.
- `/result id tier evidence`: assigned tester records a result once, with an HTTPS evidence URL.

The bot uses ephemeral replies. It does not send DMs, mass mentions, join arbitrary servers or impersonate an account. It registers guild-specific commands, not global commands. This replaces the application's commands in the selected guild; use a dedicated application.

Results immediately appear on the local API/site. For the public static site, run `node scripts/export-results.mjs`, review the JSON, commit it, and push. Private queue/account/audit tables are never exported. The bot/API must stay running on a machine or host; GitHub Pages cannot run a persistent bot or SQLite service. Free public website hosting is separate from reliable 24/7 bot hosting.

## Onboarding copy

### Welcome

Welcome to Minecraft PvP Community. Find practice partners, learn a mode, share a clip and work toward your next tier. Start with the rules, choose a region and your modes, then introduce yourself. Community testing is preparing to launch; staff will announce approved kits and testing hours before queues open.

### Rules

Respect other players. No hate, harassment, doxxing, malicious downloads, cheating, account sharing, boosting or rigged results. No unsolicited ads or DMs. Use the matching channels. Never share your password or account token. Staff must explain verification and evidence requests. Ask for a different reviewer if you need to appeal a test. Sponsors never buy tiers or influence appeals.

### Choose your modes

Tell staff which modes and region you play. The initial setup creates interest roles but does not automatically assign them. Discord native onboarding or a reviewed role menu can be configured after the bot is installed. Breach and Density are proposed community categories pending agreed rules.

### Appeals

Do not post private evidence or accusations in public chat. Open a private staff ticket through a configured ticket system, or contact a moderator. The initial setup creates an appeals information channel; it does not create confidential ticket threads. Moderation, correction, deletion, result reversal, cooldown rules and reviewer separation need an operating policy before public testing starts.

## Launch checklist

Verify actual guild ownership and bot permissions; review Staff category privacy; recruit testers; publish kit/server/version rules; document ownership verification and appeals; run two test accounts through queue/claim/result; test backups/restores; appoint a data contact; announce the launch. Never advertise a functioning queue until the bot is installed and staff are ready.
