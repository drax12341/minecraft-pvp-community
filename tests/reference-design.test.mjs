import test from "node:test";
import assert from "node:assert/strict";
import { nativeQueuePanel, queueV2Flag } from "../cloud/queue-panels.mjs";
import { resultAnnouncement } from "../cloud/result-presentation.mjs";
import {
  referenceCommandData,
  referenceCommands,
} from "../config/reference-commands.mjs";
import { referencePlan } from "../discord/community-v4.mjs";

test("reference shortcuts retain the canonical handlers and mandatory staff inputs", () => {
  assert.deepEqual(
    referenceCommandData({
      name: "next",
      options: [
        { name: "mode", value: "mace" },
        { name: "region", value: "EU" },
      ],
    }),
    {
      name: "pull",
      options: [
        { name: "mode", value: "mace" },
        { name: "region", value: "EU" },
      ],
    },
  );
  const reset = referenceCommands.find((c) => c.name === "cdreset");
  assert.ok(reset.options.find((o) => o.name === "reason").required);
  assert.ok(reset.options.find((o) => o.name === "user").required);
  assert.equal(
    referenceCommandData({ name: "cdreset", options: [] }).options[0].name,
    "reset",
  );
  assert.equal(referenceCommandData({ name: "start" }), null);
  const plan = referencePlan();
  assert.equal(plan.preservesMessages, true);
  const names = plan.categories.flatMap((g) => g.channels.map((c) => c[0]));
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.includes("🤖┃bot-commands"));
});

test("reference queue keeps all twenty places legible, controls usable, and mentions silent", () => {
  const board = nativeQueuePanel({
    kit: { id: "mace", name: "Mace" },
    region: "EU",
    session: { status: "open", cooldown: 72 },
    counts: { occupied: 20, waiting: 20, claimed: 0 },
    active: [],
    waiting: Array.from({ length: 20 }, (_, n) => ({ name: "Player" + n })),
    available: [{ user: "50001", status: "available" }],
    capacity: 20,
    page: 1,
    controls: [],
  });
  assert.equal(board.flags, queueV2Flag);
  const text = JSON.stringify(board);
  assert.match(text, /Tester\(s\) Available!/);
  assert.match(text, /Player19/);
  assert.match(text, /20\/20/);
  assert.doesNotMatch(text, /SESSION OVERVIEW|PAGE 1/);
  assert.equal(board.components[0].accent_color, 0x7861e8);
  assert.deepEqual(board.allowed_mentions, { parse: [] });
});

test("reference results use a red skin card with vertically readable ranks", () => {
  const body = resultAnnouncement(
    {
      id: "reference-test",
      uuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      name: "PlayerOne",
      mode: "mace",
      region: "EU",
      tier: 3,
      pos: 0,
      tester: "50001",
      record_type: "test",
      created: new Date().toISOString(),
    },
    { account: { discord: "60000" } },
  );
  const card = body.embeds[0];
  assert.equal(card.color, 0xff161e);
  assert.match(card.author.name, /PlayerOne.*Test Results/);
  assert.deepEqual(
    card.fields.slice(0, 5).map((f) => f.name),
    ["Tester", "Region", "Username", "Previous Rank", "Rank Earned"],
  );
  assert.equal(card.fields[4].value, "High Tier 3");
  assert.ok(card.fields.slice(0, 5).every((f) => f.inline === false));
  assert.match(card.thumbnail.url, /mc-heads.net\/body/);
});
