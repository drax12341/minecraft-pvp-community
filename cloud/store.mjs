export class CloudStore {
  constructor(db) {
    this.db = db;
  }
  statement(sql, ...args) {
    return this.db.prepare(sql).bind(...args);
  }
  async practiceCreate(user, mode, region, note) {
    if (
      typeof note !== "string" ||
      note.trim().length < 10 ||
      note.length > 180
    )
      throw Error(
        "Describe your kit, UTC availability and practice goal in 10–180 characters. Do not include private information.",
      );
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    const expires = new Date(Date.now() + 24 * 3600000).toISOString();
    const r = await this.statement(
      `INSERT INTO practice_posts(id,user,mode,region,note,created,expires)
      SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM practice_posts WHERE user=? AND status='open' AND expires>?)<3
      AND NOT EXISTS(SELECT 1 FROM practice_posts WHERE user=? AND mode=? AND status='open' AND expires>?)`,
      id,
      user,
      mode,
      region,
      note.trim(),
      now,
      expires,
      user,
      now,
      user,
      mode,
      now,
    ).run();
    if (!r.meta.changes)
      throw Error(
        "You already have an active post for this mode, or three active posts. Close an old post first.",
      );
    return id;
  }
  async practiceList(mode, region) {
    return this.all(
      "SELECT id,user,mode,region,note,expires FROM practice_posts WHERE status='open' AND expires>? AND (?='' OR mode=?) AND (?='' OR region=?) ORDER BY created DESC LIMIT 5",
      new Date().toISOString(),
      mode || "",
      mode || "",
      region || "",
      region || "",
    );
  }
  async practiceClose(id, actor, moderator = false) {
    const r = await this.db.batch([
      this.statement(
        "UPDATE practice_posts SET status='closed' WHERE id=? AND status='open' AND (user=? OR ?=1)",
        id,
        actor,
        moderator ? 1 : 0,
      ),
      this.audit(actor, "practice-close-attempt", id),
    ]);
    if (!r[0].meta.changes)
      throw Error("Only the post owner or a moderator can close an open post.");
  }
  async applyTester(user, mode, region, experience, availability) {
    if (
      typeof experience !== "string" ||
      experience.trim().length < 30 ||
      experience.length > 800 ||
      typeof availability !== "string" ||
      availability.trim().length < 5 ||
      availability.length > 100
    )
      throw Error(
        "Use 30–800 characters of testing experience and 5–100 characters of UTC availability. Do not include private personal information.",
      );
    if (!(await this.one("SELECT 1 FROM accounts WHERE discord=?", user)))
      throw Error(
        "Ask staff to verify your Minecraft ownership before applying.",
      );
    const id = crypto.randomUUID();
    const r = await this.statement(
      `INSERT INTO tester_applications(id,user,mode,region,experience,availability,created)
      SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM tester_applications WHERE user=? AND mode=? AND status='pending')`,
      id,
      user,
      mode,
      region,
      experience.trim(),
      availability.trim(),
      new Date().toISOString(),
      user,
      mode,
    ).run();
    if (!r.meta.changes)
      throw Error("You already have a pending application for this mode.");
    return id;
  }
  async testerApplications(user) {
    return user
      ? this.all(
          "SELECT id,mode,region,status,decision FROM tester_applications WHERE user=? ORDER BY created DESC LIMIT 6",
          user,
        )
      : this.all(
          "SELECT id,user,mode,region,experience,availability FROM tester_applications WHERE status='pending' ORDER BY created LIMIT 3",
        );
  }
  async reviewTester(id, actor, decision, reason) {
    this.reason(reason);
    if (!["interview", "declined"].includes(decision))
      throw Error(
        "Choose interview or declined. Interviews do not grant staff roles.",
      );
    const r = await this.db.batch([
      this.statement(
        "UPDATE tester_applications SET status=?,reviewer=?,decision=? WHERE id=? AND status='pending' AND user<>?",
        decision,
        actor,
        reason.trim(),
        id,
        actor,
      ),
      this.audit(actor, "tester-review-attempt", id),
    ]);
    if (!r[0].meta.changes)
      throw Error(
        "A pending application and an independent moderator are required.",
      );
  }
  async release(id, actor) {
    const r = await this.db.batch([
      this.statement(
        "UPDATE queue SET status='waiting',tester=NULL WHERE id=? AND status='claimed' AND tester=? AND NOT EXISTS(SELECT 1 FROM results WHERE id=?)",
        id,
        actor,
        id,
      ),
      this.audit(actor, "release-attempt", id),
    ]);
    if (!r[0].meta.changes)
      throw Error(
        "Only the assigned tester can release an unfinished claimed entry.",
      );
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
    const existing=await this.one('SELECT uuid FROM accounts WHERE discord=?',user);
    if(existing&&existing.uuid!==uuid)throw Error('This Discord account is linked to another UUID. Open a private recovery ticket; existing identity is preserved.');
    const outcomes=await this.db.batch([
      this.statement(
        "INSERT INTO accounts(discord,uuid,name,verified_by,verified_at) VALUES(?,?,?,?,?) ON CONFLICT(discord) DO UPDATE SET name=excluded.name,verified_by=excluded.verified_by,verified_at=excluded.verified_at WHERE accounts.uuid=excluded.uuid",
        user,
        uuid,
        name,
        actor,
        new Date().toISOString(),
      ),
      this.audit(actor, "verify", uuid),
    ]);
    if(!outcomes[0].meta.changes)throw Error('Account link changed during verification. Review the private recovery case; no identity was replaced.');
  }
  async session(mode, region, status, actor, capacity = 30, cooldown = 72, kitVersion=null, benchmarks=null) {
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
        "INSERT INTO sessions(mode,region,status,capacity,cooldown,actor,updated,kit_version,benchmarks) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(mode,region) DO UPDATE SET status=excluded.status,capacity=excluded.capacity,cooldown=excluded.cooldown,actor=excluded.actor,updated=excluded.updated,kit_version=COALESCE(excluded.kit_version,sessions.kit_version),benchmarks=COALESCE(excluded.benchmarks,sessions.benchmarks)",
        mode,
        region,
        status,
        capacity,
        cooldown,
        actor,
        new Date().toISOString(),
        kitVersion,
        benchmarks,
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
      AND NOT EXISTS(SELECT 1 FROM test_restrictions tr WHERE tr.user=? AND tr.mode=s.mode AND tr.until_at>?)
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
      now,
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
  async list(user=null) {
    return this.all(
      "SELECT id,user,mode,region,status,created FROM queue WHERE status IN ('waiting','claimed') AND (? IS NULL OR user=?) ORDER BY created,id LIMIT 200",user,user,
    );
  }
  async status(user, mode, region) {
    const account = await this.one(
      "SELECT name FROM accounts WHERE discord=?",
      user,
    );
    const session = await this.one(
      "SELECT status,capacity,cooldown FROM sessions WHERE mode=? AND region=?",
      mode,
      region,
    );
    const entry = await this.one(
      "SELECT id,status,region,created,tester FROM queue WHERE user=? AND mode=? AND status IN ('waiting','claimed')",
      user,
      mode,
    );
    const latest = await this.one(
      `SELECT r.id,r.created,r.tier,r.pos,r.evidence FROM results r JOIN accounts a ON a.uuid=r.uuid
      WHERE a.discord=? AND r.mode=? AND NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id) ORDER BY r.sequence DESC LIMIT 1`,
      user,
      mode,
    );
    const counts = await this.one(
      "SELECT count(*) AS occupied FROM queue WHERE mode=? AND region=? AND status IN ('waiting','claimed')",
      mode,
      region,
    );
    let position = null;
    if (entry?.status === "waiting")
      position = (
        await this.one(
          `SELECT count(*)+1 AS position FROM queue WHERE mode=? AND region=? AND status='waiting' AND (created<? OR (created=? AND id<?))`,
          mode,
          entry.region,
          entry.created,
          entry.created,
          entry.id,
        )
      ).position;
    const eligibleAt =
      latest && session
        ? new Date(
            Date.parse(latest.created) + session.cooldown * 3600000,
          ).toISOString()
        : null;
    return {
      account,
      session,
      entry,
      latest,
      position,
      occupied: counts.occupied,
      eligibleAt,
    };
  }
  async claim(id, actor) {
    const outcomes = await this.db.batch([
      this.statement(
        "UPDATE queue SET status='claimed',tester=? WHERE id=? AND status='waiting' AND user<>? AND NOT EXISTS(SELECT 1 FROM queue WHERE tester=? AND status='claimed') AND NOT EXISTS(SELECT 1 FROM queue busy WHERE busy.user=queue.user AND busy.status='claimed') AND EXISTS(SELECT 1 FROM sessions s WHERE s.mode=queue.mode AND s.region=queue.region AND s.status='open')",
        actor,
        id,
        actor,
        actor,
      ),
      this.audit(actor, "claim-attempt", id),
    ]);
    if (!outcomes[0].meta.changes)
      throw Error("Entry was already claimed, cancelled, or belongs to you.");
  }
  async claimNext(mode,region,actor){
    const row=await this.statement(`UPDATE queue SET status='claimed',tester=? WHERE id=(
      SELECT q.id FROM queue q JOIN sessions s ON s.mode=q.mode AND s.region=q.region
      WHERE q.mode=? AND q.region=? AND q.status='waiting' AND q.user<>? AND s.status='open'
      AND NOT EXISTS(SELECT 1 FROM queue busy WHERE busy.user=q.user AND busy.status='claimed')
      ORDER BY q.created,q.id LIMIT 1) AND NOT EXISTS(SELECT 1 FROM queue WHERE tester=? AND status='claimed') RETURNING id`,actor,mode,region,actor,actor).first();
    if(!row)throw Error('No eligible waiting player in an open session, or you already hold a claim.');
    await this.audit(actor,'claim-next',row.id).run();
    return row.id;
  }
  async result(id, tier, pos, evidence, actor, enforceRubric = false) {
    const outcomes = await this.db.batch([
      this.statement(
        `INSERT INTO results(id,uuid,name,region,mode,tier,pos,tester,evidence,created,assessment_revision,kit_version,rubric_version)
        SELECT q.id,a.uuid,a.name,q.region,q.mode,?,?,q.tester,?,?,
        (SELECT revision FROM assessments WHERE id=q.id),(SELECT kit_version FROM assessments WHERE id=q.id),(SELECT version FROM assessments WHERE id=q.id) FROM queue q JOIN accounts a ON a.discord=q.user
        WHERE q.id=? AND q.tester=? AND q.status='claimed'
        AND (?=0 OR EXISTS(SELECT 1 FROM assessments a WHERE a.id=q.id AND a.tester=q.tester
          AND a.version='community-1' AND (? > 2 OR EXISTS(SELECT 1 FROM placement_reviews p
            WHERE p.id=q.id AND p.assessment_revision=a.revision AND p.tier=? AND p.reviewer<>q.tester AND p.reviewer<>q.user AND p.evidence=?))))`,
        tier,
        pos,
        evidence,
        new Date().toISOString(),
        id,
        actor,
        enforceRubric ? 1 : 0,
        tier,
        `${pos === 0 ? "HT" : "LT"}${tier}`,
        evidence,
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
      throw Error("Result needs your assigned claim and a current /assessment record. High tiers also need independent /assessment review for the exact proposed tier.");
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
          "SELECT id,result_id,reason,status,decision,created FROM appeals WHERE user=? ORDER BY created DESC LIMIT 50",
          actor,
        )
      : this.all(
          "SELECT * FROM appeals WHERE status='pending' ORDER BY created LIMIT 50",
        );
  }
  async review(id, actor, decision, reason) {
    this.reason(reason);
    if (!["uphold", "revoke"].includes(decision))
      throw Error("Choose uphold or revoke.");
    const outcomes = await this.db.batch([
      this.statement(
        `UPDATE appeals SET status=?,reviewer=?,decision=? WHERE id=? AND status='pending' AND user<>?
        AND EXISTS(SELECT 1 FROM results r WHERE r.id=appeals.result_id AND r.tester<>?)
        AND NOT EXISTS(SELECT 1 FROM placement_reviews p WHERE p.id=appeals.result_id AND p.reviewer=?)`,
        decision,
        actor,
        reason.trim(),
        id,
        actor,
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
        region: r.region,
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
