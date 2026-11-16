import tierNetworkDirectory from "../config/tier-network-directory.json" with { type: "json" };
import { externalBanEmbed } from "./external-bans.mjs";
const networkProfileLabel = {
  "identity-required": "Link a Minecraft account first",
  unavailable: "Public profile unavailable",
  "identity-mismatch": "UUID mismatch · excluded",
  "profile-not-found": "No public profile returned · ban status unknown",
};
function reviewNetworkCard(profiles, external) {
  const installed = new Set(external.installedDiscordGuildIds || []);
  const fields = tierNetworkDirectory.networks.map((network) => {
    const p = profiles.find((p) => p.id === network.id),
      known = new Set(
        network.modes.filter((m) => m.guildId).map((m) => m.guildId),
      ),
      connected = [...known].filter((id) => installed.has(id)).length;
    const profile =
      p?.status === "profile-found"
        ? "**UUID matched** · " +
          p.modeCount +
          " mode(s) · " +
          (p.points ?? "—") +
          " points"
        : networkProfileLabel[p?.status] || "Not checked";
    const link =
      p?.identity === "discord-match"
        ? "Linked Discord matches"
        : p?.identity === "different-discord"
          ? "Linked Discord differs: `" +
            p.linkedDiscord +
            "` · may be stale; not proof of an alt"
          : "Linked Discord not published / not checked";
    return {
      name: network.name,
      value:
        "[Website](" +
        network.url +
        ") · " +
        (p?.apiUrl
          ? "[Public API](" + p.apiUrl + ")"
          : "[Directory](" + network.directorySource + ")") +
        "\n" +
        profile +
        "\n" +
        link +
        "\n**Discord access:** " +
        connected +
        "/" +
        known.size +
        " resolved mode server(s) installed · " +
        network.modes.length +
        " published mode links\n**Ban history:** not provided by this public profile API",
      inline: false,
    };
  });
  return {
    title: "🔎 Tier Network Coverage",
    color: 0x8b70f5,
    description:
      "Public identity records are separate from Discord ban evidence.",
    fields,
    footer: {
      text:
        "Directory snapshot " +
        tierNetworkDirectory.researchedAt +
        " · Unresolved invites are not counted as readable servers",
    },
    timestamp: external.checkedAt,
  };
}

export function reviewPresentation(
  base,
  external,
  profiles,
  target,
  view = "overview",
) {
  const allowed = ["overview", "stats", "evidence", "networks"];
  if (!allowed.includes(view)) view = "overview";
  const fields = base.embeds.flatMap((e) => e.fields || []),
    pick = (names) =>
      names.map((name) => fields.find((f) => f.name === name)).filter(Boolean);
  let embeds;
  if (view === "stats") embeds = base.embeds;
  else if (view === "evidence") {
    const embed = externalBanEmbed(external),
      reading = external.messageReading;
    if (reading) {
      embed.fields.push({
        name: "Moderation-channel Reading",
        value:
          reading.channelsRead +
          " channel(s) read · " +
          reading.unavailable +
          " unavailable\nRecent 20 messages in at most 2 matching channels per accessible network server. " +
          (reading.partial ? "Partial history; " : "") +
          "References are not current-ban confirmations.",
        inline: false,
      });
      for (const ref of reading.references.slice(0, 3))
        embed.fields.push({
          name: "Message Reference · " + ref.network,
          value:
            "[View source message](" +
            ref.url +
            ") · " +
            ref.matchedBy +
            "\n" +
            ref.excerpt,
          inline: false,
        });
    }
    embeds = [embed];
  } else if (view === "networks")
    embeds = [reviewNetworkCard(profiles, external)];
  else {
    const matched = profiles.filter((p) => p.status === "profile-found").length,
      links = profiles.filter((p) => p.identity === "discord-match").length,
      diff = profiles.filter((p) => p.identity === "different-discord").length;
    embeds = [
      {
        title: "🛡 Account Review",
        color: external.findings.length ? 0xe05f74 : 0x8b70f5,
        description: "<@" + target + "> · **Alt relationship: unknown.**",
        ...(base.embeds[0].thumbnail
          ? { thumbnail: base.embeds[0].thumbnail }
          : {}),
        fields: pick([
          "Minecraft IGN",
          "Account Age",
          "Server Tenure",
          "Local Ban",
          "Moderation Cases",
          "Testing Restrictions",
          "Official Tests",
          "Peak Placement",
          "Retest Cooldowns",
        ]),
        footer: {
          text: "Private staff review · Facts and source coverage, no automatic penalties",
        },
        timestamp: external.checkedAt,
      },
      {
        title: "🌐 Evidence Snapshot",
        color: 0x54c8c2,
        fields: [
          {
            name: "External Discord Bans",
            value: String(external.findings.length),
            inline: true,
          },
          {
            name: "Other Bot Servers",
            value: String(external.discoveredDiscordGuilds),
            inline: true,
          },
          {
            name: "Tier Profiles",
            value: matched + "/3 UUID matched",
            inline: true,
          },
          {
            name: "Published Discord Links",
            value:
              links +
              " match · " +
              diff +
              " differ · other sources unlinked/unavailable",
            inline: false,
          },
        ],
        description:
          "Use **Evidence** for source details or **Networks** for MCTiers, PvPTiers and SubTiers. A missing record does not mean a clean account.",
      },
    ];
  }
  return {
    content: "",
    allowed_mentions: { parse: [] },
    embeds,
    components: [
      {
        type: 1,
        components: allowed.map((key) => ({
          type: 2,
          style: key === view ? 1 : 2,
          label: {
            overview: "Overview",
            stats: "Full Stats",
            evidence: "Evidence",
            networks: "Networks",
          }[key],
          custom_id: "review:view:" + key + ":" + target,
        })),
      },
    ],
  };
}
