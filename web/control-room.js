import {playerIdentity} from './player-identity.js?v=identity-v12';
const crNameMCLink=p=>{const id=playerIdentity(p);return id?`<a class="cr-namemc-link" href="${id.nameMC}" target="_blank" rel="noopener noreferrer" aria-label="Open ${crEscape(p.name)} on NameMC" title="NameMC profile, skins and name history">MC ↗</a>`:'';};
const crEscape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const crTier = (rank) => (rank.pos === 0 ? "HT" : "LT") + rank.tier;
const crActive = (player) =>
  Object.entries(player.rankings || {}).filter(([, r]) => !r.retired);
const crPoints = (player, config, mode = "overall") =>
  crActive(player).reduce(
    (sum, [id, r]) =>
      sum +
      (mode === "overall" || mode === id
        ? Number(config.points[crTier(r)]) || 0
        : 0),
    0,
  );
const crBest = (player, config) =>
  Math.max(
    0,
    ...crActive(player).map(([, r]) => config.points[crTier(r)] || 0),
  );
const crGet = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem("pvp:" + key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const crSet = (key, value) => {
  try {
    localStorage.setItem("pvp:" + key, JSON.stringify(value));
  } catch {}
};
const crRegions = ["EU", "NA", "AS", "SA", "AU", "AF", "ME", "OC"];
const crAvatar = (p) =>
  `<img src="https://mc-heads.net/avatar/${encodeURIComponent(p.uuid)}/48" width="32" height="32" alt="" loading="lazy" referrerpolicy="no-referrer">`;
const crToken = (r) =>
  `<span class="rank-token rank-token-${Number(r.tier) || 5}">${crEscape(crTier(r))}</span>`;
const crModeOptions = (config) =>
  config.modes
    .map(
      (m) => `<option value="${crEscape(m.id)}">${crEscape(m.name)}</option>`,
    )
    .join("");
const crRegionOptions = () =>
  '<option value="all">All regions</option>' +
  crRegions.map((r) => `<option>${r}</option>`).join("");
const crDate = (value) =>
  Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })
    : "Date pending";
const crEvidence = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? crEscape(u.href) : null;
  } catch {
    return null;
  }
};
const crIcon = (name, size = 18) =>
  `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{ trophy: '<path d="M8 3h8v7a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-4 1h8"/>', users: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2"/>', queue: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h8m-8 4h8m-8 4h4"/>', activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>', search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>', arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>', download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>', star: '<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>', shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>', grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>', list: '<path d="M8 5h13M8 12h13M8 19h13M3 5h1m-1 7h1m-1 7h1"/>', copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>', check: '<path d="m5 12 4 4L19 6"/>', spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/>' }[name] || '<circle cx="12" cy="12" r="8"/>'}</svg>`;

export function selectControlPlayers(
  players,
  config,
  scope = {},
  saved = new Set(),
) {
  const mode = scope.mode || "overall",
    query = String(scope.query || "")
      .trim()
      .toLowerCase();
  const rows = players.filter((p) => {
    const active = crActive(p).filter(
      ([id]) => mode === "overall" || id === mode,
    );
    return (
      active.length &&
      (!scope.region ||
        scope.region === "all" ||
        (mode === "overall"
          ? p.region
          : p.rankings[mode]?.region || p.region) === scope.region) &&
      (!query || String(p.name).toLowerCase().includes(query)) &&
      (!scope.savedOnly || saved.has(p.uuid))
    );
  });
  return rows.sort(
    (a, b) =>
      (scope.sort === "name"
        ? 0
        : scope.sort === "best"
          ? crBest(b, config) - crBest(a, config)
          : crPoints(b, config, mode) - crPoints(a, config, mode)) ||
      String(a.name).localeCompare(String(b.name)),
  );
}
export function controlRoomSnapshot(data, testing, config) {
  const active = (data.players || []).filter((p) => crActive(p).length),
    sessions = testing.sessions || [];
  const tiers = [0, 0, 0, 0, 0],
    regions = Object.create(null);
  for (const p of active) {
    regions[p.region] = (regions[p.region] || 0) + 1;
    for (const [, r] of crActive(p))
      if (r.tier >= 1 && r.tier <= 5) tiers[r.tier - 1]++;
  }
  return {
    players: active.length,
    placements: tiers.reduce((a, b) => a + b, 0),
    recent: (data.recent || []).length,
    open: sessions.filter((s) => s.status === "open").length,
    waiting: sessions.reduce(
      (n, s) => n + Math.max(0, Number(s.waiting) || 0),
      0,
    ),
    testing: sessions.reduce(
      (n, s) => n + Math.max(0, Number(s.claimed) || 0),
      0,
    ),
    tiers,
    regions,
    modes: config.modes.length,
  };
}
export function buildPlayerCsv(players, config) {
  const cell = (value) => {
    let text = String(value ?? "");
    if (/^\s*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows = [
    ["Player", "Region", "Active points", ...config.modes.map((m) => m.name)],
    ...players.map((p) => [
      p.name,
      p.region,
      crPoints(p, config),
      ...config.modes.map((m) =>
        p.rankings[m.id] && !p.rankings[m.id].retired
          ? crTier(p.rankings[m.id])
          : "Unranked",
      ),
    ]),
  ];
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
export function activityBuckets(recent, days = 14, now = new Date()) {
  const end = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const buckets = Array.from({ length: days }, (_, n) => ({
    day: new Date(end - (days - n - 1) * 86400000).toISOString().slice(0, 10),
    count: 0,
  }));
  const counts = new Map(buckets.map((b) => [b.day, b]));
  for (const result of recent) {
    const time = Date.parse(result.created);
    if (!Number.isFinite(time) || time > now.getTime()) continue;
    const day = new Date(time).toISOString().slice(0, 10);
    if (counts.has(day)) counts.get(day).count++;
  }
  return buckets;
}

export function renderControlRoomHome({
  main,
  config,
  data,
  testing,
  saved,
  selected,
  profile,
  openMode,
  onSave,
  onCompare,
  copy,
  download,
}) {
  const snapshot = controlRoomSnapshot(data, testing, config),
    all = selectControlPlayers(data.players, config),
    leader = all[0];
  const pref = crGet("controlScope", {}),
    params = new URLSearchParams(location.hash.split("?")[1]);
  const scope = {
    mode: params.get("mode") || pref.mode || "overall",
    region: params.get("region") || pref.region || "all",
    query: params.get("q") ?? pref.query ?? "",
    sort: params.get("sort") || pref.sort || "points",
    savedOnly: params.has("saved")
      ? params.get("saved") === "1"
      : pref.savedOnly === true,
    view: (params.get("view") || pref.view) === "cards" ? "cards" : "table",
  };
  if (
    !config.modes.some((m) => m.id === scope.mode) &&
    scope.mode !== "overall"
  )
    scope.mode = "overall";
  if (!crRegions.includes(scope.region)) scope.region = "all";
  if (!["points", "name", "best"].includes(scope.sort)) scope.sort = "points";
  scope.query = String(scope.query).slice(0, 64);
  let page = 1,
    chartDays = 14;
  const scene = crGet("heroScene", "arena") === "quiet" ? "quiet" : "arena";
  const updated = Number.isFinite(Date.parse(data.updatedAt))
    ? new Date(data.updatedAt).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "First results pending";
  const release =
    "https://github.com/drax12341/minecraft-pvp-community/releases/tag/v0.2.0-experimental";
  main.innerHTML = `
 <div class="control-room">
  <section class="control-hero" data-scene="${scene}" aria-labelledby="hero-title">
   <div class="cr-hero-mesh" aria-hidden="true"></div><div class="cr-hero-copy">
    <div class="cr-overline"><span class="cr-signal"></span> Minecraft PvP · Community rankings</div>
    <h1 id="hero-title">Mace<br><span>Tierlist.</span></h1>
    <p>Every placement. Every queue.<br>Your community, in one live control room.</p>
    <div class="cr-hero-actions"><a href="#home?section=leaderboard" class="button" data-cr-section="leaderboard">View rankings ${crIcon("arrow", 16)}</a><a href="${release}" target="_blank" rel="noopener" class="button secondary">${crIcon("download", 16)} Get TierTagger</a><button class="cr-ghost" id="hero-random-profile"${all.length ? "" : " disabled"}>${crIcon("users", 16)} Random profile</button></div>
    <div class="cr-hero-foot"><span>${crIcon("shield", 14)} Independently tested</span><span>${config.modes.length} Mace disciplines</span><span>HT1 → LT5</span></div>
   </div>
   <div class="cr-player-scene" aria-label="${leader ? "Current leader " + crEscape(leader.name) : "Community challenger illustration"}">
    <div class="cr-scene-ring" aria-hidden="true"></div><img class="cr-challenger" src="./assets/challenger-scene.svg" alt="" width="600" height="440">
    <div class="cr-scene-float cr-scene-queue"><span>Open queues</span><strong>${snapshot.open}<i class="cr-live-indicator" aria-hidden="true"></i></strong><small>${snapshot.waiting} waiting · ${snapshot.testing} in testing</small></div>
    <div class="cr-scene-float cr-leader-card">${leader ? `<img class="cr-leader-skin" src="https://mc-heads.net/body/${encodeURIComponent(leader.uuid)}/right" alt="" width="56" height="112" loading="lazy"><div><span>Current leader</span><button data-cr-profile="${crEscape(leader.uuid)}">${crEscape(leader.name)}</button><strong>${crPoints(leader, config)} <small>pts</small></strong></div>` : `<img src="./assets/control-room-mark.svg" width="52" height="52" alt=""><div><span>Your next placement</span><strong class="cr-unclaimed">A place to earn.</strong><small>The first champion starts in a test.</small></div>`}</div>
    <div class="cr-scene-float cr-scene-tests"><span>Recent tests</span><strong>${snapshot.recent}</strong><small>Published match evidence</small></div>
    <div class="cr-scene-label" aria-hidden="true"><span>MC / MACE</span><i></i><span>THE NEXT CHALLENGER</span></div>
   </div>
   <div class="cr-scene-switch" role="group" aria-label="Scene detail"><button data-scene-choice="arena" aria-pressed="${scene === "arena"}" aria-label="Arena scene">Scene on</button><button data-scene-choice="quiet" aria-pressed="${scene === "quiet"}" aria-label="Quiet scene">Quiet</button></div>
  </section>
  <section class="cr-stat-grid community-stats" aria-label="Community snapshot">
   ${[
     ["users", "Ranked players", snapshot.players, "Active community profiles"],
     [
       "activity",
       "Recent tests",
       snapshot.recent,
       "In the latest public result feed",
     ],
     [
       "queue",
       "Open queues",
       snapshot.open,
       snapshot.testing + " players currently in testing",
     ],
     [
       "trophy",
       "Active placements",
       snapshot.placements,
       config.modes.length + " disciplines · 10 tier bands",
     ],
   ]
     .map(
       ([icon, label, count, note]) =>
         `<article class="cr-stat"><span>${label}</span>${crIcon(icon, 21)}<strong>${count}</strong><small>${note}</small></article>`,
     )
     .join("")}
  </section>
  <section class="cr-mod-panel" id="home-tagger" aria-labelledby="mod-heading">
   <div class="cr-mod-copy"><p class="cr-overline">Bring your placement into Minecraft</p><h2 id="mod-heading">Your tier.<br>Right beside your name.</h2><p>Community TierTagger shows earned placements on nametags and the tablist. Choose your discipline, keep retired tiers hidden, and let the right result speak for you.</p><div class="cr-compatibility"><span>Java 1.21.1</span><span>Fabric</span><span>UUID-backed results</span><span>No invented ranks</span></div><div class="cr-hero-actions"><a class="button" href="${release}" target="_blank" rel="noopener">${crIcon("download", 16)} Download experimental JAR</a><a class="cr-text-link" href="#tagger">Configure your tag ${crIcon("arrow", 14)}</a></div><details class="cr-install"><summary>Installation in three steps <span aria-hidden="true">+</span></summary><ol><li>Install Fabric Loader and Fabric API for Minecraft Java 1.21.1.</li><li>Put the experimental Community TierTagger JAR into your mods folder. Back up your world and test compatibility.</li><li>Launch Minecraft and use <code>/communitytag</code>. Configure the feed and optional fallback on the tagger page.</li></ol><p>The current experimental client reads published snapshots. Live cloud refresh support requires a later client update.</p></details></div>
   <div class="cr-mod-console"><div class="cr-release-head"><img src="./assets/control-room-mark.svg" width="68" height="68" alt=""><div><span>Community TierTagger</span><strong>v0.2.0 <small>experimental</small></strong><p>Fabric · Minecraft Java 1.21.1</p></div><span class="cr-pixel-mark" aria-hidden="true">✦</span></div><div class="cr-game-preview"><div class="cr-game-grid" aria-hidden="true"></div><span class="cr-preview-caption">Interactive preview</span><div class="cr-nametag" id="home-tag-preview"><b>[Mace HT3]</b> <span>YourName</span></div><img src="./assets/challenger-scene.svg" alt="" width="260" height="190"><span class="cr-preview-disclaimer">Illustrative only · no rank is assigned</span></div><div class="cr-tag-controls"><label>Discipline<select id="preview-mode">${crModeOptions(config)}</select></label><label>Tier<select id="preview-tier">${Object.keys(
     config.points,
   )
     .map((t) => `<option${t === "HT3" ? " selected" : ""}>${t}</option>`)
     .join(
       "",
     )}</select></label><label class="cr-colour-label">Colour<input id="preview-colour" type="color" value="#f2c562"></label><button id="tag-preview-cycle" class="cr-icon-button" aria-label="Cycle the tier tag preview">↻</button></div><div class="cr-command-grid">${["/communitytag toggle", "/communitytag reload", "/communitytag fallback", "/communitytag mode mace"].map((command) => `<button data-cr-copy="${command}" title="Copy command"><code>${command}</code>${crIcon("copy", 12)}</button>`).join("")}</div></div>
  </section>
  <nav class="cr-jump-nav" aria-label="Control room sections"><span class="cr-jump-brand">${crIcon("grid", 14)} Control room</span>${[
    ["leaderboard", "Player index"],
    ["queues", "Live queues"],
    ["analytics", "Analytics"],
    ["testing", "Testing guide"],
  ]
    .map(
      ([id, label]) =>
        `<a href="#home?section=${id}" data-cr-section="${id}">${label}</a>`,
    )
    .join(
      "",
    )}<span class="cr-jump-update"><i class="cr-live-indicator" aria-hidden="true"></i> ${crEscape(updated)}</span></nav>
  <div class="cr-dashboard" id="home-leaderboard">
   <section class="cr-panel cr-index-panel"><div class="cr-panel-heading"><div><p class="cr-overline">The competition</p><h2>Player index <span id="index-count">0</span></h2></div><a class="cr-text-link" href="#rankings">Full tier board ${crIcon("arrow", 14)}</a></div>
    <div class="cr-mode-tabs" role="group" aria-label="Leaderboard discipline"><button data-index-mode="overall">${crIcon("trophy", 20)}<span>Overall</span></button>${config.modes.map((m) => `<button data-index-mode="${crEscape(m.id)}"><img src="./assets/${crEscape(m.id)}.svg" width="24" height="24" alt=""><span>${crEscape(m.name)}</span></button>`).join("")}</div>
    <div class="cr-index-toolbar"><label class="cr-search">${crIcon("search", 16)}<input id="home-player-search" type="search" maxlength="64" placeholder="Search a Minecraft player" aria-label="Search the player index"></label><label class="cr-select"><span>Region</span><select id="home-player-region">${crRegionOptions()}</select></label><label class="cr-select"><span>Sort</span><select id="home-sort"><option value="points">Most points</option><option value="best">Best tier</option><option value="name">Player name</option></select></label></div>
    <div class="cr-index-tools"><button class="cr-tool" id="home-saved-only" aria-pressed="${scope.savedOnly}">${crIcon("star", 14)} Saved players</button><button class="cr-tool" id="index-random">${crIcon("users", 14)} Random profile</button><button class="cr-tool" id="index-export">${crIcon("download", 14)} CSV</button><button class="cr-tool" id="index-share">${crIcon("copy", 14)} Share view</button><button class="cr-tool" id="index-reset">Reset</button><div class="cr-view-switch" role="group" aria-label="Player index layout"><button data-index-view="table" aria-label="Table view">${crIcon("list", 16)}</button><button data-index-view="cards" aria-label="Player card view">${crIcon("grid", 16)}</button></div></div>
    <div id="home-player-index" aria-live="polite"></div><div class="cr-index-footer"><span id="index-results-label"></span><div class="cr-pagination"><button id="index-prev" aria-label="Previous player page">←</button><span id="index-page">1 / 1</span><button id="index-next" aria-label="Next player page">→</button></div></div>
    <div class="cr-index-note">${crIcon("shield", 14)} Points count active placements. Retired results remain in player history.</div>
   </section>
   <aside class="cr-side-stack"><section class="cr-panel cr-queues-panel" id="home-queues-panel"><div class="cr-panel-heading"><div><p class="cr-overline">Find your next test</p><h2>Live queues</h2></div><span class="cr-status-pill"><i class="cr-live-indicator"></i> Public feed</span></div><div class="cr-queue-controls"><label>Region<select id="home-region">${crRegionOptions()}</select></label><a href="#testing">All sessions ↗</a></div><div id="home-queues"></div><div class="cr-slot-legend"><span><i></i>Waiting</span><span><i></i>Testing</span><span><i></i>Available</span></div><p class="cr-panel-footnote">20 shared slots per session. Your assigned tester and private status are available in Discord.</p></section>
    <section class="cr-panel cr-private-desk"><div class="cr-panel-heading"><div><p class="cr-overline">Your next move</p><h2>Personal testing desk</h2></div>${crIcon("shield", 22)}</div><div class="cr-desk-selects"><label>Discipline<select id="quick-mode">${crModeOptions(config)}</select></label><label>Region<select id="quick-region">${crRegions.map((r) => `<option>${r}</option>`).join("")}</select></label></div><div class="cr-private-command"><code id="quick-command"></code><button id="quick-copy" class="cr-icon-button" aria-label="Copy your private queue status command">${crIcon("copy", 15)}</button></div><a class="button secondary" href="${crEscape(config.invite)}" target="_blank" rel="noopener">Open Discord testing ${crIcon("arrow", 14)}</a><p>Copy the command into Discord to check your queue, tester and cooldown. Preferences here never reserve a place.</p></section>
    <section class="cr-panel cr-recent-panel"><div class="cr-panel-heading"><div><p class="cr-overline">The latest placements</p><h2>Recent tests</h2></div><a href="#results" aria-label="All published tests">${crIcon("arrow", 18)}</a></div><div id="home-recent-results"></div></section>
   </aside>
  </div>
  <section class="cr-analytics-section" id="home-analytics"><div class="cr-section-heading"><div><p class="cr-overline">A read on the community</p><h2>The field at a glance.</h2></div><a href="#insights" class="cr-text-link">Explore all insights ${crIcon("arrow", 14)}</a></div><div class="cr-analytics-grid"><article class="cr-panel"><div class="cr-chart-title"><h3>Tier distribution</h3><span>Active placements</span></div><div class="cr-donut-layout"><div id="home-tier-chart"></div><div id="home-tier-legend"></div></div></article><article class="cr-panel"><div class="cr-chart-title"><h3>Where we play</h3><span>Ranked players</span></div><div id="home-region-chart"></div></article><article class="cr-panel cr-activity-panel"><div class="cr-chart-title"><h3>Testing activity</h3><div class="cr-chart-range" role="group" aria-label="Activity chart period">${[7, 14, 30].map((n) => `<button data-chart-days="${n}" aria-pressed="${n === 14}">${n}d</button>`).join("")}</div></div><div id="home-activity-chart"></div><p class="cr-chart-note">Completed tests in the capped public feed. Not an all-time total.</p></article></div></section>
  <section class="cr-disciplines" id="home-disciplines"><div class="cr-section-heading"><div><p class="cr-overline">Choose your fight</p><h2>Seven ways to earn it.</h2></div><a href="./standards.html" class="cr-text-link">Approved kits & rules ${crIcon("arrow", 14)}</a></div><div class="cr-discipline-grid">${config.modes
    .map((m) => {
      const ranked = all.filter(
          (p) => p.rankings[m.id] && !p.rankings[m.id].retired,
        ).length,
        open = (testing.sessions || []).filter(
          (s) => s.mode === m.id && s.status === "open",
        ).length;
      return `<button class="cr-discipline" data-league-mode="${crEscape(m.id)}" style="--mode-colour:${/^#[0-9a-f]{6}$/i.test(m.color) ? m.color : "#a5cdf5"}"><img src="./assets/${crEscape(m.id)}.svg" alt="" width="42" height="42"><h3>${crEscape(m.name)}</h3><span>${crEscape(m.group)}</span><div><strong>${ranked}<small>ranked</small></strong><strong>${open}<small>open queues</small></strong></div><i aria-hidden="true">↗</i></button>`;
    })
    .join("")}</div></section>
  <div class="cr-bottom-grid"><section class="cr-panel cr-tester-panel"><div class="cr-panel-heading"><div><p class="cr-overline">Behind every placement</p><h2>The testing team</h2></div>${crIcon("trophy", 22)}</div><div id="tester-activity" aria-live="polite"><p class="cr-subtle-empty">Loading published tester activity…</p></div><a class="cr-text-link" href="#commands">Testing command library ${crIcon("arrow", 14)}</a><p class="cr-panel-footnote">Documented, non-revoked tests. Activity is recognition; it does not automatically grant staff qualifications.</p></section>
   <section class="cr-panel cr-path-panel"><div class="cr-panel-heading"><div><p class="cr-overline">Set your sights</p><h2>Explore your next tier</h2></div>${crIcon("trophy", 22)}</div><div class="cr-target-tiers" role="group" aria-label="Explore a target tier">${Object.keys(
     config.points,
   )
     .reverse()
     .map(
       (t) =>
         `<button data-target-tier="${t}" aria-pressed="${t === "HT3"}">${t}</button>`,
     )
     .join(
       "",
     )}</div><div id="home-target-result"></div><a href="#planner" class="cr-text-link">Open the full tier explorer ${crIcon("arrow", 14)}</a></section></div>
  <section class="cr-guide-section" id="home-testing"><div class="cr-section-heading"><div><p class="cr-overline">From first queue to first placement</p><h2>Know what happens next.</h2></div><a href="#test-desk" class="button secondary">Prepare a test ${crIcon("arrow", 14)}</a></div><div class="cr-guide-layout"><div class="cr-guide-steps" role="tablist" aria-label="Testing walkthrough">${[
    ["verify", "Verify your account", "One player. One verified identity."],
    ["queue", "Find your session", "The right discipline, region and tester."],
    [
      "play",
      "Play. Review. Place.",
      "Fair sets. Recorded evidence. Your result.",
    ],
  ]
    .map(
      ([id, title, copy], n) =>
        `<button role="tab" data-guide-step="${id}" id="guide-tab-${id}" aria-controls="guide-detail" aria-selected="${n === 0}" tabindex="${n === 0 ? 0 : -1}"><span>${n + 1}</span><div><h3>${title}</h3><p>${copy}</p></div>${crIcon("arrow", 16)}</button>`,
    )
    .join(
      "",
    )}</div><section id="guide-detail" class="cr-guide-detail" role="tabpanel" aria-labelledby="guide-tab-verify"></section></div></section>
  <section class="cr-toolbox"><a href="#watchlist">${crIcon("star", 23)}<span><strong>Saved players</strong><small>Your rivals, kept close.</small></span>${crIcon("arrow", 16)}</a><a href="./standards.html">${crIcon("shield", 23)}<span><strong>Approved loadouts</strong><small>Know the exact kit before playing.</small></span>${crIcon("arrow", 16)}</a><a href="#community">${crIcon("users", 23)}<span><strong>Practice & community</strong><small>Find a spar. Share what you learn.</small></span>${crIcon("arrow", 16)}</a><a href="#commands">${crIcon("queue", 23)}<span><strong>Command library</strong><small>Every next step, searchable.</small></span>${crIcon("arrow", 16)}</a></section>
  <section class="cr-faq-section" id="home-faq"><div><p class="cr-overline">Before you enter the arena</p><h2>A fair fight starts<br>with clear rules.</h2><p>Your place on the board is earned through documented testing. These are the details worth knowing.</p><a href="#about" class="cr-text-link">Community rules & privacy ${crIcon("arrow", 14)}</a></div><div class="cr-faq">${[
    [
      "How do I get my first tier?",
      "Verify ownership of your Minecraft Java account with staff. Choose a discipline and region, then enter an open session through Discord. Interest roles never award ranks.",
    ],
    [
      "Can I see my tester and queue position?",
      "Your assigned tester, current player status, place and cooldown are available privately through /queue status. Discord waitlist boards show tester activity and current testing. The website publishes session totals, not private tickets.",
    ],
    [
      "What changes for high-tier tests?",
      "HT3 and higher follow the ranked rubric and recorded testing phases. Stronger placements require qualified opponents and independent senior sign-off.",
    ],
    [
      "What happens if a result is disputed?",
      "Appeal your own completed test in Discord. An independent reviewer considers its evidence and retains the audit history. Revoked results are removed from the active tierlist.",
    ],
    [
      "Are the numbers on this page live?",
      "Rankings and sessions use the public community feeds and refresh automatically. Recent tests are the capped latest result feed. Empty boards and unavailable feeds are shown honestly.",
    ],
    [
      "Where is the website hosted?",
      "The public source is on GitHub and GitHub Actions deploys this frontend to GitHub Pages. Discord commands and live community feeds use the existing separate backend.",
    ],
  ]
    .map(
      ([q, a]) =>
        `<details><summary>${q}<span aria-hidden="true">+</span></summary><p>${a}</p></details>`,
    )
    .join("")}</div></section>
  <section class="cr-final-banner"><img src="./assets/control-room-mark.svg" alt="" width="70" height="70"><div><p class="cr-overline">Your people. Your next fight.</p><h2>Put your name on the board.</h2><p>Start with a fair test. Stay for the community.</p></div><a href="${crEscape(config.invite)}" target="_blank" rel="noopener" class="button">Join the Discord ${crIcon("arrow", 16)}</a></section>
 </div>`;

  const persist = () => crSet("controlScope", scope);
  const scopeLink = () =>
    location.href.split("#")[0] +
    "#home?" +
    new URLSearchParams({
      section: "leaderboard",
      mode: scope.mode,
      region: scope.region,
      q: scope.query,
      sort: scope.sort,
      view: scope.view,
      ...(scope.savedOnly ? { saved: "1" } : {}),
    });
  const filtered = () =>
    selectControlPlayers(data.players, config, scope, saved);
  const playerButton = (p) =>
    `<button class="cr-player-identity" data-cr-profile="${crEscape(p.uuid)}">${crAvatar(p)}<span><strong>${crEscape(p.name)}</strong><small>View player profile</small></span></button>`;
  const playerActions = (p) =>
    `<div class="cr-player-actions"><button class="cr-save-player" data-cr-save="${crEscape(p.uuid)}" aria-label="${saved.has(p.uuid) ? "Unsave" : "Save"} ${crEscape(p.name)}" aria-pressed="${saved.has(p.uuid)}">${crIcon("star", 15)}</button>${crNameMCLink(p)}<label class="cr-compare-check"><input type="checkbox" data-cr-compare="${crEscape(p.uuid)}" aria-label="Compare ${crEscape(p.name)}"${selected.has(p.uuid) ? " checked" : ""}><span>Compare</span></label></div>`;
  const drawIndex = () => {
    const rows = filtered(),
      pages = Math.max(1, Math.ceil(rows.length / 10));
    page = Math.max(1, Math.min(page, pages));
    const visible = rows.slice((page - 1) * 10, page * 10);
    main.querySelector("#index-count").textContent = rows.length;
    main.querySelector("#index-results-label").textContent = rows.length
      ? `${(page - 1) * 10 + 1}–${Math.min(page * 10, rows.length)} of ${rows.length} ranked players`
      : "No matching published players";
    main.querySelector("#index-page").textContent = page + " / " + pages;
    main.querySelector("#index-prev").disabled = page <= 1;
    main.querySelector("#index-next").disabled = page >= pages;
    main.querySelector("#index-export").disabled = !rows.length;
    main.querySelector("#index-random").disabled = !rows.length;
    main
      .querySelectorAll("[data-index-mode]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.indexMode === scope.mode),
        ),
      );
    main
      .querySelectorAll("[data-index-view]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.indexView === scope.view),
        ),
      );
    main
      .querySelector("#home-saved-only")
      .setAttribute("aria-pressed", String(scope.savedOnly));
    const root = main.querySelector("#home-player-index");
    root.innerHTML = rows.length
      ? scope.view === "table"
        ? `<div class="cr-table-scroll"><table class="cr-ranking-table"><thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">Points</th><th scope="col">Region</th><th scope="col">Placements</th><th scope="col"><span class="sr-only">Save or compare</span></th></tr></thead><tbody>${visible
            .map(
              (p, n) =>
                `<tr><td><span class="cr-standing position-${(page - 1) * 10 + n + 1}">${(page - 1) * 10 + n + 1}</span></td><td>${playerButton(p)}</td><td class="cr-player-score">${crPoints(p, config, scope.mode)}</td><td><span class="region-tag">${crEscape(scope.mode === "overall" ? p.region : p.rankings[scope.mode]?.region || p.region)}</span></td><td><div class="cr-placement-chips">${crActive(
                  p,
                )
                  .filter(
                    ([id]) => scope.mode === "overall" || scope.mode === id,
                  )
                  .map(
                    ([id, r]) =>
                      `<span title="${crEscape(config.modes.find((m) => m.id === id)?.name || id)}"><img src="./assets/${crEscape(config.modes.some((m) => m.id === id) ? id : "mace")}.svg" width="16" height="16" alt="">${crToken(r)}</span>`,
                  )
                  .join("")}</div></td><td>${playerActions(p)}</td></tr>`,
            )
            .join("")}</tbody></table></div>`
        : `<div class="cr-player-cards">${visible
            .map(
              (p) =>
                `<article class="cr-player-card">${playerButton(p)}<div class="cr-card-score"><strong>${crPoints(p, config, scope.mode)}</strong><span>earned points</span><span class="region-tag">${crEscape(p.region)}</span></div><div class="cr-card-placements">${crActive(
                  p,
                )
                  .filter(
                    ([id]) => scope.mode === "overall" || scope.mode === id,
                  )
                  .map(
                    ([id, r]) =>
                      `<span>${crEscape(config.modes.find((m) => m.id === id)?.name || id)}${crToken(r)}</span>`,
                  )
                  .join("")}</div>${playerActions(p)}</article>`,
            )
            .join("")}</div>`
      : `<div class="cr-index-empty league-empty"><div class="cr-empty-podium" aria-hidden="true"><span>2</span><span>${crIcon("trophy", 30)}</span><span>3</span></div><h3>${scope.query || scope.savedOnly || scope.region !== "all" ? "No players in this view." : "The first results start with you."}</h3><p>${scope.query || scope.savedOnly || scope.region !== "all" ? "Try another name, region or saved-player filter." : "Reviewed community tests put real player names on this board. Your first placement could be next."}</p><a href="#test-desk" class="button secondary">Find your testing path ${crIcon("arrow", 14)}</a></div>`;
    bindProfiles(root);
    root.querySelectorAll("[data-cr-save]").forEach(
      (b) =>
        (b.onclick = () => {
          const id = b.dataset.crSave;
          onSave(id);
          drawIndex();
          (
            [...root.querySelectorAll("[data-cr-save]")].find(
              (other) => other.dataset.crSave === id,
            ) || main.querySelector("#home-saved-only")
          ).focus();
        }),
    );
    root.querySelectorAll("[data-cr-compare]").forEach(
      (b) =>
        (b.onchange = () => {
          onCompare(b.dataset.crCompare);
          b.checked = selected.has(b.dataset.crCompare);
        }),
    );
    persist();
  };
  function bindProfiles(root) {
    root
      .querySelectorAll("[data-cr-profile]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            profile(data.players.find((p) => p.uuid === b.dataset.crProfile))),
      );
  }
  const resetPage = () => {
    page = 1;
    drawIndex();
  };
  main.querySelector("#home-player-search").value = scope.query;
  main.querySelector("#home-player-region").value = scope.region;
  main.querySelector("#home-sort").value = scope.sort;
  main.querySelector("#home-player-search").oninput = (e) => {
    scope.query = e.target.value;
    resetPage();
  };
  main.querySelector("#home-player-region").onchange = (e) => {
    scope.region = e.target.value;
    resetPage();
  };
  main.querySelector("#home-sort").onchange = (e) => {
    scope.sort = e.target.value;
    resetPage();
  };
  main.querySelector("#home-saved-only").onclick = () => {
    scope.savedOnly = !scope.savedOnly;
    resetPage();
  };
  main.querySelectorAll("[data-index-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        scope.mode = b.dataset.indexMode;
        resetPage();
      }),
  );
  main.querySelectorAll("[data-index-view]").forEach(
    (b) =>
      (b.onclick = () => {
        scope.view = b.dataset.indexView;
        drawIndex();
      }),
  );
  main.querySelector("#index-prev").onclick = () => {
    page--;
    drawIndex();
  };
  main.querySelector("#index-next").onclick = () => {
    page++;
    drawIndex();
  };
  const randomProfile = () => {
    const rows = filtered();
    if (rows.length) profile(rows[Math.floor(Math.random() * rows.length)]);
  };
  main.querySelector("#hero-random-profile").onclick = () => {
    if (all.length) profile(all[Math.floor(Math.random() * all.length)]);
  };
  main.querySelector("#index-random").onclick = randomProfile;
  main.querySelector("#index-reset").onclick = () => {
    Object.assign(scope, {
      mode: "overall",
      region: "all",
      query: "",
      sort: "points",
      savedOnly: false,
    });
    main.querySelector("#home-player-search").value = "";
    main.querySelector("#home-player-region").value = "all";
    main.querySelector("#home-sort").value = "points";
    resetPage();
  };
  main.querySelector("#index-share").onclick = () =>
    copy(scopeLink(), "Player index link copied.");
  main.querySelector("#index-export").onclick = () =>
    download(
      buildPlayerCsv(filtered(), config),
      "mace-tierlist-" + scope.mode + ".csv",
      "text/csv;charset=utf-8",
    );
  bindProfiles(main);
  main
    .querySelectorAll("[data-league-mode]")
    .forEach((b) => (b.onclick = () => openMode(b.dataset.leagueMode)));
  drawIndex();

  const drawQueues = () => {
    const region = main.querySelector("#home-region").value;
    crSet("homeRegion", region);
    const rows = (testing.sessions || [])
      .filter((s) => region === "all" || s.region === region)
      .sort((a, b) => Number(b.status === "open") - Number(a.status === "open"))
      .slice(0, 5);
    main.querySelector("#home-queues").innerHTML = rows.length
      ? rows
          .map((s) => {
            const m = config.modes.find((m) => m.id === s.mode),
              waiting = Math.max(0, Number(s.waiting) || 0),
              claimed = Math.max(0, Number(s.claimed) || 0),
              capacity = Math.max(1, Math.min(20, Number(s.capacity) || 20)),
              occupied = waiting + claimed;
            const board = config.queueBoards?.find(
              (b) => b.mode === s.mode && b.region === s.region,
            );
            const boardUrl = board
              ? "https://discord.com/channels/" +
                encodeURIComponent(board.guild) +
                "/" +
                encodeURIComponent(board.channel) +
                (board.message ? "/" + encodeURIComponent(board.message) : "")
              : config.invite;
            return `<article class="cr-queue" data-queue-region="${crEscape(s.region)}"><div class="cr-queue-top"><img src="./assets/${crEscape(m?.id || "mace")}.svg" width="26" height="26" alt=""><div><h3>${crEscape(m?.name || s.mode)}</h3><span>${crEscape(s.region)} · ${waiting} waiting · ${claimed} testing</span></div><span class="cr-queue-state state-${s.status === "open" ? "open" : "paused"}">${s.status === "open" ? (occupied >= capacity ? "Full" : "Open") : crEscape(s.status)}</span></div><div class="cr-queue-places"><strong>${occupied}<span>/${capacity}</span></strong><span>shared places occupied</span></div><div class="cr-queue-slots" role="img" aria-label="${occupied} of ${capacity} places occupied">${Array.from({ length: capacity }, (_, n) => `<i class="${n < Math.min(claimed, capacity) ? "is-testing" : n < Math.min(occupied, capacity) ? "is-waiting" : ""}"></i>`).join("")}</div><a href="#testing?mode=${encodeURIComponent(s.mode)}">Check eligibility ${crIcon("arrow", 12)}</a><a class="cr-queue-board" href="${crEscape(boardUrl)}" target="_blank" rel="noopener">Tester & current player ↗</a></article>`;
          })
          .join("")
      : `<div class="cr-queues-empty"><div class="cr-queue-slots" aria-hidden="true">${Array.from({ length: 20 }, () => "<i></i>").join("")}</div><h3>No published sessions here.</h3><p>Testers announce their next open queue in Discord. Choose another region or prepare your request.</p><a href="#testing" class="cr-text-link">Explore testing ${crIcon("arrow", 12)}</a></div>`;
  };
  const queueRegion = crGet("homeRegion", "all");
  main.querySelector("#home-region").value = crRegions.includes(queueRegion)
    ? queueRegion
    : "all";
  main.querySelector("#home-region").onchange = drawQueues;
  drawQueues();
  const quick = crGet("quickDesk", {});
  main.querySelector("#quick-mode").value = config.modes.some(
    (m) => m.id === quick.mode,
  )
    ? quick.mode
    : "mace";
  main.querySelector("#quick-region").value = crRegions.includes(quick.region)
    ? quick.region
    : "EU";
  const drawQuick = () => {
    const mode = main.querySelector("#quick-mode").value,
      region = main.querySelector("#quick-region").value;
    crSet("quickDesk", { mode, region });
    main.querySelector("#quick-command").textContent =
      "/queue status mode:" + mode + " region:" + region;
  };
  main.querySelector("#quick-mode").onchange = drawQuick;
  main.querySelector("#quick-region").onchange = drawQuick;
  main.querySelector("#quick-copy").onclick = () =>
    copy(main.querySelector("#quick-command").textContent);
  drawQuick();
  const recent = [...(data.recent || [])].sort(
    (a, b) => (Date.parse(b.created) || 0) - (Date.parse(a.created) || 0),
  );
  main.querySelector("#home-recent-results").innerHTML = recent.length
    ? recent
        .slice(0, 5)
        .map((r) => {
          const url = crEvidence(r.evidence);
          return `<article class="cr-recent-result"><span class="cr-timeline-point"></span><div><strong>${crEscape(r.name)}</strong><small>${crEscape(config.modes.find((m) => m.id === r.mode)?.name || r.mode)} · ${crEscape(r.region)} · ${crDate(r.created)}</small>${url ? `<a href="${url}" target="_blank" rel="noopener">Match evidence ↗</a>` : "<small>Evidence link unavailable</small>"}</div>${crToken(r)}</article>`;
        })
        .join("")
    : '<div class="cr-subtle-empty">' +
      crIcon("activity", 26) +
      "<p>The next result belongs here.</p><small>Reviewed tests and match evidence appear as they are published.</small></div>";

  const colours = ["#f2c562", "#b6c9ec", "#c99778", "#78b49e", "#8c9db8"],
    total = snapshot.placements;
  let offset = 0;
  const arcs = snapshot.tiers
    .map((count, n) => {
      const length = total ? (count / total) * 100 : 0,
        arc = `<circle cx="70" cy="70" r="52" fill="none" stroke="${colours[n]}" stroke-width="13" pathLength="100" stroke-dasharray="${length} ${100 - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)"/>`;
      offset += length;
      return arc;
    })
    .join("");
  main.querySelector("#home-tier-chart").innerHTML =
    `<svg viewBox="0 0 140 140" role="img" aria-label="${total} active placements across five tiers"><circle cx="70" cy="70" r="52" fill="none" stroke="#ffffff09" stroke-width="13"/>${arcs}<text x="70" y="69" text-anchor="middle" class="cr-donut-total">${total}</text><text x="70" y="86" text-anchor="middle" class="cr-donut-label">placements</text></svg>`;
  main.querySelector("#home-tier-legend").innerHTML = snapshot.tiers
    .map(
      (count, n) =>
        `<div><span style="--tier-colour:${colours[n]}"></span><small>Tier ${n + 1}</small><strong>${count}</strong><em>${total ? Math.round((count / total) * 100) : 0}%</em></div>`,
    )
    .join("");
  const regionRows = Object.entries(snapshot.regions).sort(
    (a, b) => b[1] - a[1],
  );
  main.querySelector("#home-region-chart").innerHTML = regionRows.length
    ? regionRows
        .slice(0, 6)
        .map(
          ([region, count]) =>
            `<div class="cr-region-bar"><span>${crEscape(region)}</span><meter min="0" max="${snapshot.players || 1}" value="${count}" aria-label="${crEscape(region)}: ${count} players"></meter><strong>${count}</strong></div>`,
        )
        .join("")
    : '<div class="cr-subtle-empty">' +
      crIcon("globe", 32) +
      "<p>A global arena, ready to grow.</p><small>Published player regions will appear here.</small></div>";
  const drawActivity = () => {
    const buckets = activityBuckets(recent, chartDays),
      max = Math.max(1, ...buckets.map((b) => b.count)),
      count = buckets.reduce((n, b) => n + b.count, 0);
    main.querySelector("#home-activity-chart").innerHTML =
      `<div class="cr-activity-total"><strong>${count}</strong><span>tests / ${chartDays} days</span></div><div class="cr-activity-bars" role="img" aria-label="${count} published tests in the last ${chartDays} UTC days">${buckets.map((b) => `<div title="${b.day}: ${b.count} tests"><span style="height:${(b.count / max) * 100}%"></span><i></i></div>`).join("")}</div><div class="cr-chart-axis"><span>${crDate(buckets[0].day)}</span><span>Today · UTC</span></div>`;
    main
      .querySelectorAll("[data-chart-days]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(Number(b.dataset.chartDays) === chartDays),
        ),
      );
  };
  main.querySelectorAll("[data-chart-days]").forEach(
    (b) =>
      (b.onclick = () => {
        chartDays = Number(b.dataset.chartDays);
        drawActivity();
      }),
  );
  drawActivity();
  const testerNode = main.querySelector("#tester-activity");
  const deskOrigin =
    location.hostname === "drax12341.github.io"
      ? "https://minecraft-pvp-community.draxion0.chatgpt.site"
      : "";
  fetch(deskOrigin + "/api/testing-desk", {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  })
    .then(async (response) => {
      if (!response.ok) throw Error();
      const result = await response.json();
      if (!Array.isArray(result.leaderboard)) throw Error();
      if (main.querySelector("#tester-activity") !== testerNode) return;
      testerNode.innerHTML = result.leaderboard.length
        ? result.leaderboard
            .slice(0, 5)
            .map(
              (t, n) =>
                `<div class="cr-tester-row"><span>${n + 1}</span><img src="https://mc-heads.net/avatar/${encodeURIComponent(t.name)}/40" alt="" width="30" height="30" loading="lazy" referrerpolicy="no-referrer"><strong>${crEscape(t.name)}</strong><small>${Math.max(0, Number(t.tests) || 0)} tests</small></div>`,
            )
            .join("")
        : '<div class="cr-subtle-empty">' +
          crIcon("shield", 30) +
          "<p>Ready for the next challenger.</p><small>Published staff testing activity will appear here.</small></div>";
    })
    .catch(() => {
      if (main.querySelector("#tester-activity") === testerNode)
        testerNode.innerHTML =
          '<p class="cr-subtle-empty">Tester activity is unavailable. Check /tester leaderboard in Discord.</p>';
    });
  const updateTag = () => {
    const mode = config.modes.find(
        (m) => m.id === main.querySelector("#preview-mode").value,
      ),
      tier = main.querySelector("#preview-tier").value;
    main.querySelector("#home-tag-preview b").textContent =
      "[" + (mode?.name || "Mace") + " " + tier + "]";
    main.querySelector("#home-tag-preview b").style.color =
      main.querySelector("#preview-colour").value;
  };
  ["#preview-mode", "#preview-tier", "#preview-colour"].forEach((id) =>
    main
      .querySelector(id)
      .addEventListener(id.includes("colour") ? "input" : "change", updateTag),
  );
  main.querySelector("#tag-preview-cycle").onclick = () => {
    const select = main.querySelector("#preview-tier");
    select.selectedIndex = (select.selectedIndex + 1) % select.options.length;
    updateTag();
  };
  updateTag();
  main
    .querySelectorAll("[data-cr-copy]")
    .forEach((b) => (b.onclick = () => copy(b.dataset.crCopy)));
  main.querySelectorAll("[data-scene-choice]").forEach(
    (b) =>
      (b.onclick = () => {
        const scene = b.dataset.sceneChoice;
        main.querySelector(".control-hero").dataset.scene = scene;
        crSet("heroScene", scene);
        main
          .querySelectorAll("[data-scene-choice]")
          .forEach((other) =>
            other.setAttribute("aria-pressed", String(other === b)),
          );
      }),
  );
  const target = (t) => {
    main
      .querySelectorAll("[data-target-tier]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.targetTier === t)),
      );
    const high = ["HT3", "LT2", "HT2", "LT1", "HT1"].includes(t);
    main.querySelector("#home-target-result").innerHTML =
      `<div><span class="rank-token rank-token-${t.slice(-1)}">${t}</span><strong>${config.points[t]}<small>earned points</small></strong></div><p>${high ? "Recorded high-tier phases and independent review." : "A qualified tester and a documented evaluation."} Play and evidence determine the placement.</p><a class="button secondary" href="#${high ? "test-desk" : "testing"}?mode=mace&tier=${t}">Explore the ${t} path ${crIcon("arrow", 14)}</a>`;
  };
  main
    .querySelectorAll("[data-target-tier]")
    .forEach((b) => (b.onclick = () => target(b.dataset.targetTier)));
  target("HT3");
  const guide = {
    verify: [
      "Your account. Your identity.",
      "Start with private ownership verification. Staff confirm your Minecraft account before you enter an official queue. Never share a password or account token.",
      "/desk",
    ],
    queue: [
      "A real place in a real session.",
      "Choose your discipline and region. Open sessions have 20 shared slots for waiting and active tests. Your private status explains your place and cooldown.",
      "/queue status",
    ],
    play: [
      "Play, review and earn your placement.",
      "Your qualified tester opens a private room. Confirm readiness and exact equipment, play recorded sets, and receive a reviewed result with shareable evidence.",
      "/test-hub",
    ],
  };
  const guideButtons = [...main.querySelectorAll("[data-guide-step]")],
    activateGuide = (b) => {
      guideButtons.forEach((other) => {
        other.setAttribute("aria-selected", String(other === b));
        other.tabIndex = other === b ? 0 : -1;
      });
      const [title, text, command] = guide[b.dataset.guideStep],
        panel = main.querySelector("#guide-detail");
      panel.setAttribute("aria-labelledby", b.id);
      panel.innerHTML = `<span class="cr-guide-icon">${crIcon(b.dataset.guideStep === "verify" ? "shield" : b.dataset.guideStep === "queue" ? "queue" : "trophy", 32)}</span><h3>${title}</h3><p>${text}</p><code>${command}</code><a href="${crEscape(config.invite)}" class="cr-text-link" target="_blank" rel="noopener">Open Discord ${crIcon("arrow", 14)}</a>`;
    };
  guideButtons.forEach((b, n) => {
    b.onclick = () => activateGuide(b);
    b.onkeydown = (e) => {
      const index =
        e.key === "ArrowDown" || e.key === "ArrowRight"
          ? (n + 1) % guideButtons.length
          : e.key === "ArrowUp" || e.key === "ArrowLeft"
            ? (n + guideButtons.length - 1) % guideButtons.length
            : e.key === "Home"
              ? 0
              : e.key === "End"
                ? guideButtons.length - 1
                : -1;
      if (index < 0) return;
      e.preventDefault();
      guideButtons[index].focus();
      activateGuide(guideButtons[index]);
    };
  });
  activateGuide(guideButtons[0]);
  const scrollSection = (id) =>
    main
      .querySelector("#home-" + (id === "queues" ? "queues-panel" : id))
      ?.scrollIntoView?.({
        block: "start",
        behavior:
          document.body.classList.contains("calm-view") ||
          window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
      });
  main.querySelectorAll("[data-cr-section]").forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        scrollSection(a.dataset.crSection);
      }),
  );
  const section = params.get("section");
  if (
    [
      "leaderboard",
      "queues",
      "analytics",
      "testing",
      "tagger",
      "faq",
      "disciplines",
    ].includes(section)
  )
    scrollSection(section);
}
