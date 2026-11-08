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
async function website(players = []) {
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
          ? { sessions: [], activation: "pending" }
          : { updatedAt: null, players, recent: [] },
  });
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
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
