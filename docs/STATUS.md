# Delivery status

## Implemented

- Static public site, mobile CSS, mode rail, search, region/status filters, profiles, active/peak information, comparisons, share links and SVG cards.
- Attributed live-fetched MCTiers top-50 snapshot with a visible timestamp and scope disclosure.
- Community directory, testing guide, sponsor contact page and privacy/source explanations.
- Discord setup dry run and idempotent creation of missing roles/categories/channels; private Staff category and read-only announcement channels for a newly created layout.
- Guild bot commands for staff verification, queues, claims and evidence-linked results. No privileged message-content intent.
- SQLite transaction protection for claims/results, unique open entries, source UUIDs, audit records, peak preservation and public JSON export.
- Experimental Fabric 1.21.1 nametag/tablist client, asynchronous snapshot cache, selected-mode and highest-active fallback, mode/source/config commands.
- Website/mod CI, GitHub Pages deployment and weekly promotion-draft workflow with optional own-channel webhook.

## Activation required

- Discord bot application, installation and private credentials; confirm guild ID before applying setup.
- 24/7 bot/API host if needed. Static website hosting cannot run these services.
- Publish kits, account ownership verification procedure, staff responsibilities and appeals/privacy workflow before tests begin.
- Optional own-channel announcement webhook for automatic weekly promotion.

## Not implemented or not verified

- Full browser visual QA and in-game Fabric/mixin smoke testing.
- All provider aggregation, complete player databases, automatic kit detection, nearest-player UI, mode icons, chat tags, multiversion/NeoForge/Quilt support.
- Automatic Minecraft ownership verification, cooldowns, reversible moderation/results UI, confidential appeal tickets, self-service roles, tournament brackets or automated score capture.
- A hosted Minecraft game server, anti-cheat, replays, global matchmaking or reliable cross-provider tier conversions.
- Sponsor deals, payments, social account creation or guaranteed audience growth.

Keep these gaps visible when announcing the community. The repository is a foundation for continued development, not a claim of parity with mature networks.
