# Mace Network v11

This release continues the master-platform implementation after the live v10 installation.
It preserves the seven original Mace disciplines and all existing resource references.
Channel cleanup is deferred; queue updates edit this bot's existing panels in place.

## Closed queues and native Discord presentation

Queue panels use Components V2 containers for every state, so a single saved message
can safely switch from closed to open and back. Closed panels follow the supplied
reference: a red accent, lock heading, real separators, closure reason, localized
end timestamp and italic thank-you text. Never-opened queues state that they have
not started and do not invent an end timestamp. Open/paused panels retain FIFO
positions, capacity, availability, current tests and functional queue controls.

Closure reasons and UTC timestamps persist in `queue_closures`. Deterministic numeric
component IDs distinguish same-mode panels in different regions. Both public message
edits and ephemeral interaction replies use the required V2 flags and clear legacy
embed/content fields. Once Discord enables V2 on a message, the renderer continues
using V2 for subsequent states; it never tries to turn the flag off.

## Additional connected workflows

- `/tier set|reset|history`: confirmed, append-only staff placement adjustments with
  previous-record references, private reasons and audit history. Corrections update
  effective placements, points and scoped roles without creating fake evaluations,
  tester completion credit or new cooldowns. A reset clears the current placement
  while preserving historical peaks. Concurrent/stale confirmations are rejected.
- `/tester add|remove|permissions`: independent management approval and durable
  synchronization of the affected mode role, generic tester role and senior scope.
  Self-qualification is rejected. Unrelated mode qualifications and roles remain.
- `/ticket reopen|transcript|evidence|link-test`: independently authorized reopening,
  downloadable private transcripts, retained staff-only notes, attachment/evidence
  references and explicit test linkage. Atomic reopening reservations enforce the
  existing two-case limit. Tester reports use the confidential reviewer boundary.
- Support categories now include account support, tier appeals, tester reports,
  testing disputes, bug reports and general support alongside retained categories.
- `/analytics`: UTC monthly participation, unique competitors, rank outcomes,
  active testing days, and mode/region breakdowns. Staff adjustments and revoked
  results are excluded from official evaluation totals; seasons never reset tiers.
- Tester statistics include daily, weekly, monthly and lifetime evaluations, reviewed
  absences, cancellations and recorded availability hours. Interval triggers stop
  the active-time clock while paused/offline and restart it on resume.
- Notification maintenance creates deduplicated result, cooldown expiry, high-test,
  readiness and quota reminders. Preferences are rechecked at delivery; blocked DMs
  are recorded without repeated retries. Elapsed readiness windows request human
  review and never automatically punish or mark a player absent.
- The default published retest policy is now 30 days; existing explicitly configured
  sessions retain their policy. Dynamic public configuration loads from D1, and
  corrections are visible through the same authoritative ranking API.

## Validation and activation

All 99 automated tests pass, including closed/open V2 transitions, ephemeral V2
reply conversion, append-only staff changes, reset peak retention, support privacy,
notification deduplication, tester role boundaries and real seasonal counts. The
cloud bundle builds and passes syntax checking.

Apply the additive migrations through `0015_tester_active_time` with the matching
worker. `npm run discord:register` registers the expanded command definitions.
`npm run discord:desk:apply` refreshes the existing queue panels using the actual
cloud database rather than constructing approximate local boards. It neither
deletes channel history nor posts duplicate queues.

The real Minecraft ownership server still needs its endpoint/secrets configured.
Unattended reminders require the supported scheduled worker hook or a scheduler
calling the authenticated maintenance endpoint. Interaction-driven reconciliation
runs without a scheduler, but does not guarantee deadlines while nobody interacts.
A real Minecraft/Discord evaluation and production load testing remain distinct
from synthetic workflow tests. No fake ranks or kit approvals are created by QA.

Reference: [Discord component API](https://github.com/discord/discord-api-docs/blob/main/developers/components/reference.mdx).
