import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/store.mjs";
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
test("session state, capacity and retest cooldown are enforced", () => {
  const s = new Store(":memory:");
  s.verify("10000", "uuid1", "PlayerOne", "90000");
  s.verify("11000", "uuid2", "PlayerTwo", "90000");
  assert.throws(() => s.join("10000", "sword", "EU"), /closed/);
  s.setSession("sword", "EU", "open", "90000", 1, 72);
  const id = s.join("10000", "sword", "EU");
  assert.throws(() => s.join("11000", "sword", "EU"), /full/);
  s.claim(id, "20000");
  s.result({ id, tier: 3, pos: 0, evidence: "https://example.com" }, "20000");
  assert.throws(() => s.join("10000", "sword", "EU"), /cooldown/);
  s.setSession("sword", "EU", "paused", "90000");
  assert.throws(() => s.join("11000", "sword", "EU"), /closed/);
  s.close();
});
test("appeals are private, owner-only and independently reviewed; revocation restores previous rank", () => {
  const s = new Store(":memory:");
  s.verify("10000", "uuid1", "PlayerOne", "90000");
  s.setSession("sword", "EU", "open", "90000", 30, 0);
  const first = s.join("10000", "sword", "EU");
  s.claim(first, "20000");
  s.result(
    { id: first, tier: 4, pos: 1, evidence: "https://example.com/1" },
    "20000",
  );
  const second = s.join("10000", "sword", "EU");
  s.claim(second, "20000");
  s.result(
    { id: second, tier: 1, pos: 0, evidence: "https://example.com/2" },
    "20000",
  );
  assert.throws(
    () => s.appeal(second, "11000", "Incorrect test result"),
    /own/,
  );
  const appeal = s.appeal(second, "10000", "Wrong equipment used during test");
  assert.throws(
    () =>
      s.reviewAppeal(appeal, "20000", "revoke", "Wrong equipment confirmed"),
    /independent/,
  );
  assert.throws(
    () =>
      s.reviewAppeal(appeal, "10000", "revoke", "Wrong equipment confirmed"),
    /independent/,
  );
  s.reviewAppeal(appeal, "90000", "revoke", "Wrong equipment confirmed");
  assert.equal(s.rankings(points).players[0].points, 3);
  assert.equal(s.rankings(points).recent.length, 1);
  assert.equal(s.appeals("11000").length, 0);
  assert.equal(s.appeals("10000")[0].status, "revoke");
  assert.doesNotMatch(JSON.stringify(s.testing()), /10000|20000|90000/);
  s.close();
});
