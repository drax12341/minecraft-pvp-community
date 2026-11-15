import config from "../config/community.json" with { type: "json" };

const resultSiteOrigin =
  "https://minecraft-pvp-community.draxion0.chatgpt.site";
const resultSnowflake = /^\d{5,22}$/;
const resultRank = (r) =>
  r && r.record_type !== "reset"
    ? `${r.pos === 0 ? "HT" : "LT"}${r.tier}`
    : "Unranked";

export function resultAnnouncement(
  result,
  { previous, peak, account, appearance, score } = {},
  env = {},
) {
  const tier = resultRank(result),
    old = resultRank(previous),
    best = resultRank(peak);
  const staff =
    result.record_type === "adjustment" || result.record_type === "reset";
  const reset = result.record_type === "reset";
  const movement = reset
    ? "PLACEMENT RESET"
    : old === "Unranked"
      ? "FIRST PLACEMENT"
      : old === tier
        ? "RANK RETAINED"
        : config.points[tier] > config.points[old]
          ? "PROMOTED"
          : "DEMOTED";
  const validUuid = /^[a-f0-9-]{32,36}$/i.test(result.uuid);
  const skinUrl = validUuid
    ? `https://mc-heads.net/body/${result.uuid}/240`
    : null;
  // Only URLs from the already validated appearance cache may replace the fallback.
  const cachedSkin =
    appearance?.body_url &&
    /^https:\/\/(?:skinmc\.net|mc-heads\.net)\//.test(appearance.body_url)
      ? appearance.body_url
      : null;
  const player = resultSnowflake.test(account?.discord)
    ? account.discord
    : null;
  const role = resultSnowflake.test(env.DISCORD_RESULT_PING_ROLE_ID)
    ? env.DISCORD_RESULT_PING_ROLE_ID
    : null;
  const field = (name, value) => ({ name, value, inline: true });
  const fields = [
    field(
      "Mace mode",
      config.modes.find((m) => m.id === result.mode)?.name || result.mode,
    ),
    field("Region", result.region),
    field(
      "Tester",
      resultSnowflake.test(result.tester)
        ? `<@${result.tester}>`
        : "Official staff",
    ),
    field("Previous Rank", old),
    field("Rank Earned", tier),
    field("Peak tier", best),
  ];
  if (!staff && score)
    fields.push(field("Final score", String(score).slice(0, 100)));
  const profile = `${resultSiteOrigin}/players/${encodeURIComponent(result.uuid)}`;
  const embeds = [
    {
      author: {
        name: result.name,
        ...(validUuid
          ? { icon_url: `https://mc-heads.net/avatar/${result.uuid}/80` }
          : {}),
      },
      title: reset
        ? "Placement reset"
        : `${tier} · ${config.modes.find((m) => m.id === result.mode)?.name || result.mode}`,
      url: profile,
      description: `**${staff ? "STAFF TIER AWARD" : "OFFICIAL TEST RESULT"}**\n${movement}${!reset && tier === best && old !== tier ? " · PEAK TIER " + best : ""}`,
      color: reset
        ? 0x98a3ba
        : movement === "DEMOTED"
          ? 0xff5575
          : movement === "PROMOTED"
            ? 0x31d6a1
            : result.tier <= 2
              ? 0xffc76b
              : 0x7966ff,
      fields,
      ...(skinUrl ? { thumbnail: { url: cachedSkin || skinUrl } } : {}),
      footer: { text: "Official test " + result.id },
      timestamp: result.created,
    },
  ];
  return {
    content:
      [player ? `<@${player}>` : null, role ? `<@&${role}>` : null]
        .filter(Boolean)
        .join(" ") || undefined,
    allowed_mentions: {
      parse: [],
      users: player ? [player] : [],
      roles: role ? [role] : [],
    },
    embeds,
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 5, label: "Player profile", url: profile },
          {
            type: 2,
            style: 5,
            label: "Mode rankings",
            url: `${resultSiteOrigin}/rankings/${encodeURIComponent(result.mode)}`,
          },
        ],
      },
    ],
  };
}

export async function deliverResultReaction(job, store, api) {
  const p = JSON.parse(job.payload);
  if (await store.one("SELECT 1 FROM revoked WHERE result_id=?", p.result))
    return;
  if (
    !resultSnowflake.test(p.channel) ||
    !resultSnowflake.test(p.message) ||
    typeof p.emoji !== "string" ||
    p.emoji.length > 100
  )
    throw Error("Invalid result reaction delivery");
  await api(
    `/channels/${p.channel}/messages/${p.message}/reactions/${encodeURIComponent(p.emoji)}/@me`,
    "PUT",
  );
}

async function resultPresentationContext(r, store) {
  const previous = await store.one(
    "SELECT tier,pos,record_type FROM results WHERE uuid=? AND mode=? AND sequence<? AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=results.id) ORDER BY sequence DESC LIMIT 1",
    r.uuid,
    r.mode,
    r.sequence,
  );
  const peak = await store.one(
    "SELECT tier,pos FROM results WHERE uuid=? AND mode=? AND sequence<=? AND record_type<>'reset' AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=results.id) ORDER BY tier,pos LIMIT 1",
    r.uuid,
    r.mode,
    r.sequence,
  );
  const account = await store.one(
    "SELECT discord FROM accounts WHERE uuid=?",
    r.uuid,
  );
  const appearance = await store.one(
    "SELECT body_url FROM skin_previews WHERE uuid=?",
    r.uuid,
  );
  const lifecycle = await store.one(
    "SELECT score FROM test_lifecycle WHERE test_id=?",
    r.id,
  );
  return { previous, peak, account, appearance, score: lifecycle?.score };
}

// Restyle only existing official bot posts. Never create an announcement or repeat its ping.
export async function refreshPublishedResults(store, env, api) {
  const jobs = await store.all(
    "SELECT o.* FROM outbox_events o JOIN results r ON r.id=o.subject WHERE o.kind IN ('result','staff-result','result-high') AND o.status='done' AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=r.id) ORDER BY o.id DESC LIMIT 10",
  );
  const messages = new Map();
  let updated = 0,
    missing = 0;
  for (const job of jobs) {
    const r = await store.one("SELECT * FROM results WHERE id=?", job.subject);
    const channel =
      job.kind === "result-high"
        ? config.testingDeskChannels?.highResults
        : env.DISCORD_RESULTS_CHANNEL_ID;
    if (!channel) continue;
    const publication = await store.one(
      "SELECT * FROM result_publications WHERE job_id=?",
      job.id,
    );
    let message = publication?.message;
    if (!message) {
      if (!messages.has(channel))
        messages.set(
          channel,
          await api(`/channels/${channel}/messages?limit=100`),
        );
      message = messages
        .get(channel)
        .find(
          (m) =>
            m.author?.id === env.DISCORD_CLIENT_ID &&
            m.embeds?.some((e) => e.footer?.text === "Official test " + r.id),
        )?.id;
    }
    if (!message) {
      missing++;
      continue;
    }
    const body = resultAnnouncement(
      r,
      await resultPresentationContext(r, store),
      env,
    );
    body.allowed_mentions = { parse: [], users: [], roles: [] };
    await api(`/channels/${channel}/messages/${message}`, "PATCH", body);
    await store
      .statement(
        "INSERT OR IGNORE INTO result_publications(job_id,channel,message,published_at) VALUES(?,?,?,?)",
        job.id,
        channel,
        message,
        new Date().toISOString(),
      )
      .run();
    await deliverResultAnnouncement(job, store, env, api);
    await store
      .audit("system", "result-announcement-refreshed", String(job.id))
      .run();
    updated++;
  }
  return { updated, missing };
}

export async function deliverResultAnnouncement(job, store, env, api) {
  const r = await store.one("SELECT * FROM results WHERE id=?", job.subject);
  if (!r) throw Error("Result missing; inspect " + job.subject);
  const channel =
    job.kind === "result-high"
      ? config.testingDeskChannels?.highResults
      : env.DISCORD_RESULTS_CHANNEL_ID;
  if (
    job.kind === "result-high" &&
    (!channel || r.tier > 3 || (r.tier === 3 && r.pos !== 0))
  )
    return;
  if (!channel) throw Error("Configure DISCORD_RESULTS_CHANNEL_ID");
  if (await store.one("SELECT 1 FROM revoked WHERE result_id=?", r.id)) return;
  let publication = await store.one(
    "SELECT * FROM result_publications WHERE job_id=?",
    job.id,
  );
  if (!publication) {
    const path = `/channels/${channel}/messages`;
    const recent = job.attempts > 1 ? await api(path + "?limit=100") : [];
    let message = recent.find(
      (m) =>
        m.author?.id === env.DISCORD_CLIENT_ID &&
        m.embeds?.some((e) => e.footer?.text === "Official test " + r.id),
    );
    if (!message)
      message = await api(path, "POST", {
        ...resultAnnouncement(
          r,
          await resultPresentationContext(r, store),
          env,
        ),
        nonce: String(job.id),
        enforce_nonce: true,
      });
    if (!resultSnowflake.test(message?.id))
      throw Error("Discord did not return a result message ID");
    await store
      .statement(
        "INSERT OR IGNORE INTO result_publications(job_id,channel,message,published_at) VALUES(?,?,?,?)",
        job.id,
        channel,
        message.id,
        new Date().toISOString(),
      )
      .run();
    publication = await store.one(
      "SELECT * FROM result_publications WHERE job_id=?",
      job.id,
    );
  }
  // Independent durable jobs keep reaction failures from resending the result or its ping.
  const reactions = config.resultPresentation?.reactions || ["🏆", "🔥"];
  for (const emoji of [...new Set(reactions)]
    .filter((e) => typeof e === "string" && e.length > 0 && e.length <= 100)
    .slice(0, 4)) {
    const subject = `${publication.channel}/${publication.message}/${emoji}`,
      now = new Date().toISOString();
    await store
      .statement(
        "INSERT OR IGNORE INTO outbox_events(kind,subject,payload,available_at,created) VALUES('result-reaction',?,?,?,?)",
        subject,
        JSON.stringify({
          result: r.id,
          channel: publication.channel,
          message: publication.message,
          emoji,
        }),
        now,
        now,
      )
      .run();
    const reaction = await store.one(
      "SELECT * FROM outbox_events WHERE kind='result-reaction' AND subject=?",
      subject,
    );
    if (reaction.status !== "pending") continue;
    // Acquire the same lease contract used by drainOutbox before immediate delivery.
    const lease = crypto.randomUUID();
    const reserved = await store
      .statement(
        "UPDATE outbox_events SET status='processing',lease=?,lease_until=?,attempts=attempts+1 WHERE id=? AND status='pending' AND available_at<=? RETURNING *",
        lease,
        new Date(Date.now() + 120000).toISOString(),
        reaction.id,
        now,
      )
      .first();
    if (!reserved) continue;
    try {
      await deliverResultReaction(reserved, store, api);
      await store
        .statement(
          "UPDATE outbox_events SET status='done',lease=NULL,lease_until=NULL,last_error=NULL WHERE id=? AND lease=?",
          reserved.id,
          lease,
        )
        .run();
    } catch (e) {
      await store.db.batch([
        store.statement(
          "UPDATE outbox_events SET status='pending',lease=NULL,lease_until=NULL,last_error=?,available_at=? WHERE id=? AND lease=?",
          String(e.message).slice(0, 300),
          new Date(Date.now() + 60000).toISOString(),
          reserved.id,
          lease,
        ),
        store.audit("system", "result-reaction-failed", String(reserved.id)),
      ]);
    }
  }
}
