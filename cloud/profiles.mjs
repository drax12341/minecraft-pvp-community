import config from "../config/community.json" with { type: "json" };
import { staffAccess } from "../config/community-roles.mjs";
export async function competitorProfile(i, env, store, progress = false) {
  const { actor, mod } = staffAccess(i, env),
    sub = i.data.options?.find((o) => o.type === 1),
    opts = sub?.options || i.data.options || [],
    get = (n) => opts.find((o) => o.name === n)?.value;
  const user = get("user") || actor,
    name = get("name"),
    mode = get("mode") || "";
  if (name && !/^\w{3,16}$/.test(name))
    throw Error("Enter a valid Minecraft username.");
  const account = name
    ? await store.one(
        "SELECT discord,uuid,name,verified_by FROM accounts WHERE lower(name)=lower(?)",
        name,
      )
    : await store.one(
        "SELECT discord,uuid,name,verified_by FROM accounts WHERE discord=?",
        user,
      );
  if (!account)
    return {
      content:
        "No verified competitor found. Start account verification from the player desk.",
      components: [],
    };
  const settings = await store.one(
    "SELECT public_profile FROM player_settings WHERE user=?",
    account.discord,
  );
  if (settings?.public_profile === 0 && actor !== account.discord && !mod)
    throw Error(
      "This competitor has chosen a private profile. Official leaderboard placements remain public.",
    );
  const data = await store.rankings(config.points),
    position = data.players.findIndex((p) => p.uuid === account.uuid),
    player = data.players[position]||data.unrankedPlayers?.find(p=>p.uuid===account.uuid);
  const rows = await store.all(
    "SELECT r.id,r.mode,r.tier,r.pos,r.created,r.record_type,l.score FROM results r LEFT JOIN test_lifecycle l ON l.test_id=r.id WHERE r.uuid=? AND (?='' OR r.mode=?) AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=r.id) ORDER BY sequence DESC LIMIT 10",
    account.uuid,
    mode,
    mode,
  );
  const total = await store.one(
    "SELECT count(*) n,min(created) first,max(created) last,count(DISTINCT mode) modes FROM results r WHERE uuid=? AND r.record_type='test' AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=r.id)",
    account.uuid,
  );
  const rank = (r) => `${r.pos === 0 ? "HT" : "LT"}${r.tier}`;
  const fields = Object.entries(player?.rankings || {})
    .filter(([id]) => !mode || mode === id)
    .slice(0, 15)
    .map(([id, r]) => ({
      name: config.modes.find((m) => m.id === id)?.name || id,
      value: `Current **${rank(r)}** · Peak **${r.peak_pos === 0 ? "HT" : "LT"}${r.peak_tier}**${r.retired ? " · Retired" : ""}`,
      inline: true,
    }));
  for(const [id,peak] of Object.entries(player?.peaks||{})){if(fields.length<18&&!player.rankings[id]&&(!mode||mode===id))fields.push({name:(config.modes.find(m=>m.id===id)?.name||id)+' ? Historical peak',value:'Unranked ? Peak **'+(peak.peak_pos===0?'HT':'LT')+peak.peak_tier+'**',inline:true});}
  fields.push(
    { name: "Official evaluations", value: String(total.n), inline: true },
    {
      name: "Overall points",
      value: String(player?.points || 0),
      inline: true,
    },
    {
      name: "Overall placement",
      value: position >= 0 ? "#" + (position + 1) : "Unranked",
      inline: true,
    },
  );
  if (actor === account.discord || mod) {
    const cooldowns = await store.all(
      "SELECT mode,until_at FROM cooldowns c WHERE user=? AND until_at>? AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=c.result_id)",
      account.discord,
      new Date().toISOString(),
    );
    const restrictions = await store.all(
      "SELECT mode,until_at FROM player_restrictions WHERE user=? AND until_at>?",
      account.discord,
      new Date().toISOString(),
    );
    if (cooldowns.length)
      fields.push({
        name: "Your cooldowns",
        value: cooldowns
          .slice(0, 7)
          .map(
            (c) =>
              c.mode +
              ": <t:" +
              Math.floor(Date.parse(c.until_at) / 1000) +
              ":R>",
          )
          .join("\n"),
      });
    if (restrictions.length)
      fields.push({
        name: "Private testing restrictions",
        value: restrictions
          .map(
            (c) =>
              c.mode +
              ": <t:" +
              Math.floor(Date.parse(c.until_at) / 1000) +
              ":F>",
          )
          .join("\n"),
      });
  }
  const milestones = [];
  if (total.n) milestones.push("First Official Test");
  if (total.modes >= 2) milestones.push("Multiple Mode Rankings");
  for (const t of [3, 2, 1])
    if (
      Object.values(player?.rankings || {}).some(
        (r) => r.peak_tier < t || (r.peak_tier === t && r.peak_pos === 0),
      )
    )
      milestones.push("First HT" + t);
  if (
    total.first &&
    Date.parse(total.last) - Date.parse(total.first) >= 180 * 86400000
  )
    milestones.push("Long-Term Competitor");
  if (progress)
    fields.push(
      {
        name: "Official tier progression",
        value: rows.length
          ? rows
              .map(
                (r) =>
                  `<t:${Math.floor(Date.parse(r.created) / 1000)}:d> · ${r.mode} · **${r.record_type==='reset'?'Unranked':rank(r)}**${r.record_type!=='test'?' ? Staff adjustment':''}${r.score ? " · " + r.score : ""}`,
              )
              .join("\n")
          : "No official evaluations yet.",
      },
      {
        name: "Cosmetic milestones",
        value:
          milestones.join(" · ") ||
          "Your first official evaluation starts your progression.",
      },
    );
  return {
    content: "",
    embeds: [
      {
        title: progress
          ? "📈 MACE PLAYER PROGRESS"
          : "👑 MACE COMPETITOR PROFILE",
        color: 0x7861e8,
        description: `**${account.name}** · Verified Java account\n${total.modes} ranked Mace mode${total.modes === 1 ? "" : "s"} · Official tier-test history`,
        thumbnail: {
          url: "https://mc-heads.net/avatar/" + account.uuid + "/128",
        },
        fields,
        footer: {
          text: "Official evaluations only; this is not comprehensive duel statistics.",
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
            label: "My progression",
            custom_id: "network:progress",
          },
          {
            type: 2,
            style: 2,
            label: "Match history",
            custom_id: "community:history",
          },
          {
            type: 2,
            style: 2,
            label: "Live queues",
            custom_id: "community:boards",
          },
        ],
      },
    ],
    allowed_mentions: { parse: [] },
  };
}
