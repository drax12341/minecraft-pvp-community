const main = document.querySelector("main"),
  dialog = document.querySelector("dialog");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let config,
  snapshot,
  own,
  selected = new Set(),
  mode = "overall",
  provider = "mctiers",
  region = "all",
  status = "all",
  query = "";
const modeName = (id) => config.modes.find((m) => m.id === id)?.name || id;
const tier = (r) => (r ? `${r.pos === 0 ? "HT" : "LT"}${r.tier}` : "Unranked");
const score = (r) => (r ? config.points[tier(r)] || 0 : 0);
const badge = (id, r) =>
  `<span class="tier t${r.tier}${r.retired ? " retired" : ""}" title="${esc(modeName(id))}: ${tier(r)}${r.retired ? " (retired)" : ""}"><span class="mode-short">${esc(modeName(id))}</span>${tier(r)}</span>`;
const avatar = (p) =>
  `<img class="avatar" src="https://mc-heads.net/avatar/${encodeURIComponent(p.uuid)}/64" alt="" loading="lazy" referrerpolicy="no-referrer">`;
const toast = (s) => {
  let t = document.querySelector("#toast");
  t.textContent = s;
  t.style.display = "block";
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => (t.style.display = "none"), 3500);
};
const players = () =>
  provider === "community" ? own.players : snapshot.players;
const intro = (title, text) =>
  `<div class="page-head"><h1>${title}</h1><p class="lead">${text}</p></div>`;
function render() {
  document.querySelector(".comparebar")?.remove();
  let route = location.hash.slice(1).split("?")[0] || "rankings";
  document.querySelectorAll("nav a").forEach((a) => {
    a.classList.toggle("active", a.hash === `#${route}`);
    if (a.hash === `#${route}`) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.title = `${{ rankings: "Rankings", communities: "Communities", testing: "Get tested", tagger: "Tier tagger", sponsors: "Sponsors", about: "Sources & rules" }[route] || "Rankings"} • Minecraft PvP Community`;
  if (route === "communities") communities();
  else if (route === "testing") testing();
  else if (route === "tagger") tagger();
  else if (route === "sponsors") sponsors();
  else if (route === "about") about();
  else rankings();
  const params = new URLSearchParams(location.hash.split("?")[1]);
  if (params.has("player")) {
    const p = [...snapshot.players, ...own.players].find(
      (p) => p.uuid === params.get("player"),
    );
    if (p) showProfile(p);
    else
      toast(
        "This player is not in the current snapshot. Search on the source website.",
      );
  }
}
function rankings() {
  main.innerHTML = `<section class="hero"><div><div class="eyebrow"><span class="dot"></span> Your next chapter starts here</div><h1>EVERY MODE.<br>YOUR COMMUNITY.</h1><p class="lead">Find your place in Minecraft PvP. Explore the rankings, meet your next rival, and make your next tier count.</p><div class="hero-actions"><a class="button" href="#testing">Get your first tier</a><a class="button secondary" href="#communities">Explore communities</a></div></div><div class="arena" aria-hidden="true"><svg class="swords" viewBox="0 0 180 155"><g transform="translate(22 5) rotate(-40 65 72)"><path d="M59 0h16v80H59z" fill="#afdaee"/><path d="M59 0h7v80h-7z" fill="#e3f8ff"/><path d="M43 80h48v12H43z" fill="#9cabe1"/><path d="M59 92h16v39H59z" fill="#7c628e"/><path d="M55 129h24v13H55z" fill="#c7a8d2"/></g><g transform="translate(22 5) rotate(40 65 72)"><path d="M59 0h16v80H59z" fill="#b7a1ee"/><path d="M59 0h7v80h-7z" fill="#dfd2ff"/><path d="M43 80h48v12H43z" fill="#d5bdd6"/><path d="M59 92h16v39H59z" fill="#7c628e"/><path d="M55 129h24v13H55z" fill="#c7a8d2"/></g></svg><div class="arena-label">A place for every playstyle</div></div></section><div class="strip"><span class="badge">Community launch</span><span>Help shape a new home for Minecraft players.</span><a href="${config.invite}" target="_blank" rel="noopener">Be here from the beginning ↗</a></div><div class="section-top"><h2>The leaderboard</h2><span class="muted small">Provider rankings, clearly separated.</span></div><div class="modes" role="group" aria-label="Game mode">${[{ id: "overall", name: "Overall", icon: "✦" }, ...config.modes].map((m) => `<button class="mode ${mode === m.id ? "active" : ""}" data-mode="${m.id}" aria-pressed="${mode === m.id}"><span class="icon">${m.icon}</span>${m.name}</button>`).join("")}</div><div class="rank-layout"><section><div class="toolbar"><div class="search"><span>⌕</span><input id="search" type="search" placeholder="Search a player…" aria-label="Search players" value="${esc(query)}"></div><label>Source<select id="provider"><option value="mctiers" ${provider === "mctiers" ? "selected" : ""}>MCTiers snapshot</option><option value="community" ${provider === "community" ? "selected" : ""}>Our community</option></select></label><label>Region<select id="region">${["all", "EU", "NA", "AS", "SA", "AU", "AF", "ME", "OC"].map((x) => `<option ${region === x ? "selected" : ""} value="${x}">${x === "all" ? "All regions" : x}</option>`).join("")}</select></label><label>Status<select id="status">${["all", "active", "retired"].map((x) => `<option ${status === x ? "selected" : ""} value="${x}">${x[0].toUpperCase() + x.slice(1)}</option>`).join("")}</select></label></div><div class="table-wrap" id="results"></div><div class="caption"><span id="result-count"></span><span>${provider === "mctiers" ? `Top 50 overall snapshot · ${snapshot.updatedAt ? esc(new Date(snapshot.updatedAt).toLocaleString()) : "Not yet fetched"}<br>Mode filters only cover these 50 players. <a href="https://mctiers.net/" target="_blank" rel="noopener">Full rankings ↗</a>` : "Community rankings begin with reviewed test results."}<br>Dashed tags indicate retired tiers. Select two players to compare.</span></div></section><aside class="sidebar"><div class="side-panel"><div class="side-title"><span class="badge">Make your move</span><span>⚔</span></div><h3>Good rivals.<br>Better together.</h3><p>Testing, practice partners, clips, tournaments. One Discord to bring it together.</p><a class="button" href="${config.invite}" target="_blank" rel="noopener">Join the community ↗</a></div><div class="side-panel"><h3>More than a ranking</h3><a class="mini-link" href="#testing">How testing works <span>↗</span></a><a class="mini-link" href="#tagger">Your tier, in game <span>↗</span></a><a class="mini-link" href="#communities">Find your mode <span>↗</span></a><a class="mini-link" href="#sponsors">Support the community <span>↗</span></a></div></aside></div>`;
  document.querySelectorAll("[data-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        mode = b.dataset.mode;
        rankings();
      }),
  );
  document.querySelector("#search").oninput = (e) => {
    query = e.target.value;
    renderRows();
  };
  for (const id of ["provider", "region", "status"])
    document.querySelector(`#${id}`).onchange = (e) => {
      if (id === "provider") {
        provider = e.target.value;
        selected.clear();
      } else if (id === "region") region = e.target.value;
      else status = e.target.value;
      rankings();
    };
  renderRows();
}
function filteredRankings(p) {
  return Object.entries(p.rankings).filter(
    ([id, r]) =>
      (mode === "overall" || mode === id) &&
      (status === "all" || (status === "retired" ? r.retired : !r.retired)),
  );
}
function renderRows() {
  const list = players()
    .map((p) => ({ ...p, shown: filteredRankings(p) }))
    .filter(
      (p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) &&
        (region === "all" || p.region === region) &&
        p.shown.length,
    )
    .sort((a, b) =>
      mode === "overall"
        ? b.points - a.points
        : score(b.rankings[mode]) - score(a.rankings[mode]) ||
          a.name.localeCompare(b.name),
    );
  const target = document.querySelector("#results");
  target.innerHTML = list.length
    ? `<table><thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">Region</th><th scope="col">${mode === "overall" ? "Tiers" : "Tier"}</th><th scope="col">${mode === "overall" ? "Overall pts" : "Mode pts"}</th><th scope="col">Compare</th></tr></thead><tbody>${list.map((p, i) => `<tr><td class="rank">${i + 1}</td><td><button class="player" data-player="${p.uuid}">${avatar(p)}<span>${esc(p.name)}<small>${provider === "mctiers" ? "MCTiers" : "Community"}</small></span></button></td><td><span class="badge">${esc(p.region)}</span></td><td><div class="tiers">${p.shown.map(([id, r]) => badge(id, r)).join("")}</div></td><td>${mode === "overall" ? p.points : score(p.rankings[mode])}</td><td><input class="check" type="checkbox" aria-label="Compare ${esc(p.name)}" data-compare="${p.uuid}" ${selected.has(p.uuid) ? "checked" : ""}></td></tr>`).join("")}</tbody></table>`
    : `<div class="empty"><strong>${provider === "community" ? "The first tier is still yours to claim." : "No players match these filters."}</strong><p>${provider === "community" ? "Join Discord to help launch fair, reviewed community testing." : "Try another mode or region. This snapshot includes only the top 50 overall players."}</p><a class="button secondary" href="${provider === "community" ? config.invite : "https://mctiers.net/"}" target="_blank" rel="noopener">${provider === "community" ? "Join Discord" : "Open full MCTiers ladder"} ↗</a></div>`;
  document.querySelector("#result-count").textContent =
    `${list.length} players shown${status !== "all" && mode === "overall" ? " · Overall points remain the provider’s total" : ""}`;
  target
    .querySelectorAll("[data-player]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          showProfile(players().find((p) => p.uuid === b.dataset.player))),
    );
  target.querySelectorAll("[data-compare]").forEach(
    (b) =>
      (b.onchange = () => {
        if (b.checked && selected.size === 2) {
          b.checked = false;
          toast("Choose up to two players.");
          return;
        }
        b.checked
          ? selected.add(b.dataset.compare)
          : selected.delete(b.dataset.compare);
        compareBar();
      }),
  );
  compareBar();
}
function compareBar() {
  document.querySelector(".comparebar")?.remove();
  if (!selected.size) return;
  const bar = document.createElement("div");
  bar.className = "comparebar";
  const names = [...selected]
    .map((id) => players().find((p) => p.uuid === id)?.name)
    .filter(Boolean);
  bar.innerHTML = `<span>${names.map(esc).join(" vs ")}${selected.size === 1 ? " · Choose one more" : ""}</span><button id="compare-now" ${selected.size === 2 ? "" : "disabled"}>Compare</button><button id="compare-clear" aria-label="Clear comparison">×</button>`;
  document.body.append(bar);
  bar.querySelector("#compare-clear").onclick = () => {
    selected.clear();
    renderRows();
  };
  bar.querySelector("#compare-now").onclick = () => {
    const ps = [...selected].map((id) => players().find((p) => p.uuid === id));
    document.querySelector("#profile-body").innerHTML =
      `<h2>Head to head</h2><p class="muted">Tier comparison within ${provider === "mctiers" ? "MCTiers" : "our community"}. This does not predict match outcomes.</p><table><thead><tr><th>Mode</th>${ps.map((p) => `<th>${esc(p.name)}</th>`).join("")}</tr></thead><tbody>${config.modes.map((m) => `<tr><td>${m.name}</td>${ps.map((p) => `<td>${p.rankings[m.id] ? badge(m.id, p.rankings[m.id]) : "Unranked"}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    dialog.showModal();
  };
}
function showProfile(p) {
  const isOwn =
    own.players.some((x) => x.uuid === p.uuid) && provider === "community";
  document.querySelector("#profile-body").innerHTML =
    `<div class="profile-head">${avatar(p)}<div><h2>${esc(p.name)}</h2><p class="muted">${esc(p.region)} · ${p.points} overall points · ${isOwn ? "Community" : "MCTiers"}</p></div></div><div class="profile-modes">${Object.entries(
      p.rankings,
    )
      .map(
        ([id, r]) =>
          `<div class="profile-mode"><div>${esc(modeName(id))}<small>Peak: ${r.peak_tier ? tier({ tier: r.peak_tier, pos: r.peak_pos }) : "Not available"}${r.retired ? " · Retired" : " · Active"}</small></div>${badge(id, r)}</div>`,
      )
      .join(
        "",
      )}</div><div class="profile-actions"><button class="button" id="share-player">Copy profile link</button><button class="button secondary" id="download-card">Download player card</button><a class="button secondary" href="${isOwn ? config.invite : "https://mctiers.net/"}" target="_blank" rel="noopener">View source ↗</a></div>`;
  document.querySelector("#share-player").onclick = async () => {
    try {
      await navigator.clipboard.writeText(
        `${location.href.split("#")[0]}#rankings?player=${encodeURIComponent(p.uuid)}`,
      );
      toast("Profile link copied.");
    } catch {
      toast("Clipboard unavailable. Copy the URL from your browser.");
    }
  };
  document.querySelector("#download-card").onclick = () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500"><rect width="1000" height="500" fill="#101625"/><text x="65" y="90" fill="#a5b4ff" font-family="sans-serif" font-size="24">Minecraft PvP Community</text><text x="65" y="190" fill="white" font-family="sans-serif" font-size="54">${esc(p.name)}</text><text x="65" y="250" fill="#a5b1cb" font-family="sans-serif" font-size="25">${esc(p.region)} · ${p.points} points · ${isOwn ? "Community" : "MCTiers"}</text>${Object.entries(
      p.rankings,
    )
      .map(
        ([id, r], i) =>
          `<text x="${65 + (i % 4) * 230}" y="${320 + Math.floor(i / 4) * 46}" fill="#edc478" font-family="sans-serif" font-size="18">${esc(modeName(id))} ${tier(r)}${r.retired ? "*" : ""}</text>`,
      )
      .join(
        "",
      )}<text x="65" y="465" fill="#a5b1cb" font-family="sans-serif" font-size="17">Snapshot ${snapshot.updatedAt?.slice(0, 10) || "unknown"} · * Retired · Independent community</text></svg>`;
    download(
      new Blob([svg], { type: "image/svg+xml" }),
      `${p.name}-pvp-card.svg`,
    );
  };
  if (!dialog.open) dialog.showModal();
}
function communities() {
  main.innerHTML =
    intro(
      "FIND YOUR PEOPLE.",
      "From your first sword duel to specialist mace kits. Explore the communities that make Minecraft PvP.",
    ) +
    `<p class="notice">An independent directory, not a partnership list. Only MCTiers currently supplies rankings here. Other sources open on their own websites.</p><div class="grid">${config.providers.map((p, i) => `<article class="card"><div class="symbol">${["✦", "MC", "PT", "CT", "LX", "HQ", "CT", "PL", "MS"][i]}</div><span class="badge" style="float:right">${p.kind}</span><h3>${p.name}</h3><p>${p.description}</p><a href="${p.url}" target="_blank" rel="noopener">${p.id === "community" ? "Join our Discord" : "Visit source"} ↗</a></article>`).join("")}</div>`;
}
function testing() {
  main.innerHTML =
    intro(
      "YOUR NEXT TIER STARTS HERE.",
      "A fair test. A clear result. A community to help you improve.",
    ) +
    `<div class="two-col"><section class="steps">${[
      [
        "Join the community",
        "Enter our Discord, read the rules and choose your game modes and region.",
      ],
      [
        "Request a test",
        "Use /queue join with a mode and region once the bot is installed. Your Minecraft account must be verified by staff before any result is accepted.",
      ],
      [
        "Meet your tester",
        "A tester claims your queue entry. Agree on the approved kit, version, server and evidence rules before playing.",
      ],
      [
        "Review your result",
        "Results are recorded with a player UUID, tester, mode and evidence link. Appeals go to staff who did not conduct the test.",
      ],
    ]
      .map(
        ([t, d]) =>
          `<div class="step"><div><h3>${t}</h3><p>${d}</p></div></div>`,
      )
      .join(
        "",
      )}<a class="button" href="${config.invite}" target="_blank" rel="noopener">Join Discord to get started ↗</a></section><aside><div class="side-panel rules"><h3>Fair play comes first</h3><p>Rankings are earned through play. Sponsors never buy tiers, queue priority or appeal outcomes.</p><p>No harassment, doxxing, account sharing or match manipulation. Do not install unknown software for a test. Staff must explain any evidence request and respect your privacy.</p><p>Mode rules and testing availability must be announced before queues open. Our new community is preparing its first testing team.</p></div><div class="side-panel"><h3>How tiers work</h3><p>HT means high tier, LT means low tier. HT1 is the highest band; LT5 is the starting band. Different communities use different criteria.</p><div class="tiers">${Object.entries(
      config.points,
    )
      .map(
        ([t, n]) => `<span class="tier t${t.slice(-1)}">${t} · ${n} pts</span>`,
      )
      .join(
        "",
      )}</div><p class="small">Community scoring proposal. External overall points are always supplied by their source.</p></div></aside></div>`;
}
function tagger() {
  main.innerHTML =
    intro(
      "TAKE YOUR TIER INTO THE FIGHT.",
      "Configure a readable nametag. Keep the source, mode and retired status visible.",
    ) +
    `<div class="two-col"><section class="card"><div class="tag-preview"><div class="nameplate"><span id="tag-label">[Sword HT3]</span> YourName</div></div><label class="form-field">Preferred mode<select id="tag-mode">${config.modes.map((m) => `<option value="${m.id}">${m.name}</option>`).join("")}</select></label><label class="form-field">Fallback<select id="tag-fallback"><option value="false">Only the selected mode</option><option value="true">Highest active tier if mode is unranked</option></select></label><label class="form-field">Tag color<input id="tag-color" type="color" value="#edc478"></label><button class="button" id="config-download">Download tagger configuration</button><p class="muted small" style="margin-top:18px">Illustrative preview. Configuration is for the community Fabric client in this project's source. It is not compatible with the third-party mods below.</p></section><section><div class="side-panel"><h3>Community tagger · early development</h3><p>A Fabric 1.21.1 client with asynchronous UUID lookups, bounded caching, mode switching and explicit retired labels. Source and build instructions ship with this project.</p><p>Client compatibility and in-game rendering still require testing. No in-game-tested release is being advertised here.</p><a class="mini-link" href="https://github.com/drax12341/minecraft-pvp-community" target="_blank" rel="noopener">Source and setup guide <span>GitHub ↗</span></a><a class="mini-link" href="https://github.com/drax12341/minecraft-pvp-community/releases/tag/v0.1.0-experimental" target="_blank" rel="noopener">Experimental Fabric 1.21.1 JAR <span>Build only; untested in game ↗</span></a></div><div class="side-panel"><h3>Explore the existing mods</h3><a class="mini-link" href="https://modrinth.com/mod/tiertagger" target="_blank" rel="noopener">Tier Tagger <span>MCTiers / SubTiers ↗</span></a><a class="mini-link" href="https://modrinth.com/mod/tiers" target="_blank" rel="noopener">Tiers <span>PvPTiers + others ↗</span></a><a class="mini-link" href="https://modrinth.com/mod/submodes-tier-tagger" target="_blank" rel="noopener">Submodes Tier Tagger <span>Mace modes ↗</span></a></div></section></div>`;
  const update = () => {
    document.querySelector("#tag-label").textContent =
      `[${modeName(document.querySelector("#tag-mode").value)} HT3]`;
    document.querySelector("#tag-label").style.color =
      document.querySelector("#tag-color").value;
  };
  document.querySelector("#tag-mode").onchange = update;
  document.querySelector("#tag-color").oninput = update;
  document.querySelector("#config-download").onclick = () =>
    download(
      new Blob(
        [
          JSON.stringify(
            {
              mode: document.querySelector("#tag-mode").value,
              fallback:
                document.querySelector("#tag-fallback").value === "true",
              color: document.querySelector("#tag-color").value,
              enabled: true,
              showRetired: false,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      "community-tagger.json",
    );
}
function sponsors() {
  main.innerHTML =
    intro(
      "SUPPORT THE NEXT GENERATION.",
      "Help fund community events, testing tools and a better place to play.",
    ) +
    `<div class="notice">Founding sponsor spaces are open. No sponsors have been confirmed and no payments are collected on this website.</div><div class="grid">${[
      [
        "Community supporter",
        "Support hosting and open-source tools.",
        "Recognition in the sponsor directory and a supporter role.",
      ],
      [
        "Event partner",
        "Help bring an event to the community.",
        "An agreed event mention and a clearly labeled sponsor placement.",
      ],
      [
        "Creator collaborator",
        "Make something worth sharing.",
        "Collaborate on guides, community clips and learning sessions.",
      ],
    ]
      .map(
        ([t, d, b]) =>
          `<article class="card"><span class="symbol">✧</span><h3>${t}</h3><p>${d}</p><p>${b}</p><a href="${config.invite}" target="_blank" rel="noopener">Discuss on Discord ↗</a></article>`,
      )
      .join(
        "",
      )}</div><section class="rules" style="margin-top:35px"><h2>Trust is part of the deal.</h2><p>Sponsor placements are labeled. Sponsors have no influence over tiers, moderation or appeals. Any future arrangement needs an agreed scope, dates, disclosure and cancellation terms. We do not guarantee views, members or sales.</p></section>`;
}
function about() {
  main.innerHTML =
    intro(
      "CLEAR SOURCES. FAIR RULES.",
      "Know where a rank comes from and what this community is building.",
    ) +
    `<div class="two-col rules"><section><h2>Rankings & freshness</h2><p>MCTiers data comes from its documented public v2 API. The website bundles a timestamped top-50 overall snapshot, not a complete or continuously live leaderboard. Per-mode ordering only compares the players in that snapshot. Provider points are preserved.</p><p>Community results are empty until reviewed tests are published. A UUID identifies a player; a displayed name alone is not proof of account ownership. CatPvP ratings and tested tiers are separate systems and are not automatically converted.</p><h2>Your privacy</h2><p>The website has no sign-in, ad trackers or analytics. It loads typefaces from Google Fonts and player avatars from mc-heads.net; those services receive normal network request information. Profile links contain only public player UUIDs. Sharing and downloads happen only when you choose them.</p><p>Discord has its own privacy terms. The optional bot stores Discord user IDs, queue choices and reviewed test records. Ask community staff for corrections, appeals or deletion. Public evidence links should contain only information you have permission to share.</p></section><section><h2>Research & attribution</h2><p>These are independent sources, not affiliated projects. Public feature descriptions informed this platform; their branding and proprietary assets have not been copied.</p>${config.providers
      .filter((p) => p.id !== "community")
      .map(
        (p) =>
          `<a class="mini-link" href="${p.url}" target="_blank" rel="noopener">${p.name}<span>Original source ↗</span></a>`,
      )
      .join(
        "",
      )}<p style="margin-top:20px">Tier Tagger is MPL-2.0; Tiers is GPL-3.0-only; the Submodes mod is all rights reserved. The community tagger is a separate implementation. Source licensing does not grant permission to reuse another community's icons.</p></section></div>`;
}
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
dialog.querySelector(".close").onclick = () => dialog.close();
dialog.onclick = (e) => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      dialog.close();
  }
};
main.innerHTML = '<div class="loading">Loading the community…</div>';
try {
  [config, snapshot, own] = await Promise.all(
    ["community", "mctiers", "results"].map(async (p) => {
      const r = await fetch(`./data/${p}.json`);
      if (!r.ok) throw Error(`Could not load ${p}`);
      return r.json();
    }),
  );
  render();
  window.addEventListener("hashchange", render);
} catch (e) {
  main.innerHTML =
    '<div class="empty"><strong>The rankings could not load.</strong><p>Refresh the page or join Discord while we resolve this.</p><a class="button" href="https://discord.gg/a36rg6BxuX">Join Discord</a></div>';
  console.error(e);
}
