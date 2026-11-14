import { minecraftProfileCandidates } from "./minecraft-profile.mjs";
const minecraftLookupEndpoints = [
  ["mojang", "https://api.mojang.com/users/profiles/minecraft/"],
  [
    "minecraft-services",
    "https://api.minecraftservices.com/minecraft/profile/lookup/name/",
  ],
];
export const minecraftRequestHeaders = {
  Accept: "application/json",
  "User-Agent":
    "MaceNetwork/1.0 (https://minecraft-pvp-community.draxion0.chatgpt.site; Minecraft account verification)",
};
export async function lookupMinecraftAccount(input, provider = fetch) {
  const name = typeof input === "string" ? input.trim() : "",
    attempts = [];
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name))
    return { profile: null, reason: "invalid-name", attempts };
  let notFound = 0;
  for (const [service, base] of minecraftLookupEndpoints) {
    const start = Date.now();
    let status = null;
    try {
      const response = await provider(base + encodeURIComponent(name), {
        headers: minecraftRequestHeaders,
        redirect: "manual",
        signal: AbortSignal.timeout(4500),
      });
      status = response.status;
      if ([204, 404].includes(status)) {
        notFound++;
        attempts.push({
          service,
          status,
          outcome: "not-found",
          milliseconds: Date.now() - start,
        });
        await response.body?.cancel();
        continue;
      }
      if (!response.ok) {
        attempts.push({
          service,
          status,
          outcome: "http-error",
          milliseconds: Date.now() - start,
        });
        await response.body?.cancel();
        continue;
      }
      let candidate;
      try {
        candidate = await response.json();
      } catch {
        attempts.push({
          service,
          status,
          outcome: "invalid-json",
          milliseconds: Date.now() - start,
        });
        continue;
      }
      if (
        /^[a-f0-9]{32}$/i.test(candidate.id || "") &&
        /^[A-Za-z0-9_]{3,16}$/.test(candidate.name || "") &&
        candidate.name.toLowerCase() === name.toLowerCase()
      ) {
        attempts.push({
          service,
          status,
          outcome: "resolved",
          milliseconds: Date.now() - start,
        });
        return {
          profile: { id: candidate.id.toLowerCase(), name: candidate.name },
          attempts,
          reason: null,
        };
      }
      attempts.push({
        service,
        status,
        outcome: "invalid-profile",
        milliseconds: Date.now() - start,
      });
    } catch (error) {
      attempts.push({
        service,
        status,
        outcome:
          error.name === "TimeoutError" || error.name === "AbortError"
            ? "timeout"
            : "network-error",
        milliseconds: Date.now() - start,
      });
    }
  }
  if (notFound !== minecraftLookupEndpoints.length) {
    for (const [service, url] of [
      ["minetools", "https://api.minetools.eu/uuid/"],
      ["playerdb", "https://playerdb.co/api/player/minecraft/"],
    ]) {
      const start = Date.now();
      try {
        const r = await provider(url + encodeURIComponent(name), {
          headers: minecraftRequestHeaders,
          redirect: "manual",
          signal: AbortSignal.timeout(4500),
        });
        if (!r.ok) {
          attempts.push({
            service,
            status: r.status,
            outcome: "http-error",
            milliseconds: Date.now() - start,
          });
          await r.body?.cancel();
          continue;
        }
        const data = await r.json(),
          p =
            service === "minetools"
              ? data
              : {
                  id:
                    data.data?.player?.raw_id ||
                    data.data?.player?.id?.replaceAll("-", ""),
                  name: data.data?.player?.username,
                };
        if (
          /^[a-f0-9]{32}$/i.test(p?.id || "") &&
          p?.name?.toLowerCase() === name.toLowerCase()
        ) {
          attempts.push({
            service,
            status: r.status,
            outcome: "resolved",
            milliseconds: Date.now() - start,
          });
          return {
            profile: { id: p.id.toLowerCase(), name: p.name },
            attempts,
            reason: null,
          };
        }
        attempts.push({
          service,
          status: r.status,
          outcome: "invalid-profile",
          milliseconds: Date.now() - start,
        });
      } catch {
        attempts.push({
          service,
          status: null,
          outcome: "network-error",
          milliseconds: Date.now() - start,
        });
      }
    }
  }
  return {
    profile: null,
    reason:
      notFound === minecraftLookupEndpoints.length
        ? "not-found"
        : "unavailable",
    attempts,
  };
}
export async function minecraftVerificationHealth(name, provider = fetch) {
  const lookup = await lookupMinecraftAccount(name, provider);
  const candidates = lookup.profile
    ? await minecraftProfileCandidates(lookup.profile.id, provider)
    : [];
  let imageProbe = null;
  const candidate = candidates[0];
  if (candidate) {
    try {
      const textures = JSON.parse(
        atob(
          candidate.profile.properties.find((p) => p.name === "textures").value,
        ),
      );
      const url = new URL(textures.textures.SKIN.url);
      if (url.hostname === "textures.minecraft.net") {
        url.protocol = "https:";
        const r = await provider(url.href, {
          signal: AbortSignal.timeout(4500),
        });
        imageProbe = { status: r.status };
        await r.body?.cancel();
      }
    } catch {
      imageProbe = { status: null };
    }
  }
  return {
    ...lookup,
    textureProbe: candidates.map((c) => ({
      source: c.source,
      uuidMatches: c.profile.id === lookup.profile.id,
      signatureVerified: c.signatureVerified,
    })),
    imageProbe,
  };
}
