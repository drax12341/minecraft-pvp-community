import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
export class Store {
  constructor(path = "data/community.sqlite") {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS accounts(discord TEXT PRIMARY KEY,uuid TEXT UNIQUE NOT NULL,name TEXT NOT NULL,verified_by TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS queue(id TEXT PRIMARY KEY,user TEXT NOT NULL,mode TEXT NOT NULL,region TEXT NOT NULL,created TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'waiting',tester TEXT);
 CREATE UNIQUE INDEX IF NOT EXISTS one_queue ON queue(user,mode) WHERE status IN ('waiting','claimed');
 CREATE TABLE IF NOT EXISTS results(sequence INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,uuid TEXT NOT NULL,name TEXT NOT NULL,region TEXT NOT NULL,mode TEXT NOT NULL,tier INTEGER NOT NULL,pos INTEGER NOT NULL,tester TEXT NOT NULL,evidence TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,subject TEXT NOT NULL,created TEXT NOT NULL);`);
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS sessions(mode TEXT NOT NULL,region TEXT NOT NULL,status TEXT NOT NULL,capacity INTEGER NOT NULL,cooldown INTEGER NOT NULL,actor TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(mode,region));
      CREATE TABLE IF NOT EXISTS appeals(id TEXT PRIMARY KEY,result_id TEXT NOT NULL,user TEXT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',reviewer TEXT,decision TEXT,created TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS one_pending_appeal ON appeals(result_id) WHERE status='pending';
      CREATE TABLE IF NOT EXISTS revoked(result_id TEXT PRIMARY KEY,actor TEXT NOT NULL,reason TEXT NOT NULL,created TEXT NOT NULL);`);
  }
  verify(discord, uuid, name, actor) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          "INSERT INTO accounts VALUES(?,?,?,?) ON CONFLICT(discord) DO UPDATE SET uuid=excluded.uuid,name=excluded.name,verified_by=excluded.verified_by",
        )
        .run(discord, uuid, name, actor);
      this.audit(actor, "verify", uuid);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  audit(actor, action, subject) {
    this.db
      .prepare(
        "INSERT INTO audit(actor,action,subject,created) VALUES(?,?,?,?)",
      )
      .run(actor, action, subject, new Date().toISOString());
  }
  join(user, mode, region) {
    if (!this.db.prepare("SELECT 1 FROM accounts WHERE discord=?").get(user))
      throw Error(
        "Ask staff to verify your Minecraft UUID before joining a queue.",
      );
    const id = randomUUID();
    if (
      this.db
        .prepare(
          "SELECT 1 FROM queue WHERE user=? AND mode=? AND status IN ('waiting','claimed')",
        )
        .get(user, mode)
    )
      throw Error("You already have an open queue entry for this mode.");
    const session = this.db
      .prepare("SELECT * FROM sessions WHERE mode=? AND region=?")
      .get(mode, region);
    if (!session || session.status !== "open")
      throw Error("This testing session is closed.");
    const count = this.db
      .prepare(
        "SELECT count(*) AS n FROM queue WHERE mode=? AND region=? AND status IN ('waiting','claimed')",
      )
      .get(mode, region).n;
    if (count >= session.capacity) throw Error("This testing session is full.");
    const previous = this.db
      .prepare(
        "SELECT r.created FROM results r JOIN accounts a ON a.uuid=r.uuid WHERE a.discord=? AND r.mode=? AND NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id) ORDER BY r.sequence DESC LIMIT 1",
      )
      .get(user, mode);
    if (
      previous &&
      Date.now() - Date.parse(previous.created) < session.cooldown * 3600000
    )
      throw Error(
        `Retest cooldown: eligible ${new Date(Date.parse(previous.created) + session.cooldown * 3600000).toISOString()}`,
      );
    try {
      this.db
        .prepare(
          "INSERT INTO queue(id,user,mode,region,created) VALUES(?,?,?,?,?)",
        )
        .run(id, user, mode, region, new Date().toISOString());
    } catch {
      throw Error("You already have an open queue entry for this mode.");
    }
    return id;
  }
  leave(user, mode) {
    return this.db
      .prepare(
        "UPDATE queue SET status='cancelled' WHERE user=? AND mode=? AND status='waiting'",
      )
      .run(user, mode).changes;
  }
  list(mode) {
    return this.db
      .prepare(
        "SELECT id,user,mode,region,created,status FROM queue WHERE status IN ('waiting','claimed') AND (? IS NULL OR mode=?) ORDER BY created,id",
      )
      .all(mode ?? null, mode ?? null);
  }
  claim(id, tester) {
    const n = this.db
      .prepare(
        "UPDATE queue SET tester=?,status='claimed' WHERE id=? AND status='waiting' AND user<>?",
      )
      .run(tester, id, tester).changes;
    if (!n)
      throw Error("Entry was already claimed, cancelled, or belongs to you.");
    this.audit(tester, "claim", id);
  }
  result({ id, tier, pos, evidence }, tester) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const q = this.db
        .prepare(
          "SELECT * FROM queue WHERE id=? AND tester=? AND status='claimed'",
        )
        .get(id, tester);
      if (!q)
        throw Error("Only the assigned tester can record a claimed entry.");
      const a = this.db
        .prepare("SELECT * FROM accounts WHERE discord=?")
        .get(q.user);
      if (!a) throw Error("Account verification missing.");
      this.db
        .prepare(
          "INSERT INTO results(id,uuid,name,region,mode,tier,pos,tester,evidence,created) VALUES(?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          id,
          a.uuid,
          a.name,
          q.region,
          q.mode,
          tier,
          pos,
          tester,
          evidence,
          new Date().toISOString(),
        );
      this.db.prepare("UPDATE queue SET status='complete' WHERE id=?").run(id);
      this.audit(tester, "result", id);
      this.db.exec("COMMIT");
      return a;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  rankings(points) {
    const rows = this.db
        .prepare(
          "SELECT * FROM results r WHERE NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id) ORDER BY sequence",
        )
        .all(),
      players = new Map();
    for (const r of rows) {
      let p = players.get(r.uuid);
      if (!p) {
        p = {
          uuid: r.uuid,
          name: r.name,
          region: r.region,
          points: 0,
          rankings: {},
        };
        players.set(r.uuid, p);
      }
      p.name = r.name;
      p.region = r.region;
      const old = p.rankings[r.mode],
        value = points[`${r.pos === 0 ? "HT" : "LT"}${r.tier}`];
      const best =
        old &&
        points[`${old.peak_pos === 0 ? "HT" : "LT"}${old.peak_tier}`] >= value
          ? { tier: old.peak_tier, pos: old.peak_pos }
          : r;
      p.rankings[r.mode] = {
        tier: r.tier,
        pos: r.pos,
        peak_tier: best.tier,
        peak_pos: best.pos,
        retired: false,
        attained: r.created,
        evidence: r.evidence,
      };
    }
    for (const p of players.values())
      p.points = Object.values(p.rankings).reduce(
        (s, r) => s + points[`${r.pos === 0 ? "HT" : "LT"}${r.tier}`],
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
  setSession(mode, region, status, actor, capacity = 30, cooldown = 72) {
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
    this.db
      .prepare(
        "INSERT INTO sessions VALUES(?,?,?,?,?,?,?) ON CONFLICT(mode,region) DO UPDATE SET status=excluded.status,capacity=excluded.capacity,cooldown=excluded.cooldown,actor=excluded.actor,updated=excluded.updated",
      )
      .run(
        mode,
        region,
        status,
        capacity,
        cooldown,
        actor,
        new Date().toISOString(),
      );
    this.audit(actor, "session-" + status, mode + "/" + region);
  }
  testing() {
    return {
      updatedAt: new Date().toISOString(),
      activation: "active",
      sessions: this.db
        .prepare(
          "SELECT mode,region,status,capacity,cooldown,updated,(SELECT count(*) FROM queue q WHERE q.mode=s.mode AND q.region=s.region AND q.status='waiting') AS waiting,(SELECT count(*) FROM queue q WHERE q.mode=s.mode AND q.region=s.region AND q.status='claimed') AS claimed FROM sessions s",
        )
        .all(),
    };
  }
  appeal(resultId, user, reason) {
    if (
      typeof reason !== "string" ||
      reason.trim().length < 10 ||
      reason.length > 2000
    )
      throw Error("Appeal reason must contain 10–2000 characters.");
    const r = this.db
      .prepare(
        "SELECT r.id FROM results r JOIN accounts a ON a.uuid=r.uuid WHERE r.id=? AND a.discord=?",
      )
      .get(resultId, user);
    if (!r) throw Error("You can only appeal your own test result.");
    const id = randomUUID();
    try {
      this.db
        .prepare(
          "INSERT INTO appeals(id,result_id,user,reason,created) VALUES(?,?,?,?,?)",
        )
        .run(id, resultId, user, reason.trim(), new Date().toISOString());
    } catch {
      throw Error("An appeal is already pending for this result.");
    }
    this.audit(user, "appeal", id);
    return id;
  }
  appeals(user) {
    return user
      ? this.db
          .prepare(
            "SELECT id,result_id,reason,status,decision,created FROM appeals WHERE user=? ORDER BY created DESC",
          )
          .all(user)
      : this.db
          .prepare(
            "SELECT * FROM appeals WHERE status='pending' ORDER BY created",
          )
          .all();
  }
  reviewAppeal(id, actor, decision, reason) {
    if (
      !["uphold", "revoke"].includes(decision) ||
      typeof reason !== "string" ||
      reason.trim().length < 10 ||
      reason.length > 2000
    )
      throw Error("A decision and 10–2000 character explanation are required.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const appeal = this.db
        .prepare(
          "SELECT a.*,r.tester FROM appeals a JOIN results r ON r.id=a.result_id WHERE a.id=? AND a.status='pending'",
        )
        .get(id);
      if (!appeal) throw Error("No pending appeal found.");
      if (actor === appeal.tester || actor === appeal.user)
        throw Error("An independent reviewer must decide this appeal.");
      this.db
        .prepare("UPDATE appeals SET status=?,reviewer=?,decision=? WHERE id=?")
        .run(decision, actor, reason.trim(), id);
      if (decision === "revoke")
        this.db
          .prepare("INSERT OR IGNORE INTO revoked VALUES(?,?,?,?)")
          .run(
            appeal.result_id,
            actor,
            reason.trim(),
            new Date().toISOString(),
          );
      this.audit(actor, "appeal-" + decision, id);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  close() {
    this.db.close();
  }
}
