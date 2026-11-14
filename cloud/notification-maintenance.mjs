import config from "../config/community.json" with { type: "json" };
export async function enqueuePlatformNotifications(store, clock = Date.now()) {
  const now = new Date(clock).toISOString(),
    gate = await store
      .statement(
        "INSERT INTO maintenance_locks VALUES('notifications',?) ON CONFLICT(key) DO UPDATE SET next_at=excluded.next_at WHERE maintenance_locks.next_at<=? RETURNING key",
        new Date(clock + 60000).toISOString(),
        now,
      )
      .first();
  if (!gate) return 0;
  const jobs = [];
  const add = (kind, subject, payload, available_at = now) =>
    jobs.push(
      store.statement(
        "INSERT OR IGNORE INTO outbox_events(kind,subject,payload,available_at,created) VALUES(?,?,?,?,?)",
        kind,
        subject,
        JSON.stringify(payload),
        available_at,
        now,
      ),
    );
  const cooldowns = await store.all(
    "SELECT c.* FROM cooldowns c JOIN notification_preferences p ON p.user=c.user AND p.delivery='dm' WHERE NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=c.result_id) AND NOT EXISTS(SELECT 1 FROM outbox_events o WHERE o.kind='cooldown-expired' AND o.subject=c.result_id||'/'||c.until_at) LIMIT 200",
  );
  for (const c of cooldowns)
    add(
      "cooldown-expired",
      c.result_id + "/" + c.until_at,
      { user: c.user, mode: c.mode, result: c.result_id, until: c.until_at },
      c.until_at,
    );
  const results = await store.all(
    "SELECT r.id,r.name,r.mode,r.tier,r.pos,a.discord user FROM results r JOIN accounts a ON a.uuid=r.uuid JOIN notification_preferences p ON p.user=a.discord AND p.delivery='dm' WHERE r.record_type='test' AND NOT EXISTS(SELECT 1 FROM outbox_events o WHERE o.kind='result-notification' AND o.subject=r.id) AND r.created>=? AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=r.id) ORDER BY r.sequence DESC LIMIT 100",
    new Date(clock - 86400000).toISOString(),
  );
  for (const r of results) add("result-notification", r.id, r);
  const reminders = await store.all(
    "SELECT q.id,q.user,q.tester,r.channel,l.deadline FROM test_lifecycle l JOIN queue q ON q.id=l.test_id JOIN test_rooms r ON r.id=q.id WHERE l.state='AWAITING_PLAYER' AND q.status='claimed' AND l.deadline>? AND l.deadline<=? LIMIT 30",
    now,
    new Date(clock + 120000).toISOString(),
  );
  for (const r of reminders)
    add("readiness-reminder", r.id + "/" + r.deadline, r);
  const reviews = await store.all(
    "SELECT q.id,q.user,q.tester,r.channel,l.deadline FROM test_lifecycle l JOIN queue q ON q.id=l.test_id JOIN test_rooms r ON r.id=q.id WHERE l.state='AWAITING_PLAYER' AND q.status='claimed' AND l.deadline<=? AND l.deadline>=? LIMIT 30",
    now,
    new Date(clock - 3600000).toISOString(),
  );
  for (const r of reviews) add("absence-review", r.id + "/" + r.deadline, r);
  const high = await store.all(
    "SELECT h.id,h.user,h.mode,h.region,h.status,h.target FROM high_tests h JOIN notification_preferences p ON p.user=h.user AND p.delivery='dm' WHERE h.kind='player' AND h.status IN ('claimed','denied','passed','failed') AND h.updated>=? LIMIT 100",
    new Date(clock - 86400000).toISOString(),
  );
  for (const h of high) add("high-test-notification", h.id + "/" + h.status, h);
  const date = new Date(clock),
    monthEnd = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
    ),
    monthStart = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
    ).toISOString();
  if (monthEnd.getTime() - clock <= 5 * 86400000) {
    const quotas = await store.all(
      "SELECT q.user,q.mode,q.target,(SELECT count(*) FROM results r WHERE r.tester=q.user AND r.mode=q.mode AND r.record_type='test' AND r.created>=? AND r.created<? AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=r.id)) completed FROM tester_quotas q JOIN notification_preferences p ON p.user=q.user AND p.delivery='dm' WHERE q.target>0 LIMIT 100",
      monthStart,
      monthEnd.toISOString(),
    );
    for (const q of quotas)
      if (q.completed < q.target)
        add("quota-reminder", q.user + "/" + q.mode + "/" + monthStart, q);
  }
  let created = 0;
  for (let n = 0; n < jobs.length; n += 30) {
    const outcomes = await store.db.batch(jobs.slice(n, n + 30));
    created += outcomes.reduce((sum, r) => sum + r.meta.changes, 0);
  }
  return created;
}
export async function deliverPlatformNotification(job, store, api) {
  const p = JSON.parse(job.payload),
    mode = config.modes.find((m) => m.id === p.mode)?.name || p.mode;
  if (job.kind === "readiness-reminder" || job.kind === "absence-review") {
    const live = await store.one(
      "SELECT l.state,l.deadline,q.status FROM test_lifecycle l JOIN queue q ON q.id=l.test_id WHERE l.test_id=?",
      p.id,
    );
    if (
      !live ||
      live.status !== "claimed" ||
      !["AWAITING_PLAYER", "PLAYER_READY"].includes(live.state) ||
      live.deadline !== p.deadline
    )
      return;
    const text =
      job.kind === "readiness-reminder"
        ? "⏰ Response reminder: confirm readiness in this private test. Ask your tester for an extension if needed."
        : "📋 The response window has elapsed. The assigned tester must review availability and any connection outage before deciding how to proceed. No penalty or absence was applied automatically.";
    await api("/channels/" + p.channel + "/messages", "POST", {
      content: text,
      nonce: String(job.id),
      enforce_nonce: true,
      allowed_mentions: { parse: [] },
    });
    return;
  }
  const preference = await store.one(
    "SELECT delivery FROM notification_preferences WHERE user=?",
    p.user,
  );
  if (preference?.delivery !== "dm") return;
  let text;
  if (job.kind === "cooldown-expired") {
    const c = await store.one(
      "SELECT until_at,result_id FROM cooldowns WHERE user=? AND mode=?",
      p.user,
      p.mode,
    );
    if (
      !c ||
      c.result_id !== p.result ||
      c.until_at !== p.until ||
      Date.parse(c.until_at) > Date.now()
    )
      return;
    if (await store.one("SELECT 1 FROM revoked WHERE result_id=?", p.result))
      return;
    text =
      "⏱️ Your " +
      mode +
      " retest cooldown has expired. Check the live queue for availability; other eligibility restrictions may still apply.";
  } else if (job.kind === "result-notification") {
    if (await store.one("SELECT 1 FROM revoked WHERE result_id=?", p.id))
      return;
    text =
      "🏆 Your official " +
      mode +
      " evaluation was published: **" +
      (p.pos === 0 ? "HT" : "LT") +
      p.tier +
      "**. Your profile, points and rankings are updated. Test ID: " +
      p.id;
  } else if (job.kind === "high-test-notification") {
    const current = await store.one(
      "SELECT status FROM high_tests WHERE id=?",
      p.id,
    );
    if (current?.status !== p.status) return;
    text =
      "👑 Your " +
      mode +
      " high-tier request for " +
      p.target +
      " is **" +
      (p.status === "claimed" ? "accepted / assigned" : p.status) +
      "**. Open your private application dashboard for the next step.";
  } else if (job.kind === "quota-reminder")
    text =
      "📊 Your UTC monthly " +
      mode +
      " testing quota is " +
      p.completed +
      "/" +
      p.target +
      ". " +
      (p.target - p.completed) +
      " official evaluations remain. Quality and independent review requirements always apply.";
  else throw Error("Unknown platform notification");
  try {
    const dm = await api("/users/@me/channels", "POST", {
      recipient_id: p.user,
    });
    await api("/channels/" + dm.id + "/messages", "POST", {
      content: text,
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
export const platformNotificationKinds = new Set([
  "cooldown-expired",
  "result-notification",
  "readiness-reminder",
  "absence-review",
  "high-test-notification",
  "quota-reminder",
]);
