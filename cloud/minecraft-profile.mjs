import { mojangTexturePublicKeys } from "../config/mojang-texture-keys.mjs";
const profileHeaders = {
  Accept: "application/json",
  "User-Agent":
    "MaceNetwork/1.0 (+https://minecraft-pvp-community.draxion0.chatgpt.site)",
};
const profileBase64 = (value) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
export async function verifyMojangTextureProperty(property, uuid) {
  try {
    if (
      !property ||
      typeof property.value !== "string" ||
      property.value.length > 32000 ||
      typeof property.signature !== "string" ||
      property.signature.length > 4096
    )
      return null;
    const value = JSON.parse(atob(property.value));
    if (
      value.profileId?.toLowerCase() !==
        uuid.replaceAll("-", "").toLowerCase() ||
      !/^[A-Za-z0-9_]{3,16}$/.test(value.profileName || "")
    )
      return null;
    const signature = profileBase64(property.signature),
      bytes = new TextEncoder().encode(property.value);
    for (const pem of mojangTexturePublicKeys) {
      const key = await crypto.subtle.importKey(
        "spki",
        profileBase64(pem),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-1" },
        false,
        ["verify"],
      );
      if (
        await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, bytes)
      )
        return value;
    }
  } catch {}
  return null;
}
export async function minecraftProfileCandidates(uuid, provider = fetch) {
  const id = uuid.replaceAll("-", "").toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(id)) return [];
  try {
    const r = await provider(
      "https://sessionserver.mojang.com/session/minecraft/profile/" +
        id +
        "?unsigned=false",
      {
        headers: profileHeaders,
        redirect: "error",
        signal: AbortSignal.timeout(4500),
      },
    );
    if (r.ok) {
      const profile = await r.json();
      if (
        profile.id?.toLowerCase() === id &&
        /^[A-Za-z0-9_]{3,16}$/.test(profile.name || "")
      )
        return [{ profile, source: "mojang", signatureVerified: false }];
    } else await r.body?.cancel();
  } catch {}
  const out = await Promise.all(
    [
      ["minetools", "https://api.minetools.eu/profile/" + id],
      ["playerdb", "https://playerdb.co/api/player/minecraft/" + id],
    ].map(async ([source, url]) => {
      try {
        const r = await provider(url, {
          headers: profileHeaders,
          redirect: "error",
          signal: AbortSignal.timeout(4500),
        });
        if (!r.ok) {
          await r.body?.cancel();
          return null;
        }
        const data = await r.json(),
          raw = source === "minetools" ? data.raw : data.data?.player,
          property = raw?.properties?.find((p) => p.name === "textures"),
          decoded = await verifyMojangTextureProperty(property, id);
        if (!decoded) return null;
        return {
          profile: {
            id: decoded.profileId.toLowerCase(),
            name: decoded.profileName,
            properties: [property],
          },
          source,
          signatureVerified: true,
        };
      } catch {
        return null;
      }
    }),
  );
  return out.filter(Boolean);
}
