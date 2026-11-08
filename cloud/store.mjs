export class CloudStore {
  constructor(db) {
    this.db = db;
  }
  statement(sql, ...args) {
    return this.db.prepare(sql).bind(...args);
  }
  async one(sql, ...args) {
    return this.statement(sql, ...args).first();
  }
  async all(sql, ...args) {
    return (await this.statement(sql, ...args).all()).results;
  }
  audit(actor, action, subject) {
    return this.statement(
      "INSERT INTO audit(actor,action,subject,created) VALUES(?,?,?,?)",
      actor,
      action,
      subject,
      new Date().toISOString(),
    );
  }
  async verify(user, uuid, name, actor) {
    await this.db.batch([
      this.statement(
        "INSERT INTO accounts VALUES(?,?,?,?) ON CONFLICT(discord) DO UPDATE SET uuid=excluded.uuid,name=excluded.name,verified_by=excluded.verified_by",
        user,
        uuid,
        name,
        actor,
      ),
      this.audit(actor, "verify", uuid),
    ]);
  }
  async session(mode, region, status, actor, capacity = 30, cooldown = 72) {
    if (
      !["open", "paused", "closed"].includes(status) ||
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 200 ||
      !Number.isInteger(cooldown) ||
      cooldown < 0 ||
      cooldown > 720
    )
      throw Error("Invalid session settings.");
    await this.db.batch([
      this.statement(
        "INSERT INTO sessions VALUES(?,?,?,?,?,?,?) ON CONFLICT(mode,region) DO UPDATE SET status=excluded.status,capacity=excluded.capacity,cooldown=excluded.cooldown,actor=excluded.actor,updated=excluded.updated",
        mode,
        region,
        status,
        capacity,
        cooldown,
        actor,
        new Date().toISOString(),
      ),
      this.audit(actor, "session-" + status, mode + "/" + region),
    ]);
  }
  async join(user, mode, region) {
    if (!(await this.one("SELECT 1 FROM accounts WHERE discord=?", user)))
      throw Error(
        "Ask staff to verify your Minecraft account ownership first.",
      );
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    // Eligibility and insertion are one SQL statement: concurrent requests cannot
    // oversubscribe a session or bypass a cooldown/account/duplicate check.
    const outcome = await this.statement(
      `INSERT INTO queue(id,user,mode,region,created)
      SELECT ?,?,?,?,? FROM sessions s WHERE s.mode=? AND s.region=? AND s.status='open'
      AND EXISTS(SELECT 1 FROM accounts WHERE discord=?)
      AND NOT EXISTS(SELECT 1 FROM queue WHERE user=? AND mode=? AND status IN ('waiting','claimed'))
      AND (SELECT count(*) FROM queue WHERE mode=s.mode AND region=s.region AND status IN ('waiting','claimed')) < s.capacity
      AND NOT EXISTS(SELECT 1 FROM results r JOIN accounts a ON a.uuid=r.uuid WHERE a.discord=? AND r.mode=s.mode
        AND NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id)
        AND julianday(?) - julianday(r.created) < s.cooldown / 24.0)`,
      id,
      user,
      mode,
      region,
      now,
      mode,
      region,
      user,
      user,
      mode,
      user,
      now,
    ).run();
    if (!outcome.meta.changes)
      throw Error(
        "Queue unavailable: check the open session, capacity, cooldown and your existing entries.",
      );
    return id;
  }
  async leave(user, mode) {
    return (
      await this.statement(
        "UPDATE queue SET status='cancelled' WHERE user=? AND mode=? AND status='waiting'",
        user,
        mode,
      ).run()
    ).meta.changes;
  }
  async list() {
    return this.all(
      "SELECT id,user,mode,region,status,created FROM queue WHERE status IN ('waiting','claimed') ORDER BY created,id",
    );
  }
  async claim(id, actor) {
    const outcomes = await this.db.batch([
      this.statement(
        "UPDATE queue SET status='claimed',tester=? WHERE id=? AND status='waiting' AND user<>?",
        actor,
        id,
        actor,
      ),
      this.audit(actor, "claim-attempt", id),
    ]);
    if (!outcomes[0].meta.changes)
      throw Error("Entry was already claimed, cancelled, or belongs to you.");
  }
  async result(id, tier, pos, evidence, actor) {
    const outcomes = await this.db.batch([
      this.statement(
        `INSERT INTO results(id,uuid,name,region,mode,tier,pos,tester,evidence,created)
        SELECT q.id,a.uuid,a.name,q.region,q.mode,?,?,q.tester,?,? FROM queue q JOIN accounts a ON a.discord=q.user
        WHERE q.id=? AND q.tester=? AND q.status='claimed'`,
        tier,
        pos,
        evidence,
        new Date().toISOString(),
        id,
        actor,
      ),
      this.statement(
        "UPDATE queue SET status='complete' WHERE id=? AND tester=? AND status='claimed' AND EXISTS(SELECT 1 FROM results WHERE id=? AND tester=?)",
        id,
        actor,
        id,
        actor,
      ),
      this.audit(actor, "result-attempt", id),
    ]);
    if (!outcomes[0].meta.changes)
      throw Error("Only the assigned tester can record a claimed entry.");
  }
  async appeal(resultId, actor, reason) {
    this.reason(reason);
    const id = crypto.randomUUID();
    const outcomes = await this.db.batch([
      this.statement(
        `INSERT INTO appeals(id,result_id,user,reason,created)
        SELECT ?,r.id,?,?,? FROM results r JOIN accounts a ON a.uuid=r.uuid WHERE r.id=? AND a.discord=?
        AND NOT EXISTS(SELECT 1 FROM appeals WHERE result_id=r.id AND status='pending')`,
        id,
        actor,
        reason.trim(),
        new Date().toISOString(),
        resultId,
        actor,
      ),
      this.audit(actor, "appeal-attempt", resultId),
    ]);
    if (!outcomes[0].meta.changes)
      throw Error(
        "Only your own completed test can be appealed; check for an existing pending appeal.",
      );
    return id;
  }
  reason(value) {
    if (
      typeof value !== "string" ||
      value.trim().length < 10 ||
      value.length > 2000
    )
      throw Error("An explanation of 10–2000 characters is required.");
  }
  async appeals(actor) {
    return actor
      ? this.all(
          "SELECT id,result_id,reason,status,decision,created FROM appeals WHERE user=? ORDER BY created DESC",
          actor,
        )
      : this.all(
          "SELECT * FROM appeals WHERE status='pending' ORDER BY created",
        );
  }
  async review(id, actor, decision, reason) {
    this.reason(reason);
    if (!["uphold", "revoke"].includes(decision))
      throw Error("Choose uphold or revoke.");
    const outcomes = await this.db.batch([
      this.statement(
        `UPDATE appeals SET status=?,reviewer=?,decision=? WHERE id=? AND status='pending' AND user<>?
        AND EXISTS(SELECT 1 FROM results r WHERE r.id=appeals.result_id AND r.tester<>?)`,
        decision,
        actor,
        reason.trim(),
        id,
        actor,
        actor,
      ),
      this.statement(
        "INSERT OR IGNORE INTO revoked(result_id,actor,reason,created) SELECT result_id,reviewer,decision,? FROM appeals WHERE id=? AND status='revoke' AND reviewer=?",
        new Date().toISOString(),
        id,
        actor,
      ),
      this.audit(actor, "appeal-review-attempt", id),
    ]);
    if (!outcomes[0].meta.changes)
      throw Error("A pending appeal and independent reviewer are required.");
  }
  async testing() {
    return {
      updatedAt: new Date().toISOString(),
      activation: "active",
      sessions: await this.all(
        "SELECT mode,region,status,capacity,cooldown,updated,(SELECT count(*) FROM queue q WHERE q.mode=s.mode AND q.region=s.region AND q.status='waiting') AS waiting,(SELECT count(*) FROM queue q WHERE q.mode=s.mode AND q.region=s.region AND q.status='claimed') AS claimed FROM sessions s",
      ),
    };
  }
  async rankings(points) {
    const rows = await this.all(
      "SELECT * FROM results r WHERE NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id) ORDER BY sequence",
    );
    const players = new Map();
    for (const r of rows) {
      const p = players.get(r.uuid) || {
        uuid: r.uuid,
        name: r.name,
        region: r.region,
        points: 0,
        rankings: {},
      };
      players.set(r.uuid, p);
      p.name = r.name;
      p.region = r.region;
      const old = p.rankings[r.mode],
        value = points[`${r.pos === 0 ? "HT" : "LT"}${r.tier}`];
      const peak =
        old &&
        points[`${old.peak_pos === 0 ? "HT" : "LT"}${old.peak_tier}`] >= value
          ? { tier: old.peak_tier, pos: old.peak_pos }
          : r;
      p.rankings[r.mode] = {
        tier: r.tier,
        pos: r.pos,
        peak_tier: peak.tier,
        peak_pos: peak.pos,
        retired: false,
        attained: r.created,
        evidence: r.evidence,
      };
    }
    for (const p of players.values())
      p.points = Object.values(p.rankings).reduce(
        (sum, r) => sum + points[`${r.pos === 0 ? "HT" : "LT"}${r.tier}`],
        0,
      );
    return {
      updatedAt: new Date().toISOString(),
      players: [...players.values()].sort(
        (a, b) => b.points - a.points || a.uuid.localeCompare(b.uuid),
      ),
      recent: rows
        .slice(-100)
        .reverse()
        .map(
          ({ id, uuid, name, region, mode, tier, pos, evidence, created }) => ({
            id,
            uuid,
            name,
            region,
            mode,
            tier,
            pos,
            evidence,
            created,
          }),
        ),
    };
  }
  async beginInteraction(id) {
    const results = await this.db.batch([
      this.statement(
        "DELETE FROM interaction_receipts WHERE created<?",
        new Date(Date.now() - 24 * 3600000).toISOString(),
      ),
      this.statement(
        "INSERT OR IGNORE INTO interaction_receipts(id,created,status) VALUES(?,?,'processing')",
        id,
        new Date().toISOString(),
      ),
    ]);
    return results[1].meta.changes > 0;
  }
  async finishInteraction(id, response) {
    await this.statement(
      "UPDATE interaction_receipts SET status='complete',response=? WHERE id=?",
      response,
      id,
    ).run();
  }
}
