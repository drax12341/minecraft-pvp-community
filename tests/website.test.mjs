import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
test("website search, source switching, comparison, profiles and all navigation routes", async () => {
  const dom = new JSDOM(await readFile("web/index.html", "utf8"), {
      url: "https://example.com/",
      runScripts: "outside-only",
    }),
    w = dom.window;
  w.fetch = async (url) => ({
    ok: true,
    json: async () =>
      JSON.parse(
        await readFile(
          url.endsWith("community.json")
            ? "config/community.json"
            : url.endsWith("results.json")
              ? "data/results.json"
              : "data/mctiers.json",
          "utf8",
        ),
      ),
  });
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  await w.eval(`(async()=>{${await readFile("web/app.js", "utf8")}\n})()`);
  const d = w.document;
  assert.equal(d.querySelectorAll("tbody tr").length, 50);
  const search = d.querySelector("#search");
  search.value = "ItzRealMe";
  search.dispatchEvent(new w.Event("input"));
  assert.equal(d.querySelectorAll("tbody tr").length, 1);
  d.querySelector("[data-player]").click();
  assert.ok(d.querySelector("dialog").open);
  assert.match(d.querySelector("#profile-body").textContent, /Peak:/);
  d.querySelector(".close").click();
  search.value = "";
  search.dispatchEvent(new w.Event("input"));
  [...d.querySelectorAll("[data-compare]")].slice(0, 2).forEach((x) => {
    x.checked = true;
    x.dispatchEvent(new w.Event("change"));
  });
  d.querySelector("#compare-now").click();
  assert.match(d.querySelector("#profile-body").textContent, /Head to head/);
  d.querySelector(".close").click();
  d.querySelector("#compare-clear").click();
  const provider = d.querySelector("#provider");
  provider.value = "community";
  provider.dispatchEvent(new w.Event("change"));
  assert.match(d.querySelector("#results").textContent, /first tier/);
  for (const route of [
    "communities",
    "testing",
    "tagger",
    "sponsors",
    "about",
  ]) {
    w.location.hash = route;
    await new Promise((r) => w.setTimeout(r, 5));
    assert.ok(d.querySelector("h1"), route);
    assert.equal(d.querySelectorAll('main a[href="undefined"]').length, 0);
    if (route === "tagger") {
      d.querySelector("#tag-mode").value = "mace";
      d.querySelector("#tag-mode").dispatchEvent(new w.Event("change"));
      assert.match(d.querySelector("#tag-label").textContent, /Mace HT3/);
    }
  }
  dom.window.close();
});
