const appearanceUUID =
  /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i;
function appearanceFallback(uuid) {
  return {
    uuid,
    provider: "mc-heads",
    profileUrl: "https://skinmc.net/profile/" + uuid,
    headUrl: "https://mc-heads.net/avatar/" + uuid + "/100",
    bodyUrl: "https://mc-heads.net/body/" + uuid + "/320",
    textureUrl: null,
  };
}
async function boundedSkinPage(response) {
  if (
    !response.ok ||
    !response.headers.get("Content-Type")?.includes("text/html")
  )
    throw Error("Skin profile unavailable");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let bytes = 0,
    text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1048576) throw Error("Skin profile too large");
      text += decoder.decode(value, { stream: true });
    }
    return text;
  } finally {
    await reader.cancel().catch(() => {});
  }
}
async function fetchSkinMCProfile(uuid, provider) {
  let url = new URL("https://skinmc.net/profile/" + uuid);
  const signal = AbortSignal.timeout(8000);
  for (let hop = 0; hop < 4; hop++) {
    const response = await provider(url.href, {
      headers: { Accept: "text/html" },
      redirect: "manual",
      signal,
    });
    if (response.status < 300 || response.status >= 400)
      return boundedSkinPage(response);
    const location = response.headers.get("Location");
    await response.body?.cancel();
    if (!location) throw Error("Missing skin profile redirect");
    const next = new URL(location, url);
    if (
      next.origin !== "https://skinmc.net" ||
      next.username ||
      next.password ||
      !(
        /^\/profile\/[A-Za-z0-9_.-]+\/?$/.test(next.pathname) ||
        next.pathname === "/s"
      )
    )
      throw Error("Unexpected skin profile redirect");
    url = next;
  }
  throw Error("Too many skin profile redirects");
}
/** UUID comes only from a saved verified Minecraft account. No client-supplied URLs. */
export async function resolveSkinAppearance(
  store,
  uuid,
  provider = fetch,
  refresh = false,
) {
  if (!appearanceUUID.test(uuid)) throw Error("Invalid Minecraft UUID");
  const now = new Date(),
    saved = await store.one("SELECT * FROM skin_previews WHERE uuid=?", uuid);
  if (
    saved &&
    Date.parse(saved.expires_at) > now.getTime() &&
    (!refresh || now.getTime() - Date.parse(saved.checked_at) < 60000)
  )
    return {
      uuid,
      provider: saved.provider,
      profileUrl: "https://skinmc.net/profile/" + uuid,
      headUrl: saved.head_url,
      bodyUrl: saved.body_url,
      textureUrl: saved.texture_url,
      checkedAt: saved.checked_at,
    };
  let appearance = appearanceFallback(uuid);
  try {
    const html = await fetchSkinMCProfile(uuid, provider);
    const linked = html.match(
      /data-skin-uuid\s*=\s*["']([a-f0-9-]{32,36})["']/i,
    )?.[1];
    if (
      !linked ||
      linked.replaceAll("-", "").toLowerCase() !==
        uuid.replaceAll("-", "").toLowerCase()
    )
      throw Error("Skin profile identity mismatch");
    const skinId = html.match(
      /data-skin-url\s*=\s*["']https:\/\/skinmc\.net\/api\/v1\/renders\/skins\/([a-f0-9-]{36})\/skin["']/i,
    )?.[1];
    if (!skinId || !appearanceUUID.test(skinId))
      throw Error("Skin renderer unavailable");
    const base = "https://skinmc.net/api/v1/renders/skins/" + skinId;
    appearance = {
      uuid,
      provider: "skinmc",
      profileUrl: "https://skinmc.net/profile/" + uuid,
      headUrl: base + "/head/100",
      bodyUrl: base + "/preview",
      textureUrl: base + "/skin",
    };
  } catch {
    if (saved?.provider === "skinmc")
      appearance = {
        uuid,
        provider: "skinmc",
        profileUrl: "https://skinmc.net/profile/" + uuid,
        headUrl: saved.head_url,
        bodyUrl: saved.body_url,
        textureUrl: saved.texture_url,
      };
  }
  const checkedAt = now.toISOString(),
    expiresAt = new Date(
      now.getTime() + (appearance.provider === "skinmc" ? 3600000 : 300000),
    ).toISOString();
  await store
    .statement(
      "INSERT INTO skin_previews VALUES(?,?,?,?,?,?,?) ON CONFLICT(uuid) DO UPDATE SET provider=excluded.provider,head_url=excluded.head_url,body_url=excluded.body_url,texture_url=excluded.texture_url,checked_at=excluded.checked_at,expires_at=excluded.expires_at",
      uuid,
      appearance.provider,
      appearance.headUrl,
      appearance.bodyUrl,
      appearance.textureUrl,
      checkedAt,
      expiresAt,
    )
    .run();
  return { ...appearance, checkedAt };
}
