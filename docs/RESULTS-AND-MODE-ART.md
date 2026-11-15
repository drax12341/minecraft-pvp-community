# Connected results and competitive presentation

The live Discord HTTP bot and public website still use the same authoritative results, accounts, tier history and queues. Staff awards remain adjustments, not completed tests; they do not inflate tester quotas or official-test statistics.

## Discord results

`cloud/result-presentation.mjs` renders compact result posts with the saved player's skin, mode, region, previous/current/peak tier, assigned tester or awarding staff, and profile/rankings links. Only actual official-test scores are displayed. Private evidence is omitted.

New posts mention the linked player and optional `DISCORD_RESULT_PING_ROLE_ID`; allowed mentions explicitly restrict both IDs. Automatic reactions default to 🏆 and 🔥. `config/community.json` may override `resultPresentation.reactions` with up to four Unicode emoji or Discord `name:id` identifiers.

Migration `0019_result_publications` stores each outbox announcement's Discord message ID. Reaction deliveries have separate leased, deduplicated outbox jobs. Failed reactions cannot resend the announcement or its ping. Unknown POST responses retain existing footer-marker reconciliation. A prolonged Discord outage uses the ordinary outbox backoff and audit trail.

The bot needs View Channel, Send Messages, Embed Links, Read Message History and Add Reactions in results channels. The setup wizard and maintained Discord installation scripts grant the bot Add Reactions explicitly.

`POST /api/internal/result-posts` is restricted to the existing bot-token service authentication. It can restyle up to ten already-published, non-revoked official bot results. It matches the saved message or exact footer plus bot author, edits in place, suppresses all repeat pings, queues reactions, and audits each update. It never creates a sample or missing announcement.

## Website

Mode PNGs are extracted from the project owner's supplied reference images, with flat background removal only. All seven existing mode names/IDs are preserved. The shared icon renderer serves these files on rankings, guides, profiles, results and the homepage. The overall tab uses the supplied trophy.

`platform-competition.css` adds raised mode tabs, a selectable homepage discipline orbit, a latest-real-placement link, skin-led result cards, and updated competitive surfaces. Existing starfield, animations, loading states, authentication, filters and mobile routes are retained. Reduced-motion settings disable the new entrance effects and transitions.

Automated tests cover selective mentions, skin URLs, staff attribution, accurate movement, scores, revoked results, reaction outages, restart recovery, safe maintenance edits, authentication, every configured icon, result card escaping and original application workflows. Browser preview is unavailable on this machine; visual browser QA remains a verification limitation.
