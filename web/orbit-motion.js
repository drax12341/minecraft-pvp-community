// A single bounded canvas: starlight, shooting stars and small celebration bursts.
const canvas = document.querySelector("#orbit-world");
if (canvas) installOrbitWorld(canvas);

export function installOrbitWorld(canvas) {
  let ctx;
  try {
    ctx = canvas.getContext("2d", { alpha: true });
  } catch {
    return;
  }
  if (!ctx) return;
  const doc = canvas.ownerDocument,
    win = doc.defaultView;
  const media = win.matchMedia("(prefers-reduced-motion: reduce)");
  const fine = win.matchMedia("(hover: hover) and (pointer: fine)");
  const read = (key) => {
    try {
      return win.localStorage.getItem(key) !== "off";
    } catch {
      return true;
    }
  };
  const settings = {
    cursor: read("pvp-cursor"),
    fireworks: read("pvp-fireworks"),
  };
  const menu = doc.querySelector(".effects-menu");
  doc.addEventListener("click", (event) => {
    if (menu?.open && !menu.contains(event.target)) menu.open = false;
  });
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu?.open) {
      menu.open = false;
      menu.querySelector("summary").focus();
    }
  });
  const ring = doc.createElement("div");
  ring.className = "starlight-cursor";
  ring.setAttribute("aria-hidden", "true");
  doc.body.append(ring);
  let width = 1,
    height = 1,
    frame = 0,
    last = 0,
    nextMeteor = 0,
    nextBurst = 0;
  let x = -100,
    y = -100,
    rx = -100,
    ry = -100,
    pointerVisible = false;
  let stars = [],
    meteors = [],
    particles = [];
  const calm = () => media.matches || doc.body.classList.contains("calm-view");
  function resize() {
    width = win.innerWidth;
    height = win.innerHeight;
    const dpr = Math.min(win.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: width < 600 ? 45 : 100 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.1 + 0.3,
      phase: Math.random() * 6.28,
    }));
    sync();
  }
  function burst(bx, by) {
    if (calm() || !settings.fireworks) return;
    // Fixed ceiling also covers rapid repeated clicks.
    const available = Math.min(26, 104 - particles.length);
    for (let i = 0; i < available; i++) {
      const angle = (Math.PI * 2 * i) / 26,
        speed = 1 + Math.random() * 2.3;
      particles.push({
        x: bx,
        y: by,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        hue: 230 + Math.random() * 70,
      });
    }
  }
  function draw(now, still = false) {
    ctx.clearRect(0, 0, width, height);
    for (const star of stars) {
      const alpha = still
        ? 0.35
        : 0.23 + (Math.sin(now * 0.0007 + star.phase) + 1) * 0.23;
      ctx.fillStyle = `rgba(200,196,245,${alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!still) {
      if (now > nextMeteor) {
        meteors.push({
          x: width * (0.3 + Math.random() * 0.7),
          y: Math.random() * height * 0.3,
          life: 1,
        });
        nextMeteor = now + 4200 + Math.random() * 4500;
      }
      if (
        now > nextBurst &&
        settings.fireworks &&
        doc.body.dataset.page === "home"
      ) {
        burst(
          width * (0.1 + Math.random() * 0.8),
          height * (0.15 + Math.random() * 0.3),
        );
        nextBurst = now + 10500 + Math.random() * 6500;
      }
      for (const m of meteors) {
        m.x -= 9;
        m.y += 5;
        m.life -= 0.018;
        const gradient = ctx.createLinearGradient(
          m.x,
          m.y,
          m.x + 100,
          m.y - 55,
        );
        gradient.addColorStop(0, `rgba(210,200,255,${Math.max(0, m.life)})`);
        gradient.addColorStop(1, "transparent");
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x + 100, m.y - 55);
        ctx.stroke();
      }
      meteors = meteors.filter((m) => m.life > 0);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.018;
        p.vx *= 0.987;
        p.life -= 0.018;
        ctx.fillStyle = `hsla(${p.hue},85%,80%,${Math.max(0, p.life) * 0.75})`;
        ctx.fillRect(p.x, p.y, 1.8, 1.8);
      }
      particles = particles.filter((p) => p.life > 0);
      if (settings.cursor && fine.matches && pointerVisible) {
        rx += (x - rx) * 0.2;
        ry += (y - ry) * 0.2;
        ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      }
    }
    canvas.orbitFrameCount = (canvas.orbitFrameCount || 0) + 1;
  }
  function tick(now) {
    if (doc.hidden || calm()) {
      frame = 0;
      return;
    }
    if (now - last >= 32) {
      draw(now);
      last = now;
    }
    frame = win.requestAnimationFrame(tick);
  }
  function sync() {
    win.cancelAnimationFrame(frame);
    frame = 0;
    ring.hidden =
      calm() || !settings.cursor || !fine.matches || !pointerVisible;
    if (doc.hidden) return;
    if (calm()) {
      particles = [];
      meteors = [];
      draw(0, true);
    } else frame = win.requestAnimationFrame(tick);
  }
  for (const key of ["cursor", "fireworks"]) {
    const button = doc.querySelector("#" + key + "-toggle");
    const update = () => {
      button?.setAttribute("aria-pressed", String(settings[key]));
      if (button)
        button.querySelector("span").textContent = settings[key] ? "On" : "Off";
    };
    update();
    if (button)
      button.onclick = () => {
        settings[key] = !settings[key];
        try {
          win.localStorage.setItem("pvp-" + key, settings[key] ? "on" : "off");
        } catch {}
        if (key === "fireworks" && !settings[key]) particles = [];
        update();
        sync();
      };
  }
  doc.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return;
      x = event.clientX;
      y = event.clientY;
      if (!pointerVisible) {
        rx = x;
        ry = y;
        pointerVisible = true;
        sync();
      }
      ring.classList.toggle(
        "over-control",
        Boolean(event.target.closest?.("a,button,summary,input,select")),
      );
    },
    { passive: true },
  );
  doc.addEventListener("pointerleave", () => {
    pointerVisible = false;
    sync();
  });
  doc.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0 || event.target.closest?.("input,textarea,select"))
        return;
      burst(event.clientX, event.clientY);
    },
    { passive: true },
  );
  const progress = () =>
    doc.documentElement.style.setProperty(
      "--orbit-progress",
      String(
        win.scrollY / Math.max(1, doc.documentElement.scrollHeight - height),
      ),
    );
  win.addEventListener("scroll", progress, { passive: true });
  win.addEventListener("resize", resize, { passive: true });
  doc.addEventListener("visibilitychange", sync);
  media.addEventListener("change", sync);
  fine.addEventListener("change", sync);
  new win.MutationObserver(sync).observe(doc.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  win.addEventListener("pagehide", () => win.cancelAnimationFrame(frame));
  win.addEventListener("pageshow", sync);
  resize();
  progress();
}
