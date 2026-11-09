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
    mace: { tier: 3, pos: 0, peak_tier: 3, peak_pos: 0, retired: false },
  },
};
async function website(
  players = [],
  sessions = [],
  route = "rankings",
  recent = [],
) {
  const dom = new JSDOM(await readFile("web/index.html", "utf8"), {
      url: "https://example.com/" + (route ? "#" + route : ""),
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
          : { updatedAt: null, players, recent },
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

test("inspired homepage has functional scene controls, walkthrough and kit entry points", async () => {
  const dom = await website([], [], ""),
    w = dom.window,
    d = w.document;
  assert.equal(d.body.dataset.page, "home");
  assert.ok(d.querySelector(".night-wordmark"));
  assert.equal(d.querySelectorAll(".home-faq details").length, 5);
  assert.match(d.querySelector(".launch-pill").textContent, /preparation/);
  d.querySelector('[data-sky="stars"]').click();
  assert.ok(d.querySelector(".night-hero").classList.contains("stars-only"));
  assert.equal(
    d.querySelector('[data-sky="arena"]').getAttribute("aria-pressed"),
    "false",
  );
  d.querySelector('[data-journey="2"]').click();
  assert.match(
    d.querySelector("#journey-detail").textContent,
    /independent moderator/,
  );
  assert.equal(
    d.querySelector('[data-journey="2"]').getAttribute("aria-pressed"),
    "true",
  );
  d.querySelector('[data-home-mode="mace_rod"]').click();
  await new Promise((r) => w.setTimeout(r, 10));
  assert.equal(d.body.dataset.page, "rankings");
  assert.match(d.querySelector(".kit-title h2").textContent, /Rod Mace/);
  dom.window.close();
});

test("kit groups, searchable kit picker, clear filters and compact controls work", async () => {
  const dom = await website([player]),
    w = dom.window,
    d = w.document;
  d.querySelector('[data-mode-group="sub"]').click();
  assert.ok(d.querySelector('[data-mode="mace_spear"]'));
  assert.equal(d.querySelector('[data-mode="mace"]'), null);
  d.querySelector("#browse-modes").click();
  const search = d.querySelector("#kit-search");
  search.value = "Rod Mace";
  search.dispatchEvent(new w.Event("input"));
  assert.equal(d.querySelectorAll("[data-pick]").length, 1);
  d.querySelector('[data-pick="mace_rod"]').click();
  await new Promise((r) => w.setTimeout(r, 10));
  assert.match(d.querySelector(".kit-title h2").textContent, /Rod Mace/);
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
          mode: "mace",
          region: "EU",
          status: "closed",
          waiting: 0,
          claimed: 0,
        },
        { mode: "mace", region: "NA", status: "open", waiting: 3, claimed: 1 },
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
  d.querySelector('[data-request="mace"]').click();
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

test("shared ranking scope, profile deep links, saved players and retired filtering work together", async () => {
  const retired = {
    ...player,
    uuid: "00000000-0000-0000-0000-000000000002",
    name: "RetiredPlayer",
    rankings: { mace: { ...player.rankings.mace, retired: true } },
  };
  const dom = await website(
      [player, retired],
      [],
      "rankings?mode=mace&region=EU&view=list&status=all&player=" +
        player.uuid,
    ),
    w = dom.window,
    d = w.document;
  assert.equal(d.querySelector("dialog").open, true);
  assert.match(d.querySelector("#modal-body").textContent, /TestPlayer/);
  d.querySelector("#save-player").click();
  assert.equal(
    JSON.parse(w.localStorage.getItem("pvp:savedPlayers"))[0],
    player.uuid,
  );
  d.querySelector(".close").click();
  d.querySelector("#saved-only").click();
  assert.equal(d.querySelectorAll("tbody [data-player]").length, 1);
  assert.match(w.location.hash, /saved=1/);
  d.querySelector("#reset-view").click();
  assert.equal(d.querySelectorAll("[data-player]").length, 1);
  d.querySelector("#rank-status").value = "retired";
  d.querySelector("#rank-status").dispatchEvent(new w.Event("change"));
  assert.match(
    d.querySelector("#rankings-content").textContent,
    /RetiredPlayer/,
  );
  assert.match(d.querySelector("#rankings-content").textContent, /HT3/);
  assert.match(w.location.hash, /status=retired/);
  d.querySelector("#calm-view").click();
  assert.ok(d.body.classList.contains("calm-view"));
  assert.equal(w.localStorage.getItem("pvp:calm"), "true");
  dom.window.close();
});

test("leaderboards paginate without hiding filter scope and result feeds enforce HT3 cutoff", async () => {
  const ps = Array.from({ length: 56 }, (_, i) => ({
    ...player,
    uuid: String(i),
    name: "Player" + String(i).padStart(3, "0"),
  }));
  const dom = await website(ps, [], "rankings?mode=overall&view=list"),
    w = dom.window,
    d = w.document;
  assert.equal(d.querySelectorAll("tbody tr").length, 50);
  d.querySelector("#next-page").click();
  assert.equal(d.querySelectorAll("tbody tr").length, 6);
  assert.equal(d.querySelector(".rank-position").textContent, "51");
  d.querySelector("#prev-page").click();
  assert.equal(d.querySelector(".rank-position").textContent, "1");
  dom.window.close();
  const recent = [
    {
      ...player,
      mode: "mace",
      tier: 3,
      pos: 0,
      evidence: "https://example.com/evidence",
      created: "2026-11-08T00:00:00Z",
    },
    {
      ...player,
      name: "LowPlayer",
      mode: "mace",
      tier: 3,
      pos: 1,
      evidence: "https://example.com/low",
      created: "2026-11-08T00:00:00Z",
    },
  ];
  const resultDom = await website([], [], "results", recent),
    rd = resultDom.window.document;
  assert.equal(rd.querySelectorAll(".result-card").length, 2);
  rd.querySelector("[data-result-scope=high]").click();
  assert.equal(rd.querySelectorAll(".result-card").length, 1);
  assert.match(rd.querySelector("#results-feed").textContent, /TestPlayer/);
  assert.doesNotMatch(
    rd.querySelector("#results-feed").textContent,
    /LowPlayer/,
  );
  resultDom.window.close();
});

test("community summaries are local and refresh failure retains useful content", async () => {
  const dom = await website([], [], "community"),
    w = dom.window,
    d = w.document;
  d.querySelector("[name=practice-note]").value =
    "Saturday 16 UTC, mace kit, spacing practice.";
  d.querySelector("#practice-draft").dispatchEvent(
    new w.Event("submit", { cancelable: true }),
  );
  assert.equal(d.querySelector("dialog").open, true);
  assert.match(
    d.querySelector("#modal-body").textContent,
    /nothing has been posted/,
  );
  d.querySelector(".close").click();
  w.fetch = async () => {
    throw Error("Simulated outage");
  };
  d.querySelector("#refresh-public").click();
  await new Promise((r) => w.setTimeout(r, 10));
  assert.match(
    d.querySelector("#data-status").textContent,
    /last loaded snapshot/,
  );
  assert.equal(
    d.querySelector("[name=practice-note]").value,
    "Saturday 16 UTC, mace kit, spacing practice.",
  );
  dom.window.close();
});
