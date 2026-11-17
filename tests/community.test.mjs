import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/store.mjs";
import { createApp } from "../server/index.mjs";
const points = {
  HT1: 60,
  LT1: 45,
  HT2: 30,
  LT2: 20,
  HT3: 10,
  LT3: 6,
  HT4: 4,
  LT4: 3,
  HT5: 2,
  LT5: 1,
};
test("verification, unique queues, atomic claim, assigned tester and immutable completion", () => {
  const s = new Store(":memory:");
  s.setSession("sword", "EU", "open", "90000", 30, 0);
  assert.throws(() => s.join("10000", "sword", "EU"), /verify/);
  s.verify(
    "10000",
    "00000000-0000-0000-0000-000000000001",
    "PlayerOne",
    "90000",
  );
  const id = s.join("10000", "sword", "EU");
  assert.throws(() => s.join("10000", "sword", "NA"), /already/);
  assert.throws(() => s.claim(id, "10000"));
  s.claim(id, "20000");
  assert.throws(() => s.claim(id, "30000"));
  assert.throws(() =>
    s.result({ id, tier: 1, pos: 0, evidence: "https://example.com" }, "30000"),
  );
  s.result({ id, tier: 3, pos: 0, evidence: "https://example.com" }, "20000");
  assert.throws(() =>
    s.result({ id, tier: 1, pos: 0, evidence: "https://example.com" }, "20000"),
  );
  assert.equal(s.rankings(points).players[0].points, 10);
  const second = s.join("10000", "sword", "EU");
  s.claim(second, "20000");
  s.result(
    { id: second, tier: 4, pos: 1, evidence: "https://example.com" },
    "20000",
  );
  const p = s.rankings(points).players[0];
  assert.equal(p.points, 3);
  assert.equal(p.rankings.sword.peak_tier, 3);
  assert.equal(p.rankings.sword.peak_pos, 0);
  s.close();
});
test("HTTP guards reject unauthorized writes, invalid tiers and traversal", async (t) => {
  const s = new Store(":memory:"),
    token = "x".repeat(40),
    app = createApp({ store: s, token });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  t.after(() => {
    app.close();
    s.close();
  });
  const base = `http://127.0.0.1:${app.address().port}`;
  assert.equal((await fetch(base + "/api/health")).status, 200);
  assert.equal(
    (await fetch(base + "/api/queue/join", { method: "POST", body: "{}" }))
      .status,
    401,
  );
  const post = (path, b) =>
    fetch(base + "/api/" + path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(b),
    });
  assert.equal(
    (
      await post("results", {
        actor: "20000",
        tier: 0,
        pos: 0,
        evidence: "https://example.com",
      })
    ).status,
    400,
  );
  assert.equal(
    (await post("queue/join", { actor: "10000", mode: "madeup", region: "EU" }))
      .status,
    400,
  );
  assert.equal(
    (
      await post("results", {
        actor: "20000",
        tier: 1,
        pos: 0,
        evidence: "javascript:alert(1)",
      })
    ).status,
    400,
  );
  assert.equal((await fetch(base + "/%2e%2e%5cpom.xml")).status, 403);
  assert.equal((await fetch(base + "/%2e%2e%2fpom.xml")).status, 403);
});

test('local public snapshot counts repeat tests without the recent-feed cap and removes revoked tests', () => {
  const store=new Store(':memory:');
  try {
    const insert=store.db.prepare('INSERT INTO results(id,uuid,name,region,mode,tier,pos,tester,evidence,created) VALUES(?,?,?,?,?,?,?,?,?,?)');
    for(let i=0;i<103;i++) insert.run('total-'+i,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','RepeatPlayer','EU','mace',3,0,'20000','https://example.com','2026-11-17T12:00:00Z');
    store.db.prepare('INSERT INTO revoked VALUES(?,?,?,?)').run('total-0','90000','Private reason','2026-11-17T12:00:00Z');
    const snapshot=store.rankings(points);
    assert.equal(snapshot.completedTests,102);
    assert.equal(snapshot.recent.length,100);
    assert.equal(snapshot.players.length,1);
  } finally {store.close();}
});
