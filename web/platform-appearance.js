import { api, escape as e, skin, formatDate } from "./platform-data.js";
const appearances = new Map();
export function updateAccountNavigation(me) {
  const link = document.querySelector("#account-link");
  if (!link) return;
  if (me?.account && validUUID(me.account.uuid)) {
    link.className = "account-linked";
    link.href = "/account";
    link.setAttribute("aria-label", me.account.name + " account");
    link.innerHTML =
      skin(me.account).replace(
        "data-skin-uuid=",
        'data-skin-owner="true" data-skin-uuid=',
      ) + `<span>${e(me.account.name)}</span>`;
  } else if (me?.user) {
    link.className = "icon-button";
    link.innerHTML = "&#9817;";
    link.href = "/account";
    link.setAttribute("aria-label", "Your connected Discord account");
  } else {
    link.href = "/login";
    link.className = "icon-button";
    link.setAttribute("aria-label", "Sign in with Discord");
    link.innerHTML = "&#9817;";
  }
}
let appearanceObserver = null;
const validUUID = (value) =>
  /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i.test(
    value || "",
  );
function trustedImage(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      ["skinmc.net", "mc-heads.net"].includes(u.hostname)
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function accountSkinCard(account) {
  if (!account || !validUUID(account.uuid)) return "";
  return `<section class="account-skin-card" aria-labelledby="skin-card-title"><header><span class="micro-label">Your in-game identity</span><span class="skin-live-tag"><i></i> ${account.verified_by==='ign-link'?'Minecraft IGN linked':'Verified Minecraft account'}</span></header><div class="skin-presentation"><div class="skin-orbit" aria-hidden="true"></div><div class="skin-pedestal" aria-hidden="true"></div><div class="skin-player-display">${skin(account, true).replace("data-skin-uuid=", 'data-skin-owner="true" data-skin-uuid=')}</div><div class="skin-mode-switch" aria-label="Skin preview view"><button type="button" data-skin-view="body" aria-pressed="true">Full body</button><button type="button" data-skin-view="head" aria-pressed="false">Head</button></div></div><div class="skin-card-identity"><h2 id="skin-card-title">${e(account.name)}</h2><p data-appearance-status>Loading SkinMC preview…</p><div class="skin-card-actions"><button type="button" class="button secondary small" data-refresh-skin>Refresh skin</button><a class="text-link" href="https://skinmc.net/profile/${encodeURIComponent(account.uuid)}" target="_blank" rel="noopener noreferrer">Open SkinMC ↗</a></div><a data-skin-download hidden class="skin-download" target="_blank" rel="noopener noreferrer">Open skin texture ↗</a></div></section>`;
}
function applyAppearance(root, uuid, appearance) {
  if (!root.isConnected) return;
  const images = [...root.querySelectorAll("[data-skin-uuid]")].filter(
      (img) => img.dataset.skinUuid === uuid,
    ),
    head = trustedImage(appearance.headUrl),
    body = trustedImage(appearance.bodyUrl);
  if (!head || !body) return;
  for (const image of images) {
    image.dataset.skinHead = head;
    image.dataset.skinBody = body;
    image.dataset.skinProvider = appearance.provider;
    image.src = image.dataset.skinKind === "head" ? head : body;
    image.hidden = false;
  }
  for (const card of root.querySelectorAll(".account-skin-card")) {
    if (!card.querySelector(`[data-skin-uuid="${uuid}"]`)) continue;
    const status = card.querySelector("[data-appearance-status]");
    status.textContent =
      appearance.provider === "skinmc"
        ? "SkinMC preview · " + formatDate(appearance.checkedAt)
        : "Standard preview · SkinMC is temporarily unavailable";
    const download = card.querySelector("[data-skin-download]"),
      texture = trustedImage(appearance.textureUrl);
    if (texture && new URL(texture).hostname === "skinmc.net") {
      download.href = texture;
      download.hidden = false;
    } else download.hidden = true;
    card.dataset.skinReady = "true";
  }
}
async function loadAppearance(image, root, refresh = false) {
  const uuid = image.dataset.skinUuid;
  if (!validUUID(uuid)) return;
  const own = image.dataset.skinOwner === "true",
    key = (own ? "own:" : "public:") + uuid;
  if (refresh) appearances.delete(key);
  if (!appearances.has(key)) {
    if (appearances.size > 80)
      appearances.delete(appearances.keys().next().value);
    appearances.set(
      key,
      api(
        own
          ? "/me/appearance" + (refresh ? "?refresh=1" : "")
          : "/appearance/" + encodeURIComponent(uuid),
      ).catch((error) => {
        appearances.delete(key);
        throw error;
      }),
    );
  }
  try {
    applyAppearance(root, uuid, await appearances.get(key));
  } catch {
    const status = image
      .closest(".account-skin-card")
      ?.querySelector("[data-appearance-status]");
    if (status)
      status.textContent =
        "Standard Minecraft preview. SkinMC could not be reached.";
  }
}
export function mountAppearances(root) {
  appearanceObserver?.disconnect();
  const images = root.querySelectorAll("[data-skin-uuid]");
  if ("IntersectionObserver" in window) {
    appearanceObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            loadAppearance(entry.target, root);
            appearanceObserver.unobserve(entry.target);
          }
      },
      { rootMargin: "100px" },
    );
    images.forEach((image) => appearanceObserver.observe(image));
  } else images.forEach((image) => loadAppearance(image, root));
}
export function installAppearanceControls() {
  document.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.dataset.skinUuid)
        return;
      const uuid = image.dataset.skinUuid;
      if (!validUUID(uuid)) return;
      if (image.dataset.skinFailed !== "true") {
        image.dataset.skinFailed = "true";
        image.dataset.skinProvider = "mc-heads";
        image.src =
          "https://mc-heads.net/" +
          (image.dataset.skinKind === "head" ? "avatar" : "body") +
          "/" +
          uuid +
          "/" +
          (image.dataset.skinKind === "head" ? "100" : "320");
        const status = image
          .closest(".account-skin-card")
          ?.querySelector("[data-appearance-status]");
        if (status)
          status.textContent =
            "Standard Minecraft preview · SkinMC image unavailable";
      } else {
        image.hidden = true;
        const status = image
          .closest(".account-skin-card")
          ?.querySelector("[data-appearance-status]");
        if (status)
          status.textContent =
            "Skin preview unavailable. Open your verified profile on SkinMC.";
      }
    },
    true,
  );
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-skin-view],[data-refresh-skin]");
    if (!button) return;
    const card = button.closest(".account-skin-card"),
      image = card?.querySelector("[data-skin-uuid]");
    if (!image) return;
    if (button.dataset.skinView) {
      const kind = button.dataset.skinView;
      image.dataset.skinKind = kind;
      image.classList.toggle("is-head", kind === "head");
      image.src =
        kind === "head"
          ? image.dataset.skinHead ||
            "https://mc-heads.net/avatar/" + image.dataset.skinUuid + "/100"
          : image.dataset.skinBody ||
            "https://mc-heads.net/body/" + image.dataset.skinUuid + "/320";
      card
        .querySelectorAll("[data-skin-view]")
        .forEach((control) =>
          control.setAttribute("aria-pressed", control === button),
        );
      return;
    }
    button.disabled = true;
    card.querySelector("[data-appearance-status]").textContent =
      "Checking your current skin…";
    try {
      await loadAppearance(image, document.querySelector("main"), true);
    } finally {
      button.disabled = false;
    }
  });
}
