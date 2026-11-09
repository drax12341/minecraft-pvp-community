# Testing desk upgrade

The Discord HTTP bot and website share seven active Mace gamemodes and the
HT3 → LT2 → HT2 → LT1 → HT1 promotion paths supplied by community management.

## New commands

- `/high-test apply|status|list|claim|room|opponent|score|advance|close`: verified
  player applications, recoverable private tickets, independent qualified claims,
  opponent rank snapshots, phase scores, HTTPS evidence and reviewed outcomes.
- `/tester-desk apply|status|list|room|review`: applications with gamemode, region,
  target testing tier, experience and availability. Independent management review
  leads to interview, training or decline; it never grants qualifications.
- `/tier-list mode tier [region]`: current published players in any HT/LT tier.
- `/tier-path tier`: promotion phases for HT3 through HT1.
- `/tester-roster mode`: recorded gamemode qualifications and senior status.
- `/test-stats [mode]`: database-backed completed test counts and tester leaders.
- `/cooldown mode region`: failed high-test restriction and session cooldown.

Player applications require the next tier above a valid published placement in
that gamemode. Initial evaluation remains `/request-test` and the session queue.
Existing `/tester-apply` applications remain accessible; new recruitment panels
use `/tester-desk` for tier-scoped applications and private tickets.

## Private workflow

Application tickets are visible to the applicant, management and bot. The assigned
tester receives member-specific access after a qualified claim. LT2+ coordinators
need a senior qualification in that mode. Ticket provisioning uses a durable lock
and reconciles channels by application ID after a provider timeout.

The assigned tester adds verified opponents with published mode ranks, records
sets and adjudicates phases with notes. A pass requires the final phase's sets and
a new, non-revoked published result matching the player, gamemode and target tier.
Normal `/assessment`, independent high-tier review and `/result` remain mandatory
for publishing placements. New HT3+ results also announce in high-results.

Closing a high-tier test as failed stores a 30-day gamemode restriction. Both
ordinary queue entry and subsequent high-tier applications enforce it. Previously
published initial evaluations retain session-based retest cooldowns. Reopening
exceptions, margin interpretation, replacements, strike scores, pending demotion,
forfeits, retirement and defended peak tiers remain staff-adjudicated; the desk
does not invent automatic decisions for those rules.

## Channels and website

Tierlist adds ht3-list, lt2-list, ht2-list, lt1-list and ht1-holder. Each has current
roster lookup and application menus. Testing adds tester-applications. Every mode
waitlist has evaluation, high-tier application and tester recruitment buttons.
Request-test now has a functional private cooldown menu and application shortcuts.

Website routes: `#test-desk`, `#high-tiers` and `#commands`. The roster uses real
published players, supports gamemode/region/name filters and shareable URLs. The
application builder prepares a local command; authenticated submission happens in
Discord. The command library supports search and audience filtering.
`/api/testing-desk` publishes only aggregate demand, promotion paths and tester
counts using verified Minecraft names; it excludes applicant identities, ticket
IDs, Discord IDs, private availability, experience and decision text.

## Operations and validation

Append-only migration `0005_testing_desk` adds application, set, restriction and
event tables. Sites applies it before uploading the Worker. Read-only smoke tests
verify live health, public API, native command registration and posted panels.
No fabricated applications, qualifications or rankings are created in production.

```sh
npm test
node scripts/build-cloud.mjs
node --env-file=.env scripts/check-secrets.mjs
node --env-file=.env discord/testing-desk-setup.mjs --apply
node --env-file=.env discord/bot.mjs --register-only
```

39 automated checks passed before publication. Browser visual QA could not run
because the computer-use browser host was unavailable; website interactions were
verified through DOM tests and HTTP asset checks.
