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
const leaguePreference = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem("pvp:" + key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const leagueSavePreference = (key, value) => {
  try {
    localStorage.setItem("pvp:" + key, JSON.stringify(value));
  } catch {}
};

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

export function renderLeagueHome({
  main,
  config,
  data,
  testing,
  profile,
  openMode,
}) {
  const sessions = testing.sessions || [],
    open = sessions.filter((s) => s.status === "open");
  const players = data.players.filter((p) =>
    Object.values(p.rankings).some((r) => !r.retired),
  );
  const scene = leaguePreference("heroScene", "night");
  const sceneNames = {
    night: "Night sky",
    arena: "The arena",
    quiet: "Quiet space",
  };
  main.innerHTML = `
    <section class="eclipse-hero" data-scene="${["night", "arena", "quiet"].includes(scene) ? scene : "night"}" aria-labelledby="hero-title">
      <div class="hero-atmosphere" aria-hidden="true"><div class="hero-world"></div><div class="hero-nebula"></div><div class="star-layer"></div><div class="hero-vignette"></div></div>
      <div class="hero-content"><p class="hero-badge"><span aria-hidden="true">✦</span> Independent Minecraft PvP rankings</p>
        <div class="emblem-orbit" aria-hidden="true"><div class="orbital-ring"><i></i><i></i></div><div class="orbital-ring outer"><i></i></div><div class="emblem-light"></div><img src="./assets/community-emblem.svg" alt="" width="124" height="124"></div>
        <h1 class="eclipse-wordmark" id="hero-title">MACE<span>TIERLIST</span></h1>
        <p class="hero-tagline">Seven disciplines. One earned rank.<br>Find your place in the Minecraft PvP community.</p>
        <div class="hero-actions"><a class="button primary" href="#rankings">Explore rankings <span aria-hidden="true">↗</span></a><a class="button secondary" href="#test-desk">Get tier tested</a></div>
        <p class="hero-note">Community-led. Evidence-backed. Built for the fight.</p>
      </div>
      <a class="hero-scroll" href="#home?section=features" data-home-section="features"><span aria-hidden="true"></span>Explore the community</a>
      <div class="hero-scenes" role="group" aria-label="Choose a background scene">${Object.entries(
        sceneNames,
      )
        .map(
          ([id, name]) =>
            `<button type="button" data-scene-choice="${id}" aria-label="${name}" aria-pressed="${scene === id || (!sceneNames[scene] && id === "night")}"><span aria-hidden="true"></span>${name}</button>`,
        )
        .join("")}</div>
    </section>
    <div class="mode-ribbon" aria-label="Choose a Mace discipline">${config.modes.map((m) => `<button data-league-mode="${lx(m.id)}"><img src="./assets/${lx(m.id)}.svg" width="27" height="27" alt=""><span>${lx(m.name)}</span></button>`).join("")}</div>
    <section class="site-section community-stats" aria-label="Community snapshot"><div><strong>${players.length}</strong><span>Ranked players</span></div><div><strong>${config.modes.length}</strong><span>Mace disciplines</span></div><div><strong>10</strong><span>Tier bands</span></div><div><strong>${open.length}</strong><span>Open sessions</span></div></section>
    <section class="site-section" id="home-features"><div class="section-intro"><p class="section-label">Made for the community</p><h2>Everything around<br>your next good fight.</h2><p>From the first test to the next tier. Your placements, your progress and the people you play with, all in one place.</p></div>
      <div class="feature-grid">
        <article class="feature-tile feature-wide"><div class="tile-visual tier-visual" aria-hidden="true">${["HT1", "LT1", "HT2", "LT2", "HT3"].map((t, n) => `<span class="rank-token rank-token-${Math.ceil((n + 1) / 2)}">${t}</span>`).join("")}</div><div><h3>A placement you can stand behind.</h3><p>Real tests, recorded match evidence and independent high-tier review. Your rank comes from how you play.</p><a href="#rankings">Meet the ranked players ↗</a></div></article>
        <article class="feature-tile"><div class="tile-visual queue-visual"><span class="visual-status"><i aria-hidden="true"></i>${open.length ? "Testing sessions open" : "Sessions announced in Discord"}</span><strong>20<small>slots per session</small></strong><div class="visual-slots" aria-hidden="true">${Array.from({ length: 20 }, () => "<i></i>").join("")}</div></div><h3>Your next test, without the guesswork.</h3><p>Choose your discipline and region. See actual availability before joining a waitlist.</p><a href="#testing">Find a testing session ↗</a></article>
        <article class="feature-tile"><div class="tile-visual tag-visual"><span class="tag-preview" id="home-tag-preview"><b>[Mace HT3]</b> YourName</span><span class="preview-player" aria-hidden="true"><i></i><i></i><i></i></span><button id="tag-preview-cycle" class="tiny-button" aria-label="Cycle the tier tag preview">Change tier ↻</button></div><h3>Take your tier into the game.</h3><p>Readable nametag and tablist labels, using this community’s published results.</p><a href="#tagger">Explore the tier tagger ↗</a><small class="preview-caption">Illustrative tag preview, not a real placement.</small></article>
        <article class="feature-tile feature-wide feature-tools"><div class="shortcut-visual" aria-hidden="true"><kbd>Ctrl</kbd><span>+</span><kbd>K</kbd></div><div><h3>Less searching. More playing.</h3><p>Find a player, jump to a discipline or open a testing tool. Save your rivals, compare placements and explore the field.</p><button class="text-button" id="home-open-finder">Try the quick search ↗</button></div><div class="tool-links"><a href="#watchlist">Saved players</a><a href="#insights">Insights</a><a href="#planner">Tier explorer</a></div></article>
      </div>
    </section>
    <section class="site-section showcase-section" id="home-showcase"><div class="section-intro centered"><p class="section-label">Take a look around</p><h2>Your community.<br>A little closer.</h2><p>The same real placements and testing sessions that power our Discord.</p></div>
      <div class="showcase-tabs" role="tablist" aria-label="Community showcase">${[
        ["rankings", "The rankings"],
        ["queues", "Live waitlists"],
        ["profiles", "Player profiles"],
      ]
        .map(
          ([id, name], n) =>
            `<button role="tab" id="showcase-tab-${id}" data-showcase="${id}" aria-controls="showcase-${id}" aria-selected="${n === 0}" tabindex="${n === 0 ? 0 : -1}">${name}</button>`,
        )
        .join("")}</div>
      <div class="showcase-window"><div class="window-chrome" aria-hidden="true"><span></span><span></span><span></span><p>macetiers / community</p><i>Live public snapshot</i></div>
        <section id="showcase-rankings" class="showcase-panel" role="tabpanel" aria-labelledby="showcase-tab-rankings"><div class="showcase-heading"><div><h3>The player index</h3><p>One result at a time. Every placement earned.</p></div><label class="inline-select"><span class="sr-only">Player index mode</span><select id="home-board-mode"><option value="overall">Overall rankings</option>${leagueOptions(config)}</select></label></div><div id="home-player-index"></div><a class="index-bottom-link" href="#rankings">Open the full rankings <span aria-hidden="true">↗</span></a></section>
        <section id="showcase-queues" class="showcase-panel" role="tabpanel" aria-labelledby="showcase-tab-queues" hidden><div class="showcase-heading"><div><h3>Find your next session</h3><p>Published availability. No invented waiting times.</p></div><label class="inline-select"><span class="sr-only">Queue region</span><select id="home-region">${leagueRegionOptions()}</select></label></div><div id="home-queues"></div><a class="index-bottom-link" href="#testing">All sessions and eligibility <span aria-hidden="true">↗</span></a></section>
        <section id="showcase-profiles" class="showcase-panel profile-showcase" role="tabpanel" aria-labelledby="showcase-tab-profiles" hidden><div class="profile-preview-mark"><img src="./assets/community-emblem.svg" width="65" height="65" alt=""><span>${players.length ? lx(players[0].name) : "Your player profile"}<small>${players.length ? lx(players[0].region) + " · Published community player" : "Created after your first published test"}</small></span></div><div class="profile-preview-features"><span>Current placements</span><span>Peak history</span><span>Match evidence</span><span>Shareable player card</span></div><p>Follow the earned placements that make your player profile yours. Save a player, compare disciplines and keep the match evidence close.</p>${players.length ? `<button class="button secondary" data-league-profile="${lx(players[0].uuid)}">Open ${lx(players[0].name)}’s profile</button>` : '<a class="button secondary" href="#test-desk">Prepare your first test</a>'}</section>
      </div>
    </section>
    <section class="site-section testing-walkthrough" id="home-testing"><div class="section-intro"><p class="section-label">From queue to placement</p><h2>Your first tier.<br>Three clear steps.</h2><p>Choose a step to see what happens next.</p></div><div class="walkthrough-layout"><div class="walkthrough-steps" role="tablist" aria-label="Testing walkthrough">${[
      [
        "verify",
        "Verify your account",
        "Make sure your Minecraft account is yours.",
      ],
      [
        "queue",
        "Find your session",
        "Choose a discipline, region and a real open queue.",
      ],
      [
        "play",
        "Play. Review. Place.",
        "Meet your tester and earn an evidence-backed result.",
      ],
    ]
      .map(
        ([id, title, copy], n) =>
          `<button role="tab" data-guide-step="${id}" id="guide-tab-${id}" aria-controls="guide-detail" aria-selected="${n === 0}" tabindex="${n === 0 ? 0 : -1}"><span>${n + 1}</span><div><h3>${title}</h3><p>${copy}</p></div></button>`,
      )
      .join(
        "",
      )}</div><section id="guide-detail" class="walkthrough-detail" role="tabpanel" aria-labelledby="guide-tab-verify"></section></div></section>
    <section class="site-section faq-section" id="home-faq"><div class="section-intro centered"><p class="section-label">A few things worth knowing</p><h2>Good questions.</h2></div><div class="eclipse-faq">${[
      [
        "How do I get my first tier?",
        "Verify Minecraft ownership with the testing team, choose a Mace discipline and region, then join an open session in Discord. A qualified tester plays and documents your assessment.",
      ],
      [
        "Does choosing a role give me a rank?",
        "No. Interest roles and waitlist preferences help you find the right community spaces. A published, reviewed testing result is what earns a placement.",
      ],
      [
        "Can I check who is testing me?",
        "Your private testing ticket identifies your assigned tester. Discord waitlist boards also show tester activity, queue counts and the player currently being tested.",
      ],
      [
        "How do high-tier tests work?",
        "High-tier applications follow the phases in the ranked rubric, with verified opponents, scores and match evidence. Higher placements require independent senior sign-off.",
      ],
      [
        "What if I disagree with a result?",
        "You can privately appeal your own completed test in Discord. A reviewer independent of the original assessment considers it; the audit history is retained.",
      ],
      [
        "Is the website made on GitHub?",
        "Yes. The website source is public, and GitHub Actions tests, builds and deploys it to GitHub Pages. Discord and live public feeds use the community’s separate backend.",
      ],
    ]
      .map(
        ([question, answer]) =>
          `<details><summary>${question}<span aria-hidden="true">+</span></summary><p>${answer}</p></details>`,
      )
      .join("")}</div></section>
    <section class="site-section final-community"><div class="cta-orbit" aria-hidden="true"></div><img src="./assets/community-emblem.svg" width="55" height="55" alt=""><h2>Ready for your next fight?</h2><p>Find your people. Put your name on the board.</p><div class="hero-actions"><a class="button primary" href="${lx(config.invite)}" target="_blank" rel="noopener">Join the community ↗</a><a class="button secondary" href="https://github.com/drax12341/minecraft-pvp-community" target="_blank" rel="noopener">View on GitHub</a></div></section>`;
  const drawIndex = () => {
    const chosen = main.querySelector("#home-board-mode").value;
    main.querySelector(".index-bottom-link").href =
      "#rankings?" +
      new URLSearchParams({ mode: chosen, view: "list", status: "active" });
    const rows = players
      .filter(
        (p) =>
          chosen === "overall" ||
          (p.rankings[chosen] && !p.rankings[chosen].retired),
      )
      .sort((a, b) =>
        chosen === "overall"
          ? leagueActivePoints(b, config) - leagueActivePoints(a, config) ||
            a.name.localeCompare(b.name)
          : (config.points[leagueTier(b.rankings[chosen])] || 0) -
              (config.points[leagueTier(a.rankings[chosen])] || 0) ||
            a.name.localeCompare(b.name),
      )
      .slice(0, 7);
    main.querySelector("#home-player-index").innerHTML = rows.length
      ? `<div class="table-wrap"><table class="home-ranking-table"><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Region</th><th scope="col">${chosen === "overall" ? "Points" : "Tier"}</th></tr></thead><tbody>${rows.map((p, n) => `<tr><td class="index-position">${n + 1}</td><td><button class="home-player" data-home-player="${lx(p.uuid)}">${leagueAvatar(p)}<span>${lx(p.name)}</span></button></td><td><span class="region-tag">${lx(p.region)}</span></td><td>${chosen === "overall" ? leagueActivePoints(p, config) : leagueRankToken(p.rankings[chosen])}</td></tr>`).join("")}</tbody></table></div>`
      : '<div class="league-empty"><div class="empty-rank-ladder" aria-hidden="true">' +
        [1, 2, 3, 4, 5]
          .map((n) => `<span class="rank-token rank-token-${n}">T${n}</span>`)
          .join("") +
        '</div><h3>The first results start with you.</h3><p>Completed, reviewed community tests will put real player names on this board.</p><a class="text-button" href="#test-desk">Find your testing path ↗</a></div>';
    main
      .querySelectorAll("[data-home-player]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            profile(data.players.find((p) => p.uuid === b.dataset.homePlayer))),
      );
  };
  const drawQueues = () => {
    const region = main.querySelector("#home-region").value;
    const rows = sessions
      .filter((s) => region === "all" || s.region === region)
      .sort((a, b) => Number(b.status === "open") - Number(a.status === "open"))
      .slice(0, 6);
    main.querySelector("#home-queues").innerHTML = rows.length
      ? rows
          .map((s) => {
            const m = config.modes.find((m) => m.id === s.mode),
              capacity = Math.min(Number(s.capacity) || 20, 20),
              occupied = (Number(s.waiting) || 0) + (Number(s.claimed) || 0);
            const board =
              config.queueBoards?.find(
                (b) => b.mode === s.mode && b.region === s.region,
              ) || config.queueBoards?.find((b) => b.mode === s.mode);
            const url = board
              ? `https://discord.com/channels/${encodeURIComponent(board.guild)}/${encodeURIComponent(board.channel)}`
              : config.invite;
            return `<article class="home-queue" data-queue-region="${lx(s.region)}"><div class="queue-line"><img src="./assets/${lx(m?.id || "mace")}.svg" alt="" width="26" height="26"><strong>${lx(m?.name || s.mode)}</strong><span class="queue-state state-${lx(s.status)}">${lx(s.status)}</span></div><div class="queue-occupancy"><span>${lx(s.region)} · ${Number(s.waiting) || 0} waiting · ${Number(s.claimed) || 0} testing</span><strong>${occupied}/${capacity}</strong></div><meter min="0" max="${capacity}" value="${Math.min(occupied, capacity)}" aria-label="${lx(m?.name || s.mode)} ${lx(s.region)} occupied slots">${occupied} of ${capacity}</meter><a href="${lx(url)}" target="_blank" rel="noopener">Open in Discord ↗</a></article>`;
          })
          .join("")
      : '<div class="queue-empty"><span aria-hidden="true">◷</span><h3>No published sessions in this view.</h3><p>Testers announce their availability in Discord. A saved waitlist preference helps the team see demand; it does not reserve a queue place.</p><a href="' +
        lx(config.invite) +
        '" target="_blank" rel="noopener">Check Discord ↗</a></div>';
  };
  const region = leaguePreference("homeRegion", "all"),
    chosen = leaguePreference("homeMode", "overall");
  main.querySelector("#home-region").value = leagueRegions.includes(region)
    ? region
    : "all";
  main.querySelector("#home-board-mode").value = config.modes.some(
    (m) => m.id === chosen,
  )
    ? chosen
    : "overall";
  main.querySelector("#home-region").onchange = () => {
    leagueSavePreference(
      "homeRegion",
      main.querySelector("#home-region").value,
    );
    drawQueues();
  };
  main.querySelector("#home-board-mode").onchange = () => {
    leagueSavePreference(
      "homeMode",
      main.querySelector("#home-board-mode").value,
    );
    drawIndex();
  };
  drawIndex();
  drawQueues();
  main
    .querySelectorAll("[data-league-mode]")
    .forEach((b) => (b.onclick = () => openMode(b.dataset.leagueMode)));
  main
    .querySelectorAll("[data-league-profile]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          profile(
            data.players.find((p) => p.uuid === b.dataset.leagueProfile),
          )),
    );
  main.querySelector("#home-open-finder").onclick = () =>
    document.querySelector("#global-kit-search").click();
  main.querySelectorAll("[data-scene-choice]").forEach(
    (b) =>
      (b.onclick = () => {
        const scene = b.dataset.sceneChoice;
        main.querySelector(".eclipse-hero").dataset.scene = scene;
        leagueSavePreference("heroScene", scene);
        main
          .querySelectorAll("[data-scene-choice]")
          .forEach((other) =>
            other.setAttribute("aria-pressed", String(other === b)),
          );
      }),
  );
  const activateShowcase = (button) => {
    main.querySelectorAll("[data-showcase]").forEach((b) => {
      const active = b === button;
      b.setAttribute("aria-selected", String(active));
      b.tabIndex = active ? 0 : -1;
      main.querySelector("#showcase-" + b.dataset.showcase).hidden = !active;
    });
  };
  leagueBindTabs(main.querySelectorAll("[data-showcase]"), activateShowcase);
  const guide = {
    verify: [
      "Your account. Your identity.",
      "Start with private ownership verification. Staff confirm your Minecraft account before you enter an official queue. Never share a password or account token.",
      "/desk",
      "Open the player desk",
    ],
    queue: [
      "A real place in a real session.",
      "Choose your discipline and region. Open sessions have 20 shared slots for waiting and active tests. Your private status explains your place and cooldown.",
      "/queue status",
      "Check your queue status",
    ],
    play: [
      "Play, review and earn your placement.",
      "Your qualified tester opens a private room. Agree the exact kit, confirm readiness, play your sets and publish a reviewed result with shareable evidence.",
      "/test-hub",
      "Follow your testing path",
    ],
  };
  const activateGuide = (button) => {
    main.querySelectorAll("[data-guide-step]").forEach((b) => {
      b.setAttribute("aria-selected", String(b === button));
      b.tabIndex = b === button ? 0 : -1;
    });
    const [title, copy, command, label] = guide[button.dataset.guideStep];
    const panel = main.querySelector("#guide-detail");
    panel.setAttribute("aria-labelledby", button.id);
    panel.innerHTML = `<span class="walkthrough-symbol" aria-hidden="true">${{ verify: "◇", queue: "◷", play: "✦" }[button.dataset.guideStep]}</span><h3>${title}</h3><p>${copy}</p><code>${command}</code><a class="button secondary" href="https://discord.com/channels/1568767259168608267/1569347570214506607" target="_blank" rel="noopener">${label} ↗</a>`;
  };
  leagueBindTabs(main.querySelectorAll("[data-guide-step]"), activateGuide);
  activateGuide(main.querySelector("[data-guide-step]"));
  let tag = 4;
  const tagTiers = Object.keys(config.points);
  main.querySelector("#tag-preview-cycle").onclick = () => {
    tag = (tag + 1) % tagTiers.length;
    main.querySelector("#home-tag-preview b").textContent =
      "[Mace " + tagTiers[tag] + "]";
  };
  main.querySelectorAll("[data-home-section]").forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        main.querySelector("#home-" + a.dataset.homeSection)?.scrollIntoView?.({
          behavior:
            document.body.classList.contains("calm-view") ||
            window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
          block: "start",
        });
      }),
  );
  const section = new URLSearchParams(location.hash.split("?")[1]).get(
    "section",
  );
  if (["features", "showcase", "testing", "faq"].includes(section))
    main
      .querySelector("#home-" + section)
      ?.scrollIntoView?.({ block: "start" });
}

function leagueBindTabs(nodes, activate) {
  const buttons = [...nodes];
  buttons.forEach((button, n) => {
    button.onclick = () => activate(button);
    button.onkeydown = (e) => {
      let next;
      if (e.key === "ArrowRight" || e.key === "ArrowDown")
        next = (n + 1) % buttons.length;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
        next = (n + buttons.length - 1) % buttons.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = buttons.length - 1;
      else return;
      e.preventDefault();
      buttons[next].focus();
      activate(buttons[next]);
    };
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
