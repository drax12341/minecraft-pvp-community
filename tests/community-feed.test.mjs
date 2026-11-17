import test from "node:test";
import assert from "node:assert/strict";
import {
  loadCommunityFeeds,
  normalizeCommunityResults,
  normalizeCommunityTesting,
  COMMUNITY_FEED_ORIGIN,
} from "../web/community-feed.js";
const config = { modes: [{ id: "mace_ht" }], points: { HT3: 10, LT3: 6 } };
const player = {
  uuid: "1cfc7813-5528-46d6-8dce-358a7cb32499",
  name: "PublishedPlayer",
  region: "EU",
  points: 10,
  discord: "private",
  rankings: {
    mace_ht: {
      tier: 3,
      pos: 0,
      peak_tier: 3,
      peak_pos: 0,
      retired: false,
      evidence: "private recording",
      tester: "private",
    },
  },
};
const results = {
  updatedAt: "2026-11-17T17:00:00Z",
  players: [player],
  recent: [],
  accounts: ["private"],
};

test("live Discord feed supplies existing placements without credentials or private fields", async () => {
  const calls = [];
  const feed = await loadCommunityFeeds({
    config,
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () =>
          String(url).endsWith("results.json") ? results : { sessions: [] },
      };
    },
  });
  assert.equal(feed.source, "discord");
  assert.equal(feed.data.players[0].name, "PublishedPlayer");
  assert.equal(feed.data.players[0].rankings.mace_ht.tier, 3);
  assert.equal(feed.data.completedTests, 0);
  assert.equal(feed.data.recent.length, 0);
  assert.doesNotMatch(
    JSON.stringify(feed),
    /private|recording|accounts|tester|discord":"private/,
  );
  assert.ok(
    calls.every((c) => c.url.startsWith(COMMUNITY_FEED_ORIGIN + "/data/")),
  );
  assert.ok(
    calls.every(
      (c) => c.options.credentials === "omit" && c.options.redirect === "error",
    ),
  );
});

test("a temporary bot outage loads a validated Pages snapshot initially, but refresh never replaces live data with an older fallback", async () => {
  const fetcher = async (url) => {
    if (String(url).startsWith("https:")) throw Error("offline");
    return {
      ok: true,
      json: async () =>
        String(url).endsWith("results.json") ? results : { sessions: [] },
    };
  };
  const feed = await loadCommunityFeeds({ config, fetcher });
  assert.equal(feed.source, "snapshot");
  assert.equal(feed.degraded, true);
  assert.equal(feed.data.players.length, 1);
  await assert.rejects(
    loadCommunityFeeds({ config, fetcher, allowSnapshot: false }),
    /offline/,
  );
});

test("malformed feeds cannot silently wipe ranks and snapshots strip staff or account details", () => {
  for (const value of [
    null,
    {},
    { players: "bad" },
    { players: [{ ...player, demo: true }] },
    { players: [{ ...player, uuid: "../wrong" }] },
    { players: [{ ...player, rankings: { mace_ht: { tier: 0, pos: 0 } } }] },
  ])
    assert.throws(() => normalizeCommunityResults(value, config));
  assert.throws(() =>
    normalizeCommunityTesting({
      sessions: [
        { mode: "mace_ht", region: "EU", status: "open", waiting: -5 },
      ],
    }),
  );
  const sessions = normalizeCommunityTesting({
    sessions: [
      {
        mode: "mace_ht",
        region: "EU",
        status: "open",
        waiting: 2,
        claimed: 1,
        capacity: 20,
        cooldown: 72,
        actor: "private",
      },
    ],
  });
  assert.doesNotMatch(JSON.stringify(sessions), /private|actor/);
});

test("repeat tests count independently and a capped legacy feed never pretends to be a lifetime total", () => {
  const row = {
    id: "test",
    uuid: player.uuid,
    name: player.name,
    region: "EU",
    mode: "mace_ht",
    tier: 3,
    pos: 0,
    created: "2026-11-17T17:00:00Z",
  };
  assert.equal(
    normalizeCommunityResults(
      { ...results, recent: [row, { ...row, id: "retest" }] },
      config,
    ).completedTests,
    2,
  );
  assert.equal(
    normalizeCommunityResults(
      { ...results, recent: Array.from({ length: 100 }, () => row) },
      config,
    ).completedTests,
    null,
  );
  const capped = normalizeCommunityResults(
    { ...results, recent: Array.from({ length: 100 }, () => row) },
    config,
  );
  assert.equal(
    normalizeCommunityResults(JSON.parse(JSON.stringify(capped)), config)
      .completedTests,
    null,
  );
  assert.equal(
    normalizeCommunityResults(
      { ...results, recent: [row], completedTests: 150 },
      config,
    ).completedTests,
    150,
  );
});
