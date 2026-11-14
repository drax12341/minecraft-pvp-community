const ease = "cubic-bezier(.2,.75,.2,1)";
let observer = null,
  frame = 0,
  scrollFrame = 0;
const playing = new Set();
const media = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
  document.documentElement.classList.contains("reduce-motion");
function play(node, frames, options) {
  if (media() || !node.animate) return;
  const animation = node.animate(frames, options);
  playing.add(animation);
  animation.finished.then(
    () => playing.delete(animation),
    () => playing.delete(animation),
  );
  return animation;
}
function count(node) {
  const total = Number(node.dataset.count);
  if (!Number.isFinite(total) || total <= 0 || media()) return;
  const started = performance.now();
  const tick = (now) => {
    if (!node.isConnected || media()) {
      node.textContent = total.toLocaleString();
      return;
    }
    const progress = Math.min(1, (now - started) / 850);
    node.textContent = Math.round(
      total * (1 - (1 - progress) ** 3),
    ).toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
export function stopMotion() {
  observer?.disconnect();
  for (const animation of playing) animation.cancel();
  playing.clear();
  document
    .querySelectorAll("[data-count]")
    .forEach(
      (node) =>
        (node.textContent = Number(node.dataset.count).toLocaleString()),
    );
  document.querySelectorAll("[data-parallax]").forEach((node) => {
    node.style.setProperty("--px", "0");
    node.style.setProperty("--py", "0");
  });
}
export function mountMotion(root) {
  observer?.disconnect();
  if (media()) return;
  const hero = root.querySelector(".arena-copy");
  if (hero)
    Array.from(hero.children).forEach((node, index) =>
      play(
        node,
        [
          { opacity: 0, transform: "translateY(18px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 650, delay: index * 80, easing: ease, fill: "backwards" },
      ),
    );
  const artwork = root.querySelector(".arena-stage");
  if (artwork)
    play(
      artwork,
      [
        { opacity: 0, transform: "translateY(25px) scale(.96)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      { duration: 1000, delay: 140, easing: ease, fill: "backwards" },
    );
  const reveal = (node) => {
    play(
      node,
      [
        { opacity: 0.05, transform: "translateY(22px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 650, easing: ease },
    );
    node.querySelectorAll("[data-count]").forEach(count);
  };
  const targets = root.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            reveal(entry.target);
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" },
    );
    targets.forEach((node) => observer.observe(node));
  } else targets.forEach(reveal);
  root
    .querySelectorAll(
      ".ranking-row,.tier-board-column,.result-card,.tester-card",
    )
    .forEach((node, index) => {
      if (index < 14)
        play(
          node,
          [
            { opacity: 0.1, transform: "translateY(12px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          {
            duration: 430,
            delay: Math.min(index * 35, 300),
            easing: ease,
            fill: "backwards",
          },
        );
    });
  root.querySelectorAll("[data-parallax]").forEach((node) => {
    node.onpointermove = (event) => {
      if (
        media() ||
        event.pointerType === "touch" ||
        !window.matchMedia("(pointer:fine)").matches
      )
        return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = node.getBoundingClientRect();
        node.style.setProperty(
          "--px",
          String(((event.clientX - bounds.left) / bounds.width - 0.5) * 2),
        );
        node.style.setProperty(
          "--py",
          String(((event.clientY - bounds.top) / bounds.height - 0.5) * 2),
        );
      });
    };
    node.onpointerleave = () => {
      cancelAnimationFrame(frame);
      node.style.setProperty("--px", "0");
      node.style.setProperty("--py", "0");
    };
  });
}
export function installMotion() {
  const progress = document.createElement("div");
  progress.className = "scroll-progress";
  progress.setAttribute("aria-hidden", "true");
  document.body.append(progress);
  const update = () => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      const height = document.documentElement.scrollHeight - innerHeight;
      progress.style.transform = `scaleX(${height > 0 ? Math.max(0, Math.min(1, scrollY / height)) : 0})`;
      document
        .querySelector(".site-header")
        ?.classList.toggle("is-scrolled", scrollY > 16);
    });
  };
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  query?.addEventListener?.("change", () => {
    stopMotion();
    if (!media()) mountMotion(document.querySelector("main"));
  });
  document.addEventListener("visibilitychange", () =>
    document.documentElement.classList.toggle("page-hidden", document.hidden),
  );
  update();
}
