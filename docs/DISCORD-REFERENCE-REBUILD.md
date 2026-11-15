# Discord reference rebuild · 15 November 2026

Reference material: three supplied screenshots and the 28.2-second recording
`Recording 2026-11-15 192204.mp4`. Frames were inspected at two-second intervals.
Both linked Discord messages returned HTTP 403 Missing Access to the installed
bot; their contents could not be inspected. Extraction and deployment evidence
are retained locally under `.runtime/reference-video/`.

The intended visual changes are deliberately small: emoji/divider channel names,
the Information / Tierlist / General / Requests / Community sidebar hierarchy,
purple testing boards, a combined all-time and UTC-month testing leaderboard,
red result cards with vertical fields and a single Minecraft skin portrait, and
the recording's compact profile summary. Existing Mace submodes remain available.

## Installation

`node discord/community-v4.mjs` prints the plan without credentials or requests.
`node --env-file=.env discord/community-v4.mjs --apply` applies it to guild
1568767259168608267. The installer reuses existing IDs by names/aliases, preserves
message history, edits only its own guide panels and records a before snapshot
and a read-back report. Existing channel permissions and role assignments remain
intact. New staff channels use private permissions. A failed edit is reported;
the installer does not replace a blocked channel with a duplicate.

Register commands with `node --env-file=.env discord/bot.mjs --register-only`.
Build the hosted HTTP interaction handler with `node scripts/build-cloud.mjs`.
The bot continues to use cloud hosting; no local gateway is required.

## Commands observed in the recording

| Reference | Implemented route |
| --- | --- |
| `/profile ign user` | Compact profile; existing `name` option also remains valid |
| `/start`, `/end` | Existing independently scoped tester sessions |
| `/next` | Existing `/pull`, with qualification, FIFO claim and private room checks |
| `/testerlb`, `/testerlbtotal`, `/testerlbuser` | Monthly, all-time and per-tester statistics |
| `/hightesterlb`, `/hightesterlbtotal`, `/hightesterlbuser`, `/htlb` | Actual HT3-or-higher test results; staff awards and revoked results excluded |
| `/htqueue` | Existing high-test request list |
| `/check_verification` | Your linked Minecraft account status |
| `/cdreset` | Existing per-mode cooldown reset with confirmation and audit |
| `/restrict`, `/unrestrict` | Existing per-mode testing restrictions |
| `/forcetier` | Existing reviewed tier adjustment with confirmation and audit |
| `/close` | Existing assigned test closure and archive lifecycle |
| `/request_test_panel`, `/verification_panel` | Moderator-only installation/update of the existing testing hub and verification controls |
| `/leave` (queue screenshot) | Existing waiting-queue cancellation |

The recording mostly shows command descriptions; it demonstrates only a profile
invocation. Other visible commands are **not claimed as implemented** by this
change: automatic pulling, bulk cooldown reset, stale-role cleanup, custom ticket
deadlines/status/participant removal, restriction editing, direct messages,
external tierlist migration, pass-evaluation shortcuts, leaderboard reset and
verification removal. Existing `/match`, `/ticket`, `/assessment`, `/result`,
`/cooldown` and `/player` provide the supported workflows. No placeholder commands
claim to perform those missing operations. In particular, a restriction does not
erase earned tiers, and a staff correction does not count as a completed test.

## Updating panels

Queues refresh after actions and through the existing scheduled maintenance path;
Refresh checks immediately. This implementation does not claim a ten-second
polling guarantee. Existing Components V2 queue messages retain their immutable
message flag, while adopting the compact purple layout.

The leaderboard reads the durable result records, excludes revocations and staff
adjustments, and edits one configured bot-owned message without pinging testers.
The authenticated `/api/internal/reference-panels` endpoint exposes its current
payload via GET and refreshes published boards via POST. It requires the existing
bot service credential and does not accept arbitrary channel targets.

See Discord's [message documentation](https://docs.discord.com/developers/resources/message)
and [component reference](https://docs.discord.com/developers/components/reference)
for embed limits and the immutable Components V2 flag.
