import {
  selectControlPlayers,
  crPoints,
  controlRoomSnapshot,
} from "./control-room.js?v=leaderboard-v3";

const html = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const modeOrder = [
  "mace_rod",
  "mace_og",
  "mace_lt",
  "mace_rocket",
  "mace_ht",
  "mace_spear",
  "mace",
];
const shortNames = { mace_ht: "HT Mace", mace_lt: "LT Mace" };
const validUuid = (value) =>
  /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(
    value || "",
  );
const tierName = (rank) => (rank.pos === 0 ? "HT" : "LT") + Number(rank.tier);
const validRank = (rank) =>
  rank &&
  Number.isInteger(rank.tier) &&
  rank.tier >= 1 &&
  rank.tier <= 5 &&
  [0, 1].includes(rank.pos);
const icon = (id, size = 28, eager = false) =>
  `<img src="./assets/modes/${modeOrder.includes(id) ? id : "overall"}.png" width="${size}" height="${size}" alt="" loading="${eager ? "eager" : "lazy"}">`;
const svg = (name, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    {
      search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
      trophy:
        '<path d="M8 3h8v7a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-4 1h8"/>',
      bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
      star: '<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>',
      arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
      chevron: '<path d="m9 5 7 7-7 7"/>',
      shield:
        '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
      copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
      close: '<path d="m6 6 12 12M6 18 18 6"/>',
      globe:
        '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
      crown: '<path d="m3 6 4 4 5-7 5 7 4-4-2 13H5L3 6ZM6 22h12"/>',
    }[name] || '<circle cx="12" cy="12" r="8"/>'
  }</svg>`;
const finiteCount = (value) =>
  Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString() : "\u2014";
const formatDate = (value) =>
  Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })
    : "Published";

export function renderOrbitHome({
  main,
  config,
  data,
  testing,
  saved,
  profile,
  onSave,
  copy,
}) {
  const doc = main.ownerDocument,
    win = doc.defaultView;
  const modes = [...config.modes].sort(
    (a, b) => modeOrder.indexOf(a.id) - modeOrder.indexOf(b.id),
  );
  const params = new URLSearchParams(win.location.hash.split("?")[1]);
  const scope = {
    mode: modes.some((m) => m.id === params.get("mode"))
      ? params.get("mode")
      : "overall",
    region: ["EU", "NA", "AS", "AU", "OC", "SA", "ME", "AF"].includes(
      params.get("region"),
    )
      ? params.get("region")
      : "all",
    query: "",
    sort: "points",
    savedOnly: false,
  };
  const snapshot = controlRoomSnapshot(data, testing, config);
  const pageSize = 25;
  let page = 1,
    activityScope = "recent";
  const cleanPlayers = (data.players || [])
    .filter((p) => !p.demo && validUuid(p.uuid))
    .map((p) => ({
      ...p,
      rankings: Object.fromEntries(
        Object.entries(p.rankings || {}).filter(
          ([id, r]) => modes.some((m) => m.id === id) && validRank(r),
        ),
      ),
    }));
  const recent = (data.recent || [])
    .filter((r) => !r.demo && validRank(r) && validUuid(r.uuid))
    .sort(
      (a, b) => (Date.parse(b.created) || 0) - (Date.parse(a.created) || 0),
    );
  const high = recent.filter(
    (r) => r.tier < 3 || (r.tier === 3 && r.pos === 0),
  );
  const sessions = (testing.sessions || []).filter(
    (s) => s.status === "open" || s.status === "paused",
  );
  const updated = Number.isFinite(Date.parse(data.updatedAt))
    ? new Date(data.updatedAt).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Awaiting first publication";

  main.innerHTML = `
 <div class="rankings-workspace">
   <div class="rankings-toolbar">
     <div class="leaderboard-filters"><label class="leaderboard-search">${svg("search")}<input id="orbit-player-search" type="search" placeholder="Search for a player..." aria-label="Search leaderboard" maxlength="64"><kbd>/</kbd></label><label class="region-filter">${svg("globe", 16)}<span class="sr-only">Region</span><select id="orbit-region">${["all", "EU", "NA", "AS", "AU", "OC", "SA", "ME", "AF"].map((r) => `<option value="${r}"${scope.region === r ? " selected" : ""}>${r === "all" ? "All regions" : r}</option>`).join("")}</select></label><button class="saved-filter" id="saved-only" aria-pressed="false">${svg("star", 16)}<span>Saved players</span></button><span class="filtered-count" id="filtered-count"></span></div>
     <div class="workspace-actions">
       <button class="workspace-control performance-control" id="performance-toggle" aria-pressed="false">${svg("bolt")}<span>Performance mode</span><i class="performance-switch" aria-hidden="true"></i></button>
       <button class="workspace-control" data-info-open="scoring">${svg("info")}<span>Information</span></button>
       <button class="workspace-control server-address" id="copy-practice-server" aria-label="Copy practice server address">${svg("globe")}<span>Practice IP</span><code>mcpvpcommunity.minekeep.gg</code>${svg("copy", 14)}</button>
     </div>
   </div>
   <aside class="activity-rail" aria-label="Test activity">
     <button class="activity-collapse" id="activity-collapse" aria-label="Collapse activity rail" aria-expanded="true">${svg("chevron", 16)}</button>
     <button class="activity-rail-button high-activity" data-open-activity="high" aria-haspopup="dialog"><span class="rail-icon">${svg("crown", 21)}</span><b>HT3+</b><span class="rail-label">High tests</span><small>${high.length}</small></button>
     <button class="activity-rail-button recent-activity" data-open-activity="recent" aria-haspopup="dialog"><span class="rail-icon">${svg("bolt", 21)}</span><b>Latest</b><span class="rail-label">Recent tests</span><small>${recent.length}</small></button>
   </aside>
   <div class="rankings-content">
     <a class="season-strip" href="#testing"><span class="season-emblem">${svg("trophy", 22)}</span><span class="season-label">The community circuit</span><strong>Seven disciplines. Earned placements.</strong><span class="session-status"><i class="live-dot" aria-hidden="true"></i>${snapshot.open ? snapshot.open + " open session" + (snapshot.open === 1 ? "" : "s") : "Check testing availability"}</span><span class="season-link">Find your next test ${svg("arrow", 16)}</span></a>
     <nav class="leaderboard-modes" aria-label="Leaderboard discipline">
       <button class="mode-tab" data-orbit-mode="overall" aria-pressed="${scope.mode === "overall"}">${icon("overall", 28, true)}<span>Overall</span></button>
       ${modes.map((m) => `<button class="mode-tab" data-orbit-mode="${html(m.id)}" aria-pressed="${scope.mode === m.id}">${icon(m.id, 28, true)}<span>${html(shortNames[m.id] || m.name)}</span></button>`).join("")}
     </nav>
     <section class="community-banner" aria-label="Community testing">
       <div class="banner-art" aria-hidden="true"><div class="banner-orbit"></div><span>${svg("shield", 45)}</span><i></i><i></i><i></i></div>
       <div class="banner-copy"><span class="banner-kicker">Built by the community</span><h2>Your next placement starts here.</h2><p>Pick your discipline. Meet your match. Leave your mark.</p></div>
       <div class="banner-actions"><a class="banner-discord" href="${html(config.invite)}" target="_blank" rel="noopener noreferrer">Join Discord ${svg("arrow", 17)}</a><button data-info-open="guide">How testing works</button></div>
     </section>
     <section class="leaderboard-surface" aria-labelledby="leaderboard-title">
       <div class="leaderboard-heading"><div><span class="leaderboard-eyebrow">The official community board</span><h1 id="leaderboard-title">Overall rankings</h1><p id="leaderboard-description">Combined points from every active discipline.</p></div><button class="test-counter" data-info-open="counter" aria-label="About the completed test count"><span class="live-dot" aria-hidden="true"></span><span>Tests completed</span><strong id="completed-tests">${finiteCount(data.completedTests)}</strong>${svg("info", 14)}</button></div>

       <div class="leaderboard-table-header" aria-hidden="true"><span>#</span><span>Player</span><span>Region</span><span>Tiers</span><span></span></div>
       <div id="orbit-leaderboard" aria-live="polite"></div>
       <div class="leaderboard-pagination"><span id="orbit-board-count"></span><div><button id="leaderboard-prev" aria-label="Previous leaderboard page">${svg("chevron", 16)}</button><span id="leaderboard-page"></span><button id="leaderboard-next" aria-label="Next leaderboard page">${svg("chevron", 16)}</button></div></div>
     </section>
     <div class="leaderboard-footnote"><span>${svg("shield", 15)}Published community records. Every placement earned.</span><span>Updated: ${html(updated)}<button data-info-open="counter" aria-label="About published snapshots">${svg("info", 14)}</button></span></div>
     <div class="rankings-support"><section class="support-sessions"><div class="support-heading"><div>${svg("bolt", 18)}<h2>Testing sessions</h2></div><a href="#testing">All sessions ${svg("arrow", 15)}</a></div><div id="orbit-queues">${
       sessions.length
         ? sessions
             .slice(0, 3)
             .map(
               (s) =>
                 `<a class="session-row" href="#testing">${icon(s.mode, 24)}<span><strong>${html(config.modes.find((m) => m.id === s.mode)?.name || s.mode)}</strong><small>${html(s.region)} &middot; ${s.status === "open" ? "Open" : "Paused"}</small></span><b>${Math.max(0, Number(s.waiting) || 0) + Math.max(0, Number(s.claimed) || 0)} / ${Math.max(0, Number(s.capacity) || 20)}</b></a>`,
             )
             .join("")
         : '<p class="session-empty">No sessions published. Check Discord for the next opportunity.</p>'
     }</div></section><section class="support-scoring"><div class="support-heading"><div>${svg("trophy", 18)}<h2>Know your next tier</h2></div><button data-info-open="scoring">Points &amp; rules ${svg("arrow", 15)}</button></div><p>Each discipline has its own leaderboard. Overall points count active placements across your modes.</p><a href="#planner">Explore the tier system ${svg("arrow", 15)}</a></section></div>
   </div>
 </div>
 <dialog class="community-info" aria-labelledby="community-info-title"></dialog>
 <dialog class="activity-drawer" id="activity-drawer" aria-labelledby="activity-title"><div class="drawer-heading"><div><span class="leaderboard-eyebrow">Community test activity</span><h2 id="activity-title">Recent tests</h2></div><button class="drawer-close" aria-label="Close test activity">${svg("close")}</button></div><div class="pulse-tabs" role="group" aria-label="Result feed"><button data-pulse="recent" aria-pressed="true">Recent tests</button><button data-pulse="high" aria-pressed="false">High-tier results <span>HT3+</span></button></div><p class="drawer-note">Published results, including repeat tests. Latest snapshot only.</p><div id="test-pulse-feed" aria-live="polite"></div><a href="#results" class="drawer-all">Explore all results ${svg("arrow", 16)}</a></dialog>`;

  const dialog = main.querySelector(".community-info"),
    drawer = main.querySelector("#activity-drawer");
  const closeOnBackdrop = (event) => {
    if (event.target !== event.currentTarget) return;
    const r = event.currentTarget.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      event.currentTarget.close();
  };
  dialog.addEventListener("click", closeOnBackdrop);
  drawer.addEventListener("click", closeOnBackdrop);
  const panels = {
    counter: [
      "Every test counts.",
      "<p>The total counts completed, published community tests, including repeat tests by the same player. Revoked results are excluded. Staff adjustments and previews do not count.</p><p>The number updates with published snapshots. A dash means the current snapshot does not include a total yet.</p>",
    ],
    guide: [
      "Your next placement starts here.",
      '<ol><li><strong>Join the community.</strong><p>Open Discord and follow the Minecraft account verification instructions.</p></li><li><strong>Choose your discipline.</strong><p>Pick your mode and region, then join an available testing session.</p></li><li><strong>Play. Learn. Climb.</strong><p>A qualified tester reviews the evidence. Your published result appears on your profile.</p></li></ol><a class="button" href="#test-desk" data-info-route>Open the testing desk &rarr;</a>',
    ],
    scoring: [
      "Earn your place.",
      '<p>Overall points combine active placements in each discipline. Retired placements do not contribute to this board. Each tier below shows its configured value.</p><div class="info-points">' +
        Object.entries(config.points)
          .map(
            ([rank, points]) =>
              "<span><b>" + html(rank) + "</b>" + html(points) + " pts</span>",
          )
          .join("") +
        '</div><p>Calculators and layout previews never change published placements.</p><a class="button secondary" href="#planner" data-info-route>Open the tier explorer &rarr;</a>',
    ],
  };
  function openInfo(name) {
    const [title, content] = panels[name] || panels.guide;
    dialog.innerHTML = `<button class="info-close" aria-label="Close information">${svg("close")}</button><span class="info-orbit">${svg(name === "scoring" ? "trophy" : "shield", 32)}</span><h2 id="community-info-title">${title}</h2>${content}`;
    dialog.querySelector(".info-close").onclick = () => dialog.close();
    dialog
      .querySelectorAll("[data-info-route]")
      .forEach((a) => (a.onclick = () => dialog.close()));
    dialog.showModal();
  }
  main
    .querySelectorAll("[data-info-open]")
    .forEach((b) => (b.onclick = () => openInfo(b.dataset.infoOpen)));
  function placements(player) {
    return modes
      .filter(
        (m) =>
          validRank(player.rankings[m.id]) &&
          !player.rankings[m.id].retired &&
          (scope.mode === "overall" || scope.mode === m.id),
      )
      .map((m) => {
        const rank = player.rankings[m.id],
          name = tierName(rank);
        return `<span class="placement-medallion" data-tier="${rank.tier}" data-half="${rank.pos}" tabindex="0" aria-label="${html(m.name)}: ${name}"><span class="medallion-icon">${icon(m.id, 23)}</span><b>${name}</b><span class="medallion-tooltip" aria-hidden="true">${html(m.name)} &middot; ${name} &middot; ${Number(config.points[name]) || 0} pts</span></span>`;
      })
      .join("");
  }
  function playerRow(player, position) {
    const points = crPoints(player, config, scope.mode),
      podium = position <= 3;
    return `<article class="leaderboard-player${podium ? " podium podium-" + position : ""}" data-position="${position}"><div class="player-position">${podium ? svg("crown", 18) : ""}<strong>${position}</strong><span class="position-dot" aria-hidden="true"></span></div><button class="player-identity" data-orbit-profile="${html(player.uuid)}" aria-label="Open ${html(player.name)} profile"><span class="player-skin${podium ? " body-skin" : ""}"><img src="https://mc-heads.net/${podium ? "body" : "avatar"}/${encodeURIComponent(player.uuid)}/${podium ? "96" : "64"}" width="${podium ? "60" : "40"}" height="${podium ? "96" : "40"}" alt="" loading="lazy" referrerpolicy="no-referrer"></span><span class="player-details"><strong class="player-name">${html(player.name)}</strong><span class="player-caption">${scope.mode === "overall" ? "Overall competitor" : html(config.modes.find((m) => m.id === scope.mode)?.name || scope.mode)}</span><span class="player-score">${svg("shield", 13)}<strong class="orbit-player-points">${points}</strong> <span>points</span></span></span></button><span class="player-region"><span>${html(scope.mode === "overall" ? player.region : player.rankings[scope.mode]?.region || player.region)}</span></span><div class="player-placements">${placements(player)}</div><button class="player-save" data-orbit-save="${html(player.uuid)}" aria-label="${saved.has(player.uuid) ? "Unsave" : "Save"} ${html(player.name)}" aria-pressed="${saved.has(player.uuid)}">${svg("star", 17)}</button></article>`;
  }
  function draw() {
    const ordered = selectControlPlayers(cleanPlayers, config, {
      mode: scope.mode,
      region: scope.region,
      sort: "points",
    });
    const places = new Map(ordered.map((p, i) => [p.uuid, i + 1]));
    const rows = ordered.filter(
      (p) =>
        (!scope.query ||
          String(p.name)
            .toLowerCase()
            .includes(scope.query.trim().toLowerCase())) &&
        (!scope.savedOnly || saved.has(p.uuid)),
    );
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    page = Math.min(page, pages);
    const selectedMode = config.modes.find((m) => m.id === scope.mode);
    main.querySelector("#leaderboard-title").textContent =
      (selectedMode?.name || "Overall") + " rankings";
    main.querySelector("#leaderboard-description").textContent = selectedMode
      ? "Published, active placements in " + selectedMode.name + "."
      : "Combined points from every active discipline.";
    main
      .querySelectorAll("[data-orbit-mode]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.orbitMode === scope.mode),
        ),
      );
    main.querySelector("#orbit-leaderboard").innerHTML = rows.length
      ? rows
          .slice((page - 1) * pageSize, page * pageSize)
          .map((p) => playerRow(p, places.get(p.uuid)))
          .join("")
      : `<div class="leaderboard-empty">${svg("trophy", 38)}<h2>${cleanPlayers.length ? "No players match this view." : "No placements published yet."}</h2><p>${cleanPlayers.length ? "Try another discipline, region or player name." : "The leaderboard is ready. The first names arrive with the first published community tests."}</p><div>${cleanPlayers.length ? '<button id="clear-leaderboard-filters" class="button secondary">Reset filters</button>' : ""}<button class="button" id="empty-testing-guide">How to get tested ${svg("arrow", 16)}</button></div><span class="empty-columns" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></div>`;
    main.querySelector("#orbit-board-count").textContent = rows.length
      ? `${(page - 1) * pageSize + 1}\u2013${Math.min(page * pageSize, rows.length)} of ${rows.length} players`
      : "Community results only";
    main.querySelector("#filtered-count").textContent =
      rows.length + " player" + (rows.length === 1 ? "" : "s");
    main.querySelector("#leaderboard-page").textContent = page + " / " + pages;
    main.querySelector("#leaderboard-prev").disabled = page === 1;
    main.querySelector("#leaderboard-next").disabled = page === pages;
    main
      .querySelectorAll("[data-orbit-profile]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            profile(
              cleanPlayers.find((p) => p.uuid === b.dataset.orbitProfile),
            )),
      );
    main.querySelectorAll("[data-orbit-save]").forEach(
      (b) =>
        (b.onclick = () => {
          onSave(b.dataset.orbitSave);
          draw();
        }),
    );
    main
      .querySelector("#empty-testing-guide")
      ?.addEventListener("click", () => openInfo("guide"));
    main
      .querySelector("#clear-leaderboard-filters")
      ?.addEventListener("click", () => {
        Object.assign(scope, {
          query: "",
          region: "all",
          savedOnly: false,
          mode: "overall",
        });
        main.querySelector("#orbit-player-search").value = "";
        main.querySelector("#orbit-region").value = "all";
        main.querySelector("#saved-only").setAttribute("aria-pressed", "false");
        page = 1;
        draw();
      });
    // Broken external skin renders keep a local, neutral fallback, never another player's skin.
    main.querySelectorAll(".player-skin img").forEach(
      (img) =>
        (img.onerror = () => {
          img.hidden = true;
          img.parentElement.classList.add("skin-unavailable");
        }),
    );
  }
  function updateScope() {
    const query = new URLSearchParams();
    if (scope.mode !== "overall") query.set("mode", scope.mode);
    if (scope.region !== "all") query.set("region", scope.region);
    win.history.replaceState(
      null,
      "",
      "#home" + (query.size ? "?" + query : ""),
    );
    page = 1;
    draw();
  }
  main.querySelectorAll("[data-orbit-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        scope.mode = b.dataset.orbitMode;
        updateScope();
      }),
  );
  main.querySelector("#orbit-player-search").oninput = (e) => {
    scope.query = e.target.value;
    updateScope();
  };
  main.querySelector("#orbit-region").onchange = (e) => {
    scope.region = e.target.value;
    updateScope();
  };
  main.querySelector("#saved-only").onclick = (e) => {
    scope.savedOnly = !scope.savedOnly;
    e.currentTarget.setAttribute("aria-pressed", String(scope.savedOnly));
    updateScope();
  };
  main.querySelector("#leaderboard-prev").onclick = () => {
    page--;
    draw();
  };
  main.querySelector("#leaderboard-next").onclick = () => {
    page++;
    draw();
  };
  main.querySelector("#activity-collapse").onclick = (e) => {
    const collapsed = main
      .querySelector(".rankings-workspace")
      .classList.toggle("activity-collapsed");
    e.currentTarget.setAttribute("aria-expanded", String(!collapsed));
    e.currentTarget.setAttribute(
      "aria-label",
      (collapsed ? "Expand" : "Collapse") + " activity rail",
    );
  };
  function drawPulse() {
    const rows = activityScope === "high" ? high : recent;
    main.querySelector("#activity-title").textContent =
      activityScope === "high" ? "High-tier results" : "Recent tests";
    main
      .querySelectorAll("[data-pulse]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.pulse === activityScope),
        ),
      );
    main.querySelector("#test-pulse-feed").innerHTML = rows.length
      ? rows
          .slice(0, 25)
          .map(
            (r) =>
              `<a class="pulse-result" href="#rankings?player=${encodeURIComponent(r.uuid)}"><img src="https://mc-heads.net/avatar/${encodeURIComponent(r.uuid)}/48" width="36" height="36" alt="" loading="lazy" referrerpolicy="no-referrer"><span><strong>${html(r.name)}</strong><small>${html(config.modes.find((m) => m.id === r.mode)?.name || r.mode)} &middot; ${html(r.region)}</small></span><b class="result-tier" data-tier="${r.tier}">${tierName(r)}</b><time>${html(formatDate(r.created))}</time></a>`,
          )
          .join("")
      : `<div class="activity-empty">${svg(activityScope === "high" ? "crown" : "bolt", 32)}<h3>${activityScope === "high" ? "The next breakthrough belongs here." : "The next chapter starts with a test."}</h3><p>${activityScope === "high" ? "Published HT3 and higher results will appear here." : "Completed community tests, including repeat tests, will appear here."}</p><a href="#testing">Find a session ${svg("arrow", 15)}</a></div>`;
  }
  main.querySelectorAll("[data-open-activity]").forEach(
    (b) =>
      (b.onclick = () => {
        activityScope = b.dataset.openActivity;
        drawPulse();
        drawer.showModal();
      }),
  );
  main.querySelectorAll("[data-pulse]").forEach(
    (b) =>
      (b.onclick = () => {
        activityScope = b.dataset.pulse;
        drawPulse();
      }),
  );
  drawer.addEventListener("click", (event) => {
    if (event.target.closest?.("a")) drawer.close();
  });
  drawer.querySelector(".drawer-close").onclick = () => drawer.close();
  drawer
    .querySelectorAll("a")
    .forEach((a) => (a.onclick = () => drawer.close()));
  const performanceButton = main.querySelector("#performance-toggle");
  performanceButton.setAttribute(
    "aria-pressed",
    String(doc.body.classList.contains("calm-view")),
  );
  performanceButton.onclick = () => {
    const motion = doc.querySelector("#motion-toggle");
    if (motion) motion.click();
    else doc.body.classList.toggle("calm-view");
    performanceButton.setAttribute(
      "aria-pressed",
      String(doc.body.classList.contains("calm-view")),
    );
  };
  const serverButton = main.querySelector("#copy-practice-server");
  serverButton.onclick = async () => {
    const address = "mcpvpcommunity.minekeep.gg";
    if (copy) {
      copy(address);
      return;
    }
    try {
      await win.navigator.clipboard.writeText(address);
      serverButton.querySelector("span").textContent = "Copied";
    } catch {
      serverButton.querySelector("span").textContent = "Select to copy";
    }
  };
  const searchShortcut = (event) => {
    if (!main.querySelector("#orbit-player-search")) return;
    if (
      event.key === "/" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.target.closest?.("input,textarea,select,[contenteditable=true]") &&
      !doc.querySelector("dialog[open]")
    ) {
      event.preventDefault();
      main.querySelector("#orbit-player-search")?.focus();
    }
  };
  // One document handler is replaced on re-render; other routes have no matching search input.
  doc.onkeydown = searchShortcut;
  draw();
  drawPulse();
  if (panels[params.get("info")]) openInfo(params.get("info"));
}
