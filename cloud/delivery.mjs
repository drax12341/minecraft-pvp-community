import {synchronizeTesterRoles} from './tester-management.mjs';
import {platformNotificationKinds,deliverPlatformNotification} from './notification-maintenance.mjs';
import { roomOverwrites } from "./journeys.mjs";
import config from "../config/community.json" with { type: "json" };

export async function queueSessionNotifications(store, mode, region) {
  const now = new Date().toISOString(),
    cutoff = new Date(Date.now() - 3600000).toISOString();
  // A single conditional upsert is also the cross-worker notification throttle.
  const outcomes = await store.db.batch([
    store.statement(
      `INSERT INTO session_alerts VALUES(?,?,?) ON CONFLICT(mode,region) DO UPDATE SET last_sent=excluded.last_sent WHERE session_alerts.last_sent<? `,
      mode,
      region,
      now,
      cutoff,
    ),
    store.statement(
      `INSERT OR IGNORE INTO outbox_events(kind,subject,payload,available_at,created)
    SELECT 'queue-open',w.user||'/'||w.mode||'/'||w.region||'/'||?,json_object('user',w.user,'mode',w.mode,'region',w.region),?,?
    FROM waitlists w JOIN notification_preferences p ON p.user=w.user AND p.delivery='dm'
    JOIN accounts a ON a.discord=w.user JOIN sessions s ON s.mode=w.mode AND s.region=w.region AND s.status='open'
    WHERE w.mode=? AND w.region=? AND EXISTS(SELECT 1 FROM session_alerts alert WHERE alert.mode=w.mode AND alert.region=w.region AND alert.last_sent=?) AND NOT EXISTS(SELECT 1 FROM test_restrictions t WHERE t.user=w.user AND t.mode=w.mode AND t.until_at>?)
    AND NOT EXISTS(SELECT 1 FROM cooldowns c WHERE c.user=w.user AND c.mode=w.mode AND c.until_at>? AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=c.result_id))`,
      now,
      now,
      now,
      mode,
      region,
      now,
      now,
      now,
    ),
  ]);
  return outcomes[0].meta.changes > 0;
}

export async function drainOutbox(store, env, request = fetch, limit = 8) {
  const api = async (path, method = "GET", body) => {
    const response = await request("https://discord.com/api/v10" + path, {
      method,
      headers: {
        Authorization: "Bot " + env.DISCORD_TOKEN,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const e = Error(
        "Discord HTTP " +
          response.status +
          " at " +
          path.replace(/\/users\/[^/]+/, "/users/[private]"),
      );
      e.status = response.status;
      throw e;
    }
    return response.status === 204 ? null : response.json();
  };
  let done = 0,
    failed = 0;
  for (let n = 0; n < limit; n++) {
    const now = new Date().toISOString(),
      lease = crypto.randomUUID();
    const job = await store
      .statement(
        `UPDATE outbox_events SET status='processing',lease=?,lease_until=?,attempts=attempts+1 WHERE id=(SELECT id FROM outbox_events WHERE (status='pending' AND available_at<=?) OR (status='processing' AND lease_until<?) ORDER BY id LIMIT 1) RETURNING *`,
        lease,
        new Date(Date.now() + 120000).toISOString(),
        now,
        now,
      )
      .first();
    if (!job) break;
    try {
      if(job.kind==='tester-roles'){await synchronizeTesterRoles(job,store,env,api);}
      else if(platformNotificationKinds.has(job.kind)){await deliverPlatformNotification(job,store,api);}
      else if (job.kind === "result" || job.kind === "result-high" || job.kind==='staff-result') {
        const r = await store.one(
          "SELECT * FROM results WHERE id=?",
          job.subject,
        );
        if (!r)
          throw Error("Result missing; staff must inspect " + job.subject);
        const channelId =
          job.kind === "result-high"
            ? config.testingDeskChannels?.highResults
            : env.DISCORD_RESULTS_CHANNEL_ID;
        if (
          job.kind === "result-high" &&
          (!channelId || r.tier > 3 || (r.tier === 3 && r.pos !== 0))
        ) {
          await store
            .statement(
              "UPDATE outbox_events SET status='done',lease=NULL,lease_until=NULL WHERE id=? AND lease=?",
              job.id,
              lease,
            )
            .run();
          done++;
          continue;
        }
        if (!channelId) throw Error("Configure DISCORD_RESULTS_CHANNEL_ID");
        if (await store.one("SELECT 1 FROM revoked WHERE result_id=?", r.id)) {
          await store
            .statement(
              "UPDATE outbox_events SET status='done',lease=NULL,lease_until=NULL WHERE id=? AND lease=?",
              job.id,
              lease,
            )
            .run();
          done++;
          continue;
        }
        const previous = await store.one(
          "SELECT tier,pos,record_type FROM results WHERE uuid=? AND mode=? AND sequence<? AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=results.id) ORDER BY sequence DESC LIMIT 1",
          r.uuid,
          r.mode,
          r.sequence,
        );
        const rank = (x) => `${x.pos === 0 ? "HT" : "LT"}${x.tier}`,
          tier = r.record_type==='reset'?'Unranked':rank(r),
          old = previous && previous.record_type!=='reset' ? rank(previous) : null;
        const change = !old
          ? "FIRST PLACEMENT"
          : old === tier
            ? "RANK RETAINED"
            : config.points[tier] > config.points[old]
              ? "PROMOTED"
              : "DEMOTED";
        const finalScore=await store.one('SELECT score FROM test_lifecycle WHERE test_id=?',r.id);
        const peak = await store.one(
          "SELECT tier,pos FROM results WHERE uuid=? AND mode=? AND sequence<=? AND record_type<>'reset' AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=results.id) ORDER BY tier,pos LIMIT 1",
          r.uuid,
          r.mode,
          r.sequence,
        );
        const marker = "Official test " + r.id;
        const channel = "/channels/" + channelId + "/messages";
        // Discord nonce deduplication is short-lived; inspect the durable test marker on retries too.
        const recent =
          job.attempts > 1 ? await api(channel + "?limit=100") : [];
        if (
          !recent.some(
            (m) =>
              m.author?.id === env.DISCORD_CLIENT_ID &&
              m.embeds?.some((e) => e.footer?.text === marker),
          )
        )
          await api(channel, "POST", {
            nonce: String(job.id),
            enforce_nonce: true,
            content: env.DISCORD_RESULT_PING_ROLE_ID
              ? "<@&" + env.DISCORD_RESULT_PING_ROLE_ID + ">"
              : undefined,
            allowed_mentions: {
              parse: [],
              roles: env.DISCORD_RESULT_PING_ROLE_ID
                ? [env.DISCORD_RESULT_PING_ROLE_ID]
                : [],
            },
            embeds: [
              {
                title: job.kind==='staff-result'?'\u{1F3C6} STAFF MACE TIER AWARD':"\u{1F3C6} OFFICIAL MACE TEST RESULT",
                description: `**${r.name}**\n${r.record_type==='reset'?'PLACEMENT RESET':change}${job.kind==='staff-result'?'\nAudited staff placement adjustment.':''}`,
                color:
                  change === "DEMOTED"
                    ? 0xd84a68
                    : change === "PROMOTED"
                      ? 0x39c99a
                      : 0x7861e8,
                fields: [
                  {
                    name: "Mace mode",
                    value:
                      config.modes.find((m) => m.id === r.mode)?.name || r.mode,
                    inline: true,
                  },
                  { name: "Region", value: r.region, inline: true },
                  {
                    name: "Previous Rank",
                    value: old || "Unranked",
                    inline: true,
                  },
                  { name: "Rank Earned", value: tier, inline: true },
                  { name: "Peak tier", value: peak?rank(peak):'Unranked', inline: true },
                  { name: job.kind==='staff-result'?'Tester / awarding staff':'Tester', value: `<@${r.tester}>`, inline: true },
                  ...(job.kind==='staff-result'?[]:[{ name: "Match evidence", value: r.evidence||'No public evidence' }]),
                ],
                footer: { text: marker },
                timestamp: r.created,
              },
            ],
          });
      } else if (job.kind === "archive") {
        const room = await store.one(
          "SELECT r.*,q.user FROM test_rooms r JOIN queue q ON q.id=r.id LEFT JOIN results result ON result.id=q.id WHERE r.id=? AND q.status IN ('complete','cancelled')",
          job.subject,
        );
        if (room?.channel && room.state !== "archived") {
          try {
            await api("/channels/" + room.channel, "PATCH", {
              name: "archived-test-" + job.subject.slice(0, 8),
              permission_overwrites: roomOverwrites(
                env,
                room.user,
                room.tester,
                true,
              ),
            });
          } catch (e) {
            if (e.status !== 404) throw e;
            await store
              .audit("system", "archive-channel-missing", job.subject)
              .run();
          }
          await store
            .statement(
              "UPDATE test_rooms SET state='archived',updated=? WHERE id=?",
              new Date().toISOString(),
              job.subject,
            )
            .run();
        }
      } else if (job.kind === "verified-role") {
        if (env.DISCORD_VERIFIED_ROLE_ID) {
          const roles = await api("/guilds/" + env.DISCORD_GUILD_ID + "/roles");
          const role = roles.find((r) => r.id === env.DISCORD_VERIFIED_ROLE_ID);
          if (!role || role.managed || BigInt(role.permissions) !== 0n)
            throw Error("Verified role must exist and have no permissions");
          await api(
            "/guilds/" +
              env.DISCORD_GUILD_ID +
              "/members/" +
              job.subject +
              "/roles/" +
              role.id,
            "PUT",
          );
        }
      } else if (job.kind === "roles") {
        const r = await store.one(
          "SELECT a.discord AS user,r.mode FROM results r JOIN accounts a ON a.uuid=r.uuid WHERE r.id=?",
          job.subject,
        );
        const mappings = await store.all(
          "SELECT tier,role FROM tier_role_mappings WHERE mode=?",
          r.mode,
        );
        if (mappings.length) {
          const latest = await store.one(
            "SELECT tier,pos FROM effective_placements r JOIN accounts a ON a.uuid=r.uuid WHERE a.discord=? AND r.mode=? AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=r.id) ORDER BY sequence DESC LIMIT 1",
            r.user,
            r.mode,
          );
          const target = mappings.find(
            (m) =>
              m.tier === `${latest?.pos === 0 ? "HT" : "LT"}${latest?.tier}`,
          );
          if (latest && !target)
            throw Error("Missing current tier mapping for " + r.mode);
          const roles = await api("/guilds/" + env.DISCORD_GUILD_ID + "/roles");
          if (
            mappings.some((m) => {
              const role = roles.find((x) => x.id === m.role);
              return !role || role.managed || BigInt(role.permissions) !== 0n;
            })
          )
            throw Error(
              "Tier mappings contain a missing, managed or privileged role",
            );
          const member = await api(
            `/guilds/${env.DISCORD_GUILD_ID}/members/${r.user}`,
          );
          if (target && !member.roles.includes(target.role))
            await api(
              `/guilds/${env.DISCORD_GUILD_ID}/members/${r.user}/roles/${target.role}`,
              "PUT",
            );
          for (const mapping of mappings)
            if (
              mapping.role !== target?.role &&
              member.roles.includes(mapping.role)
            )
              await api(
                `/guilds/${env.DISCORD_GUILD_ID}/members/${r.user}/roles/${mapping.role}`,
                "DELETE",
              );
        }
      } else if (job.kind === "queue-open") {
        const p = JSON.parse(job.payload);
        const eligible = await store.one(
          `SELECT 1 FROM waitlists w JOIN notification_preferences n ON n.user=w.user AND n.delivery='dm' JOIN sessions s ON s.mode=w.mode AND s.region=w.region AND s.status='open' WHERE w.user=? AND w.mode=? AND w.region=?`,
          p.user,
          p.mode,
          p.region,
        );
        if (eligible) {
          try {
            const dm = await api("/users/@me/channels", "POST", {
              recipient_id: p.user,
            });
            await api("/channels/" + dm.id + "/messages", "POST", {
              content: `\u2694\uFE0F ${config.modes.find((m) => m.id === p.mode)?.name || p.mode} testing is open in ${p.region}. Join from the testing dashboard. Your waitlist preference reserves no queue place. Eligibility and capacity apply.`,
              nonce: String(job.id),
              enforce_nonce: true,
              allowed_mentions: { parse: [] },
            });
          } catch (e) {
            if (e.status !== 403) throw e;
            await store
              .audit("system", "notification-dm-blocked", String(job.id))
              .run();
          }
        }
      } else throw Error("Unknown outbox kind");
      await store
        .statement(
          "UPDATE outbox_events SET status='done',lease=NULL,lease_until=NULL,last_error=NULL WHERE id=? AND lease=?",
          job.id,
          lease,
        )
        .run();
      done++;
    } catch (e) {
      await store.db.batch([
        store.statement(
          "UPDATE outbox_events SET status='pending',lease=NULL,lease_until=NULL,last_error=?,available_at=? WHERE id=? AND lease=?",
          String(e.message).slice(0, 300),
          new Date(
            Date.now() +
              Math.min(3600000, 30000 * 2 ** Math.min(job.attempts, 7)),
          ).toISOString(),
          job.id,
          lease,
        ),
        store.audit("system", "delivery-failed", String(job.id)),
      ]);
      failed++;
    }
  }
  return { done, failed };
}
