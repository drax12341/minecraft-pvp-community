import config from "../config/community.json" with { type: "json" };
import { deskRegions } from "../config/testing-desk.mjs";
import { staffAccess } from "../config/community-roles.mjs";
import { requireQualification, roomOverwrites } from "./journeys.mjs";
import { approvedCommunityLoadout } from "./loadouts.mjs";
import { queueSessionNotifications } from "./delivery.mjs";
import { loadCompetitionConfig } from "./competition-config.mjs";

export const competitionCommandNames = new Set([
  "account",
  "start",
  "end",
  "pause",
  "resume",
  "match",
  "absent",
  "close",
  "skip",
  "mode",
  "region",
  "config",
  "quota",
  "queue-admin",
  "cooldown-admin",
  "player-admin",
  "confirm-action",
  "progress",
  "health",
  "staff-center",
]);
export async function competitionDiscord(
  env,
  request,
  path,
  method = "GET",
  body,
) {
  const r = await request("https://discord.com/api/v10" + path, {
    method,
    headers: {
      Authorization: "Bot " + env.DISCORD_TOKEN,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok)
    throw Error(
      "Discord action failed (HTTP " +
        r.status +
        "). Check channel permissions and role hierarchy; saved records remain recoverable.",
    );
  return r.status === 204 ? null : r.json();
}
const compButton = (label, custom_id, style = 2) => ({
  type: 2,
  label,
  custom_id,
  style,
});
const compRow = (...components) => ({ type: 1, components });
export async function transitionMatch(
  store,
  test,
  actor,
  from,
  to,
  detail = "",
  extra = {},
) {
  const lifecycle = await store.one(
    "SELECT * FROM test_lifecycle WHERE test_id=?",
    test,
  );
  if (!lifecycle || !from.includes(lifecycle.state))
    throw Error(
      "Invalid test transition: " +
        (lifecycle?.state || "missing lifecycle") +
        ". Refresh the ticket before continuing.",
    );
  const stamp = new Date().toISOString();
  const outcome = await store.db.batch([
    store.statement(
      "UPDATE test_lifecycle SET state=?,version=version+1,reason=?,score=COALESCE(?,score),deadline=COALESCE(?,deadline),updated=? WHERE test_id=? AND version=? AND state=?",
      to,
      detail,
      extra.score || null,
      extra.deadline || null,
      stamp,
      test,
      lifecycle.version,
      lifecycle.state,
    ),
    store.statement(
      "INSERT INTO match_events SELECT ?,?,?,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM test_lifecycle WHERE test_id=? AND version=? AND state=?)",
      crypto.randomUUID(),
      test,
      actor,
      to,
      detail,
      stamp,
      test,
      lifecycle.version + 1,
      to,
    ),
    ...(extra.statements || []),
    store.audit(actor, "match-" + to, test),
  ]);
  if (!outcome[0].meta.changes)
    throw Error("Another action changed this test. Refresh the ticket.");
}
export async function matchDashboard(store, id, actor, mod = false) {
  const q = await store.one(
    "SELECT q.*,a.name,r.channel,r.player_ready,r.tester_ready,l.state,l.score,l.deadline FROM queue q JOIN accounts a ON a.discord=q.user LEFT JOIN test_rooms r ON r.id=q.id LEFT JOIN test_lifecycle l ON l.test_id=q.id WHERE q.id=?",
    id,
  );
  if (!q || (q.user !== actor && q.tester !== actor && !mod))
    throw Error(
      "Only this player, assigned tester and testing managers can view the test.",
    );
  const mode = config.modes.find((m) => m.id === q.mode);
  const account = await store.one(
    "SELECT uuid FROM accounts WHERE discord=?",
    q.user,
  );
  const p = (await store.rankings(config.points)).players.find(
    (p) => p.uuid === account?.uuid,
  )?.rankings[q.mode];
  const rank = (x) =>
    x ? `${x.pos === 0 ? "HT" : "LT"}${x.tier}` : "Unranked";
  const staff = q.tester === actor || mod;
  return {
    content: "",
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: "⚔️ OFFICIAL MACE TIER TEST",
        color: 0x7861e8,
        description: `**${q.name}** · ${mode?.name || q.mode} / ${q.region}\n**${q.state || q.status.toUpperCase()}**`,
        fields: [
          { name: "Player", value: `<@${q.user}> · ${q.name}`, inline: true },
          { name: "Assigned tester", value: `<@${q.tester}>`, inline: true },
          { name: "Current tier", value: rank(p), inline: true },
          {
            name: "Peak tier",
            value: p
              ? `${p.peak_pos === 0 ? "HT" : "LT"}${p.peak_tier}`
              : "Unranked",
            inline: true,
          },
          {
            name: "Readiness",
            value: `Player ${q.player_ready ? "✅" : "⏳"} · Tester ${q.tester_ready ? "✅" : "⏳"}`,
            inline: true,
          },
          {
            name: "Testing server",
            value:
              mode?.testingServer ||
              "Confirm the staff-approved testing server with your tester.",
          },
          {
            name: "Score",
            value: q.score || "No set score recorded",
            inline: true,
          },
          {
            name: "Response deadline",
            value: q.deadline
              ? `<t:${Math.floor(Date.parse(q.deadline) / 1000)}:R>`
              : "See ticket readiness window",
            inline: true,
          },
        ],
        footer: { text: "Official test " + id },
      },
    ],
    components: [
      compRow(
        compButton("I am ready", "room:ready:" + id, 3),
        compButton("Testing rules", "match:rules:" + id),
        compButton("Refresh", "match:status:" + id),
      ),
      ...(staff
        ? [
            compRow(
              compButton("Start test", "match:start:" + id, 1),
              compButton("Record final score", "matchform:finish:" + id),
              compButton("Submit result", "room:result:" + id, 3),
            ),
            compRow(
              compButton("Extend response window", "match:extend:" + id),
              compButton("Add private note", "matchform:note:" + id),
              compButton("Cancel test", "matchform:cancel:" + id, 4),
              compButton("Review absence", "matchform:absent:" + id),
              compButton("Transcript", "match:transcript:" + id),
            ),
          ]
        : [
            compRow(
              compButton("Report a test issue", "matchform:dispute:" + id, 4),
            ),
          ]),
    ],
  };
}
export async function runCompetition(i, env, store, request = fetch, dispatch) {
  const { actor, mod, tester } = staffAccess(i, env),
    sub = i.data.options?.find((o) => o.type === 1),
    opts = sub?.options || i.data.options || [];
  const get = (name) => opts.find((o) => o.name === name)?.value,
    stamp = () => new Date().toISOString();
  const staff = () => {
    if (!mod)
      throw Error("Only testing managers and moderators can use this control.");
  };
  const testStaff = () => {
    if (!tester) throw Error("Only approved testers can use this control.");
  };
  const mode = () => {
    const m = config.modes.find((m) => m.id === get("mode"));
    if (!m) throw Error("Choose an enabled Mace submode.");
    return m;
  };
  const region = () => {
    if (!deskRegions.includes(get("region")))
      throw Error("Choose an enabled testing region.");
    return get("region");
  };
  const reason = () => {
    store.reason(get("reason"));
    return get("reason").trim();
  };
  const discord = (path, method, body) =>
    competitionDiscord(env, request, path, method, body);
  const confirmation = async (action, payload, label) => {
    const id = crypto.randomUUID();
    await store
      .statement(
        "INSERT INTO staff_action_drafts VALUES(?,?,?,?,?,NULL)",
        id,
        actor,
        action,
        JSON.stringify(payload),
        new Date(Date.now() + 600000).toISOString(),
      )
      .run();
    return {
      content:
        "**CONFIRM " +
        label.toUpperCase() +
        "**\n" +
        JSON.stringify(payload) +
        "\nThis action is audited. Confirm within ten minutes.",
      components: [
        compRow(compButton("Confirm " + label, "staff:confirm:" + id, 4)),
      ],
    };
  };
  if (i.data.name === "confirm-action") {
    const d = await store.one(
      "SELECT * FROM staff_action_drafts WHERE id=? AND actor=? AND expires>?",
      get("id"),
      actor,
      stamp(),
    );
    if (!d)
      throw Error("Confirmation expired or belongs to another staff member.");
    if (d.completed) return "This confirmed action has already been applied.";
    const payload = JSON.parse(d.payload),
      result = await dispatch({
        ...i,
        confirmedAction: d.id,
        data: {
          name: d.action,
          options: Object.entries(payload).map(([name, value]) => ({
            name,
            value,
          })),
        },
      });
    await store
      .statement(
        "UPDATE staff_action_drafts SET completed=? WHERE id=?",
        stamp(),
        d.id,
      )
      .run();
    return result;
  }
  if (i.data.name === "account") {
    const a = await store.one(
      "SELECT name,uuid,verified_at FROM accounts WHERE discord=?",
      actor,
    );
    if (!a)
      throw Error(
        "No verified account. Use /verify start or private account support.",
      );
    if (sub?.name === "region") {
      const r = region();
      await store
        .statement(
          "INSERT INTO player_settings(user,region) VALUES(?,?) ON CONFLICT(user) DO UPDATE SET region=excluded.region",
          actor,
          r,
        )
        .run();
      return (
        "Your playing region is now " +
        r +
        ". Existing queue entries retain their selected region."
      );
    }
    if (sub?.name === "privacy") {
      const value = get("visibility");
      if (!["public", "private"].includes(value))
        throw Error("Choose public or private.");
      await store
        .statement(
          "INSERT INTO player_settings(user,public_profile) VALUES(?,?) ON CONFLICT(user) DO UPDATE SET public_profile=excluded.public_profile",
          actor,
          value === "public" ? 1 : 0,
        )
        .run();
      return (
        "Profile visibility: " +
        value +
        ". Official placements remain on the public leaderboard."
      );
    }
    const p = await store.one(
      "SELECT region,public_profile FROM player_settings WHERE user=?",
      actor,
    );
    return (
      "**YOUR VERIFIED ACCOUNT**\nMinecraft: " +
      a.name +
      "\nUUID: " +
      a.uuid +
      "\nRegion: " +
      (p?.region || "Not selected") +
      "\nProfile: " +
      (p?.public_profile === 0 ? "Private" : "Public")
    );
  }
  if (["start", "pause", "resume", "end"].includes(i.data.name)) {
    testStaff();
    const m = mode(),
      r = region();
    await requireQualification(store, actor, m.id);
    const current = await store.one(
      "SELECT * FROM sessions WHERE mode=? AND region=?",
      m.id,
      r,
    );
    if (i.data.name === "start") {
      const approved = get("kit")
        ? await store.one(
            "SELECT * FROM mode_loadouts WHERE mode=? AND version=? AND revoked=0",
            m.id,
            get("kit"),
          )
        : await store.one(
            "SELECT * FROM mode_loadouts WHERE mode=? AND revoked=0 ORDER BY created DESC LIMIT 1",
            m.id,
          );
      const kit = get("kit") || current?.kit_version || approved?.version;
      if (!(await approvedCommunityLoadout(store, m.id, kit)))
        throw Error(
          "A calibrated loadout is required. Management must /loadout approve before opening this Mace mode.",
        );
      const benchmarks =
        get("benchmarks") || current?.benchmarks || approved?.benchmarks;
      store.reason(benchmarks);
      const capacity = get("capacity") ?? current?.capacity ?? m.capacity ?? 20;
      await store.session(
        m.id,
        r,
        "open",
        current?.status === "open" ? current.actor : actor,
        capacity,
        current?.cooldown ?? m.cooldownHours ?? 720,
        kit,
        benchmarks,
      );
      await store.db.batch([
        store.statement(
          "INSERT INTO tester_sessions(id,user,mode,region,status,started,updated) VALUES(?,?,?,?,'available',?,?) ON CONFLICT(user,mode,region) WHERE ended IS NULL DO UPDATE SET status='available',updated=excluded.updated",
          crypto.randomUUID(),
          actor,
          m.id,
          r,
          stamp(),
          stamp(),
        ),
        store.audit(actor, "tester-session-start", m.id + "/" + r),
      ]);
      await queueSessionNotifications(store, m.id, r);
      return {
        content: `**TESTING SESSION OPEN**\n${m.name} · ${r}\nYou are available for assignments. Multiple qualified testers share the FIFO queue. Capacity: ${capacity}.`,
        components: [
          compRow(
            compButton("Pull next player", `tester:pull:${m.id}:${r}`, 1),
            compButton("Pause my availability", `tester:pause:${m.id}:${r}`),
            compButton("Tester dashboard", "community:staff"),
          ),
        ],
      };
    }
    const membership = await store.one(
      "SELECT * FROM tester_sessions WHERE user=? AND mode=? AND region=? AND ended IS NULL",
      actor,
      m.id,
      r,
    );
    if (!membership)
      throw Error("You have no active session here. Use /start first.");
    const status = { pause: "paused", resume: "available", end: "offline" }[
      i.data.name
    ];
    await store.db.batch([
      store.statement(
        "UPDATE tester_sessions SET status=?,updated=?,ended=? WHERE id=? AND ended IS NULL",
        status,
        stamp(),
        status === "offline" ? stamp() : null,
        membership.id,
      ),
      store.statement(
        "UPDATE sessions SET status=CASE WHEN EXISTS(SELECT 1 FROM tester_sessions t WHERE t.mode=sessions.mode AND t.region=sessions.region AND t.ended IS NULL AND t.status='available') THEN 'open' WHEN EXISTS(SELECT 1 FROM tester_sessions t WHERE t.mode=sessions.mode AND t.region=sessions.region AND t.ended IS NULL) THEN 'paused' ELSE 'closed' END,updated=? WHERE mode=? AND region=?",
        stamp(),
        m.id,
        r,
      ),
      store.audit(actor, "tester-session-" + status, m.id + "/" + r),
    ]);
    return `Your ${m.name} / ${r} availability is **${status}**. Active tests remain assigned; other testers retain their own availability.`;
  }
  if (i.data.name === "staff-center") {
    staff();
    const counts = await store.one(
      "SELECT (SELECT count(*) FROM sessions WHERE status='open') open,(SELECT count(*) FROM tester_sessions WHERE ended IS NULL AND status='available') testers,(SELECT count(*) FROM queue WHERE status='claimed') tests,(SELECT count(*) FROM high_tests WHERE status IN ('pending','claimed') AND kind='player') high,(SELECT count(*) FROM appeals WHERE status='pending') appeals,(SELECT count(*) FROM outbox_events WHERE status<>'done') delivery",
    );
    return {
      content: "",
      embeds: [
        {
          title: "🛡️ ADMINISTRATION CENTER",
          color: 0x7861e8,
          fields: Object.entries(counts).map(([name, value]) => ({
            name,
            value: String(value),
            inline: true,
          })),
          description:
            "Manage the network through authenticated controls. All overrides retain reasons and audit history.",
        },
      ],
      components: [
        compRow(
          compButton("Queue manager", "staff:queues", 1),
          compButton("Tester manager", "staff:testers"),
          compButton("Mode configuration", "staff:modes"),
        ),
        compRow(
          compButton("System health", "staff:health"),
          compButton("Delivery failures", "staff:delivery"),
          compButton("Setup wizard", "staff:setup"),
        ),
      ],
    };
  }
  if (i.data.name === "mode") {
    staff();
    const action = sub?.name || get("action");
    if (action === "list")
      return config.modes
        .map(
          (m) =>
            `**${m.name}** · ${m.id}\n${m.testingServer || "Testing server not configured"} · ${m.cooldownHours ?? 720}h cooldown`,
        )
        .join("\n\n");
    const id = get("mode") || get("id");
    if (!/^mace(?:_[a-z0-9]+)*$/.test(id || ""))
      throw Error("Use a stable Mace ID: mace or mace_<submode>.");
    const existing = await store.one(
        "SELECT * FROM mode_settings WHERE id=?",
        id,
      ),
      builtin = config.modes.find((m) => m.id === id);
    if (!existing && !builtin && action !== "create")
      throw Error("Unknown Mace mode.");
    if (action === "create" && config.modes.length >= 25)
      throw Error(
        "At most 25 Mace submodes may be enabled in native Discord selectors. Disable an unused mode before adding another.",
      );
    if (action === "create" && (existing || builtin))
      throw Error("This mode already exists. Use /mode edit.");
    if (["disable", "enable"].includes(action) && !i.confirmedAction)
      return confirmation(
        "mode",
        { action, mode: id, reason: reason() },
        action + " Mace mode",
      );
    const name = get("name") || existing?.name || builtin?.name;
    if (!name || name.length > 70)
      throw Error("Use a mode name of 1–70 characters.");
    const rules = get("rules")
      ? get("rules").split("\n").filter(Boolean)
      : existing
        ? JSON.parse(existing.rules)
        : builtin?.rules || [];
    const cooldown = get("cooldown") ?? existing?.cooldown_hours ?? 720,
      capacity = get("capacity") ?? existing?.capacity ?? 20;
    if (
      !Number.isInteger(cooldown) ||
      cooldown < 0 ||
      cooldown > 720 ||
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 20
    )
      throw Error("Cooldown must be 0–720 hours; capacity must be 1–20.");
    if (get("server")?.length > 200 || rules.join("\n").length > 3000)
      throw Error("Server/rules exceed their limits.");
    await store.db.batch([
      store.statement(
        "INSERT INTO mode_settings VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,enabled=excluded.enabled,rules=excluded.rules,testing_server=excluded.testing_server,cooldown_hours=excluded.cooldown_hours,capacity=excluded.capacity,updated=excluded.updated",
        id,
        name,
        action === "disable"
          ? 0
          : action === "enable"
            ? 1
            : (existing?.enabled ?? 1),
        existing?.icon || builtin?.icon || "⚔️",
        JSON.stringify(rules),
        get("server") ?? existing?.testing_server ?? "",
        cooldown,
        capacity,
        existing?.score_limit ?? 60,
        existing?.created || stamp(),
        stamp(),
      ),
      store.audit(
        actor,
        "mode-" + action,
        id + ": " + (get("reason") || "Configuration updated"),
      ),
    ]);
    if (action === "disable")
      await store
        .statement("UPDATE sessions SET status='paused' WHERE mode=?", id)
        .run();
    await loadCompetitionConfig(store);
    return (
      "Mace mode " +
      action +
      " saved. Existing tiers and test history are preserved. New modes still require real loadout calibration and qualified testers."
    );
  }
  if (i.data.name === "region") {
    staff();
    if (sub?.name === "list") return deskRegions.join(" · ");
    const id = get("region");
    if (!/^[A-Z]{2,4}$/.test(id || ""))
      throw Error("Use a region code of 2–4 uppercase letters.");
    await store.db.batch([
      store.statement(
        "INSERT INTO region_settings VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,enabled=excluded.enabled",
        id,
        get("name") || id,
        sub?.name === "disable" ? 0 : 1,
      ),
      store.audit(actor, "region-" + sub?.name, id),
    ]);
    if (sub?.name === "disable")
      await store
        .statement("UPDATE sessions SET status='paused' WHERE region=?", id)
        .run();
    await loadCompetitionConfig(store);
    return "Region configuration saved. Queue and test history retained.";
  }
  if (i.data.name === "config") {
    staff();
    if (sub?.name === "show") {
      const settings = await store.all(
        "SELECT key,value FROM platform_settings",
      );
      return (
        settings.map((s) => s.key + ": " + s.value).join("\n") ||
        "Default branding active. Use /config branding or /mode edit to configure the network."
      );
    }
    if (sub?.name !== "branding") throw Error("Choose show or branding.");
    const name = get("name"),
      color = get("color");
    if (!name || name.length > 80 || !/^#[a-f0-9]{6}$/i.test(color || ""))
      throw Error("Use a name of 1–80 characters and a #RRGGBB color.");
    await store.db.batch([
      store.statement(
        "INSERT INTO platform_settings VALUES('branding',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,actor=excluded.actor,updated=excluded.updated",
        JSON.stringify({ name, color }),
        actor,
        stamp(),
      ),
      store.audit(actor, "branding-update", name),
    ]);
    return "Network branding saved.";
  }
  if (i.data.name === "cooldown-admin") {
    staff();
    const user = get("user"),
      m = mode();
    if (!/^\d{5,22}$/.test(user || "")) throw Error("Choose a valid player.");
    const action = get("action") || sub?.name,
      current = await store.one(
        "SELECT * FROM cooldowns WHERE user=? AND mode=?",
        user,
        m.id,
      );
    if (action === "inspect")
      return (
        `Cooldown: ${current?.until_at || "Available"}\nRestrictions: ` +
        JSON.stringify(
          await store.all(
            "SELECT until_at FROM player_restrictions WHERE user=? AND mode=?",
            user,
            m.id,
          ),
        )
      );
    if (!i.confirmedAction)
      return confirmation(
        "cooldown-admin",
        {
          action,
          user,
          mode: m.id,
          hours: get("hours") ?? 0,
          reason: reason(),
        },
        action + " cooldown",
      );
    const hours = Number(get("hours"));
    if (!Number.isFinite(hours) || hours < 0 || hours > 720)
      throw Error("Hours must be 0–720.");
    const until =
      action === "reset"
        ? stamp()
        : action === "reduce"
          ? new Date(
              Math.max(
                Date.now(),
                Date.parse(current?.until_at || stamp()) - hours * 3600000,
              ),
            ).toISOString()
          : new Date(Date.now() + hours * 3600000).toISOString();
    if (!current)
      throw Error(
        "No finalized result cooldown exists. Use /player restrict for an administrative testing restriction.",
      );
    await store.db.batch([
      store.statement(
        "UPDATE cooldowns SET until_at=? WHERE user=? AND mode=?",
        until,
        user,
        m.id,
      ),
      store.audit(
        actor,
        "cooldown-" + action,
        user + "/" + m.id + ": " + reason(),
      ),
    ]);
    await store
      .statement(
        "INSERT INTO platform_settings VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,actor=excluded.actor,updated=excluded.updated",
        "cooldown-override:" + user + ":" + m.id,
        until,
        actor,
        stamp(),
      )
      .run();
    return (
      "Cooldown override saved: <t:" +
      Math.floor(Date.parse(until) / 1000) +
      ":F>. Original result and audit history retained."
    );
  }
  if (i.data.name === "player-admin") {
    staff();
    const user = get("user"),
      m = mode(),
      action = sub?.name || get("action");
    if (!/^\d{5,22}$/.test(user || "")) throw Error("Choose a valid player.");
    if (!i.confirmedAction)
      return confirmation(
        "player-admin",
        {
          action,
          user,
          mode: m.id,
          hours: get("hours") ?? 24,
          reason: reason(),
        },
        action + " player",
      );
    const detail = reason();
    if (action === "unrestrict")
      await store.db.batch([
        store.statement(
          "DELETE FROM player_restrictions WHERE user=? AND mode=?",
          user,
          m.id,
        ),
        store.audit(
          actor,
          "player-unrestrict",
          user + "/" + m.id + ": " + detail,
        ),
      ]);
    else {
      const hours = Number(get("hours"));
      if (!Number.isFinite(hours) || hours < 1 || hours > 8760)
        throw Error("Restriction must be 1–8760 hours.");
      await store.db.batch([
        store.statement(
          "INSERT INTO player_restrictions VALUES(?,?,?,?,?,?) ON CONFLICT(user,mode) DO UPDATE SET until_at=excluded.until_at,reason=excluded.reason,actor=excluded.actor,created=excluded.created",
          user,
          m.id,
          new Date(Date.now() + hours * 3600000).toISOString(),
          detail,
          actor,
          stamp(),
        ),
        store.audit(
          actor,
          "player-restrict",
          user + "/" + m.id + ": " + detail,
        ),
      ]);
    }
    return "Player restriction updated. Existing official tiers and unrelated Mace modes are preserved.";
  }
  if (i.data.name === "queue-admin") {
    staff();
    const m = mode(),
      r = region(),
      action = sub?.name || get("action");
    if (!i.confirmedAction)
      return confirmation(
        "queue-admin",
        { action, mode: m.id, region: r, reason: reason() },
        action + " queue",
      );
    const statements = [
      store.audit(actor, "queue-" + action, m.id + "/" + r + ": " + reason()),
    ];
    if (action === "forceclose")
      statements.push(
        store.statement(
          "UPDATE sessions SET status='closed',updated=? WHERE mode=? AND region=?",
          stamp(),
          m.id,
          r,
        ),
        store.statement(
          "UPDATE tester_sessions SET status='offline',ended=?,updated=? WHERE mode=? AND region=? AND ended IS NULL",
          stamp(),
          stamp(),
          m.id,
          r,
        ),
      );
    if (action === "clear")
      statements.push(
        store.statement(
          "UPDATE queue SET status='cancelled' WHERE mode=? AND region=? AND status='waiting'",
          m.id,
          r,
        ),
      );
    await store.db.batch(statements);
    return (
      "Queue " +
      action +
      " applied. Active private tests remain assigned; interest waitlists are preserved."
    );
  }
  if (i.data.name === "quota") {
    const user = get("user") || actor,
      m = get("mode") ? mode().id : "";
    if (sub?.name === "set") {
      staff();
      const target = get("target");
      if (!m || !Number.isInteger(target) || target < 0 || target > 1000)
        throw Error("Choose a mode and a quota of 0–1000.");
      await store.db.batch([
        store.statement(
          "INSERT INTO tester_quotas VALUES(?,?,?,?,?) ON CONFLICT(user,mode) DO UPDATE SET target=excluded.target,actor=excluded.actor,updated=excluded.updated",
          user,
          m,
          target,
          actor,
          stamp(),
        ),
        store.audit(actor, "quota-set", user + "/" + m + ": " + target),
      ]);
      return "Monthly quota saved; UTC calendar months apply.";
    }
    if (user !== actor && !mod)
      throw Error("Only managers can inspect another tester quota.");
    const start = new Date(),
      month = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
      ).toISOString();
    const quotas = await store.all(
      "SELECT q.mode,q.target,(SELECT count(*) FROM results r WHERE r.tester=q.user AND r.mode=q.mode AND r.created>=? AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=r.id)) completed FROM tester_quotas q WHERE user=? AND (?='' OR mode=?)",
      month,
      user,
      m,
      m,
    );
    return quotas.length
      ? quotas
          .map(
            (q) =>
              `**${q.mode}** · ${q.completed}/${q.target} · ${q.target ? Math.min(100, Math.floor((q.completed / q.target) * 100)) : 100}%`,
          )
          .join("\n")
      : "No monthly quota configured. Managers use /quota set.";
  }
  if (i.data.name === "health") {
    staff();
    const stuck = await store.all(
      "SELECT l.test_id,l.state,l.deadline FROM test_lifecycle l WHERE l.state NOT IN ('COMPLETED','ARCHIVED','CANCELLED','ABSENT') AND l.updated<? ORDER BY l.updated LIMIT 10",
      new Date(Date.now() - 30 * 60000).toISOString(),
    );
    const failures = await store.all(
      "SELECT id,kind,attempts,last_error FROM outbox_events WHERE status<>'done' AND attempts>0 ORDER BY id LIMIT 10",
    );
    return (
      "**QUEUE HEALTH**\n" +
      (stuck
        .map((s) => s.test_id + " · " + s.state + " · needs tester review")
        .join("\n") || "No stale managed tests detected.") +
      "\n\n**DELIVERY FAILURES**\n" +
      (failures
        .map((f) => "#" + f.id + " " + f.kind + " · " + f.last_error)
        .join("\n") || "No failed deliveries.")
    );
  }
  if (["match", "absent", "close", "skip"].includes(i.data.name)) {
    const id =
      get("id") ||
      (
        await store.one(
          "SELECT id FROM queue WHERE tester=? AND status='claimed'",
          actor,
        )
      )?.id;
    const q = await store.one("SELECT * FROM queue WHERE id=?", id || "");
    if (!q) throw Error("No active assessment found. Supply its test ID.");
    const action =
      i.data.name === "absent"
        ? "absent"
        : i.data.name === "close"
          ? "cancel"
          : i.data.name === "skip"
            ? "cancel"
            : sub?.name || get("action") || "status";
    if (q.user !== actor && q.tester !== actor && !mod)
      throw Error(
        "Only the player, assigned tester and managers can access this ticket.",
      );
    if (action === "status") return matchDashboard(store, q.id, actor, mod);
    if (action === "rules")
      return (
        "**" +
        (config.modes.find((m) => m.id === q.mode)?.name || q.mode) +
        " TEST RULES**\n" +
        (config.modes.find((m) => m.id === q.mode)?.rules || []).join("\n")
      );
    if (action === "dispute") {
      const detail = reason();
      await store.db.batch([
        store.statement(
          "INSERT INTO match_events VALUES(?,?,?,?,?,?)",
          crypto.randomUUID(),
          q.id,
          actor,
          "ISSUE_REPORTED",
          detail,
          stamp(),
        ),
        store.audit(actor, "match-issue", q.id),
      ]);
      return "Issue recorded privately for testing management. Use the support panel for an independently assigned dispute ticket; no official tier was changed.";
    }
    if (q.tester !== actor && !mod)
      throw Error(
        "Only the assigned tester or testing manager can perform this ticket action.",
      );
    if (action === "reassign") {
      staff();
      const target = get("user"),
        detail = reason();
      if (!/^\d{5,22}$/.test(target || ""))
        throw Error("Choose the new tester.");
      if (target === q.user || q.status !== "claimed")
        throw Error(
          "Choose an independent tester for an unfinished assigned test.",
        );
      await requireQualification(store, target, q.mode);
      if (
        await store.one(
          "SELECT 1 FROM queue WHERE tester=? AND status='claimed' AND id<>?",
          target,
          q.id,
        )
      )
        throw Error("The new tester already has an active assignment.");
      const room = await store.one("SELECT * FROM test_rooms WHERE id=?", q.id);
      if (!room?.channel)
        throw Error("Open the existing private ticket before reassigning.");
      await discord("/channels/" + room.channel, "PATCH", {
        permission_overwrites: roomOverwrites(env, q.user, target),
      });
      try {
        const deadline = new Date(Date.now() + 300000).toISOString();
        const out = await store.db.batch([
          store.statement(
            "UPDATE queue SET tester=? WHERE id=? AND tester=? AND status='claimed' AND NOT EXISTS(SELECT 1 FROM queue busy WHERE busy.tester=? AND busy.status='claimed' AND busy.id<>?)",
            target,
            q.id,
            q.tester,
            target,
            q.id,
          ),
          store.statement(
            "UPDATE test_rooms SET tester=?,player_ready=0,tester_ready=0,ready_by=? WHERE id=? AND EXISTS(SELECT 1 FROM queue WHERE id=? AND tester=?)",
            target,
            deadline,
            q.id,
            q.id,
            target,
          ),
          store.statement(
            "UPDATE test_lifecycle SET state='AWAITING_PLAYER',version=version+1,deadline=?,updated=? WHERE test_id=? AND EXISTS(SELECT 1 FROM queue WHERE id=? AND tester=?)",
            deadline,
            stamp(),
            q.id,
            q.id,
            target,
          ),
          store.audit(
            actor,
            "test-reassigned",
            q.id + ": " + q.tester + " -> " + target + ": " + detail,
          ),
        ]);
        if (!out[0].meta.changes)
          throw Error("The assignment changed concurrently. Refresh the test.");
      } catch (e) {
        const current = await store.one(
          "SELECT tester FROM queue WHERE id=?",
          q.id,
        );
        try {
          await discord("/channels/" + room.channel, "PATCH", {
            permission_overwrites: roomOverwrites(env, q.user, current.tester),
          });
        } catch {
          await store
            .audit("system", "reassignment-permissions-recovery-required", q.id)
            .run();
        }
        throw e;
      }
      return "Test reassigned. Old tester access was removed; both participants must confirm readiness again.";
    }
    if (action === "transcript") {
      const room = await store.one(
        "SELECT channel FROM test_rooms WHERE id=?",
        q.id,
      );
      const events = await store.all(
        "SELECT actor,action,detail,created FROM match_events WHERE test_id=? ORDER BY created,id LIMIT 100",
        q.id,
      );
      let messages = [];
      if (room?.channel)
        messages = await discord(
          "/channels/" + room.channel + "/messages?limit=100",
        );
      const text =
        "OFFICIAL PRIVATE TEST TRANSCRIPT\nTest " +
        q.id +
        "\nTimeline\n" +
        events
          .map(
            (e) => e.created + " " + e.actor + " " + e.action + ": " + e.detail,
          )
          .join("\n") +
        "\n\nLatest 100 Discord messages\n" +
        messages
          .reverse()
          .map(
            (m) =>
              (m.timestamp || "") +
              " " +
              m.author?.id +
              ": " +
              (m.content || "[embed]") +
              (m.attachments?.length
                ? "\nAttachments: " + m.attachments.map((a) => a.url).join(" ")
                : ""),
          )
          .join("\n");
      await store.audit(actor, "private-transcript-export", q.id).run();
      return {
        content:
          "Private transcript for " +
          q.id +
          ". Includes the recorded timeline and latest 100 channel messages.",
        artifact: { name: "test-" + q.id + ".txt", text },
        components: [],
      };
    }
    if (action === "note") {
      const detail = reason();
      await store.db.batch([
        store.statement(
          "INSERT INTO match_events VALUES(?,?,?,?,?,?)",
          crypto.randomUUID(),
          q.id,
          actor,
          "PRIVATE_NOTE",
          detail,
          stamp(),
        ),
        store.audit(actor, "match-note", q.id),
      ]);
      return "Private testing note saved to this assessment timeline.";
    }
    const l = await store.one(
      "SELECT * FROM test_lifecycle WHERE test_id=?",
      q.id,
    );
    if (!l)
      throw Error("Use /test-room open to initialize this ticket lifecycle.");
    if (action === "extend") {
      if (!["CREATED", "AWAITING_PLAYER", "PLAYER_READY"].includes(l.state))
        throw Error("Only a readiness window may be extended.");
      const deadline = new Date(Date.now() + 5 * 60000).toISOString();
      await store.db.batch([
        store.statement(
          "UPDATE test_lifecycle SET deadline=?,updated=? WHERE test_id=?",
          deadline,
          stamp(),
          q.id,
        ),
        store.statement(
          "UPDATE test_rooms SET ready_by=? WHERE id=?",
          deadline,
          q.id,
        ),
        store.audit(actor, "response-window-extended", q.id),
      ]);
      return "Response window extended by five minutes. No penalty applied.";
    }
    if (action === "start") {
      if (q.status !== "claimed")
        throw Error("This test is no longer assigned.");
      const room = await store.one("SELECT * FROM test_rooms WHERE id=?", q.id);
      if (
        !room?.player_ready ||
        !room.tester_ready ||
        !(await approvedCommunityLoadout(store, q.mode, room.kit_version))
      )
        throw Error(
          "Both participants must be ready with the approved kit before starting.",
        );
      await transitionMatch(
        store,
        q.id,
        actor,
        ["PLAYER_READY", "AWAITING_PLAYER"],
        "IN_PROGRESS",
        "Both participants confirmed readiness.",
      );
      return matchDashboard(store, q.id, actor, mod);
    }
    if (action === "finish") {
      const score = get("score");
      const parsed = /^(\d{1,2})-(\d{1,2})$/.exec(score || ""),
        limit = config.modes.find((m) => m.id === q.mode)?.scoreLimit ?? 60;
      if (
        !parsed ||
        Number(parsed[1]) + Number(parsed[2]) === 0 ||
        Number(parsed[1]) > limit ||
        Number(parsed[2]) > limit
      )
        throw Error(
          "Use a valid completed set score, for example 10-6, within the configured score limit.",
        );
      await transitionMatch(
        store,
        q.id,
        actor,
        ["IN_PROGRESS"],
        "AWAITING_RESULT",
        reason(),
        { score },
      );
      return "Set score recorded. Record the rubric, then submit and confirm the official result.";
    }
    if (["cancel", "absent"].includes(action)) {
      const detail = reason();
      if (!i.confirmedAction)
        return confirmation(
          "match",
          { action, id: q.id, reason: detail },
          action + " test",
        );
      if (action === "absent" && Date.parse(l.deadline) > Date.now())
        throw Error(
          "The response deadline has not elapsed. Extend or wait before absence review.",
        );
      if (["COMPLETED", "ARCHIVED", "CANCELLED", "ABSENT"].includes(l.state))
        throw Error("This test is already finalized or closed.");
      await transitionMatch(
        store,
        q.id,
        actor,
        [
          "CREATED",
          "AWAITING_PLAYER",
          "PLAYER_READY",
          "IN_PROGRESS",
          "AWAITING_RESULT",
          "RESULT_PENDING_CONFIRMATION",
          "DISPUTED",
        ],
        action === "absent" ? "ABSENT" : "CANCELLED",
        detail,
        {
          statements: [
            store.statement(
              "UPDATE queue SET status='cancelled' WHERE id=? AND status='claimed'",
              q.id,
            ),
            store.statement(
              "INSERT OR IGNORE INTO outbox_events(kind,subject,available_at,created) VALUES('archive',?,?,?)",
              q.id,
              stamp(),
              stamp(),
            ),
          ],
        },
      );
      return "Test closed with a recorded reason. No automatic penalty, cooldown or tier change was applied.";
    }
    throw Error("Choose a supported ticket action.");
  }
  throw Error("Choose a supported competition command.");
}
