import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import config from "../config/community.json" with { type: "json" };
import { state, modeTabs, modeIcon, resultCard } from "../web/platform-data.js";

test("every configured Mace mode renders supplied pixel artwork with usable, labelled navigation", async () => {
  state.config = config;
  const dom = new JSDOM(modeTabs("mace_ht"));
  const tabs = [...dom.window.document.querySelectorAll("a")];
  assert.equal(tabs.length, config.modes.length + 1);
  assert.equal(
    tabs.filter((a) => a.getAttribute("aria-current") === "page").length,
    1,
  );
  for (const m of config.modes) {
    const img = new JSDOM(modeIcon(m.id)).window.document.querySelector("img");
    assert.equal(img.getAttribute("src"), `/assets/modes/${m.id}.png`);
    const bytes = await readFile("web" + img.getAttribute("src"));
    assert.equal(bytes.readUInt32BE(0), 0x89504e47);
    assert.ok(
      tabs.some(
        (a) =>
          a.textContent === m.name &&
          a.getAttribute("href") === "/rankings/" + m.id,
      ),
    );
  }
  assert.match(modeIcon("../../evil"), /\/mace\.png/);
});

test("result cards show the real skin, exact movement and separate staff awards from test scores", () => {
  state.config = config;
  const base = {
    id: "real-result",
    uuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    name: "PlayerOne",
    mode: "mace",
    region: "EU",
    previous: "HT2",
    tier: "HT3",
    recordType: "adjustment",
    classification: "Demoted",
    newPeak: false,
    score: "10-6",
    tester: { name: "AwardingStaff" },
    created: "2026-11-14T12:00:00Z",
  };
  const dom = new JSDOM(resultCard(base));
  assert.ok(dom.window.document.querySelector(".skin-body"));
  assert.match(dom.window.document.body.textContent, /Staff award/);
  assert.match(dom.window.document.body.textContent, /Demoted/);
  assert.doesNotMatch(
    dom.window.document.body.textContent,
    /10-6|Promoted|New peak/,
  );
  assert.equal(
    dom.window.document.querySelector("a").getAttribute("href"),
    "/tests/real-result",
  );
  const official = new JSDOM(resultCard({ ...base, recordType: "test" }));
  assert.match(official.window.document.body.textContent, /10-6/);
});
