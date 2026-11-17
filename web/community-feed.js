// Existing Discord bot infrastructure. The website itself remains on GitHub Pages.
export const COMMUNITY_FEED_ORIGIN =
  "https://minecraft-pvp-community.draxion0.chatgpt.site";

const feedUuid =
  /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;
const feedRegions = new Set(["EU", "NA", "AS", "AU", "OC", "SA", "ME", "AF"]);
const feedDate = (value) =>
  typeof value === "string" && Number.isFinite(Date.parse(value))
    ? value
    : null;
const feedText = (value, limit = 64) => {
  if (typeof value !== "string" || !value.trim() || value.length > limit)
    throw Error("Invalid public name");
  return value;
};
const feedCount = (value) => {
  if (!Number.isSafeInteger(value) || value < 0)
    throw Error("Invalid public count");
  return value;
};
const feedRank = (rank) => {
  if (
    !rank ||
    !Number.isInteger(rank.tier) ||
    rank.tier < 1 ||
    rank.tier > 5 ||
    ![0, 1].includes(rank.pos)
  )
    throw Error("Invalid public placement");
  return { tier: rank.tier, pos: rank.pos };
};
const feedIdentity = (player) => {
  if (
    !player ||
    player.demo === true ||
    !feedUuid.test(player.uuid) ||
    !feedRegions.has(player.region)
  )
    throw Error("Invalid public player");
  return {
    uuid: player.uuid,
    name: feedText(player.name),
    region: player.region,
  };
};

export function normalizeCommunityResults(value, config) {
  if (!value || !Array.isArray(value.players) || value.players.length > 50000)
    throw Error("Invalid public rankings feed");
  const known = new Set(config.modes.map((mode) => mode.id));
  const players = value.players.map((player) => {
    const identity = feedIdentity(player);
    if (
      !player.rankings ||
      typeof player.rankings !== "object" ||
      Array.isArray(player.rankings)
    )
      throw Error("Invalid player placements");
    const rankings = Object.fromEntries(
      Object.entries(player.rankings)
        .filter(([mode]) => known.has(mode))
        .map(([mode, rank]) => {
          const current = feedRank(rank);
          const peak = feedRank({
            tier: rank.peak_tier ?? current.tier,
            pos: rank.peak_pos ?? current.pos,
          });
          return [
            mode,
            {
              ...current,
              peak_tier: peak.tier,
              peak_pos: peak.pos,
              retired: rank.retired === true,
              attained: feedDate(rank.attained),
              region: feedRegions.has(rank.region)
                ? rank.region
                : identity.region,
            },
          ];
        }),
    );
    const activePoints = Object.values(rankings).reduce(
      (sum, rank) =>
        sum +
        (rank.retired
          ? 0
          : Number(config.points[(rank.pos === 0 ? "HT" : "LT") + rank.tier]) ||
            0),
      0,
    );
    return { ...identity, rankings, points: activePoints, activePoints };
  });
  if (
    value.recent !== undefined &&
    (!Array.isArray(value.recent) || value.recent.length > 100)
  )
    throw Error("Invalid public results feed");
  const recent = (value.recent || []).map((result) => {
    if (!known.has(result.mode)) throw Error("Invalid public result mode");
    return {
      ...feedIdentity(result),
      ...feedRank(result),
      mode: result.mode,
      id: feedText(result.id, 128),
      created: feedDate(result.created),
    };
  });
  // Older bot versions expose the complete test history only while it is below
  // the 100-record cap. Never turn a capped list into an invented lifetime total.
  const completedTests =
    value.completedTests === null
      ? null
      : value.completedTests === undefined
        ? Array.isArray(value.recent) && recent.length < 100
          ? recent.length
          : null
        : feedCount(value.completedTests);
  return {
    updatedAt: feedDate(value.updatedAt),
    players,
    recent,
    completedTests,
  };
}

export function normalizeCommunityTesting(value) {
  if (!value || !Array.isArray(value.sessions) || value.sessions.length > 200)
    throw Error("Invalid public testing feed");
  return {
    updatedAt: feedDate(value.updatedAt),
    activation: value.activation === "active" ? "active" : "pending",
    sessions: value.sessions.map((session) => {
      if (
        !feedRegions.has(session.region) ||
        !["open", "paused", "closed"].includes(session.status)
      )
        throw Error("Invalid public session");
      return {
        mode: feedText(session.mode),
        region: session.region,
        status: session.status,
        waiting: feedCount(session.waiting ?? 0),
        claimed: feedCount(session.claimed ?? 0),
        capacity: feedCount(session.capacity ?? 20),
        cooldown: feedCount(session.cooldown ?? 72),
        updated: feedDate(session.updated),
      };
    }),
  };
}

export async function loadCommunityFeeds({
  config,
  fetcher = globalThis.fetch,
  allowSnapshot = true,
}) {
  const read = async (name, live) => {
    const path = live
      ? COMMUNITY_FEED_ORIGIN + "/data/" + name + ".json"
      : "./data/" + name + ".json";
    const response = await fetcher(path, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error("Public Discord feed unavailable");
    const value = await response.json();
    return name === "results"
      ? normalizeCommunityResults(value, config)
      : normalizeCommunityTesting(value);
  };
  const load = async (live) => {
    const [data, testing] = await Promise.all([
      read("results", live),
      read("testing", live),
    ]);
    return {
      data,
      testing,
      source: live ? "discord" : "snapshot",
      degraded: !live,
    };
  };
  try {
    return await load(true);
  } catch (error) {
    if (!allowSnapshot) throw error;
    return load(false);
  }
}
