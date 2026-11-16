import { externalJSON } from "./external-bans.mjs";
const tierReviewUUID = (value) =>
  String(value || "")
    .replaceAll("-", "")
    .toLowerCase();
export async function tierNetworkChecks(account, target, request = fetch) {
  const valid =
    account &&
    /^[a-f0-9]{32}$/.test(tierReviewUUID(account.uuid)) &&
    /^[A-Za-z0-9_]{3,16}$/.test(account.name);
  const uuid = valid ? tierReviewUUID(account.uuid) : "";
  const providers = [
    {
      name: "MCTiers",
      id: "mctiers",
      url: "https://mctiers.net",
      api: valid
        ? "https://mctiers.net/api/v2/profile/" + uuid + "?badges"
        : null,
    },
    {
      name: "PvPTiers",
      id: "pvptiers",
      url: "https://pvptiers.com",
      api: valid ? "https://pvptiers.com/api/profile/" + uuid : null,
    },
    {
      name: "SubTiers",
      id: "subtiers",
      url: "https://subtiers.net",
      api: valid
        ? "https://subtiers.net/api/players/" + encodeURIComponent(account.name)
        : null,
    },
  ];
  return Promise.all(
    providers.map(async (p) => {
      const result = {
        name: p.name,
        id: p.id,
        url: p.url,
        apiUrl: p.api,
        status: valid ? "unavailable" : "identity-required",
        banStatus: "not-provided",
        checkedAt: new Date().toISOString(),
      };
      if (!valid) return result;
      try {
        const response = await externalJSON(request, p.api);
        if (response.status === 404) {
          result.status = "profile-not-found";
          return result;
        }
        if (
          response.status !== 200 ||
          !response.body ||
          typeof response.body !== "object"
        )
          return result;
        const profile = response.body;
        if (tierReviewUUID(profile.uuid) !== uuid) {
          result.status = "identity-mismatch";
          return result;
        }
        result.status = "profile-found";
        result.identity = /^\d{5,22}$/.test(profile.discord_id || "")
          ? profile.discord_id === target
            ? "discord-match"
            : "different-discord"
          : "discord-not-provided";
        if (result.identity !== "discord-not-provided")
          result.linkedDiscord = profile.discord_id;
        result.modeCount =
          profile.rankings &&
          typeof profile.rankings === "object" &&
          !Array.isArray(profile.rankings)
            ? Object.values(profile.rankings).filter(
                (r) =>
                  Number.isInteger(r?.tier) &&
                  r.tier >= 1 &&
                  r.tier <= 5 &&
                  [0, 1].includes(r.pos),
              ).length
            : 0;
        if (Number.isSafeInteger(profile.points) && profile.points >= 0)
          result.points = profile.points;
        if (Number.isSafeInteger(profile.overall) && profile.overall >= 1)
          result.overall = profile.overall;
        result.badgeCount = Array.isArray(profile.badges)
          ? profile.badges.length
          : 0;
      } catch {
        /* A failed profile request supplies no ban verdict. */
      }
      return result;
    }),
  );
}
