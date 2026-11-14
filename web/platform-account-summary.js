import {
  state,
  escape as e,
  badge,
  modeIcon,
  tierOf,
  peakOf,
  formatDate,
} from "./platform-data.js";
export function connectedSummary(me) {
  const p = me.competitive,
    active = (me.queue || []).filter((q) =>
      ["waiting", "claimed"].includes(q.status),
    );
  return `<section class="panel account-overview-card"><div class="account-welcome"><span class="micro-label">Welcome to your competitive hub</span><h2>${e(me.account.name)}</h2><p>Your Minecraft identity is linked to <strong>${e(me.user.name)}</strong> on Discord.</p></div><div class="personal-metrics">${[
    ["Overall rank", p?.rank ? "#" + p.rank : "Unranked"],
    ["Competitive points", p?.points ?? 0],
    ["Official tests", me.totals?.officialTests ?? 0],
  ]
    .map(
      ([label, value]) =>
        `<div><strong>${e(value)}</strong><span>${label}</span></div>`,
    )
    .join(
      "",
    )}</div><dl class="account-link-details"><div><dt>Minecraft UUID</dt><dd>${e(me.account.uuid)}</dd></div><div><dt>Ownership verified</dt><dd>${e(formatDate(me.account.verified_at))}</dd></div><div><dt>Testing region</dt><dd>${e(me.settings?.region || "Choose your region")}</dd></div><div><dt>Queue status</dt><dd>${active.length ? e(active[0].status === "claimed" ? "Assigned to a tester" : "Waiting in " + active[0].region) : "Not in a live queue"}</dd></div></dl><div class="account-overview-links"><a class="button small" href="/account/testing">My testing status</a><a class="button secondary small" href="/account/settings">Account settings</a><a class="text-link" href="/players/${encodeURIComponent(me.account.uuid)}">Public profile ↗</a></div></section><section class="account-mode-summary"><div class="section-title"><h3>Your Mace disciplines</h3><a href="/account/history" class="text-link">History ↗</a></div><div class="grid two">${state.config.modes
    .map((m) => {
      const rank = p?.rankings?.[m.id];
      return `<a class="panel personal-mode-card" href="/rankings/${encodeURIComponent(m.id)}">${modeIcon(m.id)}<div><strong>${e(m.name)}</strong><small>Peak ${peakOf(rank) || "Unranked"}</small></div>${badge(tierOf(rank))}</a>`;
    })
    .join("")}</div></section>`;
}
