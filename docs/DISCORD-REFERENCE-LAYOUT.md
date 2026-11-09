# Screenshot-inspired Discord layout

Applied to guild `1568767259168608267` on 9 November 2026.

The Tierlist category follows the supplied order: ranked-rubric, ranked-ruleset,
testing-servers, staff-movements, punishments, testing-leaderboard, high-tests,
high-results, results and forum-posting. General contains general, media,
unstable-chats, advanced matchmaking, duel finding, commands and suggestions.
Tester-of-the-month sits above Tierlist in Information.

The supplied ranked policy is published as blue embeds. The waitlist panel has
the reference's pink accent and three buttons: Verify Account opens private
support category selection, Enter Waitlist opens the existing mode/region flow,
and View Cooldown links to instructions for `/queue status mode region`.
The leaderboard has purple all-time and monthly panels, counting genuine bot
assessment announcements by unique assessment ID. It is a staff-refreshed snapshot,
not an automatically updated database leaderboard. No sample players are posted.

Existing channel IDs, result history, private tickets and server-list content
are retained. Public information channels are read-only for ordinary members.
This guild does not have Community forums enabled; forum-posting is a text channel
with thread permissions rather than changing the guild's Community settings.

The ranked policy is staff-adjudicated. This change does not implement automatic
multi-phase tests, strike scores, forfeits, peak tiers, retirement or opponent
replacement calculations. Existing session-configured cooldowns are distinct from
the supplied failed-test 30-day rule. Staff maintain high-test coordination,
high-result announcements, public moderation outcomes and monthly recognition.

Preview or reapply the layout and refresh the leaderboard:

```sh
node discord/reference-layout.mjs
node --env-file=.env discord/reference-layout.mjs --apply
```

Ignored `.runtime/` contains before snapshots and the application report.
