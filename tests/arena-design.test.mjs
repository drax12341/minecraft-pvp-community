import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { state } from "../web/platform-data.js";
import * as classic from "../web/platform-views.js";
import * as premium from "../web/platform-premium.js";
import * as data from "../web/platform-data.js";
const config = {
  modes: [
    {
      id: "mace",
      name: "Mace",
      color: "#83b8ef",
      description: "Official Mace",
      rules: [],
    },
    {
      id: "mace_rod",
      name: "Rod Mace",
      color: "#efbf76",
      description: "Rod Mace",
      rules: [],
    },
  ],
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
  scoring: { basis: "peak", includeRetired: true },
  invite: "https://discord.gg/example",
};
function fixture(path) {
  if (path.startsWith("/bootstrap"))
    return {
      config,
      statistics: {
        verified: 0,
        completedTests: 0,
        activeTesters: 0,
        openQueues: 0,
      },
      updates: [],
      loginConfigured: false,
    };
  if (path.startsWith("/rankings"))
    return { players: [], total: 0, page: 1, pages: 1 };
  if (path.startsWith("/results")) return { results: [], page: 1, pages: 1 };
  if (path.startsWith("/queues")) return { sessions: [] };
  throw Error("Unhandled request " + path);
}
test("arena homepage and five-column tier board keep empty production data honest", async () => {
  state.config = config;
  state.statistics = fixture("/bootstrap").statistics;
  const oldFetch = globalThis.fetch,
    oldLocation = globalThis.location;
  globalThis.location = new URL("https://example.test");
  globalThis.fetch = async (path) =>
    Response.json(fixture(String(path).replace("/api/v1", "")));
  try {
    const home = new JSDOM(await premium.home());
    assert.equal(
      home.window.document.querySelectorAll(".discipline-tile").length,
      2,
    );
    assert.equal(
      home.window.document.querySelectorAll("[data-count]").length,
      4,
    );
    assert.equal(
      home.window.document.querySelectorAll(".ranking-row").length,
      0,
    );
    assert.ok(home.window.document.querySelector(".arena-art"));
    assert.match(home.window.document.body.textContent, /place on this board/);
    const board = new JSDOM(
      await premium.rankings(
        new URL("https://example.test/rankings?view=tiers"),
      ),
    );
    assert.equal(
      board.window.document.querySelectorAll(".tier-board-column").length,
      5,
    );
    assert.equal(
      board.window.document.querySelectorAll(".tier-board-half").length,
      10,
    );
    assert.equal(
      board.window.document.querySelectorAll(".tier-board-player").length,
      0,
    );
    assert.equal(
      board.window.document
        .querySelector("[data-ranking-view=tiers]")
        .getAttribute("aria-pressed"),
      "true",
    );
    home.window.close();
    board.window.close();
  } finally {
    globalThis.fetch = oldFetch;
    globalThis.location = oldLocation;
  }
});
test("primary app uses new arena views, applies ranking layout changes and respects motion preference at runtime", async () => {
  const html = await readFile("web/index.html", "utf8");
  assert.match(html, /platform-premium.css/);
  assert.doesNotMatch(html, />\?<\//);
  const dom = new JSDOM(html, {
    url: "https://example.test",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window,
    oldFetch = globalThis.fetch,
    oldLocation = globalThis.location;
  globalThis.location = w.location;
  globalThis.fetch = async (path) =>
    Response.json(fixture(String(path).replace("/api/v1", "")));
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.scrollTo = () => {};
  w.__test = {
    ...data,
    views: { ...classic, ...premium },
    workspace: async () => "<h1>Account</h1>",
    mountAppearances() {},
    installAppearanceControls() {},
    updateAccountNavigation() {},
    installCosmos() {},
    mountMotion() {
      w.__mounts = (w.__mounts || 0) + 1;
    },
    installMotion() {},
    stopMotion() {},
  };
  let source = await readFile("web/platform.js", "utf8");
  source = source
    .replace(/^import[^\n]+\n/gm, "")
    .replace(
      "const views={...classicViews,...premiumViews};",
      "const views=__test.views;",
    )
    .replace("export async function render", "async function render");
  const bindings =
    "const {state,escape:e,skin,safeUrl,api,post,action,empty,workspace,mountMotion,installMotion,stopMotion,mountAppearances,installAppearanceControls,updateAccountNavigation,installCosmos}=__test;";
  try {
    w.eval(bindings + source);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.ok(w.document.querySelector(".arena-hero"));
    assert.ok(w.__mounts > 0);
    w.document.querySelector('a[href="/rankings"]').click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.ok(w.document.querySelector(".competition-page"));
    w.document.querySelector("[data-ranking-view=tiers]").click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(new URL(w.location.href).searchParams.get("view"), "tiers");
    assert.equal(w.document.querySelectorAll(".tier-board-column").length, 5);
    w.document.querySelector("#motion-toggle").click();
    assert.ok(w.document.documentElement.classList.contains("reduce-motion"));
    assert.equal(w.localStorage.getItem("mace-motion"), "reduced");
  } finally {
    w.close();
    globalThis.fetch = oldFetch;
    globalThis.location = oldLocation;
  }
});
test("motion controller animates real sections, then cancels running effects when motion is reduced", async () => {
  const dom = new JSDOM(
    '<main><div class="arena-copy"><h1>Mace</h1></div><section data-reveal><strong data-count="0">0</strong></section></main>',
    { url: "https://example.test", runScripts: "outside-only" },
  );
  const w = dom.window;
  let animations = 0,
    cancelled = 0;
  w.matchMedia = () => ({ matches: false });
  w.Element.prototype.animate = function () {
    animations++;
    return {
      finished: new Promise(() => {}),
      cancel() {
        cancelled++;
      },
    };
  };
  const source = (await readFile("web/platform-motion.js", "utf8")).replaceAll(
    "export function ",
    "function ",
  );
  w.eval(source + "\nwindow.motionTest={mountMotion,stopMotion};");
  w.motionTest.mountMotion(w.document.querySelector("main"));
  assert.ok(animations >= 2);
  w.document.documentElement.classList.add("reduce-motion");
  w.motionTest.stopMotion();
  assert.equal(cancelled, animations);
  const before = animations;
  w.motionTest.mountMotion(w.document.querySelector("main"));
  assert.equal(animations, before);
  dom.window.close();
});
