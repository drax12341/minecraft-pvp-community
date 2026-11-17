import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderOrbitHome } from "../web/orbit-home.js";
import config from "../config/community.json" with { type: "json" };

function mount(players = [], extra = {}) {
  const dom = new JSDOM("<main></main>", {
    url: "https://drax12341.github.io/minecraft-pvp-community/#home",
  });
  const w = dom.window;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  const saved = new Set(),
    opened = [];
  renderOrbitHome({
    main: w.document.querySelector("main"),
    config,
    data: { players, recent: [], completedTests: 0, ...extra },
    testing: { sessions: [] },
    saved,
    profile: (p) => opened.push(p.uuid),
    onSave: (id) => (saved.has(id) ? saved.delete(id) : saved.add(id)),
  });
  return { dom, d: w.document, saved, opened };
}
const players = Array.from({ length: 32 }, (_, i) => ({
  uuid: i.toString(16).padStart(32, "0"),
  name: "Fighter" + String(i).padStart(2, "0"),
  region: i % 2 ? "NA" : "EU",
  rankings: { mace_rod: { tier: 3, pos: 0 }, mace_og: { tier: 4, pos: 1 } },
}));

test("main screen is the full leaderboard with original mode tabs, no marketing hero and an accessible results drawer", () => {
  const { dom, d } = mount();
  assert.equal(d.querySelector(".orbit-hero"), null);
  assert.equal(
    d.querySelector(".rankings-workspace").firstElementChild.className,
    "rankings-toolbar",
  );
  assert.match(d.querySelector("h1").textContent, /Overall rankings/);
  assert.deepEqual(
    [...d.querySelectorAll("[data-orbit-mode]")]
      .slice(0, 7)
      .map((b) => b.dataset.orbitMode),
    [
      "overall",
      "mace_rod",
      "mace_og",
      "mace_lt",
      "mace_rocket",
      "mace_ht",
      "mace_spear",
    ],
  );
  assert.equal(
    d.querySelector('[data-orbit-mode="mace_rod"] img').getAttribute("src"),
    "./assets/modes/mace_rod.png",
  );
  d.querySelector('[data-open-activity="high"]').click();
  assert.ok(d.querySelector("#activity-drawer").open);
  assert.match(d.querySelector("#activity-drawer").textContent, /HT3/);
  dom.window.close();
});

test("leaderboard paginates beyond eight rows, preserves true rank through search and mode filters, and saves players", () => {
  const { dom, d, saved, opened } = mount(players);
  assert.equal(d.querySelectorAll("[data-orbit-profile]").length, 25);
  d.querySelector("#leaderboard-next").click();
  assert.equal(d.querySelector(".player-position strong").textContent, "26");
  d.querySelector("#orbit-player-search").value = "Fighter30";
  d.querySelector("#orbit-player-search").dispatchEvent(
    new dom.window.Event("input"),
  );
  assert.equal(d.querySelectorAll("[data-orbit-profile]").length, 1);
  assert.equal(d.querySelector(".player-position strong").textContent, "31");
  d.querySelector("[data-orbit-save]").click();
  assert.equal(saved.size, 1);
  d.querySelector("[data-orbit-profile]").click();
  assert.equal(opened[0], players[30].uuid);
  d.querySelector('[data-orbit-mode="mace_lt"]').click();
  assert.equal(d.querySelectorAll("[data-orbit-profile]").length, 0);
  dom.window.close();
});

test("mode badges identify each discipline and player content cannot inject markup", () => {
  const { dom, d } = mount([
    { ...players[0], name: "<img src=x onerror=alert(1)>" },
  ]);
  assert.equal(
    d.querySelector(".player-name").textContent,
    "<img src=x onerror=alert(1)>",
  );
  assert.equal(d.querySelector("[onerror]"), null);
  assert.equal(d.querySelectorAll(".placement-medallion").length, 2);
  assert.match(
    d.querySelector(".placement-medallion").getAttribute("aria-label"),
    /Rod Mace.*HT3/,
  );
  dom.window.close();
});

test("unpublished previews, malformed identities and retired-only entries cannot become leaderboard placements", () => {
  const { dom, d } = mount([
    { ...players[0], demo: true },
    { ...players[1], uuid: "../not-a-player" },
    {
      ...players[2],
      rankings: { mace_rod: { tier: 3, pos: 0, retired: true } },
    },
    { ...players[3], rankings: { unknown: { tier: 1, pos: 0 } } },
  ]);
  assert.equal(d.querySelectorAll("[data-orbit-profile]").length, 0);
  assert.equal(d.querySelectorAll(".placement-medallion").length, 0);
  assert.equal(d.querySelector("#completed-tests").textContent, "0");
  dom.window.close();
});

test("mode and region can be shared in the homepage URL and performance mode changes the motion preference", () => {
  const { dom, d } = mount(players);
  d.querySelector('[data-orbit-mode="mace_rod"]').click();
  const region = d.querySelector("#orbit-region");
  region.value = "EU";
  region.dispatchEvent(new dom.window.Event("change"));
  assert.match(dom.window.location.hash, /mode=mace_rod/);
  assert.match(dom.window.location.hash, /region=EU/);
  assert.match(d.querySelector("h1").textContent, /Rod Mace rankings/);
  assert.equal(d.querySelectorAll("[data-orbit-profile]").length, 16);
  d.querySelector("#performance-toggle").click();
  assert.ok(d.body.classList.contains("calm-view"));
  assert.equal(
    d.querySelector("#performance-toggle").getAttribute("aria-pressed"),
    "true",
  );
  dom.window.close();
});
