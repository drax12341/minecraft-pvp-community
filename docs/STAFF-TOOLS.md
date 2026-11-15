# Staff tools · 15 November 2026

The update uses short public panels and private command replies. The catalogue
contains 99 slash commands. Every registered command and subcommand is classified
in `config/command-policy.mjs`; handlers retain their existing participant,
qualification, independent-review and confirmation checks.

## New tools

| Tool | Access | Behavior |
| --- | --- | --- |
| `/alt-check user` | Security Analyst, moderator or higher | Discord account age/join date, local ban lookup, linked IGN, local cases/restrictions; relationships remain unknown |
| `/add-role`, `/remove-role` | Role Manager, moderator or higher | One targeted role change, hierarchy validation, private-access protection and audit trail |
| `/role-info` | Everyone | Role metadata; actual changes always recheck full eligibility |
| `/member-info` | Staff with inspection access | Private membership and linked-account overview |
| `/server-info` | Everyone | Aggregate server/testing status |
| `/staff-help`, `/permissions` | Everyone | Show tools available to the caller; inspect a command's access tier |
| `/staff roster` | Staff with inspection access | Role roster limited to the first 1,000 members; requires the bot's member-list access |
| `/staff assign`, `/staff remove` | Actual and configured server owner only | Maintain approved, zero-permission staff roles; earned tier/verification roles remain protected |
| `/security sources`, `/security audit` | Security Analyst, moderator or higher | Source transparency and read-only native-role permission review |
| `/slowmode`, `/lock`, `/unlock` | Event Manager, moderator or higher | Current text-channel controls; unlock restores the saved Send Messages bit and retains other overrides |
| `/timeout`, `/untimeout` | Moderators or higher | Native communication timeout; both actor and bot hierarchy enforced, administrators protected |

All mutations require a 10–500-character reason, write an audit attempt before
the Discord request and write a completion event after success. Role tools use
Discord's single-role endpoints, preserving unrelated roles, and verify the
member afterward. Failed API calls never produce success replies.

## Specialist roles

Six roles are created with **zero native Discord permissions**, beneath the bot:

- Community Manager: moderation, confidential report review and all new tools.
- Senior Moderator: moderation, confidential report review and all new tools.
- Trial Moderator: ordinary support and member inspection.
- Security Analyst: account checks, security audit and member inspection.
- Role Manager: safe role changes and member inspection.
- Event Manager: channel controls and member inspection.

They start unassigned. Only the server owner may assign these staff roles through
the new staff commands. No new role grants tester qualification automatically.
Existing moderator/tester/support roles retain their previous access. New support
roles are included in newly created ordinary ticket permissions; confidential
reports remain restricted to specifically authorized reviewers.

Application access is enforced on every command request. Discord may still show
staff command names in autocomplete; visibility overrides in Server Settings →
Integrations require Discord's separate application-command permission workflow.
Visible command names confer no authority.

## Alt-check limits

The default source scope is **this community only**. No partner servers or external
ban databases are connected. Discord has no universal alternate-account lookup.
An old/new account, a linked IGN or a missing local ban is not proof that an
account is safe, malicious, or related to another account. The tool does not
obtain IP addresses or device fingerprints, create an automatic risk verdict,
punish anyone, or publish an accusation.

A 403 ban lookup is reported as unavailable, distinct from a 404 missing ban.
Ban reasons are not copied into the report. Account checks are audited and their
replies are ephemeral, with mentions disabled.

## Native bot permissions

The live bot already has Manage Roles and Manage Channels. Read-back found it
does **not** have Ban Members or Moderate Members. Discord requires the former
to read bans and the latter to apply timeouts. Those actions remain unavailable
until the owner authorizes and enables the precise missing permissions. No
Administrator grant is requested or applied.

## Verification

Tests cover the complete command-policy catalogue, role escalation/private-access
protection, unknown account relationships, inaccessible ban lookups, targeted
role mutation/read-back, and restoration of channel lock state. The full existing
testing, support, ownership, result and website regression suites also run.

Official references: [guild/member/ban endpoints](https://docs.discord.com/developers/resources/guild)
and [application command permissions](https://docs.discord.com/developers/interactions/application-commands#permissions).
