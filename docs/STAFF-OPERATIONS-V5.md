# Staff operations and launch gates

This is an independent community tierlist. No imported placements, purchased queue positions or paid appeal influence. The HTTP interaction bot runs in the cloud; an offline-looking gateway indicator does not mean its commands require the owner's PC.

## Permission matrix

| Role | Public/community | Account verification | General cases | Confidential staff reports | Assess/publish | High-tier review | Staff appointment |
|---|---|---|---|---|---|---|---|
| Member | Read instructions, converse, preferences, private help | Request | Own case | Own report | No | No | No |
| Verified player | Also waitlist and eligible queue | Request corrections | Own case | Own report | No | No | No |
| Helper | Public guidance | No | Only with explicit Support Team appointment | No | No | No | No |
| Support staff | Community help | No | Claim, assign, state, notes, close | No | No | No | No |
| Trainee tester | Supervised training | No | Own case | Own report | No independent publishing | No | No |
| Qualified tester | Community help | No | Own case | Own report | Assigned claim in approved modes | No | No |
| Senior tester | Calibration | No | Own case | Own report | Approved modes | Independent, separately approved senior modes | No |
| Moderator | Moderation | Manual ownership decision | Support operations | Only explicit independent reviewer configuration | Requires mode qualification | Requires senior mode qualification | Human decision |
| Administrator/owner | Server administration | Manual ownership decision | All, including inherent Discord access | Inherent administrator access cannot be excluded by channel overwrites | Requires mode qualification in bot | Requires senior mode qualification in bot | Human decision |

Interest and notification roles must have zero guild permissions. Neither an application nor a qualification command grants Discord roles. The qualification roster is an additional server-side gate. An independent moderator must record `/qualification grant user mode reason`, with `senior` only after senior calibration. Self-grants are rejected. Revoke on departure or loss of qualification. Moderators do not automatically qualify in every mode.

Confidential reports default to the owner and explicitly configured `DISCORD_REPORT_REVIEWER_ROLE_IDS`, not all moderators, helpers or testers. A reviewer involved in the allegation must recuse. If the owner is implicated, establish an independent review panel before collecting the report; administrators inherently retain access and this platform cannot promise secrecy from the guild owner. Historical report channels created before v5 need a manual access audit; v5 does not silently rewrite old channels.

## Identity

No trusted automatic ownership integration was found in the audited project. A typed IGN or a public UUID lookup is not ownership proof. Open an account case privately. Staff explain the chosen manual evidence and its limitations, verify control through an already trusted account channel or a supervised challenge using an existing trusted integration, then record `/verify-account`. If reliable control cannot be established, leave unverified. Never collect passwords, Microsoft tokens, recovery codes, launcher files or unrelated screen contents. Do not require changes to a Minecraft server.

Verification stores the actor and UTC time. Existing v4 records have unknown verification times; migration deliberately does not invent them. A rename updates the name against the same UUID. A changed UUID is blocked and routed to recovery; staff must independently resolve identity conflicts, retain an audit record and plan any exceptional transfer. Recovery is not an automatic overwrite feature. A unique UUID constraint prevents linking the same account twice.

## Player journey

1. Read rules, open an account case, complete reliable ownership review.
2. `/preferences` selects interests. `/waitlist join mode region` records future demand and reserves no queue place. `/interests role:tests` toggles alerts.
3. Read the approved, versioned kit and rubric. Until exact manifests, arena requirements and benchmark opponents are approved, keep sessions closed.
4. Qualified staff open an actually staffed `/session open`; players `/queue join`. Capacity and eligibility are checked atomically. No ETA is advertised.
5. A qualified tester claims an entry. `/test-room open id` creates a private room restricted to the player, assigned tester and bot (plus inherent administrators).
6. Both use `/test-room ready id` within five minutes of the call. A missed call awards no result and no cooldown. Archive then release, preserving original queue creation order. There is no background timer service that automatically releases missed calls; the tester executes the documented outcome.
7. Write the versioned kit, exact version, agreed location, round format, recording agreement, reset and disconnect rules in the room. Default format: two warmups, first to ten scored rounds, alternate sides. Pause unresolved lag. Replay interrupted rounds only with both parties' agreement. Never turn a disconnect into an invented skill placement.
8. Record six rubric dimensions with `/assessment record`. Feedback must include demonstrated strengths, specific weaknesses, next practice goals and benchmark evidence. A numeric score never converts automatically to a tier.
9. HT1/LT1/HT2/LT2 require an independent senior qualified reviewer. `/assessment review` binds the exact revision, proposed tier and HTTPS evidence. Changing scores/rationale creates a new revision; substituting evidence prevents publishing against the old sign-off.
10. Assigned qualified tester publishes `/result`; `/queue status` shows latest result ID, evidence and retest timestamp. Archive the room privately. Publication and archival are separate operations; staff must finish both.

One tester cannot hold two active claims. Archive before release/handoff so a previous tester cannot retain access to a new test room. A fresh room is created for a new assignment, with original queue order retained. Opening a session requires the explicit pilot kit version and a real benchmark/calibration reference. Only Sword, Axe and Bow currently have complete pilot manifests. Qualified staff must actually review and approve the content before opening.

## Support and appeals

Use the public support panel: category → short questions → private draft review → submit. Drafts expire in 15 minutes, three pending drafts per user. Two active cases maximum, one per category. General, account, player report, staff report and technical categories are supported. The slash `/ticket open` path submits the fields directly after Discord's command review.

`/ticket claim`, `/ticket assign`, `/ticket state` (waiting-staff, waiting-player, escalated), `/ticket note`, `/ticket notes`, `/ticket close id reason`. Internal notes stay in the database and ephemeral staff responses, never in the player's channel. Assignments check recipient access and never grant permissions. Use a useful resolution summary as the closure reason. Closure retains a read-only private channel. Controlled reopening is not implemented; a follow-up case can reference the closed case ID.

On uncertain channel-creation errors, the ticket reservation remains active so retrying cannot create another case. `/ticket recover` reconciles the exact case topic against Discord channels and checks access. If no channel exists, the owner must investigate the retained reservation; there is no automatic unsafe retry. Recovery does not yet rebuild every missing welcome panel or notification.

Placement disputes use `/appeal submit result-id reason`, not general ticket reports. The player can inspect `/appeal status`; an independent moderator can uphold or revoke. A revocation retains the original result and removes it from valid rankings. Staff should recuse if they participated in the assessment or its original approval. No appeal decisions are sold.

## Applications and quality

Applications remain private records; review can invite an interview or decline, never automatically promote. Conduct an interview, supervised test, evidence discussion and calibration before manual staff-role assignment and mode qualification. Sample decisions for rubric consistency, feedback quality and conflicts of interest; do not reward raw test volume. Use the private handbook/calibration/audit areas. Do not announce available testers or events without their agreement.

## Short launch checklist

- Approve exact mode kits, version, arena and disconnect policy; record real benchmark opponents and consented evidence. Keep unsupported modes closed.
- Identify authorised staff, independent report reviewers and senior reviewers; review existing channel overwrites and role hierarchy.
- Complete a two-person acceptance test for verification, waitlist, queue, private room, readiness, assessment, independent review, result, appeal and support resolution.
- Confirm permission failures, API-timeout recovery and private endpoint checks in the deployed version.
- Verify desktop/mobile rendering and keyboard navigation once browser access is restored.
- Check no abandoned claimed entries, unarchived rooms or stuck ticket reservations remain before advertising sessions.

