import {
  controlRoomSnapshot,
  selectControlPlayers,
  crPoints,
} from "./control-room.js?v=starlight-v2";

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
      <div class="celestial-eclipse" aria-hidden="true"><i></i><span></span></div>
      <div class="orbit-hero-copy">
        <p class="orbit-intro"><span class="orbit-status-dot"></span> Your community. Your competition.</p>
        <h1 id="orbit-heading">Leave your mark.</h1>
        <p class="orbit-lede">Seven disciplines. One place to prove yourself.<br>Discover the players shaping Mace PvP.</p>
        <div class="orbit-actions"><a class="button" href="#rankings">Explore rankings ${arrow}</a><button class="orbit-link" data-info-open="guide">How to get tested <span aria-hidden="true">?</span></button></div>
        <button class="test-counter" data-info-open="counter" aria-label="About the completed test count"><span class="counter-spark" aria-hidden="true">?</span><span>We've completed <strong id="completed-tests">${Number.isSafeInteger(data.completedTests) && data.completedTests >= 0 ? data.completedTests.toLocaleString() : "?"}</strong> tests</span><span class="counter-info" aria-hidden="true">i</span></button>
        <p class="counter-caption">Every test counts. Every comeback, too.</p>
      </div>
      <a class="orbit-scroll" href="#home?section=disciplines" data-orbit-scroll="orbit-disciplines"><span>Find your discipline</span><span aria-hidden="true">?</span></a>
    </section>
    <div class="orbit-proof" aria-label="Community snapshot">
      <div><strong data-orbit-count="${stats.players}">${stats.players}</strong><span>Ranked players</span></div>
      <div><strong data-orbit-count="${stats.placements}">${stats.placements}</strong><span>Active placements</span></div>
      <div><strong>${config.modes.length}</strong><span>Mace disciplines</span></div>
      <div class="orbit-proof-note"><span class="orbit-status-dot"></span><span>Published community data<small>${html(date)}</small></span></div>
    </div>
    <section class="orbit-section test-pulse" aria-labelledby="pulse-heading">
      <div class="pulse-heading"><div><p class="orbit-section-note">The latest from the arena</p><h2 id="pulse-heading">Every fight leaves a story.</h2></div><button class="info-button" data-info-open="scoring" aria-label="How tier scoring works">i</button></div>
      <div class="pulse-tabs" role="group" aria-label="Result feed"><button data-pulse="recent" aria-pressed="true">Recent tests</button><button data-pulse="high" aria-pressed="false">High-tier results <span>HT3+</span></button><a href="#results">All results ${arrow}</a></div>
      <div id="test-pulse-feed" aria-live="polite"></div>
    </section>
    <section class="orbit-section" id="orbit-disciplines" aria-labelledby="disciplines-heading">
      <div class="orbit-section-head"><div><p class="orbit-section-note">Pick your playstyle</p><h2 id="disciplines-heading">Find your edge.</h2></div><p>From the first drop to the last rocket.<br>Every discipline has its own board.</p></div>
      <div class="orbit-disciplines">${config.modes.map((m, n) => `<button class="orbit-discipline" data-orbit-open="${html(m.id)}" data-orbit-color="${html(m.color)}" style="--discipline:${html(m.color)}"><span class="orbit-discipline-icon">${icon(m.id)}</span><span><small>${n === 0 ? "The original" : "Mace discipline"}</small><strong>${html(m.name)}</strong></span><span class="orbit-discipline-arrow" aria-hidden="true">↗</span></button>`).join("")}</div>
    </section>
    <section class="orbit-section orbit-board-section" aria-labelledby="board-heading">
      <div class="orbit-section-head"><div><p class="orbit-section-note">The community board</p><h2 id="board-heading">The community tierlist.</h2></div><a class="orbit-link" href="#rankings">Full tier board ${arrow}</a></div>
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

  const dialog = doc.createElement("dialog");
  dialog.className = "community-info";
  dialog.setAttribute("aria-labelledby", "community-info-title");
  main.append(dialog);
  const panels = {
    counter: [
      "Every test counts.",
      "<p>This total counts completed, published community tests, including repeat tests by the same player. Revoked results are excluded. Staff adjustments and tier previews do not count.</p><p>The counter updates when a new snapshot is published and refreshed. A dash means the current snapshot does not include a total yet.</p>",
    ],
    guide: [
      "Your next placement starts here.",
      '<ol><li><strong>Join the community.</strong><p>Open Discord and follow the account verification instructions.</p></li><li><strong>Choose your discipline.</strong><p>Pick a mode and region, then join an available testing session.</p></li><li><strong>Play. Learn. Climb.</strong><p>A qualified tester reviews your match evidence. Published results appear on your profile.</p></li></ol><a class="button" href="#test-desk" data-info-route>Open the testing desk ?</a>',
    ],
    scoring: [
      "Earn your place.",
      '<p>Points come from your published placements. The board totals active placements; each mode has its own tier ranking.</p><div class="info-points">' +
        Object.entries(config.points)
          .map(
            ([rank, points]) =>
              "<span><b>" + html(rank) + "</b>" + html(points) + " pts</span>",
          )
          .join("") +
        '</div><p>Tier explorers are previews and never change a player?s real placement.</p><a class="orbit-link" href="#kits" data-info-route>Read kits & rules ?</a>',
    ],
  };
  main.querySelectorAll("[data-info-open]").forEach((button) => {
    button.onclick = () => {
      const [title, content] = panels[button.dataset.infoOpen];
      dialog.innerHTML =
        '<button class="info-close" aria-label="Close information">?</button><span class="info-orbit" aria-hidden="true">?</span><h2 id="community-info-title">' +
        title +
        "</h2>" +
        content;
      dialog.querySelector(".info-close").onclick = () => dialog.close();
      dialog
        .querySelectorAll("[data-info-route]")
        .forEach((link) => (link.onclick = () => dialog.close()));
      dialog.showModal();
    };
  });
  dialog.onclick = (event) => {
    if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      )
        dialog.close();
    }
  };
  let pulseScope = "recent";
  function drawPulse() {
    const recent = [...(data.recent || [])]
      .filter(
        (r) =>
          r.tier >= 1 &&
          r.tier <= 5 &&
          (pulseScope !== "high" ||
            r.tier < 3 ||
            (r.tier === 3 && r.pos === 0)),
      )
      .sort(
        (a, b) => (Date.parse(b.created) || 0) - (Date.parse(a.created) || 0),
      )
      .slice(0, 5);
    main.querySelector("#test-pulse-feed").innerHTML = recent.length
      ? recent
          .map(
            (r) =>
              '<a class="pulse-result" href="#rankings?player=' +
              encodeURIComponent(r.uuid) +
              '">' +
              avatar(r) +
              "<span><strong>" +
              html(r.name) +
              "</strong><small>" +
              html(config.modes.find((m) => m.id === r.mode)?.name || r.mode) +
              " ? " +
              html(r.region) +
              '</small></span><b class="orbit-tier-badge" data-tier="' +
              Number(r.tier) +
              '">' +
              html(tier(r)) +
              "</b><time>" +
              html(
                Number.isFinite(Date.parse(r.created))
                  ? new Date(r.created).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })
                  : "Published",
              ) +
              '</time><span aria-hidden="true">?</span></a>',
          )
          .join("")
      : '<div class="pulse-empty"><span aria-hidden="true">?</span><div><strong>' +
        (pulseScope === "high"
          ? "The next breakthrough belongs here."
          : "A new chapter is about to begin.") +
        "</strong><p>" +
        (pulseScope === "high"
          ? "Published HT3 and higher results will appear here."
          : "Completed community tests will appear here. Ready to be first?") +
        '</p></div><a href="#testing">Find a session ?</a></div>';
  }
  main.querySelectorAll("[data-pulse]").forEach(
    (button) =>
      (button.onclick = () => {
        pulseScope = button.dataset.pulse;
        main
          .querySelectorAll("[data-pulse]")
          .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        drawPulse();
      }),
  );
  drawPulse();

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
  main.querySelector("[data-orbit-scroll]").onclick = (event) => {
    event.preventDefault();
    main.querySelector("#orbit-disciplines").scrollIntoView?.({
      behavior: doc.body.classList.contains("calm-view") ? "instant" : "smooth",
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
