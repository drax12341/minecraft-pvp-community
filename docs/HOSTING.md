# Continuous Discord hosting

The active no-PC deployment uses the community's existing Sites Worker and D1
database. See [FREE-CLOUD.md](FREE-CLOUD.md). No Railway subscription is required.
The Railway instructions below describe an optional gateway-hosting alternative.

GitHub stores and builds code. GitHub-hosted Actions jobs have a six-hour limit;
they are not a continuous bot host. Making a repository private does not change this.

## Prepared Railway deployment

Connect Railway to `drax12341/minecraft-pvp-community` and deploy the default branch.
The checked-in Dockerfile runs Node 24 and installs only production dependencies.
No `.env`, SQLite database, Git history, Java build output or local files enter the image.
The repository may remain public: credentials belong in Railway service variables.

Before starting:

1. Attach a persistent volume at `/data`. The runtime refuses Railway startup without a volume.
2. Copy these values privately from local `.env` into Railway variables:
   `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`,
   `TESTER_ROLE_ID`, `MODERATOR_ROLE_ID`, `ADMIN_TOKEN`.
   Do not add the local `API_URL` or `PORT`: the runtime connects its private API automatically.
3. Set `DATABASE_PATH=/data/community.sqlite`. Keep exactly one replica and disable serverless sleeping.
4. Configure a public domain for `/healthz` and optional public JSON feeds.
5. Wait for health to report `{"ok":true,"bot":"online"}`; stop the local bot before using the cloud copy.
6. Enable Railway volume backups and a spending limit/alert. A persistent disk is not an off-site backup.

The runtime restarts the Discord process with exponential backoff after failures;
Discord.js reconnects gateway interruptions. Railway restarts the whole container
if it exits. No service can promise zero downtime. Authentication failures require
valid replacement credentials; restarts cannot fix revoked tokens.

Only `/healthz`, `/data/results.json` and `/data/testing.json` are exposed.
Administrative endpoints remain on loopback. Public feeds exclude private Discord
account, queue and appeal data. The existing GitHub Pages board and tagger still
use committed exports until their data URL is explicitly switched to a deployed feed.

## Cost and activation

Railway Hobby currently starts at $5/month with $5 of usage included; extra usage
can add charges. It is not a free, unlimited always-on guarantee. No paid service
has been provisioned by preparing these files. An authenticated hosting account
and approval of the actual billing arrangement are still needed.

Free Render services sleep after inactivity and do not provide persistent disks.
They do not meet this deployment's continuous availability and SQLite persistence needs.

## Local fallback

`npm run start:community` starts the API and bot together using local `.env`,
with process recovery. It only stays online while that process and PC are running.

References: [GitHub Actions limits](https://docs.github.com/en/actions/reference/limits),
[Railway config](https://docs.railway.com/config-as-code/reference),
[Railway volumes](https://docs.railway.com/volumes),
[Railway pricing](https://docs.railway.com/pricing),
[Render free services](https://render.com/docs/free).
