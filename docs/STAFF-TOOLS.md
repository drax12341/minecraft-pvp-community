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

The source scope includes this community and up to ten other Discord servers
where the bot is installed and can read bans. Live discovery currently finds
**zero other servers**. No private third-party server is scanned without bot
membership and the required API access. Discord has no universal alternate-account lookup.
An old/new account, a linked IGN or a missing local ban is not proof that an
account is safe, malicious, or related to another account. The tool does not
obtain IP addresses or device fingerprints, create an automatic risk verdict,
punish anyone, or publish an accusation.

A 403 ban lookup is reported as unavailable, distinct from a 404 missing ban.
Ban reasons are not copied into the report. Account checks are audited and their
replies are ephemeral, with mentions disabled.

## Native bot permissions · verified 16 November 2026

The owner enabled the permissions after Discord rejected the bot's attempt with
HTTP 403 Missing Permissions. Live role read-back now confirms Ban Members and
Moderate Members, and the real Discord ban-list endpoint returns successfully.
Manage Roles and Manage Channels also remain available. Native timeout actions
are covered with mocked requests; no live member was punished for verification.

The bot currently also has Administrator enabled by the owner's role change.
The new tools do not require Administrator. `/security status` reports its actual
permission coverage, including this broader grant. The application has not
silently removed or expanded the owner's native role configuration.

## Expanded account statistics

`/alt-check user` now returns two compact, private cards with 24 fields:
account age/creation, server tenure/join date, role count, membership screening,
local ban state, timeout, server boost, linked IGN/verification date, moderation
counts, active restrictions/cooldowns, and explicitly qualified review signals;
plus official test totals, 30-day activity, modes, peak placement, latest test,
waiting/active queue entries, completed tester work, qualifications and last
logged bot action. The last action is not claimed to be general Discord activity.

Test counters exclude revoked results and staff awards. Peak placement includes
valid reviewed staff placements. Case reasons, appeal text and evidence links
are not included in the report. A Refresh Report button routes through the same
security checks; a removed staff role cannot keep refreshing a cached report.

`/server-info` adds live member/presence/boost/channel/role counts and testing
activity. `/security status` distinguishes ready native actions from missing
permissions and reports the current count of other bot servers.

## External ban checks · researched 16 November 2026

The report now has a third card, **External Ban Evidence**. Discord discovery
uses the bot's own guild list, checks at most ten other servers with at most
three concurrent requests, and requests each exact Discord user ID's ban entry.
Ban Members, View Audit Log or Administrator access is required. A response is
accepted as a finding only when the source returns the requested user ID.
Only Discord's `Unknown Ban` error code 10026 is treated as no current ban;
403, unknown-guild 404, rate limits and network failures remain unavailable.
Reasons are source-attributed, escaped and bounded. Discord does not provide
the original ban date through this endpoint, so the report shows the check time.

Minecraft research used the named services' own public sites and frontend APIs:

- [PvPHQ](https://pvphq.com): its public `/api/v1/players/{uuid}` endpoint is
  queried only for a locally linked Minecraft UUID. Returned UUIDs must match.
  The verified profile schema does not provide ban history. A profile, a 404,
  or a valid tier is never treated as a clean ban record.
- [CatPvP](https://catpvp.xyz): public player pages were found, but no supported
  public ban-history API was verified. The report provides a source/profile
  link and explicitly marks the ban feed as unverified; it does not claim to
  scan a hidden database.
- [PvP Club](https://mcpvp.club): the official site identifies the modern PvP
  server, but no public ban-history endpoint was verified. Other similarly
  named domains were not substituted as this source.

The CatPvP/PvP Club statuses are research coverage notes, not successful live ban
queries. Actual ban-history integrations require those operators to provide an
authorized feed or install the bot in their Discord with read access. No login,
CAPTCHA, private API or account restriction is bypassed. External payloads are
bounded to 128 KiB, redirects are rejected, timeouts are five seconds, and the
Discord bot token is sent only to Discord. External findings are not persisted
as local convictions and never trigger automatic punishments.

Validation includes real public-profile probes, inaccessible/malformed sources,
UUID mismatches, precise Discord error handling, token isolation and report-size
limits. The current real probe found zero other bot guilds and therefore returned
zero external Discord bans; no test finding was posted into the community.

## Verification

Tests cover the complete command-policy catalogue, role escalation/private-access
protection, unknown account relationships, inaccessible ban lookups, targeted
role mutation/read-back, and restoration of channel lock state. The full existing
testing, support, ownership, result and website regression suites also run.

Official references: [guild/member/ban endpoints](https://docs.discord.com/developers/resources/guild)
and [application command permissions](https://docs.discord.com/developers/interactions/application-commands#permissions).
