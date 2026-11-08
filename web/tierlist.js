const main = document.querySelector("main"),
  modal = document.querySelector("dialog"),
  body = document.querySelector("#modal-body");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let config,
  data,
  testing,
  mode = "sword",
  region = "all",
  search = "",
  view = "board",
  preview = false,
  selected = new Set(),
  modeGroup = "main",
  compact = false,
  sessionRegion = "all",
  sessionStatus = "all";
const kit = (id) => config.modes.find((m) => m.id === id),
  art = (id) => `<img src="./assets/${esc(id)}.svg" alt="">`,
  label = (r) => (r.pos === 0 ? "HT" : "LT") + r.tier,
  chip = (r) => `<span class="chip t${r.tier}">${label(r)}</span>`;
const safeUrl = (s) => {
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? esc(u.href) : "#";
  } catch {
    return "#";
  }
};
const toast = (s) => {
  const t = document.querySelector("#toast");
  t.textContent = s;
  t.style.display = "block";
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => (t.style.display = "none"), 4000);
};
function download(content, name, type = "application/json") {
  const u = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function show(html) {
  body.innerHTML = html;
  if (!modal.open) modal.showModal();
}
const demoPlayers = () =>
  Array.from({ length: 10 }, (_, i) => ({
    uuid: `preview-${i}`,
    name: `PreviewPlayer${i + 1}`,
    region: ["EU", "NA", "AS"][i % 3],
    points: Object.values(config.points)[i],
    rankings: {
      [mode === "overall" ? "sword" : mode]: {
        tier: Math.floor(i / 2) + 1,
        pos: i % 2,
        retired: false,
        peak_tier: Math.floor(i / 2) + 1,
        peak_pos: i % 2,
      },
    },
    demo: true,
  }));
const source = () => (preview ? demoPlayers() : data.players);
const avatar = (p) =>
  p.demo
    ? `<svg class="avatar" viewBox="0 0 8 8" aria-hidden="true"><rect width="8" height="8" fill="#426079"/><path d="M1 2h6v5H1z" fill="#96b2b8"/><path d="M2 3h1v1H2m3-1h1v1H5M3 6h2" stroke="#253e51"/></svg>`
    : `<img class="avatar" src="https://mc-heads.net/avatar/${encodeURIComponent(p.uuid)}/64" alt="" loading="lazy" referrerpolicy="no-referrer">`;
const points = (p) =>
  Object.values(p.rankings).reduce(
    (s, r) => s + (r.retired ? 0 : config.points[label(r)] || 0),
    0,
  );
const intro = (title, description) =>
  `<section class="page-title"><div><div class="eyebrow">Minecraft PvP Tierlist</div><h1>${title}</h1><p class="subtitle">${description}</p></div></section>`;
const selectModes = (id) =>
  `<select id="${id}">${config.modes.map((m) => `<option value="${m.id}" ${mode === m.id ? "selected" : ""}>${m.name}</option>`).join("")}</select>`;
function render() {
  document.querySelector(".compare-dock")?.remove();
  const route = location.hash.slice(1).split("?")[0] || "rankings";
  document.querySelectorAll("nav a").forEach((a) => {
    a.classList.toggle("active", a.hash === "#" + route);
    if (a.hash === "#" + route) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.title = `${{ rankings: "Rankings", testing: "Testing center", kits: "Kits & rules", tagger: "Tier tagger", sponsors: "Support us", about: "Rules & privacy", staff: "Staff console" }[route] || "Rankings"} · Minecraft PvP Tierlist`;
  (
    ({ rankings, testing: testingPage, kits, tagger, sponsors, about, staff })[
      route
    ] || rankings
  )();
  const id = new URLSearchParams(location.hash.split("?")[1]).get("player");
  if (id) {
    const p = data.players.find((p) => p.uuid === id);
    if (p) profile(p);
    else toast("This player does not have a published tier here yet.");
  }
}
function rankings() {
  const visibleModes = config.modes.filter(
    (m) =>
      modeGroup === "all" ||
      (modeGroup === "main"
        ? m.group === "Main modes"
        : m.group === "Submodes"),
  );
  main.innerHTML =
    intro(
      "The arena is yours.",
      "Independent Minecraft PvP testing. Choose your kit. Earn your place.",
    ) +
    '<section class="rankings-hub"><div class="mode-toolbar"><div class="segmented" aria-label="Mode category">' +
    [
      ["main", "Main modes"],
      ["sub", "Submodes"],
      ["all", "All modes"],
    ]
      .map(
        ([id, name]) =>
          '<button data-mode-group="' +
          id +
          '" class="' +
          (modeGroup === id ? "active" : "") +
          '" aria-pressed="' +
          (modeGroup === id) +
          '">' +
          name +
          "</button>",
      )
      .join("") +
    '</div><button class="text-button" id="browse-modes">Browse kits <kbd>Ctrl / ⌘ K</kbd></button></div>' +
    '<div class="modes" role="group" aria-label="Game mode">' +
    [{ id: "overall", name: "Overall" }, ...visibleModes]
      .map(
        (m) =>
          '<button class="mode ' +
          (mode === m.id ? "active" : "") +
          '" data-mode="' +
          m.id +
          '" aria-pressed="' +
          (mode === m.id) +
          '">' +
          (m.id === "overall"
            ? '<span class="overall-symbol" aria-hidden="true">♜</span>'
            : art(m.id)) +
          m.name +
          "</button>",
      )
      .join("") +
    "</div></section>" +
    '<div class="workspace"><section class="competition-panel"><div class="kit-heading"><div class="kit-title">' +
    (mode === "overall" ? '<span class="overall-symbol">♜</span>' : art(mode)) +
    "<div><h2>" +
    (mode === "overall" ? "Overall rankings" : kit(mode).name + " rankings") +
    "</h2><p>" +
    (mode === "overall"
      ? "Combined points from active placements."
      : kit(mode).description) +
    '</p></div></div><a href="#testing" class="button secondary">Get tested</a></div>' +
    '<div class="filters"><div class="search"><span aria-hidden="true">⌕</span><input id="search" type="search" aria-label="Search players" placeholder="Find a player…" value="' +
    esc(search) +
    '"><kbd>/</kbd></div><select id="region" aria-label="Region">' +
    ["all", "EU", "NA", "AS", "SA", "AU", "AF", "ME", "OC"]
      .map(
        (r) =>
          '<option value="' +
          r +
          '" ' +
          (region === r ? "selected" : "") +
          ">" +
          (r === "all" ? "All regions" : r) +
          "</option>",
      )
      .join("") +
    '</select><div class="segmented" aria-label="Ranking view"><button data-view="board" class="' +
    (view === "board" ? "active" : "") +
    '" aria-pressed="' +
    (view === "board") +
    '">Tier board</button><button data-view="list" class="' +
    (view === "list" ? "active" : "") +
    '" aria-pressed="' +
    (view === "list") +
    '">Leaderboard</button></div><button id="density" class="density-button" aria-label="Toggle compact rows" aria-pressed="' +
    compact +
    '">' +
    (compact ? "Comfortable" : "Compact") +
    '</button></div><div id="preview-label"></div><div id="rankings-content"></div><div class="rank-note"><span id="rank-count"></span><span>' +
    (data.updatedAt
      ? "Published " + esc(new Date(data.updatedAt).toLocaleString())
      : "First verified results coming after testing opens") +
    ' · <button id="preview-toggle">' +
    (preview ? "Exit preview" : "Preview the layout") +
    '</button></span></div><div class="section-heading"><h2>Latest placements</h2><a href="#testing">Testing center ↗</a></div>' +
    activity() +
    "</section>" +
    '<aside class="sidebar"><div class="side-card testing"><div class="label"><span class="light"></span>' +
    (testing.activation === "active"
      ? "Testing availability"
      : "Preparing for launch") +
    '</div><h3>Ready for your placement?</h3><p>Get matched with a tester in your mode and region. Your first tier starts with a fair test.</p><div class="testing-totals"><div><strong>' +
    data.players.length +
    "</strong><span>Ranked players</span></div><div><strong>" +
    testing.sessions.filter((s) => s.status === "open").length +
    '</strong><span>Open sessions</span></div></div><a href="#testing" class="button">Find a session ↗</a><p class="fine">' +
    (testing.activation === "active"
      ? "Confirm current availability in Discord."
      : "Sessions open when the testing team is ready.") +
    '</p></div><div class="side-card"><h3>Know the tiers</h3><p>Each tier has a high and low band. HT1 is the highest placement.</p><div class="tier-legend">' +
    [1, 2, 3, 4, 5]
      .map(
        (t) =>
          '<div><img src="./assets/tier-' +
          t +
          '.svg" alt=""><span>Tier ' +
          t +
          "</span>" +
          chip({ tier: t, pos: 0 }) +
          chip({ tier: t, pos: 1 }) +
          "</div>",
      )
      .join("") +
    '</div><a class="link-row" href="#kits">Kits & testing rules <span>↗</span></a></div></aside></div>';
  const hero = main.querySelector(".page-title");
  hero.classList.add("arena-hero");
  hero
    .querySelector("div")
    .insertAdjacentHTML(
      "beforeend",
      '<div class="hero-actions"><a class="button" href="#testing">Start your tier test</a><a class="hero-secondary" href="#kits">Explore the kits</a></div>',
    );
  main.querySelectorAll("[data-mode-group]").forEach(
    (b) =>
      (b.onclick = () => {
        modeGroup = b.dataset.modeGroup;
        if (
          mode !== "overall" &&
          !config.modes
            .filter(
              (m) =>
                modeGroup === "all" ||
                (modeGroup === "main"
                  ? m.group === "Main modes"
                  : m.group === "Submodes"),
            )
            .some((m) => m.id === mode)
        )
          mode = modeGroup === "sub" ? "mace_spear" : "sword";
        rankings();
      }),
  );
  main.querySelectorAll("[data-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        mode = b.dataset.mode;
        if (mode === "overall") view = "list";
        rankings();
      }),
  );
  main.querySelector("#browse-modes").onclick = browseModes;
  main.querySelector("#search").oninput = (e) => {
    search = e.target.value;
    renderBoard();
  };
  main.querySelector("#region").onchange = (e) => {
    region = e.target.value;
    renderBoard();
  };
  main.querySelectorAll("[data-view]").forEach(
    (b) =>
      (b.onclick = () => {
        view = b.dataset.view;
        if (mode === "overall" && view === "board") {
          mode = "sword";
          modeGroup = "main";
        }
        rankings();
      }),
  );
  main.querySelector("#density").onclick = () => {
    compact = !compact;
    rankings();
  };
  main.querySelector("#preview-toggle").onclick = () => {
    preview = !preview;
    selected.clear();
    rankings();
  };
  main.querySelector(".competition-panel").classList.toggle("compact", compact);
  renderBoard();
}
function browseModes() {
  show(
    '<h2>Choose your kit</h2><p class="fine">Main modes and specialist submodes belong to this tierlist.</p><label class="field">Search kits<input type="search" id="kit-search" placeholder="Sword, Mace, Bow…" autocomplete="off"></label><div class="kit-picker" id="kit-picker"></div>',
  );
  const draw = () => {
    const q = body.querySelector("#kit-search").value.toLowerCase();
    body.querySelector("#kit-picker").innerHTML =
      config.modes
        .filter((m) => m.name.toLowerCase().includes(q))
        .map(
          (m) =>
            '<button data-pick="' +
            m.id +
            '">' +
            art(m.id) +
            "<span><strong>" +
            m.name +
            "</strong><small>" +
            m.group +
            '</small></span><span aria-hidden="true">↗</span></button>',
        )
        .join("") || '<p class="fine">No matching kits. Try another name.</p>';
    body.querySelectorAll("[data-pick]").forEach(
      (b) =>
        (b.onclick = () => {
          mode = b.dataset.pick;
          modeGroup = kit(mode).group === "Main modes" ? "main" : "sub";
          view = "board";
          modal.close();
          if (location.hash !== "#rankings") location.hash = "rankings";
          else rankings();
        }),
    );
  };
  body.querySelector("#kit-search").oninput = draw;
  draw();
  body.querySelector("#kit-search").focus();
}
function renderBoard() {
  const rows = source()
    .filter(
      (p) =>
        (region === "all" || p.region === region) &&
        p.name.toLowerCase().includes(search.toLowerCase()) &&
        (mode === "overall" || (p.rankings[mode] && !p.rankings[mode].retired)),
    )
    .sort((a, b) =>
      mode === "overall"
        ? points(b) - points(a) || a.name.localeCompare(b.name)
        : config.points[label(b.rankings[mode])] -
            config.points[label(a.rankings[mode])] ||
          a.name.localeCompare(b.name),
    );
  main.querySelector("#preview-label").innerHTML = preview
    ? '<div class="preview-notice">Layout preview · Sample players only. Not real rankings.<button id="exit-preview">Exit preview</button></div>'
    : "";
  main.querySelector("#exit-preview")?.addEventListener("click", () => {
    preview = false;
    selected.clear();
    rankings();
  });
  main.querySelector("#rank-count").textContent =
    `${rows.length} ${preview ? "sample" : "ranked"} players · ${mode === "overall" ? "Overall" : kit(mode).name}`;
  let html;
  if (view === "board" && mode !== "overall")
    html = `<div class="board" tabindex="0" aria-label="Five tier columns; scroll horizontally on narrow screens">${[
      1, 2, 3, 4, 5,
    ]
      .map(
        (t) =>
          `<section class="tier-column"><div class="tier-heading"><span class="tier-number"><img src="./assets/tier-${t}.svg" alt=""> Tier ${t}</span><span class="count">${rows.filter((p) => p.rankings[mode].tier === t).length}</span></div>${[
            0, 1,
          ]
            .map(
              (pos) =>
                `<div class="tier-band">${pos === 0 ? "High" : "Low"} tier ${t}</div>${
                  rows
                    .filter(
                      (p) =>
                        p.rankings[mode].tier === t &&
                        p.rankings[mode].pos === pos,
                    )
                    .map(
                      (p) =>
                        `<button class="player-entry" data-player="${p.uuid}">${avatar(p)}<span><strong>${esc(p.name)}</strong><small>${p.region}${p.demo ? " · Preview" : ""}</small></span></button>`,
                    )
                    .join("") ||
                  `<div class="empty-band"><span aria-hidden="true">—</span> No placements</div>`
                }`,
            )
            .join("")}</section>`,
      )
      .join("")}</div>`;
  else
    html = rows.length
      ? `<div class="table-wrap"><table><thead><tr><th>Rank</th><th>Player</th><th>Region</th><th>${mode === "overall" ? "Tiers" : "Tier"}</th><th>Points</th><th>Compare</th></tr></thead><tbody>${rows
          .map(
            (p, i) =>
              `<tr class="placement-${Math.min(i + 1, 4)}"><td><span class="rank-position">${i + 1}</span></td><td><button class="table-player" data-player="${p.uuid}">${avatar(p)}<span>${esc(p.name)}<small>${p.demo ? "Sample player" : "Verified test results"}</small></span></button></td><td>${p.region}</td><td><div class="chips">${Object.entries(
                p.rankings,
              )
                .filter(
                  ([id, r]) =>
                    !r.retired && (mode === "overall" || mode === id),
                )
                .map(
                  ([id, r]) =>
                    `<span title="${kit(id)?.name || id}">${chip(r)}</span>`,
                )
                .join(
                  "",
                )}</div></td><td>${mode === "overall" ? points(p) : config.points[label(p.rankings[mode])]}</td><td><input class="check" type="checkbox" data-compare="${p.uuid}" aria-label="Compare ${esc(p.name)}" ${selected.has(p.uuid) ? "checked" : ""}></td></tr>`,
          )
          .join("")}</tbody></table></div>`
      : `<div class="big-empty">${art("sword")}<h3>The next name could be yours.</h3><p>No published results match this view. Earn a placement through our testing system.</p><a href="#testing" class="button">Explore testing ↗</a></div>`;
  const filteredEmpty = rows.length === 0 && (search || region !== "all");
  const filterNotice = filteredEmpty
    ? '<div class="filter-empty"><strong>No matching players</strong><span>Try another name or region.</span><button id="clear-filters">Clear filters</button></div>'
    : "";
  main.querySelector("#rankings-content").innerHTML = filterNotice + html;
  main.querySelector("#clear-filters")?.addEventListener("click", () => {
    search = "";
    region = "all";
    rankings();
  });
  main
    .querySelectorAll("[data-player]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          profile(rows.find((p) => p.uuid === b.dataset.player))),
    );
  main.querySelectorAll("[data-compare]").forEach(
    (b) =>
      (b.onchange = () => {
        if (b.checked && selected.size >= 2) {
          b.checked = false;
          toast("Choose two players to compare.");
          return;
        }
        b.checked
          ? selected.add(b.dataset.compare)
          : selected.delete(b.dataset.compare);
        compareDock();
      }),
  );
  compareDock();
}
function compareDock() {
  document.querySelector(".compare-dock")?.remove();
  if (!selected.size) return;
  const el = document.createElement("div");
  el.className = "compare-dock";
  const ps = [...selected]
    .map((id) => source().find((p) => p.uuid === id))
    .filter(Boolean);
  el.innerHTML = `<span>${ps.map((p) => esc(p.name)).join(" vs ")}</span><button id="compare" ${ps.length < 2 ? "disabled" : ""}>Compare tiers</button><button id="clear-compare" aria-label="Clear comparison">×</button>`;
  document.body.append(el);
  el.querySelector("#clear-compare").onclick = () => {
    selected.clear();
    renderBoard();
  };
  el.querySelector("#compare").onclick = () =>
    show(
      `<h2>Player comparison</h2><p class="fine">${preview ? "Sample data preview." : "Our tierlist results only. Comparisons do not predict a match."}</p><div class="table-wrap"><table><thead><tr><th>Kit</th>${ps.map((p) => `<th>${esc(p.name)}</th>`).join("")}</tr></thead><tbody>${config.modes.map((m) => `<tr><td>${m.name}</td>${ps.map((p) => `<td>${p.rankings[m.id] ? chip(p.rankings[m.id]) : "Unranked"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,
    );
}
function profile(p) {
  show(
    `<div class="player-profile">${avatar(p)}<div><h2>${esc(p.name)}</h2><p class="fine">${p.region} · ${points(p)} points${p.demo ? " · Sample player, not a real placement" : ""}</p></div></div><div class="profile-grid">${Object.entries(
      p.rankings,
    )
      .map(
        ([id, r]) =>
          `<div class="profile-kit">${art(id)}<div>${kit(id)?.name || esc(id)}<small>Peak ${r.peak_tier ? label({ tier: r.peak_tier, pos: r.peak_pos }) : label(r)}${r.retired ? " · Retired" : ""}</small></div>${chip(r)}</div>`,
      )
      .join(
        "",
      )}</div><div class="actions"><button class="button" id="share" ${p.demo ? "disabled" : ""}>Copy profile link</button><button class="button secondary" id="card">Download player card</button></div><h2 style="margin-top:25px">Test history</h2>${
      (data.recent || [])
        .filter((r) => r.uuid === p.uuid)
        .map(
          (r) =>
            `<div class="activity">${art(r.mode)}<strong>${kit(r.mode)?.name}</strong>${chip(r)}<a href="${safeUrl(r.evidence)}" target="_blank" rel="noopener">Evidence ↗</a><small>${esc(new Date(r.created).toLocaleDateString())}</small></div>`,
        )
        .join("") || '<p class="fine">No public test history available.</p>'
    }`,
  );
  body.querySelector("#share").onclick = async () => {
    try {
      await navigator.clipboard.writeText(
        `${location.href.split("#")[0]}#rankings?player=${encodeURIComponent(p.uuid)}`,
      );
      toast("Profile link copied.");
    } catch {
      toast("Clipboard unavailable in this browser.");
    }
  };
  body.querySelector("#card").onclick = () =>
    download(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500"><rect width="1000" height="500" fill="#080b12"/><path d="M750 0h250v500H550z" fill="#142c3b"/><text x="60" y="90" fill="#69d6ed" font-family="sans-serif" font-size="22">MINECRAFT PvP TIERLIST${p.demo ? " · PREVIEW" : ""}</text><text x="60" y="200" fill="white" font-family="sans-serif" font-size="58">${esc(p.name)}</text><text x="60" y="260" fill="#a1adc1" font-family="sans-serif" font-size="25">${p.region} · ${points(p)} points</text>${Object.entries(
        p.rankings,
      )
        .slice(0, 8)
        .map(
          ([id, r], i) =>
            `<text x="${60 + (i % 4) * 230}" y="${330 + Math.floor(i / 4) * 50}" fill="#efc275" font-family="sans-serif" font-size="18">${esc(kit(id)?.name || id)} ${label(r)}</text>`,
        )
        .join(
          "",
        )}<text x="60" y="465" fill="#8394ae" font-family="sans-serif" font-size="17">One tierlist. Earned in game.${p.demo ? " Sample data only." : ""}</text></svg>`,
      `${p.name}-tier-card.svg`,
      "image/svg+xml",
    );
}
function activity() {
  return (data.recent || []).length
    ? `<div class="activity-list">${data.recent
        .slice(0, 6)
        .map(
          (r) =>
            `<div class="activity">${art(r.mode)}<strong>${esc(r.name)}</strong><span class="empty-label">${kit(r.mode)?.name}</span>${chip(r)}<small>${esc(new Date(r.created).toLocaleDateString())}</small></div>`,
        )
        .join("")}</div>`
    : '<div class="activity-empty">Verified test results will appear here. No imported ranks or invented placements.</div>';
}
function testingPage() {
  main.innerHTML =
    intro(
      "Your next tier starts here.",
      "Choose your kit. Find a session. Earn a result through our independent testing team.",
    ) +
    `<div class="notice">${testing.activation === "active" ? "Availability below reflects the latest published testing snapshot. Confirm your place in Discord." : "Live Discord testing has not been activated yet. Build your request below; it does not enter you into a queue."}</div><div class="sessions">${config.modes
      .map((m) => {
        const s =
          testing.sessions.find(
            (s) => s.mode === m.id && s.region === region,
          ) || testing.sessions.find((s) => s.mode === m.id);
        return `<article class="session">${art(m.id)}<h3>${m.name}</h3><span class="badge ${s?.status === "open" ? "open" : ""}">${s?.status === "open" ? "Open · " + esc(s.region) : s?.status === "paused" ? "Paused" : "Not scheduled"}</span><p>${s ? `${s.waiting || 0} waiting · ${s.claimed || 0} in testing` : "A tester must open a session."}</p><a href="#request" data-request="${m.id}">Prepare request ↗</a></article>`;
      })
      .join(
        "",
      )}</div><div class="section-heading"><h2>Prepare your test request</h2></div><div class="two-col"><section class="panel" id="request"><form id="request-form"><div class="form-grid"><label class="field">Minecraft username<input name="name" required minlength="3" maxlength="16" pattern="[A-Za-z0-9_]{3,16}" placeholder="Your in-game name"></label><label class="field">Region<select name="region">${["EU", "NA", "AS", "SA", "AU", "AF", "ME", "OC"].map((r) => `<option>${r}</option>`).join("")}</select></label><label class="field">Testing mode${selectModes("request-mode")}</label><label class="field">Availability<input name="availability" required maxlength="100" placeholder="e.g. Saturday 16:00–18:00 UTC"></label></div><label class="field"><span><input type="checkbox" name="rules" required> I have read the kit rules and will verify account ownership with staff.</span></label><button class="button" type="submit">Create request summary</button><p class="fine">Your entries stay in this browser. Share the summary in our Discord to request testing. This form does not verify your account or reserve a queue position.</p></form></section><section class="panel steps">${[
      [
        "Verify your Minecraft account",
        "Staff confirm ownership before you can join an open queue. A username alone is not verification.",
      ],
      [
        "Join a session",
        "Use /queue join with your mode and region. Sessions have a capacity limit and a retest cooldown.",
      ],
      [
        "Play your test",
        "One tester claims your entry. Agree on equipment, arena and evidence before the match.",
      ],
      [
        "Review and appeal",
        "Your result is recorded with evidence. A different reviewer handles an appeal.",
      ],
    ]
      .map(
        ([t, d]) =>
          `<div class="step"><div><h3>${t}</h3><p>${d}</p></div></div>`,
      )
      .join(
        "",
      )}</section></div><div class="section-heading"><h2>Recent testing results</h2></div>${activity()}`;
  const sessions = main.querySelector(".sessions");
  sessions.insertAdjacentHTML(
    "beforebegin",
    '<div class="section-heading"><h2>Find a testing session</h2><span class="badge">Published availability</span></div><div class="session-filters filters"><label>Region <select id="session-region">' +
      ["all", "EU", "NA", "AS", "SA", "AU", "AF", "ME", "OC"]
        .map(
          (r) =>
            '<option value="' +
            r +
            '" ' +
            (sessionRegion === r ? "selected" : "") +
            ">" +
            (r === "all" ? "All regions" : r) +
            "</option>",
        )
        .join("") +
      '</select></label><label>Availability <select id="session-status"><option value="all">All sessions</option><option value="open">Open now</option><option value="paused">Paused</option></select></label><span id="session-count" class="fine"></span></div>',
  );
  main.querySelector("#session-status").value = sessionStatus;
  const drawSessions = () => {
    let count = 0;
    sessions.innerHTML =
      config.modes
        .map((m) => {
          const matches = testing.sessions.filter(
            (s) =>
              s.mode === m.id &&
              (sessionRegion === "all" || s.region === sessionRegion),
          );
          const eligible =
            sessionStatus === "all"
              ? matches
              : matches.filter((s) => s.status === sessionStatus);
          if (sessionStatus !== "all" && !eligible.length) return "";
          const session =
            eligible.find((s) => s.status === "open") ||
            eligible.find((s) => s.status === "paused") ||
            eligible[0];
          count++;
          const state =
            session?.status === "open"
              ? "open"
              : session?.status === "paused"
                ? "paused"
                : "closed";
          return (
            '<article class="session session-' +
            state +
            '">' +
            art(m.id) +
            "<small>" +
            m.group +
            "</small><h3>" +
            m.name +
            '</h3><span class="badge ' +
            (state === "open" ? "open" : "") +
            '">' +
            (state === "open"
              ? "Open · " + esc(session.region)
              : state === "paused"
                ? "Paused · " + esc(session.region)
                : "Not scheduled") +
            "</span><p>" +
            (session
              ? (session.waiting || 0) +
                " waiting · " +
                (session.claimed || 0) +
                " in testing"
              : "Staff announce availability before queues open.") +
            '</p><a href="#request" data-request="' +
            m.id +
            '" data-request-region="' +
            (session?.region || "") +
            '">Prepare request <span>↗</span></a></article>'
          );
        })
        .join("") ||
      '<div class="activity-empty session-empty">No ' +
        (sessionStatus === "open" ? "open" : "matching") +
        " sessions in this region. Choose another filter or prepare a request below.</div>";
    main.querySelector("#session-count").textContent = count + " kits shown";
    sessions.querySelectorAll("[data-request]").forEach(
      (a) =>
        (a.onclick = (e) => {
          e.preventDefault();
          main.querySelector("#request-mode").value = a.dataset.request;
          if (a.dataset.requestRegion)
            main.querySelector("[name=region]").value = a.dataset.requestRegion;
          main
            .querySelector("#request")
            .scrollIntoView?.({ behavior: "smooth", block: "center" });
          main.querySelector("input[name=name]").focus();
        }),
    );
  };
  main.querySelector("#session-region").onchange = (e) => {
    sessionRegion = e.target.value;
    drawSessions();
  };
  main.querySelector("#session-status").onchange = (e) => {
    sessionStatus = e.target.value;
    drawSessions();
  };
  drawSessions();
  main.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      request = {
        name: f.get("name"),
        region: f.get("region"),
        mode: main.querySelector("#request-mode").value,
        availability: f.get("availability"),
      };
    const text = `Tier test request\nUsername: ${request.name}\nMode: ${kit(request.mode).name}\nRegion: ${request.region}\nAvailable: ${request.availability}\nAccount ownership: pending staff verification`;
    show(
      `<h2>Your testing request</h2><p class="fine">Prepared locally. Share this in Discord; no queue entry has been created.</p><pre style="white-space:pre-wrap;line-height:1.8">${esc(text)}</pre><div class="actions"><button class="button" id="request-copy">Copy summary</button><button class="button secondary" id="request-download">Download request</button><a class="button secondary" href="${config.invite}" target="_blank" rel="noopener">Open Discord ↗</a></div>`,
    );
    body.querySelector("#request-copy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(text);
        toast("Request copied. Share it in Discord.");
      } catch {
        toast("Clipboard unavailable. Use the download button.");
      }
    };
    body.querySelector("#request-download").onclick = () =>
      download(text, "tier-test-request.txt", "text/plain");
  };
}
function kits() {
  main.innerHTML =
    intro(
      "Know your kit. Own your fight.",
      "Dedicated rankings for main modes and submodes. Agree on the exact kit with your tester before every test.",
    ) +
    `<div class="grid">${config.modes.map((m) => `<article class="kit-card">${art(m.id)}<small>${m.group}</small><h3>${m.name}</h3><p>${m.description}</p><button data-rules="${m.id}">Kit rules & testing ↗</button></article>`).join("")}</div><div class="notice">Main modes and submodes are independently scored in this tierlist. Proposed specialist kit rules must be announced by staff before their first testing session.</div>`;
  main.querySelectorAll("[data-rules]").forEach(
    (b) =>
      (b.onclick = () => {
        const m = kit(b.dataset.rules);
        show(
          `<h2>${m.name} testing</h2>${art(m.id)}<p class="fine">${m.description}</p><ul>${m.rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul><p class="fine">Default retest cooldown: ${config.testing.cooldownHours} hours. A session can announce a different cooldown before it opens. HT1–HT3 results can require additional staff review under the published kit rubric.</p><a class="button" href="#testing" id="kit-request">Prepare a ${m.name} request</a>`,
        );
        body.querySelector("img").style.width = "75px";
        body.querySelector("#kit-request").onclick = () => {
          mode = m.id;
          modal.close();
        };
      }),
  );
}
function tagger() {
  main.innerHTML =
    intro(
      "Your tier. In the game.",
      "A dedicated tagger for this tierlist, with readable mode labels and no external ranking providers.",
    ) +
    `<div class="two-col"><section class="panel"><div class="tag-scene"><div class="nametag"><span id="tag-label">[Sword HT3]</span> YourName</div></div><label class="field" style="margin-top:20px">Preferred mode${selectModes("tag-mode")}</label><label class="field">Fallback policy<select id="tag-fallback"><option value="false">Only show the selected mode</option><option value="true">Highest active tier when selected mode is unranked</option></select></label><label class="field">Tag color<input type="color" id="tag-color" value="#69d6ed"></label><div class="actions"><button class="button" id="tag-download">Save configuration</button><a href="https://github.com/drax12341/minecraft-pvp-community/releases/tag/v0.2.0-experimental" target="_blank" rel="noopener" class="button secondary">Experimental Fabric JAR ↗</a></div><p class="fine">Illustrative preview, not your actual rank. Minecraft Java 1.21.1. The experimental build requires in-game compatibility testing.</p></section><section class="panel"><h2>Built around your placements.</h2><ul><li>Our tierlist results only, identified by Minecraft UUID.</li><li>Nametag and tablist labels with mode and tier.</li><li>Async snapshot loading; rendering never waits on a network request.</li><li>Highest-active fallback is your choice. Retired tiers are hidden by default.</li><li>Mode switching and toggles with /communitytag.</li></ul><div class="notice">A name gets a label only after a verified result is published on this tierlist. Missing players are not assigned a fake tier.</div><p>Place the downloaded configuration in your Minecraft config folder as community-tagger.json before starting the game.</p></section></div>`;
  const update = () => {
    main.querySelector("#tag-label").textContent =
      `[${kit(main.querySelector("#tag-mode").value).name} HT3]`;
    main.querySelector("#tag-label").style.color =
      main.querySelector("#tag-color").value;
  };
  main.querySelector("#tag-mode").onchange = update;
  main.querySelector("#tag-color").oninput = update;
  update();
  main.querySelector("#tag-download").onclick = () =>
    download(
      JSON.stringify(
        {
          enabled: true,
          mode: main.querySelector("#tag-mode").value,
          color: main.querySelector("#tag-color").value,
          fallback: main.querySelector("#tag-fallback").value === "true",
          showRetired: false,
        },
        null,
        2,
      ),
      "community-tagger.json",
    );
}
function sponsors() {
  main.innerHTML =
    intro(
      "Help build the arena.",
      "Support independent testing, community events and the tools that keep this tierlist open.",
    ) +
    `<div class="grid">${[
      [
        "Community supporter",
        "Help cover tools and hosting.",
        "A disclosed supporter credit and community recognition.",
      ],
      [
        "Event partner",
        "Help bring players together.",
        "Agree an event scope, placement and schedule with staff.",
      ],
      [
        "Creator partner",
        "Share something worth watching.",
        "Collaborate on kit guides, player spotlights and learning sessions.",
      ],
    ]
      .map(
        ([t, p, d]) =>
          `<article class="panel"><div class="sponsor-art">◇</div><h2>${t}</h2><p>${p}</p><p>${d}</p><a class="button secondary" href="${config.invite}" target="_blank" rel="noopener">Discuss on Discord ↗</a></article>`,
      )
      .join(
        "",
      )}</div><div class="notice">No sponsors confirmed. No payments are collected here. Support never buys tiers, faster testing or appeal decisions.</div>`;
}
function about() {
  main.innerHTML =
    intro(
      "One tierlist. Clear rules.",
      "Every placement comes from this community’s testing system.",
    ) +
    `<div class="two-col"><section class="panel"><h2>Independent rankings</h2><p>We do not import another network’s players, tiers or rating points. Each mode has HT1 through LT5. Overall points sum a player’s active placements using the published scoring table.</p><div class="chips">${Object.entries(
      config.points,
    )
      .map(
        ([t, n]) =>
          `<span class="chip t${t.slice(-1)}">${t} · ${n} points</span>`,
      )
      .join(
        " ",
      )}</div><h2 style="margin-top:25px">Testing & appeals</h2><p>Sessions open by mode and region. Account ownership must be verified by staff. A tester cannot claim their own test. Results require evidence. Appeals are private staff records and cannot be reviewed by the original tester. Revoked results remain in the audit trail and are excluded from rankings.</p><p>Do not install unknown files, share passwords or expose personal information for a test. No cheating, boosting, harassment or account sharing.</p></section><section class="panel"><h2>Privacy & freshness</h2><p>The public site reads the last published export; it is not a live queue unless the operating service is connected. No Discord member IDs or private appeal text appear in that export. No sign-in or analytics run on this static website.</p><p>Google Fonts and mc-heads.net serve fonts and avatars and receive normal network requests. Local request forms stay in your browser until you choose to copy, download or share them. Preview players are visibly marked and never become test records.</p><p>Ask staff in Discord for corrections, appeals or deletion. No affiliation with Mojang or Microsoft.</p><a class="button secondary" href="${config.invite}" target="_blank" rel="noopener">Contact staff ↗</a></section></div>`;
}
function staff() {
  main.innerHTML =
    intro(
      "Staff operations",
      "Testing operations are managed through the installed Discord bot. Public pages never accept a staff service token.",
    ) +
    `<div class="panel"><h2>Commands</h2><p>/session open · /session pause · /queue join · /claim · /result · /appeal submit · /appeal review</p><p>Account verification is restricted to moderators. Test claims and results require a tester role. Appeals require an independent moderator.</p><a class="button" href="${config.invite}" target="_blank" rel="noopener">Open staff Discord ↗</a></div>`;
}
modal.querySelector(".close").onclick = () => modal.close();
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    const r = modal.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      modal.close();
  }
});
try {
  [config, data, testing] = await Promise.all(
    ["community", "results", "testing"].map(async (p) => {
      const r = await fetch(`./data/${p}.json`);
      if (!r.ok) throw Error("Data unavailable");
      return r.json();
    }),
  );
  render();
  window.addEventListener("hashchange", render);
} catch (e) {
  main.innerHTML =
    '<div class="big-empty"><h1>The tierlist could not load.</h1><p>Refresh the page or visit Discord.</p><a class="button" href="https://discord.gg/a36rg6BxuX">Open Discord ↗</a></div>';
  console.error(e);
}

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (config) browseModes();
    return;
  }
  if (
    e.key === "/" &&
    !modal.open &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)
  ) {
    e.preventDefault();
    if (main.querySelector("#search")) main.querySelector("#search").focus();
    else {
      location.hash = "rankings";
      setTimeout(() => main.querySelector("#search")?.focus(), 0);
    }
  }
});
