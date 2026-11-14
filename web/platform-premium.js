import {
  state,
  tiers,
  regions,
  escape as e,
  safeUrl,
  modeName,
  tierOf,
  peakOf,
  profileLink,
  badge,
  skin,
  modeIcon,
  head,
  section,
  statistics,
  rankingRows,
  resultCard,
  queueCard,
  modeTabs,
  selectField,
  field,
  regionField,
  pager,
  api,
} from "./platform-data.js";
const glyphs = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  shield:
    '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  swords:
    '<path d="m4 3 17 17M3 4l5 1-3 3-1-5Zm16-1L3 20m17-16-5 1 3 3 2-5ZM3 16l5 5m8-18 5 5"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  users:
    '<path d="M3 21v-3a5 5 0 0 1 10 0v3m3-9a4 4 0 0 1 5 4v4"/><circle cx="8" cy="7" r="4"/><path d="M16 3a4 4 0 0 1 0 8"/>',
  trophy:
    '<path d="M7 3h10v6a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 14v6m-5 1h10"/>',
  chevron: '<path d="m8 5 7 7-7 7"/>',
};
export const icon = (name, cls = "") =>
  `<svg class="ui-icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphs[name] || glyphs.spark}</svg>`;
function premiumStats() {
  const s = state.statistics;
  return `<div class="network-stats" data-reveal>${[
    ["verified", "Verified competitors", "users"],
    ["completedTests", "Official evaluations", "swords"],
    ["activeTesters", "Active testers", "shield"],
    ["openQueues", "Open queues", "globe"],
  ]
    .map(
      ([k, l, i]) =>
        `<div class="network-stat">${icon(i)}<div><strong data-count="${Number(s?.[k] || 0)}">${Number(s?.[k] || 0).toLocaleString()}</strong><span>${l}</span></div></div>`,
    )
    .join("")}</div>`;
}
function champion(p) {
  return `<a class="champion-feature" href="${profileLink(p)}"><div class="champion-rank">01<span>Overall leader</span></div>${skin(p, true)}<div class="champion-info"><span class="status-pill award">${e(p.title || "Competitor")}</span><h3>${e(p.name)}</h3><p>${e(regions[p.region] || p.region)} · ${p.points} points</p><span>View competitor ${icon("arrow")}</span></div></a>`;
}
function seasonEmpty() {
  return `<div class="ranking-invitation"><div class="invitation-emblem">${icon("trophy")}<span class="emblem-orbit"></span></div><div><span class="micro-label">The competitive field is open</span><h3>A place on this board<br>has to be earned.</h3><p>Verify your account. Pick your Mace discipline. Your first confirmed tier creates your competitive profile.</p><a class="button" href="/how-to-test">Get your first tier ${icon("arrow")}</a></div><div class="invitation-tiers" aria-label="Official tier hierarchy">${[1, 2, 3, 4, 5].map((n) => `<div>${badge("HT" + n)}${badge("LT" + n)}<small>Tier ${n}</small></div>`).join("")}</div></div>`;
}
export async function home() {
  const [r, results, q] = await Promise.all([
    api("/rankings?limit=10"),
    api("/results?limit=4"),
    api("/queues"),
  ]);
  const modes = state.config.modes,
    mode = modes[0];
  return `<div class="network-ribbon"><span><i class="live-dot"></i> Official Mace testing network</span><a href="/queues">${state.statistics.openQueues ? state.statistics.openQueues + " queues open" : "Find your next testing session"} ${icon("arrow")}</a></div><section class="arena-hero"><div class="arena-copy"><div class="hero-caption">Mace Competitive Network <span>Where the next legends begin</span></div><h1>YOUR NEXT<br>PEAK<span class="hero-period">.</span></h1><p>Rise through the Mace competitive network.<br>${modes.length} disciplines. One connected identity.<br>Prove your skill. Build your legacy.</p><div class="actions"><a class="button primary-large" href="/rankings">Explore rankings ${icon("arrow")}</a><a class="button secondary primary-large" href="/how-to-test">Get tier tested</a></div><div class="hero-proof">${icon("shield")}<span>Verified accounts. Traceable results. Real competition.</span></div></div><div class="arena-stage" data-parallax><div class="arena-coordinate coordinate-top">MACE / COMPETITIVE DIVISION</div><div class="cosmic-portal"><div class="portal-aura"></div><div class="portal-orbit outer"></div><div class="portal-orbit inner"></div><div class="portal-orbit"></div><img class="arena-art community-crest" src="/assets/community-crest.png" width="1024" height="1024" alt="Official community emblem featuring the Mace and Tiers artwork" fetchpriority="high"><div class="portal-satellite satellite-primary">${icon("shield")}<div><strong>One verified identity</strong><small>Discord + Minecraft</small></div></div><div class="portal-satellite satellite-secondary">${icon("trophy")}<div><strong>Every peak recorded</strong><small>Your competitive legacy</small></div></div><span class="portal-star one"></span><span class="portal-star two"></span><div class="portal-status"><i></i> THE OFFICIAL MACE COMPETITIVE NETWORK</div></div><div class="arena-cross cross-one"></div><div class="arena-cross cross-two"></div><div class="arena-modeplate">${modeIcon(mode.id)}<div><small>Featured discipline</small><strong id="hero-mode-name">${e(mode.name)}</strong></div><a id="hero-mode-link" href="/modes/${mode.id}" aria-label="View featured mode">${icon("arrow")}</a></div><div class="arena-coordinate coordinate-bottom">PLAY. PROVE. PROGRESS.</div></div></section>${premiumStats()}<section class="discipline-section" data-reveal><div class="section-heading"><div><span class="micro-label">Choose your discipline</span><h2>Built around the Mace.</h2></div><a class="text-link" href="/modes">Explore every mode ${icon("arrow")}</a></div><div class="discipline-rail">${modes.map((m, n) => `<a class="discipline-tile ${n === 0 ? "is-featured" : ""}" href="/rankings/${encodeURIComponent(m.id)}" data-feature-mode="${e(m.id)}"><span class="discipline-art" style="--discipline-color:${/^#[a-f0-9]{6}$/i.test(m.color) ? m.color : "#7966ff"}">${modeIcon(m.id)}</span><strong>${e(m.name)}</strong><small>View rankings ${icon("chevron")}</small></a>`).join("")}</div></section><section class="competitive-section" data-reveal><div class="section-heading"><div><span class="micro-label">The leaderboard</span><h2>Competition, in its purest form.</h2></div><a class="text-link" href="/rankings">Full rankings ${icon("arrow")}</a></div>${
    r.players.length
      ? `<div class="featured-standings">${champion(r.players[0])}<div class="standing-list">${r.players
          .slice(1, 5)
          .map(
            (p, n) =>
              `<a href="${profileLink(p)}"><span class="standing-position">0${n + 2}</span>${skin(p)}<div><strong>${e(p.name)}</strong><small>${e(p.title || "Competitor")} · ${e(p.region)}</small></div><b>${p.points}<small>pts</small></b>${icon("chevron")}</a>`,
          )
          .join("")}</div></div>${rankingRows(r.players.slice(5))}`
      : seasonEmpty()
  }</section><section class="network-section" data-reveal><div class="section-heading"><div><span class="micro-label">The testing floor</span><h2>Your next evaluation starts here.</h2></div><a class="text-link" href="/queues">View all queues ${icon("arrow")}</a></div><div class="grid regional-network">${[
    "EU",
    "NA",
    "AS",
  ]
    .map((region) =>
      queueCard(
        mode.id,
        region,
        q.sessions.find((s) => s.mode === mode.id && s.region === region),
      ),
    )
    .join(
      "",
    )}</div></section><section class="recent-section" data-reveal><div class="section-heading"><div><span class="micro-label">Official placements</span><h2>Every result tells a story.</h2></div><a class="text-link" href="/tests">All results ${icon("arrow")}</a></div>${results.results.length ? `<div class="grid four">${results.results.map(resultCard).join("")}</div>` : `<div class="results-awaiting"><div class="awaiting-icon">${icon("clock")}</div><div><h3>The next result is yet to be written.</h3><p>Completed evaluations and reviewed staff awards appear here automatically.</p></div><a class="button secondary" href="/how-to-test">How testing works ${icon("arrow")}</a></div>`}</section><section class="journey-section" data-reveal><div class="journey-heading"><span class="micro-label">From contender to competitor</span><h2>One test.<br>A new beginning.</h2><p>Your competitive identity follows you across every official Mace discipline.</p><a href="/how-to-test" class="text-link">See the complete process ${icon("arrow")}</a></div><ol class="journey-track">${[
    [
      "Prove your identity",
      "Enter your Minecraft Java IGN in Discord.",
      "shield",
    ],
    [
      "Find your discipline",
      "Choose a Mace submode, region and an open testing queue.",
      "globe",
    ],
    [
      "Show what you can do",
      "Meet your assigned tester in a private official evaluation.",
      "swords",
    ],
    [
      "Make it official",
      "Your confirmed tier updates your profile, roles and rankings.",
      "trophy",
    ],
  ]
    .map(
      ([t, d, i], n) =>
        `<li><span class="journey-number">0${n + 1}</span><div><h3>${t}</h3><p>${d}</p></div>${icon(i)}</li>`,
    )
    .join(
      "",
    )}</ol></section><section class="discord-banner" data-reveal><div class="discord-banner-art" aria-hidden="true">${icon("swords")}${icon("shield")}</div><div><span class="micro-label">Your community. Your competition.</span><h2>The next challenger<br>is already in Discord.</h2><p>Find testing sessions, meet the team and start your climb.</p><a class="button primary-large" href="${safeUrl(state.config.invite)}" target="_blank" rel="noopener">Join the community ${icon("arrow")}</a></div><div class="discord-banner-mark" aria-hidden="true">M<span>N</span></div></section>`;
}
function tierBoard(players, total) {
  return `<div class="tier-board">${[1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<section class="tier-board-column tier-column-${n}"><header><span class="tier-column-symbol">${["I", "II", "III", "IV", "V"][n - 1]}</span><div><h2>Tier ${n}</h2><span>${players.filter((p) => Object.values(p.rankings).some((r) => r.tier === n)).length} in this view</span></div></header>${[
          "HT",
          "LT",
        ]
          .map((prefix) => {
            const t = prefix + n,
              matching = players.filter((p) =>
                Object.values(p.rankings).some((r) => tierOf(r) === t),
              );
            return `<div class="tier-board-half"><div class="tier-half-heading">${badge(t)}<span>${prefix === "HT" ? "High" : "Low"} Tier ${n}</span><small>${matching.length}</small></div>${matching.length ? matching.map((p) => `<a class="tier-board-player" href="${profileLink(p)}">${skin(p)}<strong>${e(p.name)}</strong><span>${e(p.region)}</span></a>`).join("") : `<div class="tier-board-vacancy"><span>—</span><small>${total ? "No placements on this page" : "Awaiting official placements"}</small></div>`}</div>`;
          })
          .join("")}</section>`,
    )
    .join("")}</div>`;
}
export async function rankings(url) {
  const mode = url.pathname.split("/")[2] || "",
    params = new URLSearchParams(url.search);
  if (mode && !state.config.modes.some((m) => m.id === mode))
    throw Error("This Mace mode is not configured.");
  if (mode) params.set("mode", mode);
  const data = await api("/rankings?" + params),
    view = params.get("view") || "leaderboard";
  const boardPlayers = mode
    ? data.players.map((p) => ({
        ...p,
        rankings: { [mode]: p.rankings[mode] },
      }))
    : data.players;
  return `<div class="competition-page"><div class="competition-page-top"><div><span class="micro-label">Official competitive placements</span><h1>${mode ? e(modeName(mode)) : "GLOBAL MACE"}<br><span>RANKINGS.</span></h1><p>Every placement earned. Every discipline accounted for.</p></div><div class="ranking-summary"><div>${icon("users")}<strong>${data.total}</strong><small>Ranked competitors</small></div><div>${icon("swords")}<strong>${state.config.modes.length}</strong><small>Mace disciplines</small></div><a href="/points">How rankings work ${icon("arrow")}</a></div></div>${modeTabs(mode)}<div class="ranking-workspace"><form class="toolbar premium-toolbar" data-filter>${field("q", "Search competitors", "search", params.get("q") || "", 'placeholder="Minecraft name or UUID"')}${regionField(params.get("region") || "")}${selectField("tier", "Tier", tiers, params.get("tier") || "", "All tiers")}${selectField(
    "status",
    "Status",
    [
      ["active", "Active"],
      ["retired", "Retired"],
    ],
    params.get("status") || "",
    "All competitors",
  )}${selectField(
    "sort",
    "Sort by",
    [
      ["points", "Most points"],
      ["name", "Name"],
    ],
    params.get("sort") || "points",
    null,
  )}<input type="hidden" name="view" value="${e(view)}"><button class="button small" type="submit">Apply ${icon("arrow")}</button></form><div class="standings-toolbar"><div class="view-switch" aria-label="Rankings layout"><button data-ranking-view="leaderboard" aria-pressed="${view !== "tiers"}">${icon("users")} Leaderboard</button><button data-ranking-view="tiers" aria-pressed="${view === "tiers"}">${icon("shield")} Tier board</button></div><a href="/players/compare" class="text-link">Compare players ${icon("arrow")}</a></div>${view === "tiers" ? tierBoard(boardPlayers, data.total) : data.players.length ? rankingRows(data.players, mode) : `<div class="ranking-empty-board"><div class="ranking-header" aria-hidden="true"><span>Rank</span><span>Competitor</span><span>Region</span><span>Points</span><span>Disciplines</span></div>${seasonEmpty()}</div>`}${pager(data)}<div class="ranking-policy-note">${icon("shield")}<span>${state.config.scoring?.basis === "current" ? "Current" : "Peak"} tiers determine overall points. Ties are ordered by UUID. ${view === "tiers" ? "Tier-board counts describe this page of results." : ""}</span><a href="/points">Scoring details</a></div></div><div class="rankings-bottom"><div>${icon("swords")}<span>Ready to earn your place?</span></div><a href="/how-to-test" class="button secondary small">Get tier tested ${icon("arrow")}</a></div></div>`;
}
