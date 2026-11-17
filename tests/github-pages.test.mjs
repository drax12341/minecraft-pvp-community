import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { renderOrbitHome } from "../web/orbit-home.js";
import config from "../config/community.json" with { type: "json" };

const player = {
  uuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  name: "<Competitor>",
  region: "EU",
  rankings: { mace: { tier: 3, pos: 0 } },
};
function home(players = [], snapshot = {}) {
  const dom = new JSDOM("<main></main>", {
    url: "https://drax12341.github.io/minecraft-pvp-community/#home",
  });
  dom.window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  dom.window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  const saved = new Set(),
    opened = [];
  renderOrbitHome({
    main: dom.window.document.querySelector("main"),
    config,
    data: { players, updatedAt: null, recent: [], ...snapshot },
    testing: { sessions: [] },
    saved,
    profile: (p) => opened.push(p.uuid),
    openMode: (id) => opened.push(id),
    onSave: (id) => (saved.has(id) ? saved.delete(id) : saved.add(id)),
  });
  return { dom, d: dom.window.document, saved, opened };
}
test("the new homepage presents truthful empty rankings and queues without fake players or live claims", () => {
  const { dom, d } = home();
  assert.match(d.querySelector("h1").textContent, /Leave your mark/);
  assert.equal(d.querySelectorAll("[data-orbit-profile]").length, 0);
  assert.match(
    d.querySelector("#orbit-leaderboard").textContent,
    /No placements published/,
  );
  assert.match(
    d.querySelector("#orbit-queues").textContent,
    /No sessions published/,
  );
  assert.equal(
    d.querySelectorAll("[data-orbit-mode]").length,
    config.modes.length + 1,
  );
  assert.equal(d.querySelector(".orbit-hero-stage"), null);
  assert.equal(d.querySelector("#orbit-explode"), null);
  assert.equal(d.querySelector("#completed-tests").textContent, "?");
  d.querySelector('[data-info-open="guide"]').click();
  assert.ok(d.querySelector(".community-info").open);
  assert.match(
    d.querySelector(".community-info").textContent,
    /Choose your discipline/,
  );
  d.querySelector(".info-close").click();
  assert.equal(d.querySelector(".community-info").open, false);
  dom.window.close();
});
test("home search, mode filters, saved controls and profiles operate on actual published records", () => {
  const { dom, d, saved, opened } = home([player]);
  assert.doesNotMatch(
    d.querySelector("#orbit-leaderboard").innerHTML,
    /<Competitor>/,
  );
  assert.equal(d.querySelector(".orbit-player-points").textContent, "10");
  d.querySelector("[data-orbit-save]").click();
  assert.ok(saved.has(player.uuid));
  d.querySelector("[data-orbit-profile]").click();
  assert.deepEqual(opened, [player.uuid]);
  d.querySelector('[data-orbit-mode="mace_rod"]').click();
  assert.equal(d.querySelectorAll("[data-orbit-profile]").length, 0);
  d.querySelector('[data-orbit-mode="overall"]').click();
  const input = d.querySelector("#orbit-player-search");
  input.value = "missing";
  input.dispatchEvent(new dom.window.Event("input"));
  assert.equal(d.querySelectorAll("[data-orbit-profile]").length, 0);
  dom.window.close();
});
test("tier calculator uses configured point values and does not publish simulated placements", () => {
  const { dom, d } = home();
  d.querySelector("#orbit-tier").value = "HT2";
  d.querySelector("#orbit-tier").dispatchEvent(new dom.window.Event("change"));
  assert.match(d.querySelector("#orbit-tier-points").textContent, /30/);
  assert.match(d.querySelector("#orbit-tier-note").textContent, /explorer/i);
  assert.equal(d.querySelectorAll("[data-orbit-profile]").length, 0);
  dom.window.close();
});
test("Pages serves the website directly and browser entrypoints do not depend on GPT hosting", async () => {
  const workflow = await readFile(".github/workflows/pages.yml", "utf8");
  assert.doesNotMatch(
    workflow,
    /chatgpt\.site|http-equiv|has moved|location\.replace/,
  );
  const entry = await readFile("web/pages.html", "utf8");
  assert.match(entry, /orbit-world/);
  assert.match(entry, /github\.io\/minecraft-pvp-community/);
  for (const file of [
    "tierlist.js",
    "testing-desk.js",
    "control-room.js",
    "orbit-home.js",
    "orbit-motion.js",
  ])
    assert.doesNotMatch(
      await readFile("web/" + file, "utf8"),
      /chatgpt\.site/,
      file,
    );
});

test("test total is independent of recent feed and high-tier filters safely preserve repeat tests", () => {
  const recent = [
    { ...player, mode: "mace", tier: 3, pos: 0, created: "2026-11-17" },
    { ...player, mode: "mace", tier: 4, pos: 1, created: "2026-11-16" },
  ];
  const { dom, d } = home([player], { completedTests: 1234, recent });
  assert.match(
    d.querySelector("#completed-tests").textContent.replace(/\D/g, ""),
    /1234/,
  );
  assert.equal(d.querySelectorAll(".pulse-result").length, 2);
  assert.equal(
    d.querySelector(".pulse-result strong").textContent,
    "<Competitor>",
  );
  assert.equal(d.querySelector(".pulse-result Competitor"), null);
  d.querySelector('[data-pulse="high"]').click();
  assert.equal(d.querySelectorAll(".pulse-result").length, 1);
  assert.match(d.querySelector(".pulse-result").textContent, /HT3/);
  d.querySelector('[data-info-open="counter"]').click();
  assert.match(d.querySelector(".community-info").textContent, /repeat tests/);
  dom.window.close();
});
