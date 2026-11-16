import {
  controlRoomSnapshot,
  selectControlPlayers,
  crPoints,
} from "./control-room.js?v=orbit-v1";

const html = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (id) =>
  `<img src="./assets/modes/${["mace", "mace_spear", "mace_ht", "mace_lt", "mace_og", "mace_rod", "mace_rocket"].includes(id) ? id : "overall"}.png" width="32" height="32" alt="" loading="lazy">`;
const arrow =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const tier = (r) => (r.pos === 0 ? "HT" : "LT") + r.tier;
const avatar = (p) =>
  /^[a-f0-9-]{32,36}$/i.test(p.uuid)
    ? `<img src="https://mc-heads.net/avatar/${encodeURIComponent(p.uuid)}/64" width="40" height="40" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : '<span class="orbit-avatar" aria-hidden="true">◇</span>';

export function renderOrbitHome({
  main,
  config,
  data,
  testing,
  saved,
  profile,
  openMode,
  onSave,
}) {
  const doc = main.ownerDocument,
    win = doc.defaultView;
  doc.body.dataset.exploded = "false";
  const stats = controlRoomSnapshot(data, testing, config);
  const scope = { mode: "overall", region: "all", query: "", sort: "points" };
  const date = Number.isFinite(Date.parse(data.updatedAt))
    ? new Date(data.updatedAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Awaiting first publication";
  main.innerHTML = `
    <section class="orbit-hero" aria-labelledby="orbit-heading">
      <div class="orbit-hero-copy">
        <p class="orbit-intro"><span class="orbit-status-dot"></span> Independent Minecraft PvP</p>
        <h1 id="orbit-heading"><span>Drop in.</span><span>Stand out.</span></h1>
        <p class="orbit-lede">One community. Seven ways to master the Mace.<br>Find your competition. Earn your place.</p>
        <div class="orbit-actions"><a class="button" href="#rankings">Explore rankings ${arrow}</a><a class="orbit-link" href="#test-desk">Get tested ${arrow}</a></div>
        <div class="orbit-hero-note"><span class="orbit-mini-mace">${icon("mace")}</span><p>Every placement earned.<br><strong>Every result, our own.</strong></p></div>
      </div>
      <div class="orbit-hero-stage" aria-label="Interactive Mace illustration">
        <span class="orbit-scene-caption">The Mace / built to make an impact</span>
        <div class="orbit-scene-label"><span class="orbit-crosshair" aria-hidden="true">+</span><span>Heavy core<br><strong>One perfect hit.</strong></span></div>
        <button class="orbit-scene-control" id="orbit-explode" aria-pressed="false">Break it apart <span aria-hidden="true">↗</span></button>
      </div>
      <a class="orbit-scroll" href="#home?section=disciplines" data-orbit-scroll="orbit-disciplines"><span>Find your discipline</span><span aria-hidden="true">↓</span></a>
    </section>
    <div class="orbit-proof" aria-label="Community snapshot">
      <div><strong data-orbit-count="${stats.players}">${stats.players}</strong><span>Ranked players</span></div>
      <div><strong data-orbit-count="${stats.placements}">${stats.placements}</strong><span>Active placements</span></div>
      <div><strong>${config.modes.length}</strong><span>Mace disciplines</span></div>
      <div class="orbit-proof-note"><span class="orbit-status-dot"></span><span>Published community data<small>${html(date)}</small></span></div>
    </div>
    <section class="orbit-section" id="orbit-disciplines" aria-labelledby="disciplines-heading">
      <div class="orbit-section-head"><div><p class="orbit-section-note">Pick your playstyle</p><h2 id="disciplines-heading">Same weapon.<br>Different game.</h2></div><p>From the first drop to the last rocket.<br>Every discipline has its own board.</p></div>
      <div class="orbit-disciplines">${config.modes.map((m, n) => `<button class="orbit-discipline" data-orbit-open="${html(m.id)}" data-orbit-color="${html(m.color)}" style="--discipline:${html(m.color)}"><span class="orbit-discipline-icon">${icon(m.id)}</span><span><small>${n === 0 ? "The original" : "Mace discipline"}</small><strong>${html(m.name)}</strong></span><span class="orbit-discipline-arrow" aria-hidden="true">↗</span></button>`).join("")}</div>
    </section>
    <section class="orbit-section orbit-board-section" aria-labelledby="board-heading">
      <div class="orbit-section-head"><div><p class="orbit-section-note">The community board</p><h2 id="board-heading">A place worth earning.</h2></div><a class="orbit-link" href="#rankings">Full tier board ${arrow}</a></div>
      <div class="orbit-mode-tabs" role="group" aria-label="Filter leaderboard by discipline"><button data-orbit-mode="overall" aria-pressed="true">${icon("overall")}Overall</button>${config.modes.map((m) => `<button data-orbit-mode="${html(m.id)}" aria-pressed="false">${icon(m.id)}${html(m.name)}</button>`).join("")}</div>
      <div class="orbit-board-layout"><div class="orbit-board">
        <div class="orbit-board-controls"><label class="orbit-search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg><input id="orbit-player-search" type="search" placeholder="Find a player…" aria-label="Search leaderboard" maxlength="64"></label><label class="orbit-region"><span class="sr-only">Region</span><select id="orbit-region"><option value="all">All regions</option>${["EU", "NA", "AS", "AU", "OC", "SA", "ME", "AF"].map((r) => `<option>${r}</option>`).join("")}</select></label></div>
        <div id="orbit-leaderboard" aria-live="polite"></div><div class="orbit-board-bottom"><span id="orbit-board-count"></span><a href="#watchlist">Your saved players ${arrow}</a></div>
      </div><aside class="orbit-queue-panel"><div class="orbit-panel-title"><span class="orbit-status-dot"></span><h3>Testing sessions</h3></div><p class="orbit-queue-note">Published availability</p><div id="orbit-queues"></div><a class="button secondary" href="#testing">View all sessions ${arrow}</a><p class="orbit-fine">Check Discord for the latest availability.</p></aside></div>
    </section>
    <section class="orbit-journey orbit-section" aria-labelledby="journey-heading">
      <div class="orbit-journey-heading"><p class="orbit-section-note">Your next chapter</p><h2 id="journey-heading">Good fights.<br>Better players.</h2><a class="orbit-link" href="#test-desk">Open the testing desk ${arrow}</a></div>
      <div class="orbit-journey-steps"><article><span>01</span><div><h3>Make yourself known.</h3><p>Join Discord and link your Minecraft Java account.</p></div></article><article><span>02</span><div><h3>Find your match.</h3><p>Pick your discipline and region. Join an available testing session.</p></div></article><article><span>03</span><div><h3>Leave your mark.</h3><p>Play your test. Earn a verified placement and start your next climb.</p></div></article></div>
    </section>
    <section class="orbit-tool-grid orbit-section" aria-label="Player tools">
      <article class="orbit-tier-tool"><div><p class="orbit-section-note">Know your next move</p><h2>Every tier<br>has a value.</h2><p>Explore the scoring before your next test.</p></div><div class="orbit-tier-calculator"><label for="orbit-tier">Explore a tier</label><select id="orbit-tier">${Object.keys(
        config.points,
      )
        .map(
          (t) => `<option${t === "HT3" ? " selected" : ""}>${html(t)}</option>`,
        )
        .join(
          "",
        )}</select><output id="orbit-tier-points" for="orbit-tier"></output><small id="orbit-tier-note">Tier explorer only. Your published placement stays unchanged.</small></div><a class="orbit-link" href="#planner">Explore all tiers ${arrow}</a></article>
      <article class="orbit-tagger-tool" id="orbit-tagger"><div class="orbit-nametag-demo" aria-label="Example TierTagger nametag"><span>Example nametag</span><strong><b>HT3</b> YourName</strong><div class="orbit-pixel-head" aria-hidden="true"><i></i><i></i></div></div><div><p class="orbit-section-note">Take your tier with you</p><h2>Your game.<br>Your signature.</h2><p>Show your community placement in Minecraft with TierTagger.</p><a class="orbit-link" href="#tagger">Explore TierTagger ${arrow}</a></div></article>
    </section>
    <section class="orbit-final orbit-section"><p class="orbit-section-note">The board starts with a fight.</p><h2>Make the next one count.</h2><a class="button" href="${html(config.invite)}" target="_blank" rel="noopener noreferrer">Join the community ${arrow}</a><span aria-hidden="true" class="orbit-final-word">MACE</span></section>`;

  function draw() {
    const rows = selectControlPlayers(data.players, config, scope, saved);
    main.querySelector("#orbit-leaderboard").innerHTML = rows.length
      ? `<div class="orbit-table-heading"><span>Rank</span><span>Player</span><span>Region</span><span>Points</span><span>Save</span></div>` +
        rows
          .slice(0, 8)
          .map(
            (p, n) =>
              `<div class="orbit-player-row"><span class="orbit-player-place">${String(n + 1).padStart(2, "0")}</span><button class="orbit-player-name" data-orbit-profile="${html(p.uuid)}">${avatar(p)}<span><strong>${html(p.name)}</strong><small>${Object.entries(
                p.rankings,
              )
                .filter(
                  ([id, r]) =>
                    !r.retired &&
                    (scope.mode === "overall" || id === scope.mode),
                )
                .map(
                  ([, r]) =>
                    `<span class="orbit-tier-badge" data-tier="${r.tier}">${html(tier(r))}</span>`,
                )
                .join(
                  "",
                )}</small></span></button><span class="orbit-player-region">${html(p.region || "—")}</span><strong class="orbit-player-points">${crPoints(p, config, scope.mode)}</strong><button class="orbit-save" data-orbit-save="${html(p.uuid)}" aria-label="${saved.has(p.uuid) ? "Unsave" : "Save"} ${html(p.name)}" aria-pressed="${saved.has(p.uuid)}">${saved.has(p.uuid) ? "★" : "☆"}</button></div>`,
          )
          .join("")
      : `<div class="orbit-empty"><span aria-hidden="true">${icon(scope.mode)}</span><h3>${data.players.length ? "No players in this view." : "No placements published yet."}</h3><p>${data.players.length ? "Try another discipline, region or name." : "The first names belong to this community’s first verified results."}</p><a class="orbit-link" href="#test-desk">${data.players.length ? "How testing works" : "Be part of the first chapter"} ${arrow}</a></div>`;
    main.querySelector("#orbit-board-count").textContent = rows.length
      ? `${Math.min(rows.length, 8)} of ${rows.length} players · active placements`
      : "Community results only";
    main
      .querySelectorAll("[data-orbit-profile]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            profile(
              data.players.find((p) => p.uuid === b.dataset.orbitProfile),
            )),
      );
    main.querySelectorAll("[data-orbit-save]").forEach(
      (b) =>
        (b.onclick = () => {
          onSave(b.dataset.orbitSave);
          draw();
        }),
    );
  }
  main.querySelectorAll("[data-orbit-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        scope.mode = b.dataset.orbitMode;
        main
          .querySelectorAll("[data-orbit-mode]")
          .forEach((t) => t.setAttribute("aria-pressed", String(t === b)));
        draw();
      }),
  );
  main.querySelector("#orbit-player-search").oninput = (event) => {
    scope.query = event.target.value;
    draw();
  };
  main.querySelector("#orbit-region").onchange = (event) => {
    scope.region = event.target.value;
    draw();
  };
  main.querySelectorAll("[data-orbit-open]").forEach((b) => {
    b.onclick = () => openMode(b.dataset.orbitOpen);
    b.onpointerenter = () =>
      doc.documentElement.style.setProperty(
        "--orbit-accent",
        b.dataset.orbitColor,
      );
  });
  const sessions = testing.sessions.filter((s) =>
    ["open", "paused"].includes(s.status),
  );
  main.querySelector("#orbit-queues").innerHTML = sessions.length
    ? sessions
        .slice(0, 3)
        .map(
          (s) =>
            `<a href="#testing" class="orbit-queue-row"><span>${icon(s.mode)}<strong>${html(config.modes.find((m) => m.id === s.mode)?.name || s.mode)}</strong><small>${html(s.region)}</small></span><span>${Number(s.waiting || 0) + Number(s.claimed || 0)}/${Number(s.capacity || 20)}<small>${s.status === "open" ? "Open" : "Paused"}</small></span></a>`,
        )
        .join("")
    : '<div class="orbit-queue-empty"><span aria-hidden="true">◎</span><strong>No sessions published.</strong><p>Find your next opportunity in Discord.</p></div>';
  const updateTier = () => {
    main.querySelector("#orbit-tier-points").innerHTML =
      `<strong>${Number(config.points[main.querySelector("#orbit-tier").value]) || 0}</strong><span>points</span>`;
  };
  main.querySelector("#orbit-tier").onchange = updateTier;
  main.querySelector("#orbit-explode").onclick = (event) => {
    const button = event.currentTarget,
      expanded = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(expanded));
    button.innerHTML =
      (expanded ? "Rebuild the Mace" : "Break it apart") +
      ' <span aria-hidden="true">↗</span>';
    doc.body.dataset.exploded = String(expanded);
  };
  main.querySelector("[data-orbit-scroll]").onclick = (event) => {
    event.preventDefault();
    main
      .querySelector("#orbit-disciplines")
      .scrollIntoView?.({
        behavior: doc.body.classList.contains("calm-view")
          ? "instant"
          : "smooth",
      });
  };
  draw();
  updateTier();
  const section = new URLSearchParams(win.location.hash.split("?")[1]).get(
    "section",
  );
  if (section === "disciplines")
    main.querySelector("#orbit-disciplines").scrollIntoView?.();
}
