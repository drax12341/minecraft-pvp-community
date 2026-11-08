import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
const config = JSON.parse(await readFile("config/community.json"));
const player = {
  uuid: "00000000-0000-0000-0000-000000000001",
  name: "TestPlayer",
  region: "EU",
  points: 10,
  rankings: {
    sword: { tier: 3, pos: 0, peak_tier: 3, peak_pos: 0, retired: false },
  },
};
async function website(players = [], sessions = []) {
  const dom = new JSDOM(await readFile("web/index.html", "utf8"), {
      url: "https://example.com/",
      runScripts: "outside-only",
    }),
    w = dom.window;
  w.fetch = async (url) => ({
    ok: true,
    json: async () =>
      url.endsWith("community.json")
        ? config
        : url.endsWith("testing.json")
          ? { sessions, activation: sessions.length ? "active" : "pending" }
          : { updatedAt: null, players, recent: [] },
  });
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    w.document.activeElement?.blur();
  };
  await w.eval(`(async()=>{${await readFile("web/tierlist.js", "utf8")}\n})()`);
  return dom;
}
test("standalone board has five tiers, explicit sample preview, and no external ranks", async () => {
  const dom = await website(),
    w = dom.window,
    d = w.document;
  assert.equal(d.querySelectorAll(".tier-column").length, 5);
  assert.equal(d.querySelectorAll("[data-player]").length, 0);
  assert.doesNotMatch(d.body.textContent, /MCTiers|PvPTiers|CatPvP|provider/i);
  d.querySelector("#preview-toggle").click();
  assert.match(
    d.querySelector(".preview-notice").textContent,
    /Not real rankings/,
  );
  assert.equal(d.querySelectorAll("[data-player]").length, 10);
  d.querySelector("#exit-preview").click();
  assert.equal(d.querySelectorAll("[data-player]").length, 0);
  dom.window.close();
});

test("kit groups, searchable kit picker, clear filters and compact controls work", async () => {
  const dom = await website([player]),
    w = dom.window,
    d = w.document;
  d.querySelector('[data-mode-group="sub"]').click();
  assert.ok(d.querySelector('[data-mode="mace_spear"]'));
  assert.equal(d.querySelector('[data-mode="sword"]'), null);
  d.querySelector("#browse-modes").click();
  const search = d.querySelector("#kit-search");
  search.value = "bow";
  search.dispatchEvent(new w.Event("input"));
  assert.equal(d.querySelectorAll("[data-pick]").length, 1);
  d.querySelector('[data-pick="bow"]').click();
  await new Promise((r) => w.setTimeout(r, 10));
  assert.match(d.querySelector(".kit-title h2").textContent, /Bow/);
  const query = d.querySelector("#search");
  query.value = "missing";
  query.dispatchEvent(new w.Event("input"));
  assert.ok(d.querySelector("#clear-filters"));
  d.querySelector("#clear-filters").click();
  assert.equal(d.querySelector("#search").value, "");
  d.querySelector("#density").click();
  assert.equal(
    d.querySelector("#density").getAttribute("aria-pressed"),
    "true",
  );
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "/", bubbles: true }));
  assert.equal(d.activeElement.id, "search");
  dom.window.close();
});

test("testing filters select an open region and preserve the request form", async () => {
  const dom = await website(
      [],
      [
        {
          mode: "sword",
          region: "EU",
          status: "closed",
          waiting: 0,
          claimed: 0,
        },
        { mode: "sword", region: "NA", status: "open", waiting: 3, claimed: 1 },
      ],
    ),
    w = dom.window,
    d = w.document;
  w.location.hash = "testing";
  await new Promise((r) => w.setTimeout(r, 10));
  assert.match(d.querySelector(".session-open").textContent, /Open · NA/);
  d.querySelector("[name=name]").value = "MyPlayer";
  d.querySelector("#session-status").value = "open";
  d.querySelector("#session-status").dispatchEvent(new w.Event("change"));
  assert.equal(d.querySelectorAll(".session").length, 1);
  d.querySelector('[data-request="sword"]').click();
  assert.equal(d.querySelector("[name=region]").value, "NA");
  assert.equal(d.querySelector("[name=name]").value, "MyPlayer");
  d.querySelector("#session-region").value = "EU";
  d.querySelector("#session-region").dispatchEvent(new w.Event("change"));
  assert.equal(d.querySelectorAll(".session").length, 0);
  assert.match(
    d.querySelector(".session-empty").textContent,
    /No open sessions/,
  );
  assert.equal(d.querySelector("[name=name]").value, "MyPlayer");
  dom.window.close();
});
test("community profile, search, navigation, request summary and tag preview work", async () => {
  const dom = await website([player]),
    w = dom.window,
    d = w.document;
  d.querySelector("[data-player]").click();
  assert.equal(d.querySelector("dialog").open, true);
  assert.match(d.querySelector("#modal-body").textContent, /TestPlayer/);
  d.querySelector(".close").click();
  const search = d.querySelector("#search");
  search.value = "nomatch";
  search.dispatchEvent(new w.Event("input"));
  assert.equal(d.querySelectorAll("[data-player]").length, 0);
  for (const route of ["testing", "kits", "tagger", "sponsors", "about"]) {
    w.location.hash = route;
    await new Promise((r) => w.setTimeout(r, 10));
    assert.ok(d.querySelector("h1"));
    if (route === "testing") {
      d.querySelector("[name=name]").value = "TestPlayer";
      d.querySelector("[name=availability]").value = "Saturday 16 UTC";
      d.querySelector("[name=rules]").checked = true;
      d.querySelector("form").dispatchEvent(
        new w.Event("submit", { cancelable: true }),
      );
      assert.match(
        d.querySelector("#modal-body").textContent,
        /no queue entry has been created/,
      );
      d.querySelector(".close").click();
    }
    if (route === "tagger") {
      d.querySelector("#tag-mode").value = "mace";
      d.querySelector("#tag-mode").dispatchEvent(new w.Event("change"));
      assert.match(d.querySelector("#tag-label").textContent, /Mace HT3/);
    }
  }
  dom.window.close();
});
