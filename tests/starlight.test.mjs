import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

test("celestial effects stop for reduced motion and hidden tabs, and visual preferences persist", async () => {
  const dom = new JSDOM(
    '<body data-page="home"><button id="cursor-toggle"><span></span></button><button id="fireworks-toggle"><span></span></button><canvas id="orbit-world"></canvas></body>',
    {
      url: "https://example.test/minecraft-pvp-community/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  );
  const w = dom.window,
    d = w.document,
    callbacks = new Map();
  let id = 0;
  const media = { matches: false, addEventListener() {} };
  w.matchMedia = (q) =>
    q.includes("prefers-reduced")
      ? media
      : { matches: true, addEventListener() {} };
  w.requestAnimationFrame = (fn) => {
    callbacks.set(++id, fn);
    return id;
  };
  w.cancelAnimationFrame = (id) => callbacks.delete(id);
  const context = {
    clearRect() {},
    setTransform() {},
    beginPath() {},
    arc() {},
    fill() {},
    fillRect() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
  };
  w.HTMLCanvasElement.prototype.getContext = () => context;
  w.eval(
    (await readFile("web/orbit-motion.js", "utf8")).replace(
      "export function",
      "function",
    ),
  );
  assert.equal(callbacks.size, 1);
  const canvas = d.querySelector("canvas"),
    count = canvas.orbitFrameCount || 0;
  d.body.classList.add("calm-view");
  await new Promise((resolve) => w.setTimeout(resolve, 0));
  assert.equal(callbacks.size, 0);
  assert.equal(canvas.orbitFrameCount, count + 1);
  assert.equal(d.querySelector(".starlight-cursor").hidden, true);
  d.querySelector("#fireworks-toggle").click();
  assert.equal(w.localStorage.getItem("pvp-fireworks"), "off");
  assert.equal(
    d.querySelector("#fireworks-toggle").getAttribute("aria-pressed"),
    "false",
  );
  d.querySelector("#cursor-toggle").click();
  assert.equal(w.localStorage.getItem("pvp-cursor"), "off");
  d.body.classList.remove("calm-view");
  await new Promise((resolve) => w.setTimeout(resolve, 0));
  assert.equal(callbacks.size, 1);
  Object.defineProperty(d, "hidden", { configurable: true, value: true });
  d.dispatchEvent(new w.Event("visibilitychange"));
  assert.equal(callbacks.size, 0);
  Object.defineProperty(d, "hidden", { configurable: true, value: false });
  media.matches = true;
  d.dispatchEvent(new w.Event("visibilitychange"));
  assert.equal(callbacks.size, 0);
  dom.window.close();
});

test("GitHub Pages entry boots the redesigned home, opens information and preserves motion controls", async () => {
  const config = JSON.parse(await readFile("config/community.json", "utf8"));
  const dom = new JSDOM(await readFile("web/pages.html", "utf8"), {
    url: "https://drax12341.github.io/minecraft-pvp-community/#home",
    runScripts: "outside-only",
  });
  const w = dom.window,
    d = w.document;
  w.matchMedia = () => ({ matches: false });
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  w.fetch = async (url) => ({
    ok: true,
    json: async () =>
      String(url).includes("community.json")
        ? config
        : String(url).includes("testing.json")
          ? { sessions: [] }
          : String(url).includes("testing-desk")
            ? { paths: [], tiers: [], commands: [] }
            : { players: [], recent: [], completedTests: 0, updatedAt: null },
  });
  let source = "";
  for (const name of [
    "community-feed",
    "testing-desk",
    "league",
    "player-identity",
    "control-room",
    "orbit-home",
    "tierlist",
  ]) {
    let moduleSource = (await readFile("web/" + name + ".js", "utf8"))
      .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\r?\n/gm, "")
      .replaceAll("export const", "const")
      .replaceAll("export function", "function")
      .replaceAll("export async function", "async function");
    source +=
      (name === "orbit-home"
        ? "const renderOrbitHome=(()=>{" +
          moduleSource +
          ";return renderOrbitHome;})();"
        : moduleSource) + "\n";
  }
  await w.eval("(async()=>{" + source + "})()");
  assert.equal(d.querySelectorAll("#motion-toggle").length, 1);
  assert.equal(d.querySelector("#completed-tests").textContent, "0");
  assert.equal(d.querySelector(".orbit-hero-stage"), null);
  d.querySelector('[data-info-open="counter"]').click();
  assert.equal(d.querySelector(".community-info").open, true);
  d.querySelector(".info-close").click();
  d.querySelector("#performance-toggle").click();
  assert.ok(d.body.classList.contains("calm-view"));
  assert.equal(
    d.querySelector("#motion-toggle").getAttribute("aria-pressed"),
    "true",
  );
  dom.window.close();
});
