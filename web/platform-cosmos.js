/** A bounded, decorative starfield. No network requests or gameplay data. */
export function createStarMap(width, height, count) {
  return Array.from({ length: count }, (_, n) => {
    const random = (k) => {
      const x = Math.sin((n + 1) * 127.1 + k * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    return {
      x: random(1) * width,
      y: random(2) * height,
      r: 0.35 + random(3) * 1.2,
      depth: 0.15 + random(4) * 0.85,
      phase: random(5) * Math.PI * 2,
      warm: random(6) > 0.82,
    };
  });
}
export function installCosmos() {
  const canvas = document.querySelector("#cosmic-stars");
  if (!canvas) return;
  let context;
  try {
    context = canvas.getContext("2d", { alpha: true });
  } catch {
    return;
  }
  if (!context) return;
  let stars = [],
    width = 0,
    height = 0,
    frame = 0,
    last = 0,
    pointerX = 0,
    pointerY = 0,
    mouseX = 0,
    mouseY = 0,
    nextComet = performance.now() + 10000,
    comet = null;
  const reduced = () =>
    document.documentElement.classList.contains("reduce-motion") ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  function resize() {
    width = innerWidth;
    height = innerHeight;
    const ratio = Math.min(
      window.devicePixelRatio || 1,
      1.5,
      Math.sqrt(3000000 / Math.max(1, width * height)),
    );
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    stars = createStarMap(width, height, width < 600 ? 65 : 145);
    draw(performance.now(), true);
  }
  function draw(now, staticFrame = false) {
    context.clearRect(0, 0, width, height);
    mouseX += (pointerX - mouseX) * 0.025;
    mouseY += (pointerY - mouseY) * 0.025;
    const t = now / 1000;
    for (const star of stars) {
      const x = star.x + mouseX * star.depth,
        y = star.y + mouseY * star.depth,
        alpha = staticFrame
          ? 0.55
          : 0.3 + 0.25 * (1 + Math.sin(t * 0.45 + star.phase));
      context.beginPath();
      context.fillStyle = star.warm
        ? `rgba(245,205,143,${alpha})`
        : `rgba(201,204,245,${alpha})`;
      context.arc(x, y, star.r, 0, Math.PI * 2);
      context.fill();
      if (star.r > 1.3) {
        context.fillStyle = `rgba(191,164,237,${alpha * 0.08})`;
        context.beginPath();
        context.arc(x, y, star.r * 4, 0, Math.PI * 2);
        context.fill();
      }
    }
    if (!staticFrame && now > nextComet) {
      comet = { start: now, x: width * 0.65, y: height * 0.12 };
      nextComet = now + 16000;
    }
    if (comet && !staticFrame) {
      const progress = (now - comet.start) / 1100;
      if (progress >= 1) comet = null;
      else {
        const x = comet.x - progress * 260,
          y = comet.y + progress * 130,
          opacity = Math.sin(progress * Math.PI) * 0.65;
        const gradient = context.createLinearGradient(x, y, x + 85, y - 42);
        gradient.addColorStop(0, `rgba(240,216,255,${opacity})`);
        gradient.addColorStop(1, "rgba(196,149,246,0)");
        context.strokeStyle = gradient;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + 85, y - 42);
        context.stroke();
      }
    }
  }
  function tick(now) {
    if (document.hidden || reduced()) {
      frame = 0;
      return;
    }
    if (now - last >= 40) {
      draw(now);
      last = now;
    }
    frame = requestAnimationFrame(tick);
  }
  function synchronize() {
    cancelAnimationFrame(frame);
    frame = 0;
    comet = null;
    if (document.hidden) return;
    if (reduced()) {
      pointerX = pointerY = mouseX = mouseY = 0;
      draw(performance.now(), true);
    } else frame = requestAnimationFrame(tick);
  }
  const resizeObserver = () => {
    resize();
    synchronize();
  };
  window.addEventListener("resize", resizeObserver, { passive: true });
  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch" || reduced()) return;
      pointerX = (event.clientX / Math.max(1, width) - 0.5) * 16;
      pointerY = (event.clientY / Math.max(1, height) - 0.5) * 12;
    },
    { passive: true },
  );
  document.addEventListener("visibilitychange", synchronize);
  const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  preference?.addEventListener?.("change", synchronize);
  new MutationObserver(synchronize).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  resize();
  synchronize();
  return {
    stop() {
      cancelAnimationFrame(frame);
      frame = 0;
    },
    resize,
  };
}
