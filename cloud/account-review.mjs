const reviewField = (name, value) => ({
  name,
  value: String(value),
  inline: true,
});
const reviewDate = (value, style = "R") =>
  value && Number.isFinite(Date.parse(value))
    ? "<t:" + Math.floor(Date.parse(value) / 1000) + ":" + style + ">"
    : "Not recorded";
export async function buildAccountReview(
  store,
  target,
  member,
  ban,
  now = new Date(),
) {
  if (!/^\d{5,22}$/.test(target))
    throw Error("Choose a valid Discord account.");
  const created = Number((BigInt(target) >> 22n) + 1420070400000n);
  if (!Number.isSafeInteger(created) || created > now.getTime())
    throw Error("Choose a valid Discord account.");
  const stamp = now.toISOString(),
    recent = new Date(now.getTime() - 30 * 86400000).toISOString();
  const [
    account,
    cases,
    restrictions,
    cooldowns,
    queue,
    tester,
    qualifications,
    lastAction,
  ] = await Promise.all([
    store.one(
      "SELECT name,uuid,verified_at FROM accounts WHERE discord=?",
      target,
    ),
    store.one(
      "SELECT count(*) total,COALESCE(sum(status='open'),0) open FROM moderation_cases WHERE user=?",
      target,
    ),
    store.one(
      "SELECT count(*) n,min(until_at) next FROM player_restrictions WHERE user=? AND until_at>?",
      target,
      stamp,
    ),
    store.one(
      "SELECT count(*) n,min(until_at) next FROM cooldowns c WHERE user=? AND until_at>? AND NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=c.result_id)",
      target,
      stamp,
    ),
    store.one(
      "SELECT COALESCE(sum(status='waiting'),0) waiting,COALESCE(sum(status='claimed'),0) active FROM queue WHERE user=?",
      target,
    ),
    store.one(
      "SELECT count(*) total,COALESCE(sum(created>=?),0) recent FROM results r WHERE tester=? AND record_type='test' AND created<=? AND NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id)",
      recent,
      target,
      stamp,
    ),
    store.one(
      "SELECT count(*) n FROM tester_qualifications WHERE user=?",
      target,
    ),
    store.one("SELECT max(created) last FROM audit WHERE actor=?", target),
  ]);
  const tests = account
    ? await store.one(
        "SELECT count(*) total,COALESCE(sum(created>=?),0) recent,count(DISTINCT mode) modes,max(created) last FROM results r WHERE uuid=? AND record_type='test' AND created<=? AND NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id)",
        recent,
        account.uuid,
        stamp,
      )
    : { total: 0, recent: 0, modes: 0, last: null };
  const peak = account
    ? await store.one(
        "SELECT tier,pos FROM results r WHERE uuid=? AND record_type<>'reset' AND created<=? AND NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id) ORDER BY tier,pos,sequence DESC LIMIT 1",
        account.uuid,
        stamp,
      )
    : null;
  const days = Math.floor((now.getTime() - created) / 86400000),
    memberKnown = !member.unavailable && !!member.joined_at;
  const tenure = memberKnown
    ? Math.max(
        0,
        Math.floor((now.getTime() - Date.parse(member.joined_at)) / 86400000),
      )
    : null;
  const timedOut =
    memberKnown &&
    member.communication_disabled_until &&
    Date.parse(member.communication_disabled_until) > now.getTime();
  const signals = [];
  if (days < 7) signals.push("Account under 7 days old");
  if (tenure !== null && tenure < 1) signals.push("Joined within 24 hours");
  if (memberKnown && member.pending)
    signals.push("Membership screening incomplete");
  if (!ban.unavailable) signals.push("Local ban recorded");
  const avatar =
    member.user?.avatar && /^[a-zA-Z0-9_]+$/.test(member.user.avatar)
      ? "https://cdn.discordapp.com/avatars/" +
        target +
        "/" +
        member.user.avatar +
        ".png?size=128"
      : null;
  const peakName = peak
    ? (peak.pos === 0 ? "HT" : "LT") + peak.tier
    : "Unranked";
  const body = {
    content: "",
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: "🛡 Account Intelligence",
        color: 0x8b70f5,
        description:
          "<@" +
          target +
          ">\n**Alt relationship: unknown.** · Local evidence only.",
        ...(avatar ? { thumbnail: { url: avatar } } : {}),
        fields: [
          reviewField("Account Age", days.toLocaleString("en-US") + " days"),
          reviewField(
            "Created",
            reviewDate(new Date(created).toISOString(), "D"),
          ),
          reviewField(
            "Server Tenure",
            tenure === null
              ? "Unavailable"
              : tenure.toLocaleString("en-US") + " days",
          ),
          reviewField("Joined", reviewDate(member.joined_at, "D")),
          reviewField(
            "Discord Roles",
            memberKnown ? String(member.roles?.length || 0) : "Unavailable",
          ),
          reviewField(
            "Membership",
            memberKnown
              ? member.pending
                ? "Screening pending"
                : member.user?.bot
                  ? "Bot account"
                  : "Member"
              : "Not available",
          ),
          reviewField(
            "Local Ban",
            ban.unavailable === 404
              ? "No ban found"
              : ban.unavailable
                ? "Unavailable · missing permission"
                : "Ban found",
          ),
          reviewField(
            "Timeout",
            timedOut
              ? reviewDate(member.communication_disabled_until)
              : memberKnown
                ? "None"
                : "Unavailable",
          ),
          reviewField(
            "Server Boost",
            member.premium_since
              ? reviewDate(member.premium_since)
              : memberKnown
                ? "Not boosting"
                : "Unavailable",
          ),
          reviewField("Minecraft IGN", account?.name || "Not linked"),
          reviewField("Verified Since", reviewDate(account?.verified_at, "D")),
          reviewField(
            "Moderation Cases",
            cases.open + " open · " + cases.total + " total",
          ),
          reviewField(
            "Testing Restrictions",
            restrictions.n
              ? restrictions.n +
                  " active · next ends " +
                  reviewDate(restrictions.next)
              : "None active",
          ),
          reviewField(
            "Retest Cooldowns",
            cooldowns.n
              ? cooldowns.n +
                  " active · next ends " +
                  reviewDate(cooldowns.next)
              : "None active",
          ),
          {
            name: "Review Signals",
            value: signals.length
              ? signals.join(" · ") +
                ". Signals alone do not prove abuse or an alt."
              : "No age or membership warning. This is not a clean-account guarantee.",
            inline: false,
          },
        ],
        footer: {
          text: "Discord membership + local records · No IP, device or universal ban lookup",
        },
        timestamp: stamp,
      },
      {
        title: "⚔️ Community Activity",
        color: 0x54c8c2,
        fields: [
          reviewField("Official Tests", tests.total),
          reviewField("Last 30 Days", tests.recent),
          reviewField("Modes Tested", tests.modes),
          reviewField("Peak Placement", peakName),
          reviewField("Latest Official Test", reviewDate(tests.last)),
          reviewField(
            "Queue Activity",
            queue.waiting + " waiting · " + queue.active + " active",
          ),
          reviewField(
            "Tests as Tester",
            tester.total + " total · " + tester.recent + " in 30 days",
          ),
          reviewField("Qualified Modes", qualifications.n),
          reviewField("Last Logged Bot Action", reviewDate(lastAction.last)),
        ],
        footer: {
          text: "Revoked tests and staff awards excluded from test counts · UTC",
        },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: "Refresh Report",
            custom_id: "review:refresh:" + target,
          },
          ...(account
            ? [
                {
                  type: 2,
                  style: 5,
                  label: "Player Profile",
                  url:
                    "https://minecraft-pvp-community.draxion0.chatgpt.site/players/" +
                    encodeURIComponent(account.uuid),
                },
              ]
            : []),
        ],
      },
    ],
  };
  return body;
}
