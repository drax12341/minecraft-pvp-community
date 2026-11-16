// One canvas for the entire site. No WebGL requirement, scroll interception or tracking.
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
    win = doc.defaultView,
    media = win.matchMedia("(prefers-reduced-motion: reduce)");
  const main = doc.querySelector("main");
  let width = 1,
    height = 1,
    frame = 0,
    last = 0,
    pointerX = 0,
    pointerY = 0,
    mouseX = 0,
    mouseY = 0,
    exploded = 0,
    stage = null,
    stageBox = null,
    accent = [155, 212, 250];
  const blocks = [];
  const stone = ["#4d657f", "#66819e", "#7a92b0", "#526d8b", "#8ba5bf"];
  for (let x = 0; x < 4; x++)
    for (let y = 0; y < 3; y++)
      for (let z = 0; z < 4; z++) {
        if ((x === 0 || x === 3) && (z === 0 || z === 3) && y !== 1) continue;
        blocks.push({
          x: (x - 1.5) * 0.72,
          y: 1.35 + y * 0.72,
          z: (z - 1.5) * 0.72,
          size: [0.7, 0.7, 0.7],
          color: stone[(x * 3 + y + z * 2) % stone.length],
          head: true,
        });
      }
  for (let y = 0; y < 7; y++)
    blocks.push({
      x: 0,
      y: 0.8 - y * 0.72,
      z: 0,
      size: [0.53, 0.72, 0.53],
      color: y === 0 || y === 6 ? "#7f9bb8" : y % 2 ? "#946e55" : "#b18b63",
    });
  blocks.push({ x: 0, y: 1, z: 0, size: [0.9, 0.3, 0.9], color: "#b7c7d6" });
  const vertices = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ];
  const faces = [
    { v: [0, 1, 2, 3], light: 0.8 },
    { v: [4, 7, 6, 5], light: 1.05 },
    { v: [0, 4, 5, 1], light: 0.55 },
    { v: [3, 2, 6, 7], light: 1.35 },
    { v: [0, 3, 7, 4], light: 0.68 },
    { v: [1, 5, 6, 2], light: 1 },
  ];
  const reduced = () =>
    media.matches || doc.body.classList.contains("calm-view");
  const shade = (hex, amount) => {
    const rgb = [1, 3, 5].map((n) =>
      Math.min(255, Math.round(parseInt(hex.slice(n, n + 2), 16) * amount)),
    );
    return `rgb(${rgb.join(",")})`;
  };
  function findStage() {
    stage = main?.querySelector(".orbit-hero-stage");
    const box = stage?.getBoundingClientRect();
    stageBox = box
      ? {
          left: box.left,
          top: box.top + win.scrollY,
          width: box.width,
          height: box.height,
        }
      : null;
    sync();
  }
  function resize() {
    width = win.innerWidth;
    height = win.innerHeight;
    const dpr = Math.min(win.devicePixelRatio || 1, 1.6);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    findStage();
  }
  function polygon(points, color, stroke = "#cce5ff19") {
    ctx.beginPath();
    points.forEach((p, n) => (n ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  function drawMace(now, still) {
    if (!stageBox) return;
    const centerY = stageBox.top - win.scrollY + stageBox.height * 0.52;
    if (centerY < -stageBox.height || centerY > height + stageBox.height)
      return;
    const centerX = stageBox.left + stageBox.width * 0.56;
    const scale = Math.min(stageBox.width * 0.13, stageBox.height / 9.5);
    const time = still ? 0 : now * 0.001;
    const target = doc.body.dataset.exploded === "true" ? 1 : 0;
    exploded = still ? target : exploded + (target - exploded) * 0.09;
    const yaw = -0.62 + Math.sin(time * 0.25) * 0.12 + mouseX * 0.3,
      roll = -0.42 + mouseY * 0.07;
    const lift = still ? 0 : Math.sin(time * 0.85) * 0.09;
    function project(x, y, z) {
      const rx = x * Math.cos(yaw) + z * Math.sin(yaw),
        rz = -x * Math.sin(yaw) + z * Math.cos(yaw);
      const tx = rx * Math.cos(roll) - y * Math.sin(roll),
        ty = rx * Math.sin(roll) + y * Math.cos(roll);
      const py = ty * Math.cos(0.22) - rz * Math.sin(0.22),
        pz = ty * Math.sin(0.22) + rz * Math.cos(0.22);
      const perspective = 1000 / (1000 + pz * scale);
      return {
        x: centerX + tx * scale * perspective,
        y: centerY - (py + lift) * scale * perspective,
        z: pz,
      };
    }
    const glow = ctx.createRadialGradient(
      centerX,
      centerY - scale * 0.3,
      10,
      centerX,
      centerY,
      scale * 4.8,
    );
    glow.addColorStop(0, `rgba(${accent.join(",")},.075)`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(
      centerX - scale * 5,
      centerY - scale * 5,
      scale * 10,
      scale * 10,
    );
    for (let r = 0; r < 3; r++) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${accent.join(",")},${0.13 - r * 0.025})`;
      ctx.lineWidth = 0.8;
      ctx.ellipse(
        centerX,
        centerY + scale * 2.7,
        scale * (3.3 + r * 0.45),
        scale * (0.72 + r * 0.12),
        -0.12 + mouseX * 0.1,
        time * 0.035 + r,
        Math.PI * 1.8 + time * 0.035 + r,
      );
      ctx.stroke();
    }
    const polygons = [];
    const shards = Array.from({ length: 9 }, (_, i) => ({
      x: Math.cos(i * 2.1 + time * 0.05) * (3.4 + (i % 3) * 0.7),
      y: Math.sin(i * 1.6 + time * 0.13) * 2.9,
      z: Math.sin(i * 2.1) * 2.4,
      size: [0.12 + (i % 3) * 0.08, 0.15 + (i % 2) * 0.1, 0.2],
      color: i % 3 ? "#58718e" : "#bed8eb",
    }));
    for (const b of [...blocks, ...shards]) {
      const spread = b.head ? 1 + exploded * 0.85 : 1;
      const center = {
        x: b.x * spread,
        y: b.head ? 2 + (b.y - 2) * spread + exploded * 0.6 : b.y,
        z: b.z * spread,
      };
      const points = vertices.map((v) =>
        project(
          center.x + (v[0] * b.size[0]) / 2,
          center.y + (v[1] * b.size[1]) / 2,
          center.z + (v[2] * b.size[2]) / 2,
        ),
      );
      for (const f of faces) {
        const pointsOnFace = f.v.map((n) => points[n]);
        polygons.push({
          points: pointsOnFace,
          depth: pointsOnFace.reduce((s, p) => s + p.z, 0) / 4,
          color: shade(b.color, f.light),
        });
      }
    }
    polygons
      .sort((a, b) => b.depth - a.depth)
      .forEach((p) => polygon(p.points, p.color));
    const pin = project(0.5, 2.7, -1.5);
    ctx.beginPath();
    ctx.strokeStyle = "#b5d9f055";
    ctx.lineWidth = 0.6;
    ctx.moveTo(pin.x, pin.y);
    ctx.lineTo(pin.x + scale * 0.7, pin.y - scale * 0.4);
    ctx.lineTo(pin.x + scale * 1.6, pin.y - scale * 0.4);
    ctx.stroke();
    ctx.fillStyle = "#c6e9ff";
    ctx.fillRect(pin.x - 1, pin.y - 1, 2, 2);
  }
  function draw(now, still = false) {
    ctx.clearRect(0, 0, width, height);
    mouseX = still ? 0 : mouseX + (pointerX - mouseX) * 0.035;
    mouseY = still ? 0 : mouseY + (pointerY - mouseY) * 0.035;
    const t = still ? 0 : now * 0.001;
    const count = width < 600 ? 30 : 65;
    for (let i = 0; i < count; i++) {
      const seed = Math.sin(i * 124.53 + 14.76) * 43758.5453,
        base = seed - Math.floor(seed);
      const x =
        (((base * width + mouseX * (5 + (i % 5)) * 2) % width) + width) % width;
      const y =
        (((i * 113.4 + t * (1 + (i % 3)) * 1.5) % height) + height) % height;
      const alpha = 0.12 + (Math.sin(t * 0.5 + i) * 0.5 + 0.5) * 0.2;
      ctx.fillStyle = `rgba(${accent.join(",")},${alpha})`;
      ctx.fillRect(x, y, i % 8 === 0 ? 2 : 1, i % 8 === 0 ? 2 : 1);
      if (i % 12 === 0) {
        ctx.strokeStyle = `rgba(${accent.join(",")},.07)`;
        ctx.beginPath();
        ctx.moveTo(x - 14, y);
        ctx.lineTo(x + 14, y);
        ctx.moveTo(x, y - 14);
        ctx.lineTo(x, y + 14);
        ctx.stroke();
      }
    }
    drawMace(now, still);
    canvas.orbitFrameCount = (canvas.orbitFrameCount || 0) + 1;
  }
  function tick(now) {
    if (doc.hidden || reduced()) {
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
    if (doc.hidden) return;
    if (reduced()) draw(0, true);
    else frame = win.requestAnimationFrame(tick);
  }
  win.addEventListener("resize", resize, { passive: true });
  win.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch" || reduced()) return;
      pointerX = (event.clientX / width - 0.5) * 2;
      pointerY = (event.clientY / height - 0.5) * 2;
    },
    { passive: true },
  );
  doc.addEventListener(
    "pointerover",
    (event) => {
      const color =
        event.target.closest?.("[data-orbit-color]")?.dataset.orbitColor;
      if (/^#[a-f0-9]{6}$/i.test(color || ""))
        accent = [1, 3, 5].map((n) => parseInt(color.slice(n, n + 2), 16));
    },
    { passive: true },
  );
  const scroll = () => {
    doc.documentElement.style.setProperty(
      "--orbit-progress",
      String(
        win.scrollY / Math.max(1, doc.documentElement.scrollHeight - height),
      ),
    );
    if (reduced()) draw(0, true);
  };
  win.addEventListener("scroll", scroll, { passive: true });
  doc.addEventListener("visibilitychange", sync);
  media.addEventListener("change", sync);
  new MutationObserver(sync).observe(doc.body, {
    attributes: true,
    attributeFilter: ["class", "data-exploded"],
  });
  if (main) new MutationObserver(findStage).observe(main, { childList: true });
  win.addEventListener("pagehide", () => win.cancelAnimationFrame(frame));
  win.addEventListener("pageshow", sync);
  resize();
  scroll();
}
