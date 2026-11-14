import config from "../config/community.json" with { type: "json" };
export async function seasonalAnalytics(i, env, store) {
  const opts = i.data.options || [],
    get = (n) => opts.find((o) => o.name === n)?.value,
    month = get("month") || new Date().toISOString().slice(0, 7),
    mode = get("mode") || "",
    region = get("region") || "";
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))
    throw Error("Use a UTC calendar month as YYYY-MM.");
  if (mode && !config.modes.some((m) => m.id === mode))
    throw Error("Choose a configured Mace mode.");
  const start = new Date(month + "-01T00:00:00.000Z"),
    end = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
    );
  const params = [
    start.toISOString(),
    end.toISOString(),
    mode,
    mode,
    region,
    region,
  ];
  const filter =
    "r.record_type='test' AND r.created>=? AND r.created<? AND (?='' OR r.mode=?) AND (?='' OR r.region=?) AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=r.id)";
  const total = await store.one(
    "SELECT count(*) tests,count(DISTINCT uuid) competitors,count(DISTINCT date(created)) active_days FROM results r WHERE " +
      filter,
    ...params,
  );
  const modes = await store.all(
      "SELECT mode,count(*) n FROM results r WHERE " +
        filter +
        " GROUP BY mode ORDER BY n DESC,mode",
      ...params,
    ),
    regions = await store.all(
      "SELECT region,count(*) n FROM results r WHERE " +
        filter +
        " GROUP BY region ORDER BY n DESC,region",
      ...params,
    );
  const changes = await store.one(
    `WITH timeline AS (SELECT r.*,lag(CASE WHEN record_type='reset' THEN NULL ELSE tier*2+pos END) OVER(PARTITION BY uuid,mode ORDER BY sequence) previous FROM results r WHERE NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=r.id)) SELECT COALESCE(sum(previous IS NULL),0) initial,COALESCE(sum(previous>tier*2+pos),0) promotions,COALESCE(sum(previous<tier*2+pos),0) demotions,COALESCE(sum(previous=tier*2+pos),0) retained FROM timeline r WHERE ` +
      filter,
    ...params,
  );
  return {
    content: "",
    embeds: [
      {
        title: "📊 MACE SEASONAL PARTICIPATION",
        color: 0x7861e8,
        description:
          "**" +
          month +
          " UTC** · " +
          (mode || "All Mace modes") +
          " · " +
          (region || "All regions") +
          "\nSeason analytics never reset permanent tiers.",
        fields: [
          {
            name: "Official evaluations",
            value: String(total.tests),
            inline: true,
          },
          {
            name: "Competitors",
            value: String(total.competitors),
            inline: true,
          },
          {
            name: "Active testing days",
            value: String(total.active_days),
            inline: true,
          },
          {
            name: "Rank outcomes",
            value:
              "First placements: " +
              changes.initial +
              "\nPromotions: " +
              changes.promotions +
              "\nDemotions: " +
              changes.demotions +
              "\nRetained: " +
              changes.retained,
          },
          {
            name: "By Mace submode",
            value:
              modes
                .map(
                  (m) =>
                    (config.modes.find((x) => x.id === m.mode)?.name ||
                      m.mode) +
                    ": " +
                    m.n,
                )
                .join("\n") || "No official evaluations.",
          },
          {
            name: "By region",
            value:
              regions.map((r) => r.region + ": " + r.n).join("\n") ||
              "No official evaluations.",
          },
        ],
        footer: {
          text: "Revoked results and administrative placement changes do not count as evaluations.",
        },
      },
    ],
    components: [],
  };
}
