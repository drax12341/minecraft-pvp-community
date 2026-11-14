const lx = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const leagueTier = (r) => (r.pos === 0 ? "HT" : "LT") + r.tier;
const leagueActivePoints = (p, config) =>
  Object.values(p.rankings).reduce(
    (sum, r) => sum + (r.retired ? 0 : config.points[leagueTier(r)] || 0),
    0,
  );
const leagueOptions = (config) =>
  config.modes
    .map((m) => `<option value="${lx(m.id)}">${lx(m.name)}</option>`)
    .join("");
const leagueRegions = ["EU", "NA", "AS", "SA", "AU", "AF", "ME", "OC"];
const leagueRegionOptions = () =>
  '<option value="all">All regions</option>' +
  leagueRegions.map((r) => `<option>${r}</option>`).join("");
const leagueAvatar = (p) =>
  `<img src="https://mc-heads.net/avatar/${encodeURIComponent(p.uuid)}/48" alt="" width="36" height="36" loading="lazy" referrerpolicy="no-referrer">`;
const leagueRankToken = (r) =>
  `<span class="rank-token rank-token-${r.tier}">${leagueTier(r)}</span>`;
const leagueIntro = (title, copy) =>
  `<section class="page-title"><div><h1>${title}</h1><p class="subtitle">${copy}</p></div></section>`;

export function mountLeagueShell({ browseModes, onMotionToggle }) {
  document.querySelector("#global-kit-search").onclick = browseModes;
  document.querySelector("#motion-toggle").onclick = onMotionToggle;
  const toggle = document.querySelector("#mobile-navigation");
  const close = () => {
    document.body.classList.remove("rail-open");
    toggle.setAttribute("aria-expanded", "false");
  };
  toggle.onclick = () => {
    const open = document.body.classList.toggle("rail-open");
    toggle.setAttribute("aria-expanded", String(open));
  };
  document.querySelectorAll(".topbar a").forEach((a) =>
    a.addEventListener("click", () => {
      close();
      document.querySelector(".resource-menu")?.removeAttribute("open");
    }),
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("rail-open")) {
      close();
      toggle.focus();
    }
  });
  document.addEventListener("visibilitychange", () =>
    document.body.classList.toggle(
      "page-hidden",
      document.visibilityState === "hidden",
    ),
  );
  document.addEventListener("click", (e) => {
    const menu = document.querySelector(".resource-menu");
    if (menu?.open && !menu.contains(e.target)) menu.open = false;
  });
}

export function renderLeagueWatchlist({
  main,
  config,
  data,
  saved,
  profile,
  onRemove,
  onCompare,
  selected,
}) {
  const render = () => {
    const players = data.players.filter((p) => saved.has(p.uuid));
    main.innerHTML =
      leagueIntro(
        "Keep your competition close.",
        "A personal watchlist of published players. Saved on this browser, with no account or tracking profile.",
      ) +
      `<section class="watchlist-toolbar"><p id="watchlist-count" role="status">${players.length} published player${players.length === 1 ? "" : "s"} saved</p><a class="button secondary" href="#rankings">Find more players</a></section><div class="watchlist-grid">${players
        .map(
          (p) =>
            `<article class="watch-player"><button class="watch-identity" data-watch-player="${lx(p.uuid)}">${leagueAvatar(p)}<span><strong>${lx(p.name)}</strong><small>${lx(p.region)} · ${leagueActivePoints(p, config)} active points</small></span></button><div class="watch-ranks">${Object.entries(
              p.rankings,
            )
              .map(
                ([mode, r]) =>
                  `<span>${lx(config.modes.find((m) => m.id === mode)?.name || mode)} ${leagueRankToken(r)}${r.retired ? "<small>Retired</small>" : ""}</span>`,
              )
              .join(
                "",
              )}</div><div class="watch-actions"><button class="text-button" data-watch-compare="${lx(p.uuid)}" aria-pressed="${selected.has(p.uuid)}">${selected.has(p.uuid) ? "Added to comparison" : "Add to comparison"}</button><button class="text-button" data-watch-remove="${lx(p.uuid)}">Remove saved player</button></div></article>`,
        )
        .join(
          "",
        )}</div>${!players.length ? '<section class="big-empty watch-empty"><span aria-hidden="true">☆</span><h2>Your next rival is out there.</h2><p>Open a published player’s profile and choose Save player. Compare their earned placements here whenever you return.</p><a class="button" href="#rankings">Explore the player index</a></section>' : ""}${[
        ...saved,
      ]
        .filter((id) => !data.players.some((p) => p.uuid === id))
        .map(
          (id) =>
            `<p class="unavailable-save">A saved profile is no longer published. <button class="text-button" data-watch-remove="${lx(id)}">Remove unavailable profile</button></p>`,
        )
        .join("")}`;
    main
      .querySelectorAll("[data-watch-player]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            profile(
              data.players.find((p) => p.uuid === b.dataset.watchPlayer),
            )),
      );
    main.querySelectorAll("[data-watch-remove]").forEach(
      (b) =>
        (b.onclick = () => {
          onRemove(b.dataset.watchRemove);
          render();
        }),
    );
    main.querySelectorAll("[data-watch-compare]").forEach(
      (b) =>
        (b.onclick = () => {
          onCompare(b.dataset.watchCompare);
          b.setAttribute(
            "aria-pressed",
            String(selected.has(b.dataset.watchCompare)),
          );
          b.textContent = selected.has(b.dataset.watchCompare)
            ? "Added to comparison"
            : "Add to comparison";
        }),
    );
  };
  render();
}

export function renderLeagueInsights({ main, config, data, testing }) {
  main.innerHTML =
    leagueIntro(
      "Read the field.",
      "A transparent view of this community’s published placements. Filter the real data and see the shape of the competition.",
    ) +
    `<section class="insight-toolbar"><label>Discipline<select id="insight-mode"><option value="all">All disciplines</option>${leagueOptions(config)}</select></label><label>Region<select id="insight-region">${leagueRegionOptions()}</select></label><a class="button secondary" href="#results">Read the match evidence</a></section><div id="insight-summary" class="insight-summary"></div><div class="insight-layout"><section class="insight-panel"><h2>The tier distribution</h2><p>Active placements in your selection. One player may hold several disciplines.</p><div id="tier-distribution"></div></section><section class="insight-panel"><h2>Discipline participation</h2><p>Published active placements, not an estimate of popularity.</p><div id="mode-distribution"></div></section></div><section class="insight-footnote"><span aria-hidden="true">ⓘ</span><p>Retired placements are excluded. Revoked results are removed by the official feed. Feed activity is capped at the most recent 100 results; it is not an all-time test total.</p></section>`;
  const draw = () => {
    const mode = main.querySelector("#insight-mode").value,
      region = main.querySelector("#insight-region").value;
    const entries = data.players.flatMap((p) =>
      Object.entries(p.rankings)
        .filter(
          ([id, r]) =>
            !r.retired &&
            (mode === "all" || id === mode) &&
            (region === "all" || (r.region || p.region) === region),
        )
        .map(([id, r]) => ({ uuid: p.uuid, mode: id, tier: leagueTier(r) })),
    );
    const count = entries.length,
      unique = new Set(entries.map((e) => e.uuid)).size;
    main.querySelector("#insight-summary").innerHTML =
      `<article><strong id="insight-total">${count}</strong><span>Active placements</span></article><article><strong>${unique}</strong><span>Distinct players</span></article><article><strong>${(data.recent || []).filter((r) => (mode === "all" || r.mode === mode) && (region === "all" || r.region === region)).length}</strong><span>Results in current feed</span></article><article><strong>${(testing.sessions || []).filter((s) => s.status === "open" && (mode === "all" || s.mode === mode) && (region === "all" || s.region === region)).length}</strong><span>Open testing sessions</span></article>`;
    main.querySelector("#tier-distribution").innerHTML = count
      ? Object.keys(config.points)
          .map((t) => {
            const n = entries.filter((e) => e.tier === t).length,
              pct = Math.round((n / count) * 100);
            return `<div class="distribution-row"><span class="rank-token rank-token-${t.slice(-1)}">${t}</span><meter min="0" max="${count}" value="${n}" aria-label="${t}: ${n} placements">${n}</meter><strong>${n}</strong><small>${pct}%</small></div>`;
          })
          .join("")
      : '<div class="quiet-empty"><p>No active placements match this selection. Published results will make this distribution visible.</p></div>';
    main.querySelector("#mode-distribution").innerHTML = config.modes
      .filter((m) => mode === "all" || m.id === mode)
      .map((m) => {
        const n = entries.filter((e) => e.mode === m.id).length;
        return `<div class="mode-distribution-row"><img src="./assets/${lx(m.id)}.svg" alt="" width="32" height="32"><span>${lx(m.name)}</span><strong>${n}</strong><meter min="0" max="${Math.max(count, 1)}" value="${n}" aria-label="${lx(m.name)}: ${n} active placements">${n}</meter></div>`;
      })
      .join("");
  };
  main.querySelector("#insight-mode").onchange = draw;
  main.querySelector("#insight-region").onchange = draw;
  draw();
}

export function renderLeaguePlanner({ main, config }) {
  const tiers = Object.keys(config.points).reverse();
  main.innerHTML =
    leagueIntro(
      "Know the next step.",
      "Explore the ten tiers, their published point values and the testing path for your chosen Mace discipline.",
    ) +
    `<div class="planner-layout"><section class="planner-controls"><h2>Set your sights</h2><label>Discipline<select id="planner-mode">${leagueOptions(config)}</select></label><label>Starting tier<select id="planner-current"><option value="unranked">Unranked</option>${tiers.map((t) => `<option>${t}</option>`).join("")}</select></label><label>Explore a target<select id="planner-target">${tiers.map((t) => `<option${t === "HT3" ? " selected" : ""}>${t}</option>`).join("")}</select></label><p class="fine">This is a guide to the published point system. An application still checks verification, current rank and eligibility in Discord.</p></section><section class="planner-result" id="planner-result" aria-live="polite"></section></div><section class="tier-scale"><h2>Every placement on the ladder</h2><div>${tiers.map((t) => `<button data-explore-tier="${t}"><span class="rank-token rank-token-${t.slice(-1)}">${t}</span><strong>${config.points[t]}</strong><small>points</small></button>`).join("")}</div></section>`;
  const draw = () => {
    const start = main.querySelector("#planner-current").value,
      target = main.querySelector("#planner-target").value,
      mode = main.querySelector("#planner-mode").value;
    const gap = config.points[target] - (config.points[start] || 0),
      high = ["HT3", "LT2", "HT2", "LT1", "HT1"].includes(target);
    const path = high
      ? "#test-desk?" + new URLSearchParams({ mode, tier: target })
      : "#testing?" + new URLSearchParams({ mode });
    main.querySelector("#planner-result").innerHTML =
      `<div class="planner-target-mark tier-${target.slice(-1)}"><span>${target}</span><small>Target placement</small></div><p id="planner-gap"><strong>${Math.abs(gap)} points</strong> ${gap >= 0 ? "above" : "below"} ${start === "unranked" ? "an unranked starting point" : lx(start)}</p><h2>${config.points[target]} earned points.</h2><p>${high ? "High-tier promotions follow opponent sets, recorded phases and independent review." : "Start with a qualified tester in an open evaluation session."} Scores and recorded evidence determine a placement; this calculator is not a prediction or a promise of a rank.</p><a class="button" id="planner-next" href="${lx(path)}">${high ? "Explore the " + target + " test" : "Find an evaluation session"}</a><a class="subtle-link" href="#kits">Read loadouts & assessment rules</a>`;
    main
      .querySelectorAll("[data-explore-tier]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.exploreTier === target),
        ),
      );
  };
  ["#planner-current", "#planner-target", "#planner-mode"].forEach(
    (id) => (main.querySelector(id).onchange = draw),
  );
  main.querySelectorAll("[data-explore-tier]").forEach(
    (b) =>
      (b.onclick = () => {
        main.querySelector("#planner-target").value = b.dataset.exploreTier;
        draw();
      }),
  );
  draw();
}
