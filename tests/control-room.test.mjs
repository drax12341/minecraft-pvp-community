import { test } from "node:test";
import assert from "node:assert/strict";
import {
  selectControlPlayers,
  controlRoomSnapshot,
  buildPlayerCsv,
  activityBuckets,
} from "../web/control-room.js";
const config = {
  points: {
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
  },
  modes: [
    { id: "mace", name: "Mace" },
    { id: "mace_rod", name: "Rod Mace" },
  ],
};
const players = [
  {
    uuid: "b",
    name: "Beta",
    region: "NA",
    rankings: {
      mace: { tier: 2, pos: 1 },
      mace_rod: { tier: 1, pos: 0, retired: true },
    },
  },
  {
    uuid: "a",
    name: "Alpha",
    region: "EU",
    rankings: { mace: { tier: 3, pos: 0 }, mace_rod: { tier: 4, pos: 0 } },
  },
  {
    uuid: "r",
    name: "Retired",
    region: "EU",
    rankings: { mace: { tier: 1, pos: 0, retired: true } },
  },
];
test("control room combines mode, region, search and saved filters and excludes retired placements", () => {
  assert.deepEqual(
    selectControlPlayers(players, config, {
      mode: "overall",
      sort: "points",
    }).map((p) => p.name),
    ["Beta", "Alpha"],
  );
  assert.deepEqual(
    selectControlPlayers(players, config, { mode: "mace_rod" }).map(
      (p) => p.name,
    ),
    ["Alpha"],
  );
  assert.deepEqual(
    selectControlPlayers(
      players,
      config,
      { mode: "mace", region: "EU", query: "alp", savedOnly: true },
      new Set(["a"]),
    ).map((p) => p.name),
    ["Alpha"],
  );
  assert.equal(
    selectControlPlayers(
      players,
      config,
      { mode: "overall", savedOnly: true },
      new Set(),
    ).length,
    0,
  );
  assert.deepEqual(
    selectControlPlayers(players, config, {
      mode: "overall",
      sort: "name",
    }).map((p) => p.name),
    ["Alpha", "Beta"],
  );
});
test("dashboard snapshot distinguishes active placements, real recent tests and queue occupancy", () => {
  const stats = controlRoomSnapshot(
    { players, recent: [{ mode: "mace" }] },
    {
      sessions: [
        { status: "open", waiting: 3, claimed: 1 },
        { status: "paused", waiting: 2, claimed: 0 },
      ],
    },
    config,
  );
  assert.equal(stats.players, 2);
  assert.equal(stats.placements, 3);
  assert.equal(stats.recent, 1);
  assert.equal(stats.open, 1);
  assert.equal(stats.waiting, 5);
  assert.equal(stats.testing, 1);
  assert.equal(stats.tiers[0], 0);
  assert.equal(stats.tiers[1], 1);
  assert.equal(stats.regions.EU, 1);
});
test("CSV export escapes quotes/newlines and spreadsheet formulas without exporting private fields", () => {
  const csv = buildPlayerCsv(
    [{ ...players[0], name: '=HYPERLINK("x")', discord: "private-id" }],
    config,
  );
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
  assert.doesNotMatch(csv, /private-id|discord/);
  assert.match(csv, /20/);
  assert.doesNotMatch(csv, /60/);
});
test("activity chart uses UTC days and ignores invalid or future timestamps", () => {
  const buckets = activityBuckets(
    [
      { created: "2026-11-12T23:30:00Z" },
      { created: "2026-11-13T00:01:00Z" },
      { created: "invalid" },
      { created: "2026-11-15T00:00:00Z" },
    ],
    3,
    new Date("2026-11-13T20:00:00Z"),
  );
  assert.deepEqual(
    buckets.map((b) => b.count),
    [0, 1, 1],
  );
  assert.equal(buckets[2].day, "2026-11-13");
});
