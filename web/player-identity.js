const identityEscape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function playerIdentity(player) {
  if (player?.demo) return null;
  const value = String(player?.uuid || "").toLowerCase();
  if (
    !/^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(
      value,
    )
  )
    return null;
  const raw = value.replaceAll("-", ""),
    uuid = [
      raw.slice(0, 8),
      raw.slice(8, 12),
      raw.slice(12, 16),
      raw.slice(16, 20),
      raw.slice(20),
    ].join("-");
  return {
    uuid,
    nameMC: "https://namemc.com/profile/" + uuid,
    front: "https://mc-heads.net/player/" + uuid,
    isometric: "https://mc-heads.net/body/" + uuid + "/right",
    texture: "https://mc-heads.net/skin/" + uuid,
    download: "https://mc-heads.net/download/" + uuid,
  };
}
export function renderPlayerIdentity(player) {
  const id = playerIdentity(player);
  if (!id) return "";
  return `<section class="minecraft-identity" aria-labelledby="identity-title"><div class="identity-skin"><img id="identity-skin-render" src="${id.isometric}" alt="${identityEscape(player.name)} Minecraft skin" width="130" height="220" referrerpolicy="no-referrer"><span id="identity-skin-status" role="status">Current Minecraft skin</span><div role="group" aria-label="Skin view"><button data-skin-view="isometric" aria-pressed="true">3D</button><button data-skin-view="front" aria-pressed="false">Front</button><button data-skin-view="texture" aria-pressed="false">Texture</button></div></div><div class="identity-details"><p class="profile-kicker">Minecraft identity</p><h3 id="identity-title">Skin & player details</h3><dl><dt>Published username</dt><dd>${identityEscape(player.name)}</dd><dt>Minecraft UUID</dt><dd><code>${id.uuid}</code><button id="identity-copy-uuid" class="text-button">Copy UUID</button></dd></dl><div class="identity-links"><a class="button secondary" href="${id.nameMC}" target="_blank" rel="noopener noreferrer">View on NameMC ↗</a><a href="${id.download}" target="_blank" rel="noopener noreferrer">Download skin PNG ↗</a></div><p class="identity-provenance">Skin and name history opens on NameMC. Skin images: <a href="https://mc-heads.net/" target="_blank" rel="noopener noreferrer">MCHeads</a>. Rankings: this community.</p></div></section>`;
}
export function mountPlayerIdentity(root, player, copy) {
  const id = playerIdentity(player);
  if (!id) return;
  const image = root.querySelector("#identity-skin-render"),
    status = root.querySelector("#identity-skin-status");
  image.onerror = () => {
    image.hidden = true;
    status.textContent = "Skin preview unavailable. You can still open NameMC.";
  };
  image.onload = () => {
    status.textContent = "Current Minecraft skin";
  };
  root.querySelectorAll("[data-skin-view]").forEach(
    (button) =>
      (button.onclick = () => {
        const view = button.dataset.skinView;
        if (!["front", "isometric", "texture"].includes(view)) return;
        image.hidden = false;
        image.src = id[view];
        image.classList.toggle("is-texture", view === "texture");
        status.textContent = "Loading skin…";
        root
          .querySelectorAll("[data-skin-view]")
          .forEach((other) =>
            other.setAttribute("aria-pressed", String(other === button)),
          );
      }),
  );
  root.querySelector("#identity-copy-uuid").onclick = () =>
    copy(id.uuid, "Minecraft UUID copied.");
}
