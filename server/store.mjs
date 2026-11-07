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
        .prepare("SELECT * FROM results ORDER BY sequence")
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
    };
  }
  close() {
    this.db.close();
  }
}
