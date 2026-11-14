import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { createStarMap } from "../web/platform-cosmos.js";
import { accountSkinCard } from "../web/platform-appearance.js";
test("star maps are deterministic, bounded and scale to the requested viewport", () => {
  for (const [width, height, count] of [
    [375, 812, 65],
    [1440, 900, 145],
  ]) {
    const stars = createStarMap(width, height, count);
    assert.equal(stars.length, count);
    assert.deepEqual(stars, createStarMap(width, height, count));
    for (const s of stars) {
      assert.ok(s.x >= 0 && s.x < width);
      assert.ok(s.y >= 0 && s.y < height);
      assert.ok(s.r >= 0.35 && s.r <= 1.55);
    }
  }
});
test("connected skin panel uses the saved Minecraft UUID and safely renders its name", () => {
  const html = accountSkinCard({
    uuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    name: "<img onerror=alert(1)>",
  });
  const dom = new JSDOM(html);
  assert.equal(dom.window.document.querySelectorAll("img").length, 1);
  assert.ok(dom.window.document.querySelector("[data-skin-owner=true]"));
  assert.match(
    dom.window.document.querySelector("h2").textContent,
    /<img onerror/,
  );
  assert.equal(
    dom.window.document.querySelector("[data-skin-download]").hidden,
    true,
  );
  assert.ok(
    dom.window.document.querySelector(
      'a[href="https://skinmc.net/profile/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]',
    ),
  );
  assert.equal(accountSkinCard({ uuid: "../evil", name: "Impersonator" }), "");
  dom.window.close();
});
test("account preview loads SkinMC, switches head/body and falls back after an image failure", async () => {
  const uuid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    skinId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const dom = new JSDOM(
    "<main>" + accountSkinCard({ uuid, name: "Competitor" }) + "</main>",
    { url: "https://example.test", runScripts: "outside-only" },
  );
  const w = dom.window;
  let calls = 0;
  w.__api = async (path) => {
    calls++;
    assert.match(path, /\/me\/appearance/);
    return {
      uuid,
      provider: "skinmc",
      headUrl: `https://skinmc.net/api/v1/renders/skins/${skinId}/head/100`,
      bodyUrl: `https://skinmc.net/api/v1/renders/skins/${skinId}/preview`,
      textureUrl: `https://skinmc.net/api/v1/renders/skins/${skinId}/skin`,
      checkedAt: "2026-11-14T00:00:00Z",
    };
  };
  let source = (await readFile("web/platform-appearance.js", "utf8"))
    .replace(/^import[^\n]+\n/gm, "")
    .replaceAll("export function ", "function ");
  w.eval(
    "const api=window.__api;const formatDate=value=>value;" +
      source +
      "\nwindow.skinTest={mountAppearances,installAppearanceControls};",
  );
  w.skinTest.installAppearanceControls();
  w.skinTest.mountAppearances(w.document.querySelector("main"));
  await new Promise((r) => setTimeout(r, 15));
  const image = w.document.querySelector("[data-skin-uuid]");
  assert.match(image.src, /skinmc.net.*preview/);
  assert.equal(w.document.querySelector("[data-skin-download]").hidden, false);
  w.document.querySelector("[data-skin-view=head]").click();
  assert.match(image.src, /head\/100/);
  assert.equal(
    w.document
      .querySelector("[data-skin-view=head]")
      .getAttribute("aria-pressed"),
    "true",
  );
  w.document.querySelector("[data-skin-view=body]").click();
  assert.match(image.src, /preview/);
  image.dispatchEvent(new w.Event("error"));
  assert.match(image.src, /mc-heads.net\/body/);
  assert.match(
    w.document.querySelector("[data-appearance-status]").textContent,
    /unavailable/,
  );
  assert.equal(calls, 1);
  w.close();
});
